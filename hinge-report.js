#!/usr/bin/env node

/**
 * Hinge Health Formatted Competitive Intelligence Report
 * Generates a structured, executive-ready report
 */

const fs = require('fs').promises;
const path = require('path');
const { parseISO, format, subMonths, isAfter } = require('date-fns');

const DATA_FILE = path.join(__dirname, 'hinge-content.json');

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

async function loadData() {
  const data = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

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

function gatherAllData(content) {
  // Topic analysis
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

  // Trending analysis
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

  const getTrendingData = () => {
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
          change: change.toFixed(1),
          recentCount,
          olderCount,
          examples: recentData.topicContent[topic]?.slice(0, 2) || []
        });
      } else if (change < -0.5 && olderCount >= 5) {
        declining.push({
          topic,
          change: change.toFixed(1),
          recentCount,
          olderCount
        });
      }
    });

    return {
      trending: trending.sort((a, b) => parseFloat(b.change) - parseFloat(a.change)),
      declining: declining.sort((a, b) => parseFloat(a.change) - parseFloat(b.change))
    };
  };

  const trendingData = getTrendingData();

  // Audience analysis
  const audiences = ['providers', 'employers', 'partners', 'members', 'general'];
  const audienceCounts = {};

  audiences.forEach(aud => {
    audienceCounts[aud] = content.filter(c => c.targetAudience.includes(aud)).length;
  });

  // Provider breakdown
  const providerContent = content.filter(c => c.targetAudience.includes('providers'));
  const providerBreakdown = {
    pt: 0,
    physician: 0,
    payer: 0,
    other: 0
  };

  providerContent.forEach(item => {
    const text = `${item.title} ${item.metaDescription}`.toLowerCase();
    if (text.includes('physical therap') || text.includes('pt ') || text.includes('therapist')) {
      providerBreakdown.pt++;
    } else if (text.includes('physician') || text.includes('doctor') || text.includes('orthoped')) {
      providerBreakdown.physician++;
    } else if (text.includes('health plan') || text.includes('payer') || text.includes('insurance')) {
      providerBreakdown.payer++;
    } else {
      providerBreakdown.other++;
    }
  });

  // Audience shifts
  const audienceShifts = {};
  audiences.forEach(aud => {
    const recentAud = recent.filter(c => c.targetAudience.includes(aud)).length;
    const olderAud = older.filter(c => c.targetAudience.includes(aud)).length;

    const recentPct = recent.length > 0 ? (recentAud / recent.length) * 100 : 0;
    const olderPct = older.length > 0 ? (olderAud / older.length) * 100 : 0;

    audienceShifts[aud] = (recentPct - olderPct).toFixed(1);
  });

  // Quality metrics
  let withDesc = 0, withImage = 0, totalDescLen = 0;
  content.forEach(item => {
    if (item.metaDescription) {
      withDesc++;
      totalDescLen += item.metaDescription.length;
    }
    if (item.featuredImage) withImage++;
  });

  return {
    topicCounts,
    topicContent,
    trendingData,
    recent,
    older,
    audienceCounts,
    providerContent,
    providerBreakdown,
    audienceShifts,
    withDates,
    quality: {
      descPct: ((withDesc / content.length) * 100).toFixed(0),
      imagePct: ((withImage / content.length) * 100).toFixed(0),
      avgDescLen: withDesc > 0 ? Math.round(totalDescLen / withDesc) : 0
    }
  };
}

