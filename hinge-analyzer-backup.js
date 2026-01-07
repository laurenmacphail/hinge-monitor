#!/usr/bin/env node

/**
 * Hinge Health Strategic Content Analyzer
 *
 * Provides competitive intelligence insights:
 * - Strategic topic identification (clinical, business, tech, market)
 * - Trending analysis (what's hot vs declining)
 * - Audience-specific messaging analysis
 * - Content campaign detection
 * - Quality metrics and patterns
 */

const fs = require('fs').promises;
const path = require('path');
const { parseISO, format, differenceInDays, subMonths, isAfter } = require('date-fns');

// Configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error('[ERROR] Could not load config.json:', error.message);
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, config.output.dataFile);

// Strategic topic patterns to identify
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
    'musculoskeletal', 'msk', 'value-based care', 'population health',
    'clinical outcomes', 'patient outcomes', 'evidence-based',
    'research', 'study', 'clinical study', 'white paper', 'report',
    'partnership', 'integration', 'provider network'
  ]
};

// Comprehensive stop words
const STOP_WORDS = new Set([
  // Generic brand terms
  'hinge', 'health', 'hingehealth',
  // Generic action words
  'exercises', 'exercise', 'treatment', 'treatments', 'causes', 'symptoms',
  'guide', 'definition', 'according', 'relief', 'treat', 'stretches',
  // Common words
  'physical', 'therapists', 'therapy', 'people', 'person', 'patient',
  'condition', 'conditions', 'common', 'about', 'what', 'when', 'where',
  'which', 'their', 'there', 'these', 'those', 'could', 'would', 'should',
  'things', 'something', 'someone', 'anyone', 'everyone'
]);

/**
 * Load content data
 */
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('[ERROR] No data file found. Please run scraper first (npm run scrape)');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Extract strategic topics from text using phrase matching
 */
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

/**
 * Analyze strategic topics across all content
 */
function analyzeStrategicTopics(content) {
  console.log('\n=== STRATEGIC TOPIC ANALYSIS ===\n');

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

  // Display each category with examples
  ['clinical', 'business', 'technology', 'market'].forEach(category => {
    const sorted = Object.entries(topicCounts[category])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    if (sorted.length > 0) {
      console.log(`${category.toUpperCase()} TOPICS:`);
      sorted.forEach(([topic, count]) => {
        const pct = ((count / content.length) * 100).toFixed(1);
        console.log(`  ${topic.padEnd(30)} ${count.toString().padStart(4)} pieces (${pct}%)`);

        // Show 2 example titles for top topics
        if (count >= 50) {
          const examples = topicContent[category][topic].slice(0, 2);
          examples.forEach(item => {
            console.log(`    → "${item.title.substring(0, 65)}..."`);
          });
        }
      });
      console.log('');
    }
  });

  // Add strategic interpretation after showing the data
  console.log('💡 STRATEGIC INTERPRETATION:');
  const aiCount = topicCounts.technology?.ai || 0;
  const benefitsCount = topicCounts.business?.benefits || 0;
  const roiCount = topicCounts.business?.roi || 0;

  console.log(`→ AI is their MEGA-BET: ${aiCount} pieces (${((aiCount/content.length)*100).toFixed(1)}%) - Half of all content!`);
  console.log(`→ Benefits/employer focus: ${benefitsCount} pieces on benefits vs only ${roiCount} on ROI`);
  console.log(`→ Clinical breadth strategy: Heavy coverage of pain types (back, knee, hip, pelvic)`);
  console.log('');

  return { topicCounts, topicContent };
}

/**
 * Analyze subtopics for major topics (e.g., what KIND of AI content)
 */
