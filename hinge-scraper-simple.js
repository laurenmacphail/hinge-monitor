#!/usr/bin/env node

/**
 * Simple, Reliable Hinge Health Content Scraper
 *
 * Focuses on getting content from known sections without complex recursion
 */

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { format } = require('date-fns');
const crypto = require('crypto');

// Configuration
const config = require('./config.json');
const DATA_FILE = path.join(__dirname, 'hinge-content.json');

// Sections to scrape
const SECTIONS = [
  { url: 'https://www.hingehealth.com/resources/articles/', name: 'Articles', type: 'article' },
  { url: 'https://www.hingehealth.com/resources/case-studies/', name: 'Case Studies', type: 'case-study' },
  { url: 'https://www.hingehealth.com/resources/webinars/', name: 'Webinars', type: 'webinar' },
  { url: 'https://www.hingehealth.com/resources/eBooks/', name: 'eBooks', type: 'guide' },
];

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
 * Scrape a single article page
 */
async function scrapeArticle(page, url, contentType) {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    await sleep(1000);

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
        'meta[name="twitter:image"]',
        '.featured-image img',
        'article img'
      ];

      for (const selector of imgSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content.featuredImage = element.getAttribute('content') ||
                                 element.getAttribute('src') ||
                                 element.getAttribute('data-src');
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
      contentType: contentType,
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

    // Save after each article
    await saveContent();

    console.log(`  ✓ Saved: ${content.title.substring(0, 60)}...`);

    return true;

  } catch (error) {
    stats.failed++;
    stats.failedUrls.push(url);
    console.log(`  ✗ Failed: ${url} - ${error.message}`);
    return false;
  }
}

/**
 * Find all article links on a listing page
 */
async function findArticleLinks(page, sectionUrl) {
  const links = await page.evaluate(() => {
    const articleLinks = [];
    const anchors = document.querySelectorAll('a[href]');

    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      let url;
      try {
        url = new URL(href, window.location.href).toString();
      } catch {
        return;
      }

      // Filter for content URLs
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Must be under /resources/
      if (pathname.startsWith('/resources/')) {
        // Must have at least 3 path segments (e.g., /resources/articles/title)
        const segments = pathname.split('/').filter(s => s);
        if (segments.length >= 3) {
          // Clean URL
          const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
          if (!articleLinks.includes(cleanUrl)) {
            articleLinks.push(cleanUrl);
          }
        }
      }
    });

    return articleLinks;
  });

  return links;
}

/**
 * Check if there's a "Load More" button or pagination
 */
async function hasMorePages(page) {
  return await page.evaluate(() => {
    // Check for various pagination patterns
    const loadMoreBtn = document.querySelector('button.load-more, .load-more-button, [data-load-more]');
    const nextPageLink = document.querySelector('a.next-page, .pagination a.next, a[rel="next"]');
    const showMoreBtn = document.querySelector('button:contains("Show More"), button:contains("Load More")');

    return !!(loadMoreBtn || nextPageLink || showMoreBtn);
  });
}

/**
 * Try to load more content (click "Load More" or go to next page)
 */