function generateReport(data, content, analytics) {
  const dates = analytics.withDates.map(c => c.publishDate).filter(d => d).sort();
  const earliest = dates.length > 0 ? dates[0] : 'N/A';
  const latest = dates.length > 0 ? dates[dates.length - 1] : 'N/A';
  const datesPct = ((analytics.withDates.length / content.length) * 100).toFixed(1);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('HINGE HEALTH COMPETITIVE INTELLIGENCE REPORT');
  console.log(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 CONTENT OVERVIEW');
  console.log(`- Total pieces analyzed: ${content.length.toLocaleString()}`);
  console.log(`- Date range: ${earliest} to ${latest}`);
  console.log(`- Content with dates: ${datesPct}%`);
  console.log('');

  printStrategicPriorities(content, analytics);
  printTrendingUp(analytics.trendingData.trending);
  printDeclining(analytics.trendingData.declining);
  printAudienceStrategy(analytics, content.length);
  printMessaging(analytics, content);
  printCampaigns(analytics);
  printContentGaps(analytics.topicCounts);
  printQuality(analytics.quality);
  printKeyInsights(content, analytics);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('END OF REPORT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

function printStrategicPriorities(content, analytics) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎯 STRATEGIC PRIORITIES (What They\'re Betting On)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Top Strategic Focus Areas:');
  console.log('');

  const allTopics = [];
  Object.entries(analytics.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 10) {
        allTopics.push({
          topic,
          count,
          category,
          content: analytics.topicContent[category][topic]
        });
      }
    });
  });

  const top10 = allTopics.sort((a, b) => b.count - a.count).slice(0, 10);

  top10.forEach((t, i) => {
    const pct = ((t.count / content.length) * 100).toFixed(1);

    if (i === 0 && t.topic === 'ai') {
      console.log(`${i + 1}. AI - ${t.count} pieces (${pct}%) - Core differentiator, integrated across care journey`);
      console.log('   Subtopics:');

      const aiSubtopics = {
        'care': 0, 'outcomes': 0, 'cost': 0, 'member': 0, 'personalization': 0, 'clinical': 0
      };

      t.content.forEach(item => {
        const text = `${item.title} ${item.metaDescription}`.toLowerCase();
        if (text.includes('care') || text.includes('treatment') || text.includes('therapy')) aiSubtopics.care++;
        if (text.includes('outcome') || text.includes('results') || text.includes('improve')) aiSubtopics.outcomes++;
        if (text.includes('cost') || text.includes('savings') || text.includes('roi')) aiSubtopics.cost++;
        if (text.includes('member') || text.includes('patient') || text.includes('experience')) aiSubtopics.member++;
        if (text.includes('personali') || text.includes('custom') || text.includes('tailored')) aiSubtopics.personalization++;
        if (text.includes('clinical') || text.includes('evidence') || text.includes('research')) aiSubtopics.clinical++;
      });

      Object.entries(aiSubtopics).sort(([, a], [, b]) => b - a).forEach(([sub, count]) => {
        if (count > 0) {
          const subPct = ((count / t.count) * 100).toFixed(1);
          console.log(`   - AI + ${sub}: ${count} pieces (${subPct}%)`);
        }
      });

      console.log('');
      console.log('   Examples:');
      t.content.slice(0, 2).forEach(item => {
        console.log(`   - "${item.title}"`);
      });
    } else if (i === 1 && t.topic === 'musculoskeletal') {
      console.log(`${i + 1}. Musculoskeletal/MSK - ${t.count} pieces (${pct}%) - Foundational clinical content`);
      console.log('   Content Types:');

      const mskTypes = {
        'Business value': 0, 'Product features': 0, 'Exercise/treatment': 0,
        'Success stories': 0, 'Research/evidence': 0, 'Condition explainers': 0
      };

      t.content.forEach(item => {
        const text = `${item.title} ${item.metaDescription}`.toLowerCase();
        const title = item.title.toLowerCase();
        if (text.includes('roi') || text.includes('cost') || text.includes('savings') || text.includes('employer')) mskTypes['Business value']++;
        if (text.includes('platform') || text.includes('app') || text.includes('technology') || text.includes('digital')) mskTypes['Product features']++;
        if (title.includes('exercise') || title.includes('treatment') || title.includes('how to')) mskTypes['Exercise/treatment']++;
        if (item.contentType === 'case-study' || text.includes('success')) mskTypes['Success stories']++;
        if (text.includes('study') || text.includes('research') || text.includes('evidence')) mskTypes['Research/evidence']++;
        if (title.includes('what is') || title.includes('causes') || title.includes('symptoms')) mskTypes['Condition explainers']++;
      });

      Object.entries(mskTypes).sort(([, a], [, b]) => b - a).forEach(([type, count]) => {
        if (count > 0) {
          const typePct = ((count / t.count) * 100).toFixed(1);
          console.log(`   - ${type}: ${count} pieces (${typePct}%)`);
        }
      });

      console.log('');
      console.log('   Examples:');
      t.content.slice(0, 2).forEach(item => {
        console.log(`   - "${item.title}"`);
      });
    } else {
      let interp = '';
      if (t.topic === 'benefits') interp = ' - Employer value proposition';
      else if (t.topic === 'physical therapy') interp = ' - Enabling PT workflows';
      else if (t.topic === 'back pain') interp = ' - Core pain condition';
      else if (t.topic === 'pelvic floor') interp = ' - Women\'s health expansion';

      console.log(`${i + 1}. ${t.topic.charAt(0).toUpperCase() + t.topic.slice(1)} - ${t.count} pieces (${pct}%)${interp}`);
      console.log('   Examples:');
      t.content.slice(0, 2).forEach(item => {
        console.log(`   - "${item.title}"`);
      });
    }
    console.log('');
  });
}