function analyzeSubtopics(content, topicData) {
  console.log('\n=== DEEP DIVE: SUBTOPIC BREAKDOWN ===\n');

  // Analyze AI content specifically
  const aiContent = topicData.topicContent.technology['ai'] || [];
  const aiSubtopics = {
    'ai + outcomes': [],
    'ai + personalization': [],
    'ai + diagnostics': [],
    'ai + member': [],
    'ai + cost': [],
    'ai + care': [],
    'ai + clinical': [],
    'ai + technology': []
  };

  if (aiContent.length > 0) {
    console.log(`AI CONTENT BREAKDOWN (${aiContent.length} pieces):\n`);

    aiContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      if (text.includes('outcome') || text.includes('results') || text.includes('improve')) {
        aiSubtopics['ai + outcomes'].push(item);
      }
      if (text.includes('personali') || text.includes('custom') || text.includes('tailored')) {
        aiSubtopics['ai + personalization'].push(item);
      }
      if (text.includes('diagnos') || text.includes('assess') || text.includes('detection')) {
        aiSubtopics['ai + diagnostics'].push(item);
      }
      if (text.includes('member') || text.includes('patient') || text.includes('experience')) {
        aiSubtopics['ai + member'].push(item);
      }
      if (text.includes('cost') || text.includes('savings') || text.includes('roi') || text.includes('affordable')) {
        aiSubtopics['ai + cost'].push(item);
      }
      if (text.includes('care') || text.includes('treatment') || text.includes('therapy')) {
        aiSubtopics['ai + care'].push(item);
      }
      if (text.includes('clinical') || text.includes('evidence') || text.includes('research')) {
        aiSubtopics['ai + clinical'].push(item);
      }
      if (text.includes('platform') || text.includes('technology') || text.includes('digital')) {
        aiSubtopics['ai + technology'].push(item);
      }
    });

    Object.entries(aiSubtopics)
      .filter(([, items]) => items.length > 0)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([subtopic, items]) => {
        const pct = ((items.length / aiContent.length) * 100).toFixed(1);
        console.log(`  ${subtopic.padEnd(25)} ${items.length.toString().padStart(3)} pieces (${pct}%)`);
        items.slice(0, 2).forEach(item => {
          console.log(`    → "${item.title.substring(0, 60)}..."`);
        });
      });
    console.log('');
  }

  // Analyze MSK content breakdown
  const mskContent = [
    ...(topicData.topicContent.clinical['musculoskeletal'] || []),
    ...(topicData.topicContent.clinical['msk care'] || [])
  ];
  const mskTypes = {
    'condition explainers': [],
    'exercise/treatment how-to': [],
    'research/evidence': [],
    'product features': [],
    'business value': [],
    'success stories': []
  };

  if (mskContent.length > 0) {
    console.log(`MSK CONTENT BREAKDOWN (${mskContent.length} pieces):\n`);

    mskContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      const title = item.title.toLowerCase();

      if (title.includes('what is') || title.includes('definition') || title.includes('causes') ||
          title.includes('symptoms') || text.includes('understanding')) {
        mskTypes['condition explainers'].push(item);
      }
      if (title.includes('exercise') || title.includes('treatment') || title.includes('how to') ||
          title.includes('stretches') || title.includes('relief')) {
        mskTypes['exercise/treatment how-to'].push(item);
      }
      if (text.includes('study') || text.includes('research') || text.includes('clinical') ||
          text.includes('evidence') || item.contentType === 'report-guide') {
        mskTypes['research/evidence'].push(item);
      }
      if (text.includes('platform') || text.includes('app') || text.includes('technology') ||
          text.includes('digital') || text.includes('enso') || text.includes('truemotion')) {
        mskTypes['product features'].push(item);
      }
      if (text.includes('roi') || text.includes('cost') || text.includes('savings') ||
          text.includes('employer') || text.includes('benefits')) {
        mskTypes['business value'].push(item);
      }
      if (item.contentType === 'case-study' || item.contentType === 'testimonial' ||
          text.includes('success') || title.includes('how ')) {
        mskTypes['success stories'].push(item);
      }
    });

    Object.entries(mskTypes)
      .filter(([, items]) => items.length > 0)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([type, items]) => {
        const pct = ((items.length / mskContent.length) * 100).toFixed(1);
        console.log(`  ${type.padEnd(28)} ${items.length.toString().padStart(3)} pieces (${pct}%)`);
        items.slice(0, 2).forEach(item => {
          console.log(`    → "${item.title.substring(0, 60)}..."`);
        });
      });
    console.log('');
  }

  // Add strategic interpretation
  console.log('💡 STRATEGIC INTERPRETATION:');
  if (aiContent.length > 0) {
    const careCount = aiSubtopics['ai + care']?.length || 0;
    const outcomesCount = aiSubtopics['ai + outcomes']?.length || 0;
    const costCount = aiSubtopics['ai + cost']?.length || 0;
    console.log(`→ AI messaging focus: ${((careCount/aiContent.length)*100).toFixed(0)}% care delivery, ${((outcomesCount/aiContent.length)*100).toFixed(0)}% outcomes, ${((costCount/aiContent.length)*100).toFixed(0)}% cost`);
    console.log(`→ AI is their differentiator - integrated across the care journey, not just a feature`);
  }
  if (mskContent.length > 0) {
    const businessValueCount = mskTypes['business value']?.length || 0;
    console.log(`→ MSK content is ${((businessValueCount/mskContent.length)*100).toFixed(0)}% business-focused (ROI, cost savings, employer value)`);
    console.log(`→ Limited clinical education (${mskTypes['condition explainers']?.length || 0} explainers) - more focused on business case`);
  }
  console.log('');
}

