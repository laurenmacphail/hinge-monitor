#!/usr/bin/env node

/**
 * Hinge Health Content Monitor
 *
 * This script monitors HingeHealth.com/resources for new content including:
 * - Blog posts
 * - Case studies
 * - Whitepapers
 * - Guides
 * - Videos
 * - Webinars
 *
 * It tracks changes over time and generates summary reports.
 */

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { format, parseISO, isAfter, subDays } = require('date-fns');
const crypto = require('crypto');

// Configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error('[ERROR] Could not load config.json:', error.message);
  process.exit(1);
}

// Constants
const DATA_FILE = path.join(__dirname, config.output.dataFile);
const BACKUP_DIR = path.join(__dirname, 'backups');

/**
 * Logger utility with different log levels
 */
class Logger {
  constructor(level = 'info') {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.level = this.levels[level] || 2;
  }

  log(level, message, ...args) {
    if (this.levels[level] <= this.level) {
      const timestamp = new Date().toISOString();
      console.log(`[${level.toUpperCase()}] ${timestamp} - ${message}`, ...args);
    }
  }

  error(message, ...args) { this.log('error', message, ...args); }
  warn(message, ...args) { this.log('warn', message, ...args); }
  info(message, ...args) { this.log('info', message, ...args); }
  debug(message, ...args) { this.log('debug', message, ...args); }
}

const logger = new Logger(config.output.logLevel);

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate unique ID for content piece
 */
function generateId(url) {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
}

/**
 * Load previous data if it exists
 */
async function loadPreviousData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No previous data file found. This appears to be the first run.');
      return null;
    }
    throw error;
  }
}

/**
 * Backup previous data before overwriting
 */
