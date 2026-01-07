#!/usr/bin/env node

/**
 * Hinge Health Intelligence Data Generator
 *
 * Generates a comprehensive intelligence JSON file from scraped content
 * This file powers the interactive dashboard with all strategic insights
 */

const fs = require('fs').promises;
const path = require('path');
const { parseISO, format, subMonths, isAfter } = require('date-fns');

const DATA_FILE = path.join(__dirname, 'hinge-content.json');
const OUTPUT_FILE = path.join(__dirname, 'hinge-intelligence.json');

// Strategic topic patterns
const STRATEGIC_TOPICS = {
  clinical: [
    'chronic pain', 'back pain', 'knee pain', 'hip pain', 'shoulder pain', 'neck pain',
    'behavioral health', 'mental health', 'pelvic health', 'pelvic floor',
    'arthritis', 'sciatica', 'tendonitis', 'osteoarthritis',
    'physical therapy', 'exercise therapy', 'pain management', 'pain relief',
    'musculoskeletal', 'msk care', 'fall prevention', 'injury prevention'
  ],
  business: [
    'employer', 'employers', 'cost savings', 'roi', 'return on investment',
    'member engagement', 'employee engagement', 'utilization', 'outcomes',
    'claims', 'medical claims', 'healthcare costs', 'total cost',
    'productivity', 'absenteeism', 'presenteeism', 'disability',
    'benefits', 'health plan', 'wellness program'
  ],
  technology: [
    'digital health', 'digital msk', 'telehealth', 'telemedicine', 'virtual',
    'ai', 'artificial intelligence', 'machine learning', 'computer vision',
    'remote monitoring', 'wearable', 'sensor', 'motion tracking',
    'app', 'mobile', 'platform', 'technology', 'enso', 'truemotion'
  ],
  market: [
    'msk', 'value-based care', 'population health',
    'clinical outcomes', 'patient outcomes', 'evidence-based',
    'research', 'study', 'clinical study', 'white paper', 'report',
    'partnership', 'integration', 'provider network'
  ]
};

function extractStrategicTopics(text) {
  const textLower = text.toLowerCase();
  const found = { clinical: [], business: [], technology: [], market: [] };

  Object.entries(STRATEGIC_TOPICS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      if (textLower.includes(pattern)) {
        found[category].push(pattern);
      }
    });
  });

  return found;
}

async function loadData() {
  const data = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function generateIntelligence(data, content) {
  console.log('Generating intelligence data...');

  // Gather all analytics
  const topicData = gatherTopicData(content);
  const trendingData = gatherTrendingData(content);
  const audienceData = gatherAudienceData(content);
  const messagingData = gatherMessagingData(topicData, content);
  const campaignData = gatherCampaignData(content, topicData);
  const gapsData = gatherContentGaps(topicData);
  const qualityData = gatherQualityData(content);
  const insightsData = generateKeyInsights(content, topicData, trendingData, audienceData);
  const timelineData = generateTimeline(content);

  // Calculate metadata
  const withDates = content.filter(c => c.publishDate);
  const dates = withDates.map(c => c.publishDate).filter(d => d).sort();

  const intelligence = {
    lastUpdated: new Date().toISOString(),
    generatedAt: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),

    metadata: {
      totalPieces: content.length,
      dateRange: {
        earliest: dates.length > 0 ? dates[0] : null,
        latest: dates.length > 0 ? dates[dates.length - 1] : null
      },
      withDatesPct: ((withDates.length / content.length) * 100).toFixed(1)
    },

    strategicPriorities: generateStrategicPriorities(content, topicData),
    trendingUp: trendingData.trending,
    trendingDown: trendingData.declining,
    audienceStrategy: audienceData,
    messaging: messagingData,
    campaigns: campaignData,
    contentGaps: gapsData,
    qualityMetrics: qualityData,
    keyInsights: insightsData,
    timeline: timelineData,

    // Raw content for table view
    rawContent: content
  };

  return intelligence;
}