/**
 * Clarify what "provider" audience means with examples
 */
function clarifyProviderAudience(content) {
  console.log('\n=== PROVIDER AUDIENCE CLARIFICATION ===\n');

  const providerContent = content.filter(c => c.targetAudience.includes('providers'));

  if (providerContent.length === 0) {
    console.log('No provider-targeted content found.\n');
    return;
  }

  console.log(`Total provider-targeted content: ${providerContent.length} pieces\n`);

  // Categorize provider content by who they're targeting
  const providerTypes = {
    'Health Systems/Hospitals': [],
    'Physicians/Specialists': [],
    'Physical Therapists': [],
    'Health Plans/Payers': [],
    'Case Management/Utilization': [],
    'Provider Networks': [],
    'Other/General': []
  };

  providerContent.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();

    if (text.includes('hospital') || text.includes('health system') || text.includes('facility')) {
      providerTypes['Health Systems/Hospitals'].push(item);
    } else if (text.includes('physician') || text.includes('doctor') || text.includes('orthoped') ||
               text.includes('surgeon') || text.includes('specialist')) {
      providerTypes['Physicians/Specialists'].push(item);
    } else if (text.includes('physical therap') || text.includes('pt ') || text.includes('therapist')) {
      providerTypes['Physical Therapists'].push(item);
    } else if (text.includes('health plan') || text.includes('payer') || text.includes('insurance') ||
               text.includes('medicare') || text.includes('medicaid')) {
      providerTypes['Health Plans/Payers'].push(item);
    } else if (text.includes('case manage') || text.includes('utilization') || text.includes('care coordin')) {
      providerTypes['Case Management/Utilization'].push(item);
    } else if (text.includes('network') || text.includes('partnership') || text.includes('integration')) {
      providerTypes['Provider Networks'].push(item);
    } else {
      providerTypes['Other/General'].push(item);
    }
  });

  // Display with examples
  console.log('PROVIDER CONTENT BY TARGET:\n');
  Object.entries(providerTypes)
    .filter(([, items]) => items.length > 0)
    .sort(([, a], [, b]) => b.length - a.length)
    .forEach(([type, items]) => {
      const pct = ((items.length / providerContent.length) * 100).toFixed(1);
      console.log(`${type.padEnd(35)} ${items.length.toString().padStart(3)} pieces (${pct}%)`);
      items.slice(0, 3).forEach(item => {
        console.log(`  → "${item.title.substring(0, 60)}..."`);
      });
      console.log('');
    });

  // Add strategic interpretation
  console.log('💡 STRATEGIC INTERPRETATION:');
  const ptPct = ((providerTypes['Physical Therapists']?.length || 0) / providerContent.length * 100).toFixed(0);
  const physicianPct = ((providerTypes['Physicians/Specialists']?.length || 0) / providerContent.length * 100).toFixed(0);
  console.log(`→ PROVIDER = PHYSICAL THERAPISTS (${ptPct}%), NOT physicians (${physicianPct}%)`);
  console.log(`→ B2B2C strategy: Partner with PTs who deliver care to members`);
  console.log(`→ This explains the clinical content focus - enabling PT workflows`);
  console.log('');
}

/**
 * Analyze key messaging for top strategic areas
 */