async function backupData() {
  if (!config.output.backupOldData) return;

  try {
    // Check if data file exists
    await fs.access(DATA_FILE);

    // Create backup directory if it doesn't exist
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Create backup with timestamp
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const backupFile = path.join(BACKUP_DIR, `hinge-content-${timestamp}.json`);

    await fs.copyFile(DATA_FILE, backupFile);
    logger.info(`Backed up previous data to ${backupFile}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Could not backup data:', error.message);
    }
  }
}

/**
 * Check robots.txt to ensure we're allowed to scrape
 */
async function checkRobotsTxt(url) {
  if (!config.scraping.respectRobotsTxt) {
    logger.info('Skipping robots.txt check (disabled in config)');
    return true;
  }

  logger.info('Checking robots.txt...');

  try {
    const robotsParser = require('robots-parser');
    const axios = require('axios');

    const robotsUrl = new URL('/robots.txt', url).toString();

    // Fetch robots.txt content
    const response = await axios.get(robotsUrl, { timeout: 10000 });

    // Parse robots.txt
    const robots = robotsParser(robotsUrl, response.data);

    // Check if we can fetch the URL
    const userAgent = config.scraping.userAgent || 'HingeMonitor';
    const canFetch = robots.isAllowed(url, userAgent);

    if (!canFetch) {
      logger.error(`robots.txt disallows scraping ${url}`);
      return false;
    }

    logger.info('robots.txt check passed');
    return true;
  } catch (error) {
    logger.warn('Could not check robots.txt:', error.message);
    logger.warn('Proceeding with caution...');
    return true;
  }
}

/**
 * Extract date from various formats
 */
function extractDate(dateString) {
  if (!dateString) return null;

  try {
    // Try to parse ISO format first
    const date = parseISO(dateString);
    if (date && !isNaN(date.getTime())) {
      return format(date, 'yyyy-MM-dd');
    }
  } catch (error) {
    // Ignore parsing errors
  }

  // Try to match common date patterns
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,  // 2024-01-06
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // 1/6/2024
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}),? (\d{4})/i  // January 6, 2024
  ];

  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      try {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch (error) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Determine content type from URL and metadata
 */
function determineContentType(url, metadata = {}) {
  const urlLower = url.toLowerCase();
  const titleLower = (metadata.title || '').toLowerCase();

  if (urlLower.includes('/blog/') || metadata.type === 'blog') return 'blog';
  if (urlLower.includes('/case-stud') || titleLower.includes('case study')) return 'case-study';
  if (urlLower.includes('/whitepaper') || titleLower.includes('whitepaper')) return 'whitepaper';
  if (urlLower.includes('/guide') || titleLower.includes('guide')) return 'guide';
  if (urlLower.includes('/video') || metadata.type === 'video') return 'video';
  if (urlLower.includes('/webinar') || titleLower.includes('webinar')) return 'webinar';

  return 'article';
}

/**
 * Determine target audience from content
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
 * Scrape content from a single page
 */
async function scrapePage(page, url) {
  logger.debug(`Scraping page: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: config.scraping.waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
      timeout: config.scraping.timeout
    });

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 5000 });

    // Extract content data from the page
    const contentData = await page.evaluate(() => {
      const content = {};

      // Extract title
      content.title = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('title')?.textContent?.trim() ||
                     '';

      // Extract meta description
      const metaDesc = document.querySelector('meta[name="description"]') ||
                       document.querySelector('meta[property="og:description"]');
      content.metaDescription = metaDesc?.getAttribute('content')?.trim() || '';

      // Extract publish date from various sources
      const dateSelectors = [
        'meta[property="article:published_time"]',
        'meta[name="publish-date"]',
        'meta[name="date"]',
        'time[datetime]',
        '.publish-date',
        '.post-date',
        '.article-date'
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

      // Extract update date
      const updateSelectors = [
        'meta[property="article:modified_time"]',
        'meta[name="last-modified"]',
        '.update-date',
        '.modified-date'
      ];

      for (const selector of updateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content.updateDate = element.getAttribute('content') ||
                              element.getAttribute('datetime') ||
                              element.textContent?.trim();
          if (content.updateDate) break;
        }
      }

      // Extract categories/tags
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

      // Extract featured image
      const imgSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        '.featured-image img',
        'article img',
        '.hero-image img'
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

      // Extract content type from page metadata
      const typeEl = document.querySelector('meta[property="og:type"]');
      content.type = typeEl?.getAttribute('content');

      return content;
    });

    return contentData;
  } catch (error) {
    logger.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

/**
 * Extract links from a page
 */
async function extractLinksFromPage(page, currentUrl, baseUrl) {
  try {
    await page.goto(currentUrl, {
      waitUntil: config.scraping.waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
      timeout: config.scraping.timeout
    });

    // Wait a bit for dynamic content to load
    await sleep(2000);

    // Scroll to load lazy-loaded content
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

    // Extract all links from the page
    const pageLinks = await page.evaluate((base) => {
      const links = [];
      const anchors = document.querySelectorAll('a[href]');

      anchors.forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        // Convert relative URLs to absolute
        let url;
        try {
          url = new URL(href, base).toString();
        } catch {
          return;
        }

        // Only include links that start with /resources/
        const urlObj = new URL(url);
        if (urlObj.pathname.startsWith('/resources/')) {
          // Clean up URL - remove query params and hash
          const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

          // Exclude certain patterns
          if (!cleanUrl.includes('#') &&
              !cleanUrl.includes('?') &&
              !cleanUrl.endsWith('/resources') &&
              !cleanUrl.endsWith('/resources/')) {
            links.push(cleanUrl);
          }
        }
      });

      return links;
    }, baseUrl);

    return pageLinks;
  } catch (error) {
    logger.warn(`Error extracting links from ${currentUrl}:`, error.message);
    return [];
  }
}

/**
 * Determine if a URL is a content page (not a listing/index page)
 */
function isContentPage(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Listing pages typically end with these patterns
  const listingPatterns = [
    '/resources/',
    '/articles/',
    '/blog/',
    '/case-studies/',
    '/guides/',
    '/whitepapers/',
    '/webinars/',
    '/eBooks/',
    '/clinical-studies/'
  ];

  // Check if it's exactly a listing page
  for (const pattern of listingPatterns) {
    if (pathname === pattern || pathname === pattern.slice(0, -1)) {
      return false;
    }
  }

  // If path has content after a listing folder, it's likely a content page
  // e.g., /resources/articles/something/ or /resources/blog/post-title/
  const pathSegments = pathname.split('/').filter(s => s);

  // At least 2 segments (e.g., resources/articles/title)
  if (pathSegments.length >= 3) {
    return true;
  }

  return false;
}

