# Hinge Health Competitive Intelligence Dashboard

## 🎯 Overview

Complete competitive intelligence system for monitoring Hinge Health's content strategy. Includes:
- **Scraper**: Automated content collection from HingeHealth.com
- **Analyzers**: Strategic intelligence generation
- **Dashboard**: Interactive React visualization
- **Automation Ready**: GitHub Actions integration

## 📊 What You Get

### Intelligence Sections
1. **Strategic Priorities** - Top 10 focus areas with subtopic breakdowns
2. **Trending Analysis** - UP/DOWN topics with examples
3. **Audience Strategy** - Breakdown + provider deep dive (73% PTs!)
4. **Messaging Analysis** - What they're saying
5. **Content Campaigns** - Major strategic pushes detected
6. **Content Gaps** - Your opportunities (15 topics with 0 coverage)
7. **Quality Metrics** - Meta descriptions, images, etc.
8. **Key Strategic Insights** - 5 major takeaways
9. **Raw Data** - Full content table with filters

### Key Findings
- **AI EVERYWHERE**: 673 pieces (50.5%) - Their core differentiator
- **PROVIDER-FIRST**: 73% target PTs, NOT physicians
- **WOMEN'S HEALTH EXPANSION**: Pelvic floor +3.3%
- **OUTCOMES > COST**: Moving upmarket
- **15 CONTENT GAPS**: Major opportunities

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Initial Scrape
```bash
npm run scrape
```
Scrapes all content from HingeHealth.com (takes ~20 minutes for 1,332 URLs)

### 3. Generate Intelligence
```bash
npm run generate-intelligence
```
Analyzes content and creates `hinge-intelligence.json` (923 KB)

### 4. View Dashboard
```bash
# Option 1: Open test-dashboard.html in browser
open test-dashboard.html

# Option 2: Start local server
python3 -m http.server 8000
# Then visit: http://localhost:8000/test-dashboard.html
```

## 📋 Available Commands

### Data Collection
```bash
npm run scrape              # Incremental update (only new URLs)
npm run scrape:full         # Full re-scrape (all 1,332 URLs)
```

### Analysis & Reports
```bash
npm run analyze             # Full detailed analysis (console output)
npm run report              # Formatted executive report
npm run generate-intelligence  # Generate dashboard JSON
npm run build-all           # Scrape + Generate intelligence
```

## 📁 File Structure

```
hinge-monitor/
├── hinge-scraper-sitemap.js       # Scraper (sitemap-based)
├── hinge-analyzer.js              # Detailed analyzer
├── hinge-report.js                # Formatted report generator
├── hinge-intelligence-generator.js # Dashboard data generator
├── hinge-dashboard.jsx            # React dashboard
├── hinge-content.json             # Raw scraped data (1.0 MB)
├── hinge-intelligence.json        # Intelligence data (923 KB)
├── test-dashboard.html            # Dashboard test page
├── package.json                   # npm scripts
└── config.json                    # Scraper configuration
```

## 🔄 Weekly Workflow

### Manual (Local)
```bash
# Every week:
npm run scrape              # Get new content (~30 seconds)
npm run generate-intelligence  # Update intelligence
# Open dashboard in browser
```

### Automated (GitHub Actions)
```yaml
# .github/workflows/scrape-and-deploy.yml
# Runs weekly:
# 1. Scrape content
# 2. Generate intelligence
# 3. Deploy to GitHub Pages
# Dashboard auto-updates from:
# https://[username].github.io/hinge-monitor/data/hinge-intelligence.json
```

## 🎨 Dashboard Features

### Interactive Visualizations
- **Bar charts**: Strategic priorities, campaigns
- **Pie charts**: Audience breakdown, provider deep dive
- **Line charts**: Trending analysis
- **Tables**: Searchable, filterable raw data

### Navigation
- **10 tabs**: Each intelligence section
- **Expandable sections**: Click for details
- **Real examples**: Actual content titles throughout
- **External links**: Click to view original content