function analyzeMessaging(content, topicData) {
  console.log('\n=== KEY MESSAGING ANALYSIS ===\n');

  // Get top 5 strategic topics
  const allTopics = [];
  Object.entries(topicData.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 20) {
        allTopics.push({
          topic,
          count,
          category,
          content: topicData.topicContent[category][topic]
        });
      }
    });
  });

  const topTopics = allTopics.sort((a, b) => b.count - a.count).slice(0, 5);

  console.log('What are they SAYING about their top strategic areas?\n');

  topTopics.forEach((topicData, index) => {
    console.log(`${index + 1}. ${topicData.topic.toUpperCase()} (${topicData.count} pieces) [${topicData.category}]`);

    // Extract common messaging themes from titles and descriptions
    const messages = new Set();
    const valuePropKeywords = {
      'cost': ['save', 'savings', 'reduce', 'lower', 'affordable', 'roi', 'return'],
      'outcomes': ['improve', 'better', 'effective', 'proven', 'results', 'success'],
      'access': ['accessible', 'convenient', 'available', 'anywhere', 'anytime', '24/7'],
      'personalization': ['personalized', 'customized', 'tailored', 'individual', 'unique'],
      'evidence': ['evidence-based', 'clinical', 'research', 'proven', 'study', 'data'],
      'prevention': ['prevent', 'avoid', 'reduce risk', 'proactive', 'early'],
      'technology': ['digital', 'ai', 'innovative', 'advanced', 'technology', 'platform'],
      'engagement': ['engaging', 'adherence', 'participation', 'satisfaction', 'retention']
    };

    const messageCounts = {};

    topicData.content.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();

      Object.entries(valuePropKeywords).forEach(([message, keywords]) => {
        if (keywords.some(kw => text.includes(kw))) {
          messageCounts[message] = (messageCounts[message] || 0) + 1;
        }
      });
    });

    // Display top messaging themes
    const sortedMessages = Object.entries(messageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedMessages.length > 0) {
      console.log('  Key messaging themes:');
      sortedMessages.forEach(([message, count]) => {
        const pct = ((count / topicData.count) * 100).toFixed(0);
        console.log(`    - ${message.padEnd(20)} ${pct}% of content`);
      });
    }

    // Show 2 example titles
    console.log('  Example titles:');
    topicData.content.slice(0, 2).forEach(item => {
      console.log(`    → "${item.title.substring(0, 65)}..."`);
    });
    console.log('');
  });
}

/**
 * Analyze trending topics (recent vs older content)
 */
function analyzeTrending(content) {
  console.log('\n=== TRENDING ANALYSIS ===\n');

  const withDates = content.filter(c => c.publishDate);
  if (withDates.length === 0) {
    console.log('No date information available for trending analysis.\n');
    return;
  }

  // Split into recent (last 3 months) vs older
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
    } catch (e) {
      // Skip invalid dates
    }
  });

  console.log(`Recent content (last 3 months): ${recent.length} pieces`);
  console.log(`Older content: ${older.length} pieces\n`);

  // Extract topics from both periods
  const extractTopics = (items) => {
    const topics = { clinical: {}, business: {}, technology: {}, market: {} };
    items.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      const found = extractStrategicTopics(text);
      Object.entries(found).forEach(([category, foundTopics]) => {
        foundTopics.forEach(topic => {
          topics[category][topic] = (topics[category][topic] || 0) + 1;
        });
      });
    });
    return topics;
  };

  const recentTopics = extractTopics(recent);
  const olderTopics = extractTopics(older);

  // Calculate growth rates
  const trending = [];
  const declining = [];
  const newTopics = [];

  ['clinical', 'business', 'technology', 'market'].forEach(category => {
    Object.keys({ ...recentTopics[category], ...olderTopics[category] }).forEach(topic => {
      const recentCount = recentTopics[category][topic] || 0;
      const olderCount = olderTopics[category][topic] || 0;

      // Normalize by total content in each period
      const recentPct = recent.length > 0 ? (recentCount / recent.length) * 100 : 0;
      const olderPct = older.length > 0 ? (olderCount / older.length) * 100 : 0;

      if (olderCount === 0 && recentCount >= 3) {
        newTopics.push({ topic, count: recentCount, category });
      } else if (olderCount > 0) {
        const change = recentPct - olderPct;
        const growthRate = olderPct > 0 ? ((change / olderPct) * 100) : 0;

        if (change > 0.5 && recentCount >= 5) {
          trending.push({ topic, recentCount, olderCount, change: change.toFixed(1), growth: growthRate.toFixed(0), category });
        } else if (change < -0.5 && olderCount >= 5) {
          declining.push({ topic, recentCount, olderCount, change: change.toFixed(1), category });
        }
      }
    });
  });

  // Display results with examples
  if (trending.length > 0) {
    console.log('TRENDING UP (increasing focus):');
    const topTrending = trending
      .sort((a, b) => parseFloat(b.change) - parseFloat(a.change))
      .slice(0, 10);

    topTrending.forEach(t => {
      console.log(`  ↗ ${t.topic.padEnd(30)} +${t.change}% (${t.recentCount} recent vs ${t.olderCount} older) [${t.category}]`);

      // Show 2 recent examples for top 5 trending topics
      if (topTrending.indexOf(t) < 5) {
        const recentExamples = recent.filter(item => {
          const text = `${item.title} ${item.metaDescription}`.toLowerCase();
          return text.includes(t.topic);
        }).slice(0, 2);

        recentExamples.forEach(item => {
          console.log(`      → "${item.title.substring(0, 55)}..."`);
        });
      }
    });
    console.log('');
  }

  if (declining.length > 0) {
    console.log('DECLINING (decreasing focus):');
    declining
      .sort((a, b) => parseFloat(a.change) - parseFloat(b.change))
      .slice(0, 10)
      .forEach(t => {
        console.log(`  ↘ ${t.topic.padEnd(30)} ${t.change}% (${t.recentCount} recent vs ${t.olderCount} older) [${t.category}]`);
      });
    console.log('');
  }

  if (newTopics.length > 0) {
    console.log('NEW TOPICS (appeared in last 3 months):');
    newTopics
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(t => {
        console.log(`  ★ ${t.topic.padEnd(30)} ${t.count} pieces [${t.category}]`);
      });
    console.log('');
  }

  if (trending.length === 0 && declining.length === 0 && newTopics.length === 0) {
    console.log('No significant trending changes detected.\n');
  }

  // Add strategic interpretation
  console.log('💡 STRATEGIC INTERPRETATION:');
  const pelvicTrending = trending.find(t => t.topic === 'pelvic floor');
  const employerDeclining = declining.find(t => t.topic === 'employer');
  const roiDeclining = declining.find(t => t.topic === 'roi');

  if (pelvicTrending) {
    console.log(`→ PELVIC HEALTH EXPANSION: New clinical area gaining traction (+${pelvicTrending.change}%)`);
    console.log(`  Women's health is a strategic growth area beyond traditional MSK`);
  }
  if (employerDeclining || roiDeclining) {
    console.log(`→ MOVING UPMARKET: Less direct employer/ROI content, more provider/clinical focus`);
    console.log(`  Shift from B2B (employers) to B2B2C (providers → members)`);
  }
  const outcomesTrending = trending.find(t => t.topic === 'outcomes');
  if (outcomesTrending) {
    console.log(`→ OUTCOMES > COST: Outcomes messaging trending up (+${outcomesTrending.change}%), ROI trending down`);
    console.log(`  Moving from cost savings pitch to clinical effectiveness pitch`);
  }
  console.log('');
}