function gatherTopicData(content) {
  const topicCounts = { clinical: {}, business: {}, technology: {}, market: {} };
  const topicContent = { clinical: {}, business: {}, technology: {}, market: {} };

  content.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    const topics = extractStrategicTopics(text);

    Object.entries(topics).forEach(([category, foundTopics]) => {
      foundTopics.forEach(topic => {
        topicCounts[category][topic] = (topicCounts[category][topic] || 0) + 1;
        if (!topicContent[category][topic]) topicContent[category][topic] = [];
        topicContent[category][topic].push(item);
      });
    });
  });

  return { topicCounts, topicContent };
}

function gatherTrendingData(content) {
  const withDates = content.filter(c => c.publishDate);
  const threeMonthsAgo = subMonths(new Date(), 3);
  const recent = [];
  const older = [];

  withDates.forEach(item => {
    try {
      const date = parseISO(item.publishDate + 'T00:00:00');
      if (isAfter(date, threeMonthsAgo)) {
        recent.push(item);
      } else {
        older.push(item);
      }
    } catch (e) {}
  });

  const extractTopics = (items) => {
    const topics = {};
    const topicContent = {};
    items.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      const found = extractStrategicTopics(text);
      Object.entries(found).forEach(([category, foundTopics]) => {
        foundTopics.forEach(topic => {
          topics[topic] = (topics[topic] || 0) + 1;
          if (!topicContent[topic]) topicContent[topic] = [];
          topicContent[topic].push(item);
        });
      });
    });
    return { topics, topicContent };
  };

  const recentData = extractTopics(recent);
  const olderData = extractTopics(older);

  const trending = [];
  const declining = [];

  Object.keys({ ...recentData.topics, ...olderData.topics }).forEach(topic => {
    const recentCount = recentData.topics[topic] || 0;
    const olderCount = olderData.topics[topic] || 0;

    const recentPct = recent.length > 0 ? (recentCount / recent.length) * 100 : 0;
    const olderPct = older.length > 0 ? (olderCount / older.length) * 100 : 0;
    const change = recentPct - olderPct;

    if (change > 0.5 && recentCount >= 5) {
      trending.push({
        topic,
        change: parseFloat(change.toFixed(1)),
        recentCount,
        olderCount,
        examples: (recentData.topicContent[topic] || []).slice(0, 2).map(item => ({
          title: item.title,
          url: item.url
        }))
      });
    } else if (change < -0.5 && olderCount >= 5) {
      declining.push({
        topic,
        change: parseFloat(change.toFixed(1)),
        recentCount,
        olderCount
      });
    }
  });

  return {
    trending: trending.sort((a, b) => b.change - a.change),
    declining: declining.sort((a, b) => a.change - b.change),
    recentCount: recent.length,
    olderCount: older.length
  };
}

