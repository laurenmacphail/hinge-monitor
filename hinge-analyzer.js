#!/usr/bin/env node

/**
 * Hinge Health Content Analyzer
 *
 * Analyzes the collected content data to identify:
 * - Topic clusters and trends
 * - Publishing frequency patterns
 * - Most common content formats
 * - Content gap opportunities
 */

const fs = require('fs').promises;
const path = require('path');
const { parseISO, format, differenceInDays, startOfMonth, eachMonthOfInterval, subMonths } = require('date-fns');

// Configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error('[ERROR] Could not load config.json:', error.message);
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, config.output.dataFile);

/**
 * Load content data
 */
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('[ERROR] No data file found. Please run the monitor script first (npm run monitor)');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Identify topic clusters using keyword frequency analysis
 */
function identifyTopicClusters(content) {
  console.log('\n=== TOPIC CLUSTERS ===\n');

  // Collect all topics from categories and titles
  const topicFrequency = {};
  const topicContent = {};

  content.forEach(item => {
    // Process categories
    item.categories.forEach(category => {
      const normalized = category.toLowerCase().trim();
      if (normalized) {
        topicFrequency[normalized] = (topicFrequency[normalized] || 0) + 1;
        if (!topicContent[normalized]) topicContent[normalized] = [];
        topicContent[normalized].push(item);
      }
    });

    // Extract keywords from title
    const titleWords = item.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4); // Only words longer than 4 chars

    titleWords.forEach(word => {
      topicFrequency[word] = (topicFrequency[word] || 0) + 1;
    });
  });

  // Filter topics by minimum frequency
  const significantTopics = Object.entries(topicFrequency)
    .filter(([, count]) => count >= config.analysis.minTopicFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  console.log('Top Topics by Frequency:\n');
  significantTopics.forEach(([topic, count], index) => {
    const percentage = ((count / content.length) * 100).toFixed(1);
    console.log(`${(index + 1).toString().padStart(2)}. ${topic.padEnd(30)} - ${count} pieces (${percentage}%)`);
  });

  // Identify topic clusters (topics that appear together)
  console.log('\n\nTopic Co-occurrence (topics that appear together):\n');

  const topTopics = significantTopics.slice(0, 10).map(([topic]) => topic);
  const cooccurrence = {};

  content.forEach(item => {
    const itemTopics = item.categories.map(c => c.toLowerCase().trim()).filter(t => topTopics.includes(t));

    for (let i = 0; i < itemTopics.length; i++) {
      for (let j = i + 1; j < itemTopics.length; j++) {
        const pair = [itemTopics[i], itemTopics[j]].sort().join(' + ');
        cooccurrence[pair] = (cooccurrence[pair] || 0) + 1;
      }
    }
  });

  Object.entries(cooccurrence)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([pair, count], index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${pair.padEnd(50)} - ${count} pieces`);
    });

  return { topicFrequency, topicContent, significantTopics };
}

/**
 * Analyze publishing frequency over time
 */
function analyzePublishingFrequency(content) {
  console.log('\n\n=== PUBLISHING FREQUENCY ANALYSIS ===\n');

  // Filter content with valid publish dates
  const contentWithDates = content.filter(item => item.publishDate);

  if (contentWithDates.length === 0) {
    console.log('No publish dates available for analysis.');
    return;
  }

  // Sort by date
  const sorted = contentWithDates
    .map(item => ({
      ...item,
      date: parseISO(item.publishDate + 'T00:00:00')
    }))
    .sort((a, b) => a.date - b.date);

  const oldest = sorted[0].date;
  const newest = sorted[sorted.length - 1].date;
  const totalDays = differenceInDays(newest, oldest);

  console.log(`Date Range: ${format(oldest, 'MMM yyyy')} to ${format(newest, 'MMM yyyy')}`);
  console.log(`Total Period: ${totalDays} days`);
  console.log(`Total Content: ${contentWithDates.length} pieces`);
  console.log(`Average: ${(contentWithDates.length / (totalDays / 30)).toFixed(1)} pieces per month`);

  // Monthly breakdown for last 12 months
  console.log('\n\nMonthly Publishing Activity (Last 12 Months):\n');

  const now = new Date();
  const twelveMonthsAgo = subMonths(now, 12);
  const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: now });

  const monthlyData = {};
  months.forEach(month => {
    const key = format(month, 'yyyy-MM');
    monthlyData[key] = { total: 0, byType: {} };
  });

  contentWithDates.forEach(item => {
    const monthKey = format(item.date, 'yyyy-MM');
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].total++;
      monthlyData[monthKey].byType[item.contentType] = (monthlyData[monthKey].byType[item.contentType] || 0) + 1;
    }
  });

  Object.entries(monthlyData).forEach(([month, data]) => {
    const bar = '█'.repeat(Math.ceil(data.total / 2));
    console.log(`${month}  ${bar} ${data.total} pieces`);

    if (Object.keys(data.byType).length > 0) {
      Object.entries(data.byType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`         ${type}: ${count}`);
        });
    }
  });

  // Recent trends
  const recentDays = config.analysis.trendAnalysisPeriod;
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - recentDays);

  const recentContent = contentWithDates.filter(item => item.date >= recentDate);

  console.log(`\n\nRecent Trend (Last ${recentDays} days):`);
  console.log(`${recentContent.length} pieces published`);
  console.log(`Average: ${(recentContent.length / (recentDays / 7)).toFixed(1)} pieces per week`);

  return { monthlyData, recentContent };
}

/**
 * Find most common content formats
 */
function analyzeContentFormats(content) {
  console.log('\n\n=== CONTENT FORMAT ANALYSIS ===\n');

  const formatStats = {};

  content.forEach(item => {
    const type = item.contentType;
    if (!formatStats[type]) {
      formatStats[type] = {
        count: 0,
        audiences: {},
        avgCategoriesPerPiece: 0,
        totalCategories: 0,
        examples: []
      };
    }

    formatStats[type].count++;
    formatStats[type].totalCategories += item.categories.length;

    item.targetAudience.forEach(audience => {
      formatStats[type].audiences[audience] = (formatStats[type].audiences[audience] || 0) + 1;
    });

    if (formatStats[type].examples.length < 3) {
      formatStats[type].examples.push({
        title: item.title,
        url: item.url
      });
    }
  });

  // Calculate averages
  Object.keys(formatStats).forEach(type => {
    formatStats[type].avgCategoriesPerPiece =
      (formatStats[type].totalCategories / formatStats[type].count).toFixed(1);
  });

  // Sort by count
  const sortedFormats = Object.entries(formatStats)
    .sort(([, a], [, b]) => b.count - a.count);

  console.log('Content Formats by Frequency:\n');

  sortedFormats.forEach(([type, stats]) => {
    const percentage = ((stats.count / content.length) * 100).toFixed(1);
    console.log(`\n${type.toUpperCase()}`);
    console.log(`  Count: ${stats.count} (${percentage}%)`);
    console.log(`  Avg categories: ${stats.avgCategoriesPerPiece}`);

    console.log('  Primary audiences:');
    Object.entries(stats.audiences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([audience, count]) => {
        console.log(`    - ${audience}: ${count}`);
      });

    console.log('  Examples:');
    stats.examples.forEach(example => {
      console.log(`    - ${example.title}`);
    });
  });

  return formatStats;
}

/**
 * Identify content gaps and opportunities
 */
function identifyContentGaps(content, topicAnalysis, formatStats) {
  console.log('\n\n=== CONTENT GAP OPPORTUNITIES ===\n');

  const opportunities = [];

  // 1. Underrepresented formats for popular topics
  console.log('1. Format Opportunities for Popular Topics:\n');

  const topTopics = topicAnalysis.significantTopics.slice(0, 5);
  topTopics.forEach(([topic, count]) => {
    const topicContent = content.filter(item =>
      item.categories.some(cat => cat.toLowerCase() === topic)
    );

    const formatBreakdown = {};
    topicContent.forEach(item => {
      formatBreakdown[item.contentType] = (formatBreakdown[item.contentType] || 0) + 1;
    });

    console.log(`\nTopic: "${topic}" (${count} pieces)`);
    console.log('  Current formats:');
    Object.entries(formatBreakdown)
      .sort(([, a], [, b]) => b - a)
      .forEach(([format, formatCount]) => {
        console.log(`    - ${format}: ${formatCount}`);
      });

    // Suggest underrepresented formats
    const allFormats = Object.keys(formatStats);
    const missingFormats = allFormats.filter(f => !formatBreakdown[f]);
    const underrepresented = allFormats.filter(f =>
      formatBreakdown[f] && formatBreakdown[f] < count * 0.1
    );

    if (missingFormats.length > 0 || underrepresented.length > 0) {
      console.log('  Opportunities:');
      [...missingFormats, ...underrepresented].forEach(format => {
        const current = formatBreakdown[format] || 0;
        opportunities.push({
          type: 'format-gap',
          topic: topic,
          format: format,
          current: current,
          suggestion: `Create ${format} content about "${topic}"`
        });
        console.log(`    → ${format} (currently: ${current})`);
      });
    }
  });

  // 2. Audience-specific gaps
  console.log('\n\n2. Audience-Specific Opportunities:\n');

  const audienceContent = {};
  content.forEach(item => {
    item.targetAudience.forEach(audience => {
      if (!audienceContent[audience]) {
        audienceContent[audience] = { total: 0, formats: {}, topics: {} };
      }
      audienceContent[audience].total++;
      audienceContent[audience].formats[item.contentType] =
        (audienceContent[audience].formats[item.contentType] || 0) + 1;
    });
  });

  Object.entries(audienceContent)
    .sort(([, a], [, b]) => b.total - a.total)
    .forEach(([audience, data]) => {
      console.log(`\n${audience.toUpperCase()} (${data.total} pieces)`);

      // Find underrepresented formats for this audience
      const allFormats = Object.keys(formatStats);
      const underrepresented = allFormats.filter(format => {
        const count = data.formats[format] || 0;
        return count < data.total * 0.1;
      });

      if (underrepresented.length > 0) {
        console.log('  Underrepresented formats:');
        underrepresented.forEach(format => {
          const current = data.formats[format] || 0;
          opportunities.push({
            type: 'audience-gap',
            audience: audience,
            format: format,
            current: current,
            suggestion: `Create more ${format} content for ${audience}`
          });
          console.log(`    → ${format} (currently: ${current})`);
        });
      }
    });

  // 3. Recent publishing gaps
  console.log('\n\n3. Publishing Consistency Opportunities:\n');

  const recentDays = 30;
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - recentDays);

  const recentByType = {};
  content.forEach(item => {
    if (item.publishDate) {
      const pubDate = parseISO(item.publishDate + 'T00:00:00');
      if (pubDate >= recentDate) {
        recentByType[item.contentType] = (recentByType[item.contentType] || 0) + 1;
      }
    }
  });

  console.log(`Content published in last ${recentDays} days by type:\n`);
  Object.entries(formatStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([type, stats]) => {
      const recentCount = recentByType[type] || 0;
      const expectedMonthly = stats.count / 12; // Rough monthly average
      const status = recentCount < expectedMonthly * 0.5 ? '⚠️  Below average' : '✓ On track';

      console.log(`  ${type.padEnd(15)}: ${recentCount.toString().padStart(2)} pieces ${status}`);

      if (recentCount < expectedMonthly * 0.5) {
        opportunities.push({
          type: 'publishing-gap',
          format: type,
          recent: recentCount,
          expected: expectedMonthly,
          suggestion: `Increase ${type} publishing frequency`
        });
      }
    });

  console.log('\n\n=== TOP RECOMMENDATIONS ===\n');

  // Prioritize opportunities
  const prioritized = opportunities.slice(0, 10);

  prioritized.forEach((opp, index) => {
    console.log(`${index + 1}. ${opp.suggestion}`);
  });

  return opportunities;
}

/**
 * Competitive intelligence summary
 */
function generateCompetitiveIntelligence(content, topicAnalysis, formatStats) {
  console.log('\n\n=== COMPETITIVE INTELLIGENCE SUMMARY ===\n');

  console.log('Hinge Health\'s Content Strategy:\n');

  // Primary focus areas
  const topTopics = topicAnalysis.significantTopics.slice(0, 5);
  console.log('Primary Topic Focus:');
  topTopics.forEach(([topic, count], index) => {
    console.log(`  ${index + 1}. ${topic} (${count} pieces)`);
  });

  // Preferred formats
  console.log('\nPreferred Content Formats:');
  Object.entries(formatStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .forEach(([format, stats], index) => {
      const percentage = ((stats.count / content.length) * 100).toFixed(1);
      console.log(`  ${index + 1}. ${format}: ${stats.count} pieces (${percentage}%)`);
    });

  // Target audiences
  console.log('\nTarget Audience Priority:');
  const audienceCount = {};
  content.forEach(item => {
    item.targetAudience.forEach(audience => {
      audienceCount[audience] = (audienceCount[audience] || 0) + 1;
    });
  });

  Object.entries(audienceCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([audience, count], index) => {
      const percentage = ((count / content.length) * 100).toFixed(1);
      console.log(`  ${index + 1}. ${audience}: ${count} pieces (${percentage}%)`);
    });

  // Recent activity
  const recentDays = 30;
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - recentDays);

  const recentContent = content.filter(item => {
    if (!item.publishDate) return false;
    const pubDate = parseISO(item.publishDate + 'T00:00:00');
    return pubDate >= recentDate;
  });

  console.log(`\nRecent Activity (Last ${recentDays} days):`);
  console.log(`  ${recentContent.length} pieces published`);
  console.log(`  Average: ${(recentContent.length / (recentDays / 7)).toFixed(1)} pieces per week`);

  if (recentContent.length > 0) {
    console.log('\n  Recent topics:');
    const recentTopics = {};
    recentContent.forEach(item => {
      item.categories.forEach(cat => {
        recentTopics[cat] = (recentTopics[cat] || 0) + 1;
      });
    });

    Object.entries(recentTopics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([topic, count]) => {
        console.log(`    - ${topic}: ${count}`);
      });
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('HINGE HEALTH CONTENT ANALYZER');
    console.log('='.repeat(60));

    // Load data
    const data = await loadData();
    console.log(`\nLoaded ${data.content.length} content pieces`);
    console.log(`Last updated: ${new Date(data.lastUpdated).toLocaleString()}`);

    // Run analyses
    const topicAnalysis = identifyTopicClusters(data.content);
    analyzePublishingFrequency(data.content);
    const formatStats = analyzeContentFormats(data.content);
    identifyContentGaps(data.content, topicAnalysis, formatStats);
    generateCompetitiveIntelligence(data.content, topicAnalysis, formatStats);

    console.log('\n' + '='.repeat(60));
    console.log('Analysis complete!');
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  identifyTopicClusters,
  analyzePublishingFrequency,
  analyzeContentFormats,
  identifyContentGaps
};