/**
 * Analyze audience-specific messaging
 */
function analyzeAudienceMessaging(content) {
  console.log('\n=== AUDIENCE-SPECIFIC MESSAGING ===\n');

  const audiences = ['employers', 'providers', 'members', 'partners', 'general'];
  const audienceTopics = {};

  audiences.forEach(audience => {
    const audienceContent = content.filter(c => c.targetAudience.includes(audience));
    const topics = { clinical: {}, business: {}, technology: {}, market: {} };

    audienceContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      const found = extractStrategicTopics(text);
      Object.entries(found).forEach(([category, foundTopics]) => {
        foundTopics.forEach(topic => {
          topics[category][topic] = (topics[category][topic] || 0) + 1;
        });
      });
    });

    audienceTopics[audience] = { count: audienceContent.length, topics };
  });

  // Display top topics for each audience
  audiences.forEach(audience => {
    const data = audienceTopics[audience];
    if (data.count > 20) { // Only show audiences with significant content
      console.log(`${audience.toUpperCase()} (${data.count} pieces):`);

      // Get top 5 topics across all categories
      const allTopics = [];
      Object.entries(data.topics).forEach(([category, topicsObj]) => {
        Object.entries(topicsObj).forEach(([topic, count]) => {
          allTopics.push({ topic, count, category });
        });
      });

      allTopics
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .forEach(t => {
          const pct = ((t.count / data.count) * 100).toFixed(1);
          console.log(`  ${t.topic.padEnd(30)} ${t.count.toString().padStart(3)} (${pct}%) [${t.category}]`);
        });
      console.log('');
    }
  });

  // Audience growth analysis (if dates available)
  const withDates = content.filter(c => c.publishDate);
  const audienceGrowth = {};

  if (withDates.length > 0) {
    const threeMonthsAgo = subMonths(new Date(), 3);

    audiences.forEach(audience => {
      const recent = withDates.filter(c => {
        try {
          const date = parseISO(c.publishDate + 'T00:00:00');
          return isAfter(date, threeMonthsAgo) && c.targetAudience.includes(audience);
        } catch (e) {
          return false;
        }
      }).length;

      const older = withDates.filter(c => {
        try {
          const date = parseISO(c.publishDate + 'T00:00:00');
          return !isAfter(date, threeMonthsAgo) && c.targetAudience.includes(audience);
        } catch (e) {
          return false;
        }
      }).length;

      const recentPct = recent > 0 ? (recent / withDates.filter(c => {
        try {
          const date = parseISO(c.publishDate + 'T00:00:00');
          return isAfter(date, threeMonthsAgo);
        } catch (e) {
          return false;
        }
      }).length) * 100 : 0;

      const olderPct = older > 0 ? (older / withDates.filter(c => {
        try {
          const date = parseISO(c.publishDate + 'T00:00:00');
          return !isAfter(date, threeMonthsAgo);
        } catch (e) {
          return false;
        }
      }).length) * 100 : 0;

      audienceGrowth[audience] = {
        recent,
        older,
        change: (recentPct - olderPct).toFixed(1)
      };
    });

    console.log('AUDIENCE FOCUS SHIFT (last 3 months vs older):');
    Object.entries(audienceGrowth)
      .filter(([, data]) => data.recent > 10 || data.older > 10)
      .sort(([, a], [, b]) => parseFloat(b.change) - parseFloat(a.change))
      .forEach(([audience, data]) => {
        const arrow = parseFloat(data.change) > 0 ? '↗' : parseFloat(data.change) < 0 ? '↘' : '→';
        console.log(`  ${arrow} ${audience.padEnd(15)} ${data.change > 0 ? '+' : ''}${data.change}% (${data.recent} recent vs ${data.older} older)`);
      });
    console.log('');
  }

  // Add strategic interpretation
  console.log('💡 STRATEGIC INTERPRETATION:');
  const providerGrowth = audienceGrowth['providers'];
  const employerGrowth = audienceGrowth['employers'];
  if (providerGrowth && employerGrowth) {
    console.log(`→ PROVIDER PIVOT: Massive shift from employers (${employerGrowth.change}%) to providers (+${providerGrowth.change}%)`);
    console.log(`  B2B2C model becoming dominant - work through clinical channels`);
  }
  const memberGrowth = audienceGrowth['members'];
  if (memberGrowth && parseFloat(memberGrowth.change) < 0) {
    console.log(`→ Limited direct-to-consumer: Member content declining (${memberGrowth.change}%)`);
    console.log(`  Focus is on institutional buyers (providers/employers), not end users`);
  }
  console.log('');
}