async function loadMoreContent(page) {
  try {
    const clicked = await page.evaluate(() => {
      // Try clicking "Load More" button
      const loadMoreBtn = document.querySelector('button.load-more, .load-more-button, [data-load-more]');
      if (loadMoreBtn && loadMoreBtn.offsetParent !== null) {
        loadMoreBtn.click();
        return true;
      }

      // Try finding buttons with "Load More" or "Show More" text
      const buttons = Array.from(document.querySelectorAll('button'));
      const loadBtn = buttons.find(btn =>
        btn.textContent.toLowerCase().includes('load more') ||
        btn.textContent.toLowerCase().includes('show more')
      );

      if (loadBtn && loadBtn.offsetParent !== null) {
        loadBtn.click();
        return true;
      }

      return false;
    });

    if (clicked) {
      await sleep(3000); // Wait for content to load
      return true;
    }

    // Try pagination link
    const nextPage = await page.$('a.next-page, .pagination a.next, a[rel="next"]');
    if (nextPage) {
      await nextPage.click();
      await sleep(3000);
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Scrape a section with pagination support
 */
async function scrapeSection(page, section) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping section: ${section.name}`);
  console.log(`URL: ${section.url}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Visit the section page
    await page.goto(section.url, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    await sleep(2000);

    const allArticleLinks = new Set();
    let pageNum = 1;
    let hasMore = true;
    const maxPages = 10; // Prevent infinite loops

    // Collect links from all pages
    while (hasMore && pageNum <= maxPages) {
      console.log(`\nScanning page ${pageNum}...`);

      // Scroll to load lazy content
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      await sleep(1000);

      // Find article links on this page
      const pageLinks = await findArticleLinks(page, section.url);
      const newLinks = pageLinks.filter(link => !allArticleLinks.has(link));

      newLinks.forEach(link => allArticleLinks.add(link));

      console.log(`  Found ${newLinks.length} new articles on page ${pageNum} (${allArticleLinks.size} total)`);

      // Try to load more content
      if (newLinks.length > 0) {
        const loadedMore = await loadMoreContent(page);
        if (loadedMore) {
          pageNum++;
          await sleep(2000);
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const articleLinks = Array.from(allArticleLinks);
    console.log(`\nTotal articles found in ${section.name}: ${articleLinks.length}`);

    // Scrape each article
    for (let i = 0; i < articleLinks.length; i++) {
      const link = articleLinks[i];
      stats.total++;

      console.log(`\nScraping article ${i + 1}/${articleLinks.length}:`);
      console.log(`  ${link}`);

      await scrapeArticle(page, link, section.type);

      // Rate limiting
      await sleep(config.scraping.delayBetweenRequests || 1500);

      // Stop if we've hit the limit
      if (config.monitoring.maxPagesToScrape &&
          allContent.length >= config.monitoring.maxPagesToScrape) {
        console.log(`\nReached maxPagesToScrape limit (${config.monitoring.maxPagesToScrape})`);
        return;
      }
    }

  } catch (error) {
    console.log(`✗ Error scraping section ${section.name}: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('HINGE HEALTH SIMPLE CONTENT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Target: ${config.targetUrl}`);
  console.log(`Max pages: ${config.monitoring.maxPagesToScrape}`);
  console.log('='.repeat(60));

  // Launch browser
  console.log('\nLaunching browser...');
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
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Scrape each section
    for (const section of SECTIONS) {
      await scrapeSection(page, section);

      // Stop if we've hit the limit
      if (config.monitoring.maxPagesToScrape &&
          allContent.length >= config.monitoring.maxPagesToScrape) {
        break;
      }
    }

    // Final save
    await saveContent();

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total articles found: ${stats.total}`);
    console.log(`Successfully scraped: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Saved to: ${DATA_FILE}`);

    if (stats.failedUrls.length > 0) {
      console.log('\nFailed URLs:');
      stats.failedUrls.forEach(url => console.log(`  - ${url}`));
    }

    console.log('\n' + '='.repeat(60));

    // Print content breakdown
    const summary = generateSummary();
    console.log('\nContent by Type:');
    Object.entries(summary.contentByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type.padEnd(15)}: ${count}`);
      });

    console.log('\nContent by Audience:');
    Object.entries(summary.contentByAudience)
      .sort(([, a], [, b]) => b - a)
      .forEach(([audience, count]) => {
        console.log(`  ${audience.padEnd(15)}: ${count}`);
      });

    if (Object.keys(summary.topCategories).length > 0) {
      console.log('\nTop Categories:');
      Object.entries(summary.topCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([category, count]) => {
          console.log(`  ${category.padEnd(30)}: ${count}`);
        });
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
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

module.exports = { scrapeSection, scrapeArticle };