function gatherAudienceData(content) {
  const audiences = ['providers', 'employers', 'health plans', 'partners', 'members', 'general'];
  const audienceCounts = {};

  audiences.forEach(aud => {
    audienceCounts[aud] = content.filter(c => c.targetAudience.includes(aud)).length;
  });

  // Provider breakdown
  const providerContent = content.filter(c => c.targetAudience.includes('providers'));
  const providerBreakdown = {
    physicalTherapists: 0,
    physicians: 0,
    healthPlans: 0,
    other: 0
  };

  providerContent.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    if (text.includes('physical therap') || text.includes('pt ') || text.includes('therapist')) {
      providerBreakdown.physicalTherapists++;
    } else if (text.includes('physician') || text.includes('doctor') || text.includes('orthoped')) {
      providerBreakdown.physicians++;
    } else if (text.includes('health plan') || text.includes('payer') || text.includes('insurance')) {
      providerBreakdown.healthPlans++;
    } else {
      providerBreakdown.other++;
    }
  });

  // Audience shifts
  const withDates = content.filter(c => c.publishDate);
  const threeMonthsAgo = subMonths(new Date(), 3);
  const audienceShifts = { growing: [], declining: [] };

  audiences.forEach(aud => {
    const recent = withDates.filter(c => {
      try {
        const date = parseISO(c.publishDate + 'T00:00:00');
        return isAfter(date, threeMonthsAgo) && c.targetAudience.includes(aud);
      } catch (e) {
        return false;
      }
    }).length;

    const older = withDates.filter(c => {
      try {
        const date = parseISO(c.publishDate + 'T00:00:00');
        return !isAfter(date, threeMonthsAgo) && c.targetAudience.includes(aud);
      } catch (e) {
        return false;
      }
    }).length;

    const recentTotal = withDates.filter(c => {
      try {
        const date = parseISO(c.publishDate + 'T00:00:00');
        return isAfter(date, threeMonthsAgo);
      } catch (e) {
        return false;
      }
    }).length;

    const olderTotal = withDates.filter(c => {
      try {
        const date = parseISO(c.publishDate + 'T00:00:00');
        return !isAfter(date, threeMonthsAgo);
      } catch (e) {
        return false;
      }
    }).length;

    const recentPct = recentTotal > 0 ? (recent / recentTotal) * 100 : 0;
    const olderPct = olderTotal > 0 ? (older / olderTotal) * 100 : 0;
    const change = parseFloat((recentPct - olderPct).toFixed(1));

    if (change > 0) {
      audienceShifts.growing.push({ audience: aud, change, recent, older });
    } else if (change < 0) {
      audienceShifts.declining.push({ audience: aud, change, recent, older });
    }
  });

  return {
    breakdown: audiences.map(aud => ({
      audience: aud,
      count: audienceCounts[aud],
      percentage: ((audienceCounts[aud] / content.length) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count),

    providerDeepDive: {
      total: providerContent.length,
      breakdown: Object.entries(providerBreakdown).map(([type, count]) => ({
        type,
        count,
        percentage: providerContent.length > 0 ? ((count / providerContent.length) * 100).toFixed(1) : '0.0'
      })).sort((a, b) => b.count - a.count),
      interpretation: providerContent.length >= 10
        ? `Provider focus: ${Object.entries(providerBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([type, count]) => `${type} (${((count / providerContent.length) * 100).toFixed(0)}%)`)
            .join(', ')}`
        : 'Minimal provider-specific content'
    },

    shifts: audienceShifts
  };
}

function gatherMessagingData(topicData, content) {
  const allTopics = [];
  Object.entries(topicData.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 20) {
        allTopics.push({
          topic,
          count,
          content: topicData.topicContent[category][topic]
        });
      }
    });
  });

  const top5 = allTopics.sort((a, b) => b.count - a.count).slice(0, 5);

  const byTopic = top5.map(topicInfo => {
    const keywords = {
      technology: ['digital', 'ai', 'innovative', 'advanced', 'technology', 'platform'],
      outcomes: ['improve', 'better', 'effective', 'proven', 'results', 'success'],
      cost: ['save', 'savings', 'reduce', 'lower', 'affordable', 'roi'],
      prevention: ['prevent', 'avoid', 'reduce risk', 'proactive', 'early'],
      evidence: ['evidence-based', 'clinical', 'research', 'proven', 'study'],
      personalization: ['personalized', 'customized', 'tailored', 'individual']
    };

    const messageCounts = {};

    topicInfo.content.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      Object.entries(keywords).forEach(([message, kws]) => {
        if (kws.some(kw => text.includes(kw))) {
          messageCounts[message] = (messageCounts[message] || 0) + 1;
        }
      });
    });

    return {
      topic: topicInfo.topic,
      count: topicInfo.count,
      themes: Object.entries(messageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([theme, count]) => ({
          theme,
          count,
          percentage: ((count / topicInfo.count) * 100).toFixed(0)
        }))
    };
  });

  return {
    byTopic,
    keyClaims: [
      'AI-powered personalization across the care journey',
      'Clinically proven outcomes and pain reduction',
      'Cost savings and ROI for employers',
      'Virtual care delivery through physical therapists'
    ]
  };
}