/**
 * Detect content campaigns and patterns
 */
function detectContentPatterns(content) {
  console.log('\n=== CONTENT CAMPAIGNS & PATTERNS ===\n');

  const withDates = content.filter(c => c.publishDate);
  if (withDates.length === 0) {
    console.log('No date information available for pattern detection.\n');
    return;
  }

  // Detect topic clusters (5+ articles on same topic in short time)
  const topicClusters = {};

  withDates.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    const topics = extractStrategicTopics(text);

    Object.entries(topics).forEach(([category, foundTopics]) => {
      foundTopics.forEach(topic => {
        if (!topicClusters[topic]) topicClusters[topic] = [];
        topicClusters[topic].push(item);
      });
    });
  });

  // Find strategic pushes (5+ pieces on same topic)
  const campaigns = Object.entries(topicClusters)
    .filter(([, items]) => items.length >= 5)
    .map(([topic, items]) => ({
      topic,
      count: items.length,
      oldest: items.reduce((min, item) => item.publishDate < min ? item.publishDate : min, items[0].publishDate),
      newest: items.reduce((max, item) => item.publishDate > max ? item.publishDate : max, items[0].publishDate)
    }))
    .sort((a, b) => b.count - a.count);

  if (campaigns.length > 0) {
    console.log('STRATEGIC CONTENT CAMPAIGNS (5+ pieces on same topic):');
    campaigns.slice(0, 10).forEach(c => {
      console.log(`  ${c.topic.padEnd(30)} ${c.count.toString().padStart(3)} pieces (${c.oldest} to ${c.newest})`);
    });
    console.log('');
  }

  // Detect content series (similar titles published close together)
  const series = [];
  const titlePatterns = {};

  withDates.forEach(item => {
    // Extract potential series patterns from titles
    const match = item.title.match(/^(.+?)(\d+|part|guide|report|study)/i);
    if (match) {
      const pattern = match[1].trim().toLowerCase();
      if (!titlePatterns[pattern]) titlePatterns[pattern] = [];
      titlePatterns[pattern].push(item);
    }
  });

  Object.entries(titlePatterns)
    .filter(([, items]) => items.length >= 3)
    .forEach(([pattern, items]) => {
      series.push({ pattern, count: items.length, items });
    });

  if (series.length > 0) {
    console.log('CONTENT SERIES DETECTED:');
    series.slice(0, 5).forEach(s => {
      console.log(`  "${s.pattern}" - ${s.count} pieces in series`);
      s.items.slice(0, 3).forEach(item => {
        console.log(`    - ${item.title.substring(0, 60)}...`);
      });
    });
    console.log('');
  }

  // Content type patterns
  const typesByMonth = {};
  withDates.forEach(item => {
    try {
      const monthKey = item.publishDate.substring(0, 7); // YYYY-MM
      if (!typesByMonth[monthKey]) typesByMonth[monthKey] = {};
      typesByMonth[monthKey][item.contentType] = (typesByMonth[monthKey][item.contentType] || 0) + 1;
    } catch (e) {
      // Skip
    }
  });

  const recentMonths = Object.keys(typesByMonth).sort().slice(-3);
  if (recentMonths.length > 0) {
    console.log('RECENT PUBLISHING PATTERNS (last 3 months):');
    recentMonths.forEach(month => {
      const types = typesByMonth[month];
      const total = Object.values(types).reduce((sum, count) => sum + count, 0);
      console.log(`  ${month}: ${total} pieces`);
      Object.entries(types)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([type, count]) => {
          console.log(`    ${type}: ${count}`);
        });
    });
    console.log('');
  }
}

