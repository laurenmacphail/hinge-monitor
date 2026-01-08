#!/usr/bin/env node

/**
 * Sitemap-Based Hinge Health Content Scraper
 *
 * Uses the sitemap to find ALL content URLs, then scrapes them
 * Uses axios + cheerio (no Puppeteer needed - just static HTML parsing)
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { format } = require('date-fns');
const crypto = require('crypto');

// Configuration
const config = require('./config.json');
const DATA_FILE = path.join(__dirname, 'hinge-content.json');

// Parse command-line flags
const args = process.argv.slice(2);
const FORCE_RESCRAPE = args.includes('--full') || args.includes('--force');

// Stats
const stats = {
  total: 0,
  successful: 0,
  failed: 0,
  failedUrls: [],
  skipped: 0
};

// Collected content
let allContent = [];
let existingContent = new Map(); // URL -> content mapping

// Create axios instance with proper headers
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': config.scraping.userAgent || 'Mozilla/5.0 (compatible; ContentMonitor/1.0)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'no-cache',
  }
});

/**
 * Load existing content from file
 */
async function loadExistingContent() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);

    if (parsed.content && Array.isArray(parsed.content)) {
      parsed.content.forEach(item => {
        existingContent.set(item.url, item);
      });
      console.log(`Loaded ${existingContent.size} existing URLs from previous scrape`);
    }
  } catch (error) {
    console.log('No existing content file found - starting fresh scrape');
  }
}

/**
 * Generate unique ID
 */
function generateId(url) {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
}

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Save content incrementally
 */
async function saveContent() {
  const output = {
    lastUpdated: new Date().toISOString(),
    totalContent: allContent.length,
    content: allContent,
    summary: generateSummary()
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(output, null, 2), 'utf8');
}

/**
 * Generate summary
 */
function generateSummary() {
  const summary = {
    totalContent: allContent.length,
    newContentCount: allContent.filter(item => item.isNew).length,
    contentByType: {},
    contentByAudience: {},
    topCategories: {}
  };

  allContent.forEach(item => {
    summary.contentByType[item.contentType] = (summary.contentByType[item.contentType] || 0) + 1;

    item.targetAudience.forEach(audience => {
      summary.contentByAudience[audience] = (summary.contentByAudience[audience] || 0) + 1;
    });

    item.categories.forEach(category => {
      summary.topCategories[category] = (summary.topCategories[category] || 0) + 1;
    });
  });

  return summary;
}

/**
 * Determine content type from URL (will be refined by title later)
 */
function determineContentType(url) {
  if (url.includes('/articles/')) return 'article';
  if (url.includes('/case-studies/')) return 'case-study';
  if (url.includes('/press-releases/')) return 'press-release';
  if (url.includes('/glossary/')) return 'glossary';
  if (url.includes('/support/')) return 'support';
  if (url.includes('/webinars/') || url.includes('-webinar/')) return 'webinar';
  if (url.includes('/whitepapers/')) return 'report-guide'; // Whitepapers are reports/guides
  if (url.includes('/testimonials/')) return 'testimonial';
  if (url.includes('/for-organizations/')) return 'for-organizations'; // Will be refined
  if (url.includes('/acquisition/')) return 'acquisition';
  if (url.includes('/for-individuals/')) return 'for-individuals';
  return 'other';
}

/**
 * Determine if content is a report/guide based on title and URL
 */
function isReportOrGuide(title, url) {
  const titleLower = (title || '').toLowerCase();
  const urlLower = (url || '').toLowerCase();

  const keywords = ['report', 'state of', 'whitepaper', 'ebook', 'guide', 'study'];

  return keywords.some(keyword =>
    titleLower.includes(keyword) || urlLower.includes(keyword)
  );
}

/**
 * Determine target audience
 */