### Configuration
Dashboard fetches from configurable URL:
```javascript
// In hinge-dashboard.jsx:
const DATA_SOURCE_URL = process.env.REACT_APP_DATA_URL || './hinge-intelligence.json';

// For GitHub Pages:
REACT_APP_DATA_URL=https://[username].github.io/hinge-monitor/data/hinge-intelligence.json
```

## 📈 Intelligence Data Structure

The `hinge-intelligence.json` file contains:

```json
{
  "lastUpdated": "2026-01-07...",
  "metadata": {
    "totalPieces": 1332,
    "dateRange": {...},
    "withDatesPct": "88.8%"
  },
  "strategicPriorities": [
    {
      "rank": 1,
      "topic": "ai",
      "count": 673,
      "percentage": "50.5%",
      "interpretation": "...",
      "subtopics": [...],
      "examples": [...]
    }
  ],
  "trendingUp": [...],
  "trendingDown": [...],
  "audienceStrategy": {...},
  "messaging": {...},
  "campaigns": [...],
  "contentGaps": {...},
  "qualityMetrics": {...},
  "keyInsights": [...],
  "rawContent": [...]
}
```

## 🔧 Customization

### Update Scraper
Edit `config.json`:
```json
{
  "monitoring": {
    "maxPagesToScrape": null,
    "checkInterval": "0 0 * * 1"
  },
  "scraping": {
    "delayBetweenRequests": 1000,
    "userAgent": "..."
  }
}
```

### Add Strategic Topics
Edit `hinge-intelligence-generator.js`:
```javascript
const STRATEGIC_TOPICS = {
  clinical: ['chronic pain', 'back pain', ...],
  business: ['employer', 'roi', ...],
  technology: ['ai', 'digital health', ...],
  market: ['musculoskeletal', 'msk', ...]
};
```

### Dashboard Styling
Edit styles object in `hinge-dashboard.jsx`

## 🚨 Troubleshooting

### "Could not load intelligence data"
```bash
# Generate the intelligence file:
npm run generate-intelligence
```

### Dashboard not updating
```bash
# Hard refresh browser:
# Mac: Cmd+Shift+R
# Windows: Ctrl+Shift+R

# Or clear cache and reload
```

### Scraper errors
```bash
# Check internet connection
# Verify HingeHealth.com is accessible
# Try: npm run scrape:full --force
```

## 📊 Example Output

### Strategic Priorities (Top 3)
1. **AI** - 673 pieces (50.5%) - Core differentiator
   - AI + care: 278 pieces (41.3%)
   - AI + outcomes: 93 pieces (13.8%)
   - AI + cost: 70 pieces (10.4%)

2. **Musculoskeletal/MSK** - 193 pieces (14.5%)
   - Business value: 160 pieces (74.4%)
   - Product features: 62 pieces (28.8%)

3. **Benefits** - 91 pieces (6.8%) - Employer value prop

### Trending Analysis
**UP** ↗
- Pelvic floor: +3.3%
- App: +2.8%
- Outcomes: +1.8%

**DOWN** ↘
- Employer: -2.0%
- ROI: -1.4%
- Back pain: -2.3%

### Content Gaps (Your Opportunities)
- member engagement (0 pieces)
- value-based care (0 pieces)
- telemedicine (0 pieces)
- behavioral health (3 pieces)

## 📝 Notes

- **Scraper respects robots.txt** and uses 1-second delays
- **Data refreshes weekly** - run `npm run scrape` manually or via GitHub Actions
- **Dashboard is static** - no backend required, just HTML/JS/JSON
- **Intelligence JSON is portable** - can be hosted anywhere
- **All analysis is automated** - no manual data entry

## 🎓 Learn More

- View full analysis: `npm run analyze`
- View formatted report: `npm run report`
- Explore intelligence JSON: Open `hinge-intelligence.json`
- Inspect raw data: Open `hinge-content.json`

## ✅ Next Steps

1. **Set up GitHub Actions** for weekly automation
2. **Deploy to GitHub Pages** for public dashboard
3. **Share the URL** with your team
4. **Monitor weekly** for strategic changes

---

Built with ❤️ for competitive intelligence