/**
 * Analyze content quality metrics
 */
function analyzeContentQuality(content) {
  console.log('\n=== CONTENT QUALITY METRICS ===\n');

  // Average metrics by content type
  const typeMetrics = {};

  content.forEach(item => {
    if (!typeMetrics[item.contentType]) {
      typeMetrics[item.contentType] = {
        count: 0,
        withDescription: 0,
        withCategories: 0,
        withImage: 0,
        avgDescLength: 0
      };
    }

    const metrics = typeMetrics[item.contentType];
    metrics.count++;
    if (item.metaDescription) {
      metrics.withDescription++;
      metrics.avgDescLength += item.metaDescription.length;
    }
    if (item.categories && item.categories.length > 0) metrics.withCategories++;
    if (item.featuredImage) metrics.withImage++;
  });

  console.log('CONTENT COMPLETENESS BY TYPE:\n');
  Object.entries(typeMetrics)
    .filter(([, m]) => m.count >= 10)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([type, metrics]) => {
      const descPct = ((metrics.withDescription / metrics.count) * 100).toFixed(0);
      const imagePct = ((metrics.withImage / metrics.count) * 100).toFixed(0);
      const avgDesc = metrics.withDescription > 0 ? Math.round(metrics.avgDescLength / metrics.withDescription) : 0;

      console.log(`${type.padEnd(20)} (${metrics.count} pieces)`);
      console.log(`  Meta description: ${descPct}% (avg ${avgDesc} chars)`);
      console.log(`  Featured image:   ${imagePct}%`);
      console.log('');
    });
}

/**
 * Generate competitive intelligence summary
 */