/**
 * Calculate URL depth relative to base
 */
function getUrlDepth(url, baseUrl) {
  const urlPath = new URL(url).pathname;
  const basePath = new URL(baseUrl).pathname;

  const urlSegments = urlPath.split('/').filter(s => s);
  const baseSegments = basePath.split('/').filter(s => s);

  return urlSegments.length - baseSegments.length;
}

/**
 * Recursively discover all content URLs from the resources section
 */
async function discoverContentUrls(page, baseUrl) {
  logger.info('Starting recursive crawl of /resources section...');

  const visited = new Set();
  const toVisit = [baseUrl];
  const contentUrls = new Set();
  const listingUrls = new Set();

  const maxDepth = 3;
  let crawlCount = 0;

  while (toVisit.length > 0 && crawlCount < config.monitoring.maxPagesToScrape * 3) {
    const currentUrl = toVisit.shift();

    // Skip if already visited
    if (visited.has(currentUrl)) continue;

    // Check depth
    const depth = getUrlDepth(currentUrl, baseUrl);
    if (depth > maxDepth) continue;

    visited.add(currentUrl);
    crawlCount++;

    // Determine if this is a content page or listing page
    const isContent = isContentPage(currentUrl);

    if (isContent) {
      contentUrls.add(currentUrl);
    } else {
      listingUrls.add(currentUrl);
    }

    // Progress indicator
    console.log(`[CRAWL] Found ${contentUrls.size} content pages, ${listingUrls.size} listing pages | Visiting: ${currentUrl.substring(0, 80)}...`);

    // Extract links from this page
    const links = await extractLinksFromPage(page, currentUrl, baseUrl);

    // Add new links to visit queue
    for (const link of links) {
      if (!visited.has(link) && !toVisit.includes(link)) {
        toVisit.push(link);
      }
    }

    // Rate limiting
    await sleep(config.scraping.delayBetweenRequests);

    // Stop if we've found enough content
    if (config.monitoring.maxPagesToScrape &&
        contentUrls.size >= config.monitoring.maxPagesToScrape) {
      logger.info(`Reached maxPagesToScrape limit (${config.monitoring.maxPagesToScrape})`);
      break;
    }
  }

  logger.info(`Crawl complete! Visited ${visited.size} pages total`);
  logger.info(`Found ${contentUrls.size} content pages and ${listingUrls.size} listing pages`);

  return Array.from(contentUrls);
}

/**
 * Main scraping function
 */
async function scrapeContent() {
  logger.info('Starting Hinge Health content monitor...');
  logger.info(`Target: ${config.targetUrl}`);

  // Check robots.txt
  const canScrape = await checkRobotsTxt(config.targetUrl);
  if (!canScrape) {
    logger.error('Scraping not allowed by robots.txt. Exiting.');
    process.exit(1);
  }

  // Launch browser
  logger.info('Launching browser...');
  const browser = await puppeteer.launch({
    headless: config.scraping.headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--single-process'
    ]
  });

  const page = await browser.newPage();

  // Set user agent
  await page.setUserAgent(config.scraping.userAgent);

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Discover all content URLs
    const contentUrls = await discoverContentUrls(page, config.targetUrl);
    logger.info(`Found ${contentUrls.length} content pieces to process`);

    const allContent = [];
    let processed = 0;

    // Scrape each content piece
    for (const url of contentUrls) {
      processed++;
      logger.info(`Processing ${processed}/${contentUrls.length}: ${url}`);

      const contentData = await scrapePage(page, url);

      if (contentData) {
        const content = {
          id: generateId(url),
          title: contentData.title,
          url: url,
          publishDate: extractDate(contentData.publishDate),
          updateDate: extractDate(contentData.updateDate),
          contentType: determineContentType(url, contentData),
          categories: contentData.categories || [],
          metaDescription: contentData.metaDescription || '',
          targetAudience: [],
          featuredImage: contentData.featuredImage || '',
          firstSeen: new Date().toISOString(),
          lastChecked: new Date().toISOString()
        };

        // Determine target audience
        content.targetAudience = determineAudience(content);

        allContent.push(content);
      }

      // Rate limiting: wait between requests
      if (processed < contentUrls.length) {
        await sleep(config.scraping.delayBetweenRequests);
      }
    }

    logger.info(`Successfully scraped ${allContent.length} content pieces`);
    return allContent;

  } finally {
    await browser.close();
    logger.info('Browser closed');
  }
}