function determineAudience(content) {
  const text = (content.title + ' ' + content.metaDescription + ' ' + content.categories.join(' ')).toLowerCase();
  const url = content.url.toLowerCase();
  const audiences = [];

  // HEALTH PLAN CONTENT - Payers, insurance, health plans
  const healthPlanPatterns = /\b(health plan|payer|insurance|cigna|aetna|anthem|humana|united healthcare|bcbs|blue cross|value.based care|population health|medical spend|health system|healthcare system|integrated care|care coordination)/;
  if (text.match(healthPlanPatterns) || url.includes('/health-plans') || url.includes('/payers')) {
    audiences.push('health plans');
  }

  // EMPLOYER CONTENT - Workplace, HR, employee benefits
  const employerPatterns = /\b(employer|workplace|hr\b|benefits? leader|cost saving|reduces cost|roi\b|return on investment|total cost|claims|absenteeism|employee (engagement|well.?being|wellness|health program)|workforce|total rewards|beloved benefit|employee.focused|lower cost.*productivity|engagement.*cost)/;
  // Case studies, whitepapers, reports, guides are B2B (employer or health plan)
  const isB2BContent = ['case-study', 'whitepaper', 'report-guide'].includes(content.contentType);

  if (text.match(employerPatterns) || url.includes('/employers')) {
    audiences.push('employers');
  } else if (isB2BContent && !audiences.includes('health plans')) {
    // If it's B2B content but not health plan, default to employer
    audiences.push('employers');
  }

  // PROVIDER CONTENT - For clinicians/PTs (very specific patterns)
  const providerPatterns = /(for providers|for clinicians|provider network|provider portal|clinical guidelines|join our team|provider resources|provider integration|hingeselect|provider benefit|providers benefit|for physical therapist|clinician dashboard)/;
  if (text.match(providerPatterns) || url.includes('/for-providers')) {
    audiences.push('providers');
  }

  // MEMBER CONTENT - Individuals, diagnoses, symptoms, pain, health education
  const memberPatterns = /(how to|your (care|treatment|exercises|sleep|pain|body|health|knee|back|shoulder|hip|neck)|message your|use the app|exercises for|symptoms? of|symptom|treatment for|living with|managing (your|headache|pain)|self-care|pain relief|member|patient|individual|patient guide|for you|download.{0,10}app|definition and what it is|enso|kegel|pelvic|pain relief device|improving your|managing your|sleep position|pain cycle|bladder habit|breathing exercise|mindfulness|yoga|stretching|warm.up|nutrition|veggie|walking program|lifting|pregnancy|caregiver|tired of pain|breaking the|food for|tips for|ways to|strategies for your|rethink your pain|chronic pain|belly band|incontinence|water intake|stairs and|tennis player|fall leaves|beginner|full.body|resistance|portion|daily walking|diagnosis|diagnose|condition|injury|ache|aching|sore|arthritis|sciatica|tendonitis|fracture|sprain|strain|inflammation|therapy for|relief for|cope with|deal with)/;
  // Glossary, support, and for-individuals are always for members
  if (text.match(memberPatterns) || url.includes('/members') || url.includes('/for-individuals') ||
      content.contentType === 'support' || content.contentType === 'glossary' ||
      content.contentType === 'for-individuals') {
    audiences.push('members');
  }

  // PARTNER CONTENT - Only explicit partnerships (very narrow)
  const partnerPatterns = /\b(announces partnership|partner program|technology partner|strategic alliance|collaboration with|partnering with)/;
  if (text.match(partnerPatterns) || url.includes('/partners')) {
    audiences.push('partners');
  }

  // If no specific audience detected, mark as general
  if (audiences.length === 0) {
    return ['general'];
  }

  return audiences;
}

/**
 * Extract date from string
 */