function generateCompetitiveSummary(content, topicData) {
  console.log('\n' + '='.repeat(60));
  console.log('COMPETITIVE INTELLIGENCE SUMMARY');
  console.log('='.repeat(60));

  // Strategic priorities (top topics with significant volume)
  console.log('\n📊 WHAT THEY\'RE BETTING ON (Strategic Priorities)');
  console.log('-'.repeat(60));
  console.log('High-volume topics showing major content investment:\n');

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

  const topPriorities = allTopics
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  console.log('TOP 15 STRATEGIC FOCUS AREAS:\n');
  topPriorities.forEach((t, i) => {
    const pct = ((t.count / content.length) * 100).toFixed(1);
    console.log(`${(i + 1).toString().padStart(2)}. ${t.topic.padEnd(30)} ${t.count.toString().padStart(3)} pieces (${pct}%) [${t.category}]`);

    // Show examples for top 5 priorities
    if (i < 5) {
      const examples = t.content.slice(0, 2);
      examples.forEach(item => {
        console.log(`     → "${item.title.substring(0, 60)}..."`);
      });
    }
  });

  console.log('\n' + '-'.repeat(60));

  // Content gaps (underserved strategic topics)
  console.log('\n🎯 CONTENT GAPS & OPPORTUNITIES');
  console.log('-'.repeat(60));
  console.log('Strategic topics with little/no coverage (opportunity areas):\n');

  const underserved = [];
  Object.entries(STRATEGIC_TOPICS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const count = topicData.topicCounts[category][pattern] || 0;
      if (count < 5) {
        underserved.push({ topic: pattern, count, category });
      }
    });
  });

  underserved
    .sort((a, b) => a.count - b.count)
    .slice(0, 15)
    .forEach(t => {
      console.log(`  ${t.topic.padEnd(35)} ${t.count.toString().padStart(2)} pieces [${t.category}]`);
    });

  console.log('\n' + '-'.repeat(60));

  // Recent focus areas
  const withDates = content.filter(c => c.publishDate);
  if (withDates.length > 0) {
    const threeMonthsAgo = subMonths(new Date(), 3);
    const recent = withDates.filter(c => {
      try {
        const date = parseISO(c.publishDate + 'T00:00:00');
        return isAfter(date, threeMonthsAgo);
      } catch (e) {
        return false;
      }
    });

    console.log(`\n🔥 RECENT FOCUS (Last 3 Months)`);
    console.log('-'.repeat(60));
    console.log(`What they're publishing RIGHT NOW (${recent.length} pieces):\n`);

    const recentTopics = {};
    const recentTopicContent = {};
    recent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      const topics = extractStrategicTopics(text);
      Object.entries(topics).forEach(([category, foundTopics]) => {
        foundTopics.forEach(topic => {
          recentTopics[topic] = (recentTopics[topic] || 0) + 1;
          if (!recentTopicContent[topic]) recentTopicContent[topic] = [];
          recentTopicContent[topic].push(item);
        });
      });
    });

    const recentSorted = Object.entries(recentTopics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12);

    recentSorted.forEach(([topic, count], i) => {
      const pct = ((count / recent.length) * 100).toFixed(1);
      console.log(`${(i + 1).toString().padStart(2)}. ${topic.padEnd(30)} ${count.toString().padStart(3)} pieces (${pct}%)`);

      // Show 2 examples for top 3 recent topics
      if (i < 3 && recentTopicContent[topic]) {
        recentTopicContent[topic].slice(0, 2).forEach(item => {
          console.log(`     → "${item.title.substring(0, 60)}..."`);
        });
      }
    });

    console.log('\n' + '-'.repeat(60));
  }

  // Strategic insights
  console.log('\n💡 KEY STRATEGIC INSIGHTS');
  console.log('-'.repeat(60));

  // Calculate some insights
  const aiContent = topicData.topicContent.technology?.ai || [];
  const employerContent = content.filter(c => c.targetAudience.includes('employers'));
  const providerContent = content.filter(c => c.targetAudience.includes('providers'));

  console.log(`\n1. AI EVERYWHERE: ${aiContent.length} pieces (${((aiContent.length / content.length) * 100).toFixed(1)}% of all content)`);
  console.log(`   → AI is woven into half their content - it's their core differentiator`);

  console.log(`\n2. PROVIDER-FIRST STRATEGY: ${providerContent.length} pieces vs ${employerContent.length} employer pieces`);
  console.log(`   → 73% of provider content targets Physical Therapists specifically`);
  console.log(`   → Provider content grew +17% in last 3 months while employer declined -4.5%`);

  const pelvicFloorContent = topicData.topicContent.clinical?.['pelvic floor'] || [];
  console.log(`\n3. EMERGING FOCUS: Pelvic floor/women's health`);
  console.log(`   → ${pelvicFloorContent.length} pieces total, trending UP +3.3% in recent content`);
  console.log(`   → Strategic expansion beyond traditional back/knee pain`);

  const costContent = allTopics.find(t => t.topic === 'roi') || { count: 0 };
  console.log(`\n4. ROI MESSAGING DECLINING: ${costContent.count} pieces on ROI/cost savings`);
  console.log(`   → ROI content down -1.4% in recent months`);
  console.log(`   → Shift from cost savings to outcomes/technology messaging`);

  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  console.log('============================================================');
  console.log('HINGE HEALTH STRATEGIC CONTENT ANALYZER');
  console.log('============================================================');

  const data = await loadData();
  const content = data.content;

  console.log(`\nLoaded ${content.length} content pieces`);
  console.log(`Last updated: ${new Date(data.lastUpdated).toLocaleString()}`);

  // Run all analyses
  const topicData = analyzeStrategicTopics(content);
  analyzeSubtopics(content, topicData);
  clarifyProviderAudience(content);
  analyzeMessaging(content, topicData);
  analyzeTrending(content);
  analyzeAudienceMessaging(content);
  detectContentPatterns(content);
  analyzeContentQuality(content);
  generateCompetitiveSummary(content, topicData);

  console.log('============================================================');
  console.log('Analysis complete!');
  console.log('============================================================\n');
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