/**
 * Compare with previous data and identify new content
 */
function compareWithPrevious(currentContent, previousData) {
  if (!previousData || !previousData.content) {
    logger.info('No previous data to compare. All content marked as new.');
    return currentContent.map(item => ({ ...item, isNew: true }));
  }

  const previousUrls = new Set(previousData.content.map(item => item.url));
  const newCount = currentContent.filter(item => !previousUrls.has(item.url)).length;

  logger.info(`Identified ${newCount} new content pieces`);

  // Mark new content and preserve firstSeen dates
  return currentContent.map(item => {
    const isNew = !previousUrls.has(item.url);
    const previousItem = previousData.content.find(prev => prev.url === item.url);

    return {
      ...item,
      isNew: isNew,
      firstSeen: previousItem ? previousItem.firstSeen : item.firstSeen
    };
  });
}

/**
 * Generate summary statistics
 */
function generateSummary(content) {
  const now = new Date();
  const recentDate = subDays(now, config.analysis.recentContentDays);

  const summary = {
    totalContent: content.length,
    newContentCount: content.filter(item => item.isNew).length,
    recentContent: content.filter(item => {
      if (!item.firstSeen) return false;
      const firstSeenDate = parseISO(item.firstSeen);
      return isAfter(firstSeenDate, recentDate);
    }).length,
    contentByType: {},
    contentByAudience: {},
    topCategories: {}
  };

  // Count by type
  content.forEach(item => {
    summary.contentByType[item.contentType] = (summary.contentByType[item.contentType] || 0) + 1;
  });

  // Count by audience
  content.forEach(item => {
    item.targetAudience.forEach(audience => {
      summary.contentByAudience[audience] = (summary.contentByAudience[audience] || 0) + 1;
    });
  });

  // Count categories
  content.forEach(item => {
    item.categories.forEach(category => {
      summary.topCategories[category] = (summary.topCategories[category] || 0) + 1;
    });
  });

  // Sort categories by frequency
  summary.topCategories = Object.fromEntries(
    Object.entries(summary.topCategories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
  );

  return summary;
}

/**
 * Save data to file
 */
async function saveData(content, summary) {
  const output = {
    lastUpdated: new Date().toISOString(),
    totalContent: content.length,
    content: content,
    summary: summary
  };

  const jsonString = config.output.prettyPrint
    ? JSON.stringify(output, null, 2)
    : JSON.stringify(output);

  await fs.writeFile(DATA_FILE, jsonString, 'utf8');
  logger.info(`Data saved to ${DATA_FILE}`);
}

/**
 * Print summary to console
 */
function printSummary(summary) {
  console.log('\n' + '='.repeat(50));
  console.log('HINGE HEALTH CONTENT MONITOR - SUMMARY');
  console.log('='.repeat(50));
  console.log(`\nTotal Content Pieces: ${summary.totalContent}`);
  console.log(`New Content (this run): ${summary.newContentCount}`);
  console.log(`Recent Content (last ${config.analysis.recentContentDays} days): ${summary.recentContent}`);

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

  console.log('\nTop Categories:');
  Object.entries(summary.topCategories)
    .slice(0, 10)
    .forEach(([category, count]) => {
      console.log(`  ${category.padEnd(30)}: ${count}`);
    });

  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load previous data
    const previousData = await loadPreviousData();

    // Backup existing data
    await backupData();

    // Scrape current content
    const currentContent = await scrapeContent();

    // Compare with previous
    const contentWithComparison = compareWithPrevious(currentContent, previousData);

    // Generate summary
    const summary = generateSummary(contentWithComparison);

    // Save to file
    await saveData(contentWithComparison, summary);

    // Print summary
    printSummary(summary);

    logger.info('Monitor completed successfully!');
    process.exit(0);

  } catch (error) {
    logger.error('Fatal error:', error.message);
    logger.debug(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { scrapeContent, compareWithPrevious, generateSummary };