function extractDate(dateString) {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (date && !isNaN(date.getTime())) {
      return format(date, 'yyyy-MM-dd');
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Fetch all URLs from sitemap with lastmod dates
 */
async function fetchSitemapUrls() {
  console.log('Fetching sitemap...');

  try {
    const sitemapResponse = await httpClient.get('https://www.hingehealth.com/sitemap-0.xml');

    // Parse XML to extract URLs and lastmod dates
    const urlPattern = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g;
    const urlsWithDates = [];
    let match;

    while ((match = urlPattern.exec(sitemapResponse.data)) !== null) {
      const url = match[1];
      const lastmod = match[2] || null;

      // Filter for our content
      if (url.includes('/resources/') ||
          url.includes('/for-organizations/') ||
          url.includes('/acquisition/') ||
          url.includes('/for-individuals/') ||
          url.includes('-webinar/')) {
        urlsWithDates.push({ url, lastmod });
      }
    }

    // Also count URLs that have lastmod dates
    const withDates = urlsWithDates.filter(item => item.lastmod).length;
    console.log(`Found ${urlsWithDates.length} resource URLs in sitemap (${withDates} with dates)`);

    // Categorize URLs
    const categorized = {};
    urlsWithDates.forEach(item => {
      const type = determineContentType(item.url);
      if (!categorized[type]) categorized[type] = [];
      categorized[type].push(item.url);
    });

    console.log('\nContent breakdown:');
    Object.entries(categorized)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([type, urls]) => {
        console.log(`  ${type.padEnd(20)}: ${urls.length}`);
      });

    return urlsWithDates;

  } catch (error) {
    console.error('Error fetching sitemap:', error.message);
    return [];
  }
}

/**
 * Scrape a single page using axios + cheerio (no Puppeteer!)
 */
async function scrapePage(url, sitemapLastmod = null) {
  try {
    // Fetch the HTML
    const response = await httpClient.get(url);
    const html = response.data;

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Extract data
    const data = {};

    // Title
    data.title = $('h1').first().text().trim() ||
                 $('title').first().text().trim() || '';

    // Meta description
    data.metaDescription = $('meta[name="description"]').attr('content')?.trim() ||
                          $('meta[property="og:description"]').attr('content')?.trim() || '';

    // Publish date
    data.publishDate = $('meta[property="article:published_time"]').attr('content') ||
                      $('meta[name="publish-date"]').attr('content') ||
                      $('time[datetime]').first().attr('datetime') ||
                      $('time[datetime]').first().text().trim() ||
                      $('.publish-date').first().text().trim() ||
                      $('.post-date').first().text().trim() ||
                      null;

    // Categories
    data.categories = [];
    $('.category, .tag, .topic, [rel="category tag"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !data.categories.includes(text)) {
        data.categories.push(text);
      }
    });

    // Featured image
    data.featuredImage = $('meta[property="og:image"]').attr('content') ||
                        $('meta[name="twitter:image"]').attr('content') || '';

    // Determine content type (refine based on title)
    let contentType = determineContentType(url);

    // Refine for-organizations content based on title and URL
    if (contentType === 'for-organizations') {
      if (isReportOrGuide(data.title, url)) {
        contentType = 'report-guide';
      } else {
        contentType = 'other';
      }
    }

    // Check if this URL already exists
    const existing = existingContent.get(url);

    // Use sitemap lastmod date if available, otherwise try to extract from page
    const publishDate = sitemapLastmod ?
                       extractDate(sitemapLastmod) :
                       extractDate(data.publishDate);

    const content = {
      id: existing ? existing.id : generateId(url),
      title: data.title,
      url: url,
      publishDate: publishDate,
      updateDate: null,
      contentType: contentType,
      categories: data.categories || [],
      metaDescription: data.metaDescription || '',
      targetAudience: [],
      featuredImage: data.featuredImage || '',
      firstSeen: existing ? existing.firstSeen : new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      isNew: existing ? false : true
    };

    content.targetAudience = determineAudience(content);

    allContent.push(content);
    stats.successful++;

    return true;

  } catch (error) {
    stats.failed++;
    stats.failedUrls.push(url);
    console.error(`  ✗ Failed to scrape ${url}: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('HINGE HEALTH SITEMAP-BASED SCRAPER');
  console.log('Using axios + cheerio (no Puppeteer)');
  console.log('='.repeat(60));

  // Load existing content
  await loadExistingContent();

  if (FORCE_RESCRAPE) {
    console.log('--full/--force flag detected: Re-scraping all URLs\n');
  }

  // Fetch all URLs from sitemap
  const urls = await fetchSitemapUrls();

  if (urls.length === 0) {
    console.error('No URLs found. Exiting.');
    process.exit(1);
  }

  // Filter URLs based on config and existing content
  let filteredUrls = urls;

  // Skip already-scraped URLs unless --force flag is used
  if (!FORCE_RESCRAPE && existingContent.size > 0) {
    const newUrls = urls.filter(item => !existingContent.has(item.url));
    console.log(`\nFound ${newUrls.length} new URLs (${urls.length} total, ${urls.length - newUrls.length} already scraped)`);
    filteredUrls = newUrls;
  }

  // Optionally limit number of pages
  if (config.monitoring.maxPagesToScrape && filteredUrls.length > config.monitoring.maxPagesToScrape) {
    console.log(`Limiting to ${config.monitoring.maxPagesToScrape} pages (found ${filteredUrls.length})`);
    filteredUrls = filteredUrls.slice(0, config.monitoring.maxPagesToScrape);
  }

  console.log(`\nScraping ${filteredUrls.length} pages...\n`);

  try {
    // Scrape each URL
    for (let i = 0; i < filteredUrls.length; i++) {
      const item = filteredUrls[i];
      const url = item.url;
      const lastmod = item.lastmod;
      stats.total++;

      if (i % 50 === 0) {
        console.log(`Progress: ${i}/${filteredUrls.length} (${((i/filteredUrls.length)*100).toFixed(1)}%)`);
      }

      await scrapePage(url, lastmod);

      // Save periodically
      if (i % 50 === 0 && i > 0) {
        await saveContent();
        console.log(`  ✓ Checkpoint saved (${allContent.length} pieces)`);
      }

      // Rate limiting
      await sleep(config.scraping.delayBetweenRequests || 1000);
    }

    // Merge with existing content (for URLs we didn't re-scrape)
    if (!FORCE_RESCRAPE && existingContent.size > 0) {
      const scrapedUrls = new Set(allContent.map(item => item.url));
      existingContent.forEach((item, url) => {
        if (!scrapedUrls.has(url)) {
          // Update lastChecked but keep everything else the same
          item.lastChecked = new Date().toISOString();
          allContent.push(item);
          stats.skipped++;
        }
      });
    }

    // Final save
    await saveContent();

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total URLs in sitemap: ${urls.length}`);
    console.log(`Newly scraped: ${stats.successful}`);
    console.log(`Previously scraped (kept): ${stats.skipped}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Total content saved: ${allContent.length}`);
    console.log(`New Content: ${allContent.filter(item => item.isNew).length}`);
    console.log(`Saved to: ${DATA_FILE}`);

    if (stats.failedUrls.length > 0 && stats.failedUrls.length <= 20) {
      console.log('\nFailed URLs:');
      stats.failedUrls.forEach(url => console.log(`  - ${url}`));
    } else if (stats.failedUrls.length > 20) {
      console.log(`\n${stats.failedUrls.length} URLs failed (too many to list)`);
    }

    console.log('\n' + '='.repeat(60));

    // Print content breakdown
    const summary = generateSummary();
    console.log('\nContent by Type:');
    Object.entries(summary.contentByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type.padEnd(20)}: ${count}`);
      });

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchSitemapUrls, scrapePage };