function gatherCampaignData(content, topicData) {
  const campaigns = [];

  Object.entries(topicData.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 50) {
        const pct = (count / content.length) * 100;
        let interpretation = '';

        if (pct >= 30) {
          interpretation = 'Major long-term campaign';
        } else if (pct >= 15) {
          interpretation = 'Sustained strategic push';
        } else if (pct >= 10) {
          interpretation = 'Ongoing content initiative';
        } else {
          interpretation = 'Targeted campaign';
        }

        campaigns.push({ topic, count, interpretation });
      }
    });
  });

  return campaigns.sort((a, b) => b.count - a.count).slice(0, 10);
}

function gatherContentGaps(topicData) {
  const zeroCoverage = [];
  const limitedCoverage = [];

  Object.entries(STRATEGIC_TOPICS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const count = topicData.topicCounts[category][pattern] || 0;

      if (count === 0) {
        // Generate dynamic opportunity description based on category
        let opportunity = '';
        if (category === 'business') {
          opportunity = 'Business differentiation opportunity';
        } else if (category === 'technology') {
          opportunity = 'Technology positioning gap';
        } else if (category === 'clinical') {
          opportunity = 'Clinical content opportunity';
        } else if (category === 'market') {
          opportunity = 'Market positioning opportunity';
        }

        zeroCoverage.push({ topic: pattern, count: 0, opportunity });
      } else if (count < 5) {
        limitedCoverage.push({
          topic: pattern,
          count,
          opportunity: `Only ${count} piece${count === 1 ? '' : 's'} - room to expand`
        });
      }
    });
  });

  return {
    zeroCoverage: zeroCoverage.slice(0, 15),
    limitedCoverage: limitedCoverage.slice(0, 10)
  };
}

function gatherQualityData(content) {
  let withDesc = 0, withImage = 0, totalDescLen = 0;

  content.forEach(item => {
    if (item.metaDescription) {
      withDesc++;
      totalDescLen += item.metaDescription.length;
    }
    if (item.featuredImage) withImage++;
  });

  return {
    metaDescriptions: ((withDesc / content.length) * 100).toFixed(0),
    featuredImages: ((withImage / content.length) * 100).toFixed(0),
    avgDescLength: withDesc > 0 ? Math.round(totalDescLen / withDesc) : 0
  };
}

