# hinge-monitor
Competitive intelligence monitoring for Hinge Health

## Overview
Automated content monitoring system that tracks all published content on HingeHealth.com. Scrapes 1,300+ pages including articles, case studies, press releases, whitepapers, and reports. Optimized for fast incremental updates.

## Quick Start

### First Time Setup
```bash
npm install
npm run scrape:full  # Full scrape (~20 minutes, 1,300 pages)
npm run analyze      # Generate insights report
```

### Weekly Updates (Fast!)
```bash
npm run scrape      # Incremental update (~30 seconds, only new content)
npm run analyze     # Updated insights
```

## Features

### Incremental Updates (New!)
The scraper now supports fast incremental updates:
- **First run**: Scrapes all 1,300+ pages (~20 minutes)
- **Subsequent runs**: Only scrapes NEW content since last run (~30 seconds)
- **Full re-scrape**: Use `npm run scrape:full` when needed

### How It Works
1. Loads existing `hinge-content.json` on startup
2. Fetches latest sitemap to find all URLs
3. Compares sitemap URLs with already-scraped URLs
4. Only scrapes new/missing URLs
5. Merges new data with existing data
6. Updates `lastChecked` timestamp on all content

### Content Discovery
- Scrapes from sitemap (1,300+ URLs)
- Includes `/resources/` and `/for-organizations/` paths
- Categorizes content by type (article, case-study, press-release, etc.)
- Special "report-guide" detection for whitepapers/reports/ebooks

### Report & Guide Detection
Content is categorized as `report-guide` if the title contains:
- "report"
- "state of"
- "whitepaper"
- "ebook"
- "guide"

Example: "Hinge Health State of MSK Care 2024" → `report-guide`

## Usage

### Commands

```bash
# Incremental update (default, fast)
npm run scrape

# Full re-scrape (slow, scrapes everything)
npm run scrape:full

# Alternative: pass flag directly
node hinge-scraper-sitemap.js          # incremental
node hinge-scraper-sitemap.js --full   # full rescrape

# Analysis
npm run analyze
```

### Output

**Incremental Update Example:**
```
Loaded 1298 existing URLs from previous scrape
Found 2 new URLs (1300 total, 1298 already scraped)
Scraping 2 pages...

SCRAPING COMPLETE
Total URLs in sitemap: 1300
Newly scraped: 2
Previously scraped (kept): 1298
Total content saved: 1300
```

### Data Structure

Each content item includes:
- `id`: Unique identifier (MD5 hash of URL)
- `title`: Page title (H1 or meta title)
- `url`: Full URL
- `publishDate`: Publication date (if available)
- `contentType`: article, case-study, press-release, report-guide, etc.
- `categories`: Tags/topics
- `metaDescription`: SEO description
- `targetAudience`: employers, members, providers, partners, general
- `featuredImage`: OG image URL
- `firstSeen`: When first discovered (ISO timestamp)
- `lastChecked`: Last verification (ISO timestamp)
- `isNew`: Boolean (true for newly discovered content)

## Configuration

Edit `config.json`:

```json
{
  "monitoring": {
    "maxPagesToScrape": 2000,
    "checkFrequency": "daily"
  },
  "scraping": {
    "userAgent": "Mozilla/5.0...",
    "delayBetweenRequests": 800,
    "respectRobotsTxt": true
  }
}
```

## Files

- `hinge-scraper-sitemap.js` - Main scraper (sitemap-based, incremental)
- `hinge-analyzer.js` - Content analysis and insights
- `hinge-content.json` - Scraped data (1.0 MB)
- `config.json` - Configuration
- `.github/workflows/monitor.yml` - Automated daily monitoring

## Best Practices

### Daily Monitoring
Use the incremental scraper for daily/weekly checks:
```bash
npm run scrape && npm run analyze
```

### Monthly Full Refresh
Run a full re-scrape monthly to verify data integrity:
```bash
npm run scrape:full && npm run analyze
```

### GitHub Actions
The workflow runs `npm run scrape` (incremental) daily at 8 AM EST, automatically committing any new content discovered.

## Performance

| Task | Time | Pages |
|------|------|-------|
| First scrape | ~20 min | 1,300 |
| Incremental update (typical) | ~30 sec | 0-10 |
| Full re-scrape | ~20 min | 1,300 |

## Content Stats (Current)

- **Total**: 1,300 pages
- **Articles**: 1,024
- **Glossary**: 90
- **Support**: 72
- **Press Releases**: 69
- **Other**: 24
- **Case Studies**: 17
- **Report/Guides**: 1
- **Testimonials**: 1
- **Webinars**: 1
- **Whitepapers**: 1