function printTrendingUp(trending) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('📈 TRENDING UP (Growing Focus - Last 3 Months)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Hot Topics:');
  console.log('');

  trending.slice(0, 8).forEach(t => {
    let interp = '';
    if (t.topic === 'pelvic floor') interp = ' - Women\'s health expansion';
    else if (t.topic === 'outcomes') interp = ' - Shift from cost to outcomes';
    else if (t.topic === 'app') interp = ' - User experience focus';

    console.log(`- ${t.topic}: +${t.change}%${interp}`);
    if (t.examples && t.examples.length > 0) {
      const ex1 = t.examples[0]?.title || '';
      const ex2 = t.examples[1]?.title || '';
      console.log(`  Examples: "${ex1.substring(0, 50)}...", "${ex2.substring(0, 50)}..."`);
    }
    console.log('');
  });
}

function printDeclining(declining) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('📉 DECLINING (Decreasing Focus)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Cooling Off:');

  declining.slice(0, 8).forEach(t => {
    let interp = '';
    if (t.topic === 'employer' || t.topic === 'employers') interp = ' - Moving away from direct B2B';
    else if (t.topic === 'roi') interp = ' - Less cost-focused';

    console.log(`- ${t.topic}: ${t.change}%${interp}`);
  });
  console.log('');
}

function printAudienceStrategy(analytics, totalContent) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('👥 AUDIENCE STRATEGY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Target Audience Breakdown:');

  const sorted = Object.entries(analytics.audienceCounts).sort(([, a], [, b]) => b - a);
  sorted.forEach(([aud, count], i) => {
    const pct = ((count / totalContent) * 100).toFixed(1);
    console.log(`${i + 1}. ${aud.charAt(0).toUpperCase() + aud.slice(1)} - ${count} pieces (${pct}%)`);
  });

  console.log('');
  console.log('Provider Audience Deep Dive:');
  const ptPct = ((analytics.providerBreakdown.pt / analytics.providerContent.length) * 100).toFixed(1);
  const physPct = ((analytics.providerBreakdown.physician / analytics.providerContent.length) * 100).toFixed(1);
  const payerPct = ((analytics.providerBreakdown.payer / analytics.providerContent.length) * 100).toFixed(1);
  const otherPct = ((analytics.providerBreakdown.other / analytics.providerContent.length) * 100).toFixed(1);

  console.log(`- Physical Therapists: ${ptPct}% of provider content`);
  console.log(`- Physicians/Specialists: ${physPct}%`);
  console.log(`- Health Plans/Payers: ${payerPct}%`);
  console.log(`- Other/General: ${otherPct}%`);

  console.log('');
  console.log(`Strategic Insight: Provider = Physical Therapists (${ptPct}%), NOT physicians (${physPct}%)`);
  console.log('B2B2C strategy - Partner with PTs who deliver care to members');

  console.log('');
  console.log('Audience Shifts (Last 3 Months):');
  const growing = [];
  const shrinking = [];

  Object.entries(analytics.audienceShifts).forEach(([aud, change]) => {
    if (parseFloat(change) > 0) {
      growing.push(`${aud} +${change}%`);
    } else if (parseFloat(change) < 0) {
      shrinking.push(`${aud} ${change}%`);
    }
  });

  console.log(`- Growing: ${growing.join(', ')}`);
  console.log(`- Declining: ${shrinking.join(', ')}`);
  console.log('');
}

function printMessaging(analytics, content) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('💬 MESSAGING ANALYSIS (What They\'re Saying)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('By Topic:');

  const aiContent = analytics.topicContent.technology?.ai || [];
  if (aiContent.length > 0) {
    let tech = 0, outcomes = 0, cost = 0;
    aiContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      if (text.includes('technology') || text.includes('digital') || text.includes('ai')) tech++;
      if (text.includes('outcome') || text.includes('results') || text.includes('improve')) outcomes++;
      if (text.includes('cost') || text.includes('savings') || text.includes('roi')) cost++;
    });
    const techPct = ((tech / aiContent.length) * 100).toFixed(0);
    const outPct = ((outcomes / aiContent.length) * 100).toFixed(0);
    const costPct = ((cost / aiContent.length) * 100).toFixed(0);
    console.log(`- AI: ${techPct}% technology, ${outPct}% outcomes, ${costPct}% cost`);
  }

  const benefitsContent = analytics.topicContent.business?.benefits || [];
  if (benefitsContent.length > 0) {
    let tech = 0, outcomes = 0, cost = 0;
    benefitsContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      if (text.includes('technology') || text.includes('digital')) tech++;
      if (text.includes('outcome') || text.includes('results')) outcomes++;
      if (text.includes('cost') || text.includes('savings')) cost++;
    });
    const techPct = ((tech / benefitsContent.length) * 100).toFixed(0);
    const outPct = ((outcomes / benefitsContent.length) * 100).toFixed(0);
    const costPct = ((cost / benefitsContent.length) * 100).toFixed(0);
    console.log(`- Benefits: ${techPct}% technology, ${outPct}% outcomes, ${costPct}% cost`);
  }

  const ptContent = analytics.topicContent.clinical?.['physical therapy'] || [];
  if (ptContent.length > 0) {
    let tech = 0, prevention = 0, outcomes = 0;
    ptContent.forEach(item => {
      const text = `${item.title} ${item.metaDescription}`.toLowerCase();
      if (text.includes('technology') || text.includes('digital')) tech++;
      if (text.includes('prevent') || text.includes('proactive')) prevention++;
      if (text.includes('outcome') || text.includes('results')) outcomes++;
    });
    const techPct = ((tech / ptContent.length) * 100).toFixed(0);
    const prevPct = ((prevention / ptContent.length) * 100).toFixed(0);
    const outPct = ((outcomes / ptContent.length) * 100).toFixed(0);
    console.log(`- Physical Therapy: ${techPct}% technology, ${prevPct}% prevention, ${outPct}% outcomes`);
  }

  console.log('');
  console.log('Key Claims They Make:');
  console.log('- AI-powered personalization across the care journey');
  console.log('- Clinically proven outcomes and pain reduction');
  console.log('- Cost savings and ROI for employers');
  console.log('- Virtual care delivery through physical therapists');
  console.log('');
}

