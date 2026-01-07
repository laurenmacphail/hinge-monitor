#!/usr/bin/env node

/**
 * Update audience tags for all existing content with improved detection
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'hinge-content.json');

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

async function updateAudienceTags() {
  console.log('Loading existing content...');
  const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));

  console.log(`Updating audience tags for ${data.content.length} items...\n`);

  // Track changes
  let changed = 0;
  const oldCounts = {};
  const newCounts = {};

  data.content.forEach(item => {
    // Merge whitepaper into report-guide content type
    if (item.contentType === 'whitepaper') {
      item.contentType = 'report-guide';
    }

    // Track old audiences
    item.targetAudience.forEach(aud => {
      oldCounts[aud] = (oldCounts[aud] || 0) + 1;
    });

    // Update with new logic
    const oldAudience = [...item.targetAudience];
    item.targetAudience = determineAudience(item);

    // Track new audiences
    item.targetAudience.forEach(aud => {
      newCounts[aud] = (newCounts[aud] || 0) + 1;
    });

    // Check if changed
    if (JSON.stringify(oldAudience.sort()) !== JSON.stringify(item.targetAudience.sort())) {
      changed++;
    }
  });

  // Save updated data
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

  console.log('✓ Audience tags updated!');
  console.log(`\nChanged: ${changed} items`);
  console.log('\nOLD audience counts:');
  Object.entries(oldCounts).sort((a, b) => b[1] - a[1]).forEach(([aud, count]) => {
    console.log(`  ${aud}: ${count}`);
  });
  console.log('\nNEW audience counts:');
  Object.entries(newCounts).sort((a, b) => b[1] - a[1]).forEach(([aud, count]) => {
    console.log(`  ${aud}: ${count}`);
  });

  console.log('\n✓ Updated file saved to:', DATA_FILE);
}

updateAudienceTags().catch(console.error);