function generateKeyInsights(content, topicData, trendingData, audienceData) {
  const insights = [];

  // Helper to get scale descriptor based on percentage
  const getScale = (pct) => {
    if (pct >= 40) return 'dominant';
    if (pct >= 20) return 'major';
    if (pct >= 10) return 'significant';
    return 'moderate';
  };

  // Insight 1: Top topic (if significant)
  const allTopics = [];
  Object.entries(topicData.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      const pct = (count / content.length) * 100;
      if (count >= 50) {
        allTopics.push({ topic, count, pct, category, content: topicData.topicContent[category][topic] });
      }
    });
  });

  allTopics.sort((a, b) => b.count - a.count);

  if (allTopics.length > 0 && allTopics[0].pct >= 20) {
    const top = allTopics[0];
    const scale = getScale(top.pct);

    // Calculate subtopic distribution for the top topic
    let subtopicText = '';
    if (top.topic === 'ai' && top.content) {
      const subtopics = {
        'care': 0, 'outcomes': 0, 'cost': 0, 'member': 0, 'personalization': 0
      };
      top.content.forEach(item => {
        const text = `${item.title} ${item.metaDescription}`.toLowerCase();
        if (text.includes('care') || text.includes('treatment')) subtopics.care++;
        if (text.includes('outcome') || text.includes('results')) subtopics.outcomes++;
        if (text.includes('cost') || text.includes('savings') || text.includes('roi')) subtopics.cost++;
        if (text.includes('member') || text.includes('patient')) subtopics.member++;
        if (text.includes('personali') || text.includes('custom')) subtopics.personalization++;
      });
      const topSubtopics = Object.entries(subtopics)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => `${((count / top.content.length) * 100).toFixed(0)}% ${name}`)
        .join(', ');
      if (topSubtopics) subtopicText = ` Breakdown: ${topSubtopics}.`;
    }

    insights.push({
      title: `${top.topic.toUpperCase()} - ${scale.toUpperCase()} FOCUS`,
      data: `${top.count} pieces (${top.pct.toFixed(1)}%)`,
      insight: `${top.topic.charAt(0).toUpperCase() + top.topic.slice(1)} is a ${scale} focus area with ${top.pct.toFixed(1)}% of content.${subtopicText}`
    });
  }

  // Insight 2: Audience strategy (if significant)
  const audienceBreakdown = audienceData.breakdown;
  if (audienceBreakdown.length > 0) {
    const topAudience = audienceBreakdown[0];
    const audiencePct = parseFloat(topAudience.percentage);
    if (audiencePct >= 50) {
      insights.push({
        title: `${topAudience.audience.toUpperCase()}-FIRST STRATEGY`,
        data: `${topAudience.count} pieces (${topAudience.percentage})`,
        insight: `${topAudience.audience.charAt(0).toUpperCase() + topAudience.audience.slice(1)} content dominates with ${topAudience.percentage}, indicating a clear ${topAudience.audience}-first content strategy.`
      });
    }
  }

  // Insight 3: Major trending topics (only if change > 2%)
  const significantTrending = trendingData.trending.filter(t => parseFloat(t.change) >= 2.0);
  if (significantTrending.length > 0) {
    const top = significantTrending[0];
    insights.push({
      title: `${top.topic.toUpperCase()} EXPANSION`,
      data: `+${top.change}% growth (${top.recentCount} recent vs ${top.olderCount} older)`,
      insight: `${top.topic.charAt(0).toUpperCase() + top.topic.slice(1)} content trending up +${top.change}%, indicating strategic expansion into this area.`
    });
  }

  // Insight 4: Messaging shifts (only if both exist and significant)
  const outcomesT = trendingData.trending.find(t => t.topic === 'outcomes');
  const costTopics = trendingData.declining.filter(t => ['cost', 'roi', 'savings'].includes(t.topic));
  if (outcomesT && parseFloat(outcomesT.change) >= 1.5 && costTopics.length > 0) {
    const costTopic = costTopics[0];
    insights.push({
      title: 'OUTCOMES > COST',
      data: `Outcomes +${outcomesT.change}%, ${costTopic.topic} ${costTopic.change}%`,
      insight: `Messaging shift from cost focus to clinical outcomes. Outcomes content up +${outcomesT.change}% while ${costTopic.topic} content declined ${costTopic.change}%.`
    });
  }

  // Insight 5: Audience shifts (only if significant)
  const growingAudience = audienceData.shifts.growing.filter(s => Math.abs(parseFloat(s.change)) >= 2.0);
  const decliningAudience = audienceData.shifts.declining.filter(s => Math.abs(parseFloat(s.change)) >= 2.0);
  if (growingAudience.length > 0 && decliningAudience.length > 0) {
    const growing = growingAudience[0];
    const declining = decliningAudience[0];
    insights.push({
      title: 'AUDIENCE PIVOT',
      data: `${growing.audience} +${growing.change}%, ${declining.audience} ${declining.change}%`,
      insight: `Shifting focus from ${declining.audience} (${declining.change}%) to ${growing.audience} (+${growing.change}%), indicating a strategic repositioning.`
    });
  }

  return insights;
}

function generateStrategicPriorities(content, topicData) {
  const allTopics = [];

  Object.entries(topicData.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 10) {
        allTopics.push({
          topic,
          count,
          category,
          content: topicData.topicContent[category][topic]
        });
      }
    });
  });

  const top10 = allTopics.sort((a, b) => b.count - a.count).slice(0, 10);

  return top10.map((t, i) => {
    const pct = (t.count / content.length) * 100;
    const priority = {
      rank: i + 1,
      topic: t.topic,
      count: t.count,
      percentage: pct.toFixed(1),
      category: t.category,
      examples: t.content.slice(0, 3).map(item => ({
        title: item.title,
        url: item.url
      }))
    };

    // Generate dynamic interpretation based on percentage
    let scale = '';
    if (pct >= 40) scale = 'Dominant focus area';
    else if (pct >= 20) scale = 'Major strategic priority';
    else if (pct >= 10) scale = 'Significant investment';
    else if (pct >= 5) scale = 'Moderate focus';
    else scale = 'Emerging topic';

    priority.interpretation = scale;

    // Add detailed analysis for specific topics
    if (t.topic === 'ai') {
      priority.subtopics = analyzeAISubtopics(t.content);
    } else if (t.topic === 'musculoskeletal' || t.topic === 'msk') {
      priority.contentTypes = analyzeMSKTypes(t.content);
    }

    return priority;
  });
}