function printCampaigns(analytics) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('🚀 CONTENT CAMPAIGNS DETECTED');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Major Strategic Pushes:');

  const campaigns = [];
  Object.entries(analytics.topicCounts).forEach(([category, topics]) => {
    Object.entries(topics).forEach(([topic, count]) => {
      if (count >= 50) {
        let interp = '';
        if (topic === 'ai') interp = ' - Multi-year AI positioning campaign';
        else if (topic === 'benefits') interp = ' - Sustained employer education';
        else if (topic === 'pelvic floor') interp = ' - New women\'s health initiative';
        campaigns.push({ topic, count, interp });
      }
    });
  });

  campaigns.sort((a, b) => b.count - a.count).slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.topic} - ${c.count} pieces${c.interp}`);
  });
  console.log('');
}

function printContentGaps(topicCounts) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('⚠️  CONTENT GAPS (Your Opportunities)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Topics They DON\'T Cover:');

  const gaps = [];
  Object.entries(STRATEGIC_TOPICS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const count = topicCounts[category][pattern] || 0;
      if (count === 0) {
        let why = '';
        if (pattern === 'member engagement') why = ' - Opportunity to own engagement narrative';
        else if (pattern === 'value-based care') why = ' - Major market trend they\'re missing';
        else if (pattern === 'telemedicine') why = ' - Broader digital health gap';
        gaps.push({ topic: pattern, why });
      }
    });
  });

  gaps.slice(0, 10).forEach(g => {
    console.log(`- ${g.topic} (0 pieces)${g.why}`);
  });

  console.log('');
  console.log('Limited Coverage:');
  const limited = [];
  Object.entries(STRATEGIC_TOPICS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const count = topicCounts[category][pattern] || 0;
      if (count > 0 && count < 5) {
        limited.push({ topic: pattern, count });
      }
    });
  });

  limited.slice(0, 5).forEach(l => {
    console.log(`- ${l.topic} (${l.count} pieces) - Opportunity to dominate this topic`);
  });
  console.log('');
}

function printQuality(quality) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('💎 QUALITY METRICS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log(`- Meta descriptions: ${quality.descPct}%`);
  console.log(`- Featured images: ${quality.imagePct}%`);
  console.log(`- Average description length: ${quality.avgDescLen} chars`);
  console.log('');
}

function printKeyInsights(content, analytics) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('💡 KEY STRATEGIC INSIGHTS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');

  // Read insights from intelligence JSON (fully dynamic)
  try {
    const intelligenceData = require('./hinge-intelligence.json');

    if (intelligenceData.keyInsights && intelligenceData.keyInsights.length > 0) {
      intelligenceData.keyInsights.forEach((insight, i) => {
        console.log(`${i + 1}. ${insight.title}: ${insight.data}`);

        // Wrap insight text to fit within 80 chars
        const words = insight.insight.split(' ');
        let line = '   ';
        words.forEach(word => {
          if (line.length + word.length + 1 > 80) {
            console.log(line);
            line = '   ' + word;
          } else {
            line += (line.length > 3 ? ' ' : '') + word;
          }
        });
        if (line.length > 3) console.log(line);
        console.log('');
      });
    } else {
      console.log('No significant insights detected in current data.');
      console.log('');
    }
  } catch (error) {
    console.log('Error loading insights:', error.message);
    console.log('');
  }
}

async function main() {
  try {
    const data = await loadData();
    const content = data.content;
    const analytics = gatherAllData(content);
    generateReport(data, content, analytics);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
