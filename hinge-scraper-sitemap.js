#!/usr/bin/env node

/**
 * Sitemap-Based Hinge Health Content Scraper
 *
 * Uses the sitemap to find ALL content URLs, then scrapes them
 */

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { format } = require('date-fns');
const crypto = require('crypto');

// Configuration
const config = require('./config.json');
const DATA_FILE = path.join(__dirname, 'hinge-content.json');

// Stats
const stats = {
  total: 0,
  successful: 0,
  failed: 0,
  failedUrls: []
};

// Collected content
let allContent = [];

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
 * Determine content type from URL
 */
function determineContentType(url) {
  if (url.includes('/articles/')) return 'article';
  if (url.includes('/case-studies/')) return 'case-study';
  if (url.includes('/press-releases/')) return 'press-release';
  if (url.includes('/glossary/')) return 'glossary';
  if (url.includes('/support/')) return 'support';
  if (url.includes('/webinars/')) return 'webinar';
  if (url.includes('/whitepapers/')) return 'whitepaper';
  if (url.includes('/testimonials/')) return 'testimonial';
  return 'other';
}

/**
 * Determine target audience
 */
function determineAudience(content) {
  const text = (content.title + ' ' + content.metaDescription + ' ' + content.categories.join(' ')).toLowerCase();
  const audiences = [];

  if (text.match(/employer|workplace|hr|benefit/)) audiences.push('employers');
  if (text.match(/member|patient|user/)) audiences.push('members');
  if (text.match(/provider|clinician|doctor|physician|pt|physical therapist/)) audiences.push('providers');
  if (text.match(/partner|integration|api/)) audiences.push('partners');

  return audiences.length > 0 ? audiences : ['general'];
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
 * Fetch all URLs from sitemap
 */
async function fetchSitemapUrls() {
  console.log('Fetching sitemap...');

  try {
    const sitemapIndexResponse = await axios.get('https://www.hingehealth.com/sitemap-index.xml');
    const sitemapResponse = await axios.get('https://www.hingehealth.com/sitemap-0.xml');

    // Parse XML to extract URLs
    const urlMatches = sitemapResponse.data.match(/<loc>([^<]+)<\/loc>/g);

    if (!urlMatches) {
      throw new Error('No URLs found in sitemap');
    }

    const allUrls = urlMatches
      .map(match => match.replace(/<\/?loc>/g, ''))
      .filter(url => url.includes('/resources/'));

    console.log(`Found ${allUrls.length} resource URLs in sitemap`);

    // Categorize URLs
    const categorized = {};
    allUrls.forEach(url => {
      const type = determineContentType(url);
      if (!categorized[type]) categorized[type] = [];
      categorized[type].push(url);
    });

    console.log('\nContent breakdown:');
    Object.entries(categorized)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([type, urls]) => {
        console.log(`  ${type.padEnd(20)}: ${urls.length}`);
      });

    return allUrls;

  } catch (error) {
    console.error('Error fetching sitemap:', error.message);
    return [];
  }
}

/**
 * Scrape a single page
 */
async function scrapePage(page, url) {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    await sleep(500);

    const data = await page.evaluate(() => {
      const content = {};

      // Title
      content.title = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('title')?.textContent?.trim() || '';

      // Meta description
      const metaDesc = document.querySelector('meta[name="description"]') ||
                       document.querySelector('meta[property="og:description"]');
      content.metaDescription = metaDesc?.getAttribute('content')?.trim() || '';

      // Publish date
      const dateSelectors = [
        'meta[property="article:published_time"]',
        'meta[name="publish-date"]',
        'time[datetime]',
        '.publish-date',
        '.post-date'
      ];

      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content.publishDate = element.getAttribute('content') ||
                               element.getAttribute('datetime') ||
                               element.textContent?.trim();
          if (content.publishDate) break;
        }
      }

      // Categories
      content.categories = [];
      const categorySelectors = ['.category', '.tag', '.topic', '[rel="category tag"]'];
      categorySelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && !content.categories.includes(text)) {
            content.categories.push(text);
          }
        });
      });

      // Featured image
      const imgSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]'
      ];

      for (const selector of imgSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content.featuredImage = element.getAttribute('content');
          if (content.featuredImage) break;
        }
      }

      return content;
    });

    const content = {
      id: generateId(url),
      title: data.title,
      url: url,
      publishDate: extractDate(data.publishDate),
      updateDate: null,
      contentType: determineContentType(url),
      categories: data.categories || [],
      metaDescription: data.metaDescription || '',
      targetAudience: [],
      featuredImage: data.featuredImage || '',
      firstSeen: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      isNew: true
    };

    content.targetAudience = determineAudience(content);

    allContent.push(content);
    stats.successful++;

    return true;

  } catch (error) {
    stats.failed++;
    stats.failedUrls.push(url);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('HINGE HEALTH SITEMAP-BASED SCRAPER');
  console.log('='.repeat(60));

  // Fetch all URLs from sitemap
  const urls = await fetchSitemapUrls();

  if (urls.length === 0) {
    console.error('No URLs found. Exiting.');
    process.exit(1);
  }

  // Filter URLs based on config
  let filteredUrls = urls;

  // Optionally limit number of pages
  if (config.monitoring.maxPagesToScrape && urls.length > config.monitoring.maxPagesToScrape) {
    console.log(`\nLimiting to ${config.monitoring.maxPagesToScrape} pages (found ${urls.length})`);
    filteredUrls = urls.slice(0, config.monitoring.maxPagesToScrape);
  }

  console.log(`\nScraping ${filteredUrls.length} pages...\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(config.scraping.userAgent);

  try {
    // Scrape each URL
    for (let i = 0; i < filteredUrls.length; i++) {
      const url = filteredUrls[i];
      stats.total++;

      if (i % 50 === 0) {
        console.log(`Progress: ${i}/${filteredUrls.length} (${((i/filteredUrls.length)*100).toFixed(1)}%)`);
      }

      await scrapePage(page, url);

      // Save periodically
      if (i % 50 === 0 && i > 0) {
        await saveContent();
        console.log(`  ✓ Checkpoint saved (${allContent.length} pieces)`);
      }

      // Rate limiting
      await sleep(config.scraping.delayBetweenRequests || 1000);
    }

    // Final save
    await saveContent();

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total URLs processed: ${stats.total}`);
    console.log(`Successfully scraped: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
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
  } finally {
    await browser.close();
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