function analyzeAISubtopics(aiContent) {
  const subtopics = {
    'care': 0, 'outcomes': 0, 'cost': 0, 'member': 0, 'personalization': 0, 'clinical': 0
  };

  aiContent.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    if (text.includes('care') || text.includes('treatment') || text.includes('therapy')) subtopics.care++;
    if (text.includes('outcome') || text.includes('results') || text.includes('improve')) subtopics.outcomes++;
    if (text.includes('cost') || text.includes('savings') || text.includes('roi')) subtopics.cost++;
    if (text.includes('member') || text.includes('patient') || text.includes('experience')) subtopics.member++;
    if (text.includes('personali') || text.includes('custom') || text.includes('tailored')) subtopics.personalization++;
    if (text.includes('clinical') || text.includes('evidence') || text.includes('research')) subtopics.clinical++;
  });

  return Object.entries(subtopics)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name: `AI + ${name}`,
      count,
      percentage: ((count / aiContent.length) * 100).toFixed(1)
    }));
}

function analyzeMSKTypes(mskContent) {
  const types = {
    'Business value': 0,
    'Product features': 0,
    'Exercise/treatment': 0,
    'Success stories': 0,
    'Research/evidence': 0,
    'Condition explainers': 0
  };

  mskContent.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    const title = item.title.toLowerCase();

    if (text.includes('roi') || text.includes('cost') || text.includes('savings') || text.includes('employer')) types['Business value']++;
    if (text.includes('platform') || text.includes('app') || text.includes('technology') || text.includes('digital')) types['Product features']++;
    if (title.includes('exercise') || title.includes('treatment') || title.includes('how to')) types['Exercise/treatment']++;
    if (item.contentType === 'case-study' || text.includes('success')) types['Success stories']++;
    if (text.includes('study') || text.includes('research') || text.includes('evidence')) types['Research/evidence']++;
    if (title.includes('what is') || title.includes('causes') || title.includes('symptoms')) types['Condition explainers']++;
  });

  return Object.entries(types)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name,
      count,
      percentage: ((count / mskContent.length) * 100).toFixed(1)
    }));
}

function generateTimeline(content) {
  const withDates = content.filter(c => c.publishDate);
  const byMonth = {};

  withDates.forEach(item => {
    try {
      const date = parseISO(item.publishDate + 'T00:00:00');
      const monthKey = format(date, 'yyyy-MM');

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthKey,
          displayMonth: format(date, 'MMM yyyy'),
          count: 0,
          pieces: []
        };
      }

      byMonth[monthKey].count++;
      byMonth[monthKey].pieces.push({
        title: item.title,
        url: item.url,
        date: item.publishDate
      });
    } catch (e) {
      // Skip invalid dates
    }
  });

  // Get last 12 months for chart
  const sortedMonths = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  const last12Months = sortedMonths.slice(-12);

  return {
    last12Months,
    allMonths: sortedMonths,
    totalMonths: sortedMonths.length,
    avgPerMonth: sortedMonths.length > 0 ? Math.round(withDates.length / sortedMonths.length) : 0
  };
}

async function main() {
  try {
    console.log('Loading data from hinge-content.json...');
    const data = await loadData();
    const content = data.content;

    console.log(`Processing ${content.length} pieces of content...`);
    const intelligence = generateIntelligence(data, content);

    console.log(`Writing intelligence data to ${OUTPUT_FILE}...`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(intelligence, null, 2), 'utf8');

    console.log('✓ Intelligence data generated successfully!');
    console.log(`✓ Output: ${OUTPUT_FILE}`);
    console.log(`✓ File size: ${(JSON.stringify(intelligence).length / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error('Error generating intelligence:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateIntelligence };
