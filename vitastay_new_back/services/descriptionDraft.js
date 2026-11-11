/**
 * BIC-034 — draft listing description from amenities + media + hostel fields.
 * Never writes hostels.description unless the owner explicitly approves.
 * Uses template by default; optional OpenAI when OPENAI_API_KEY is set.
 */
const config = require('../config');
const logger = require('../config/logger');
const { PropertyMedia } = require('../models');

const asList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
};

const genderLabel = (policy) => ({
  male: 'men',
  female: 'women',
  unisex: 'men and women',
}[String(policy || 'unisex')] || 'guests');

const buildTemplateDraft = (hostel, mediaSummary) => {
  const amenities = asList(hostel.amenities);
  const place = [hostel.area, hostel.city].filter(Boolean).join(', ') || hostel.city || 'the city';
  const lines = [];
  lines.push(
    `${hostel.name} is a PG in ${place} for ${genderLabel(hostel.gender_policy)}.`
  );
  if (amenities.length) {
    lines.push(`Amenities include ${amenities.slice(0, 8).join(', ')}.`);
  }
  if (mediaSummary.exterior > 0 || mediaSummary.interior_common > 0) {
    lines.push('Photos of the exterior and common areas are available on the listing.');
  }
  if (mediaSummary.room > 0) {
    lines.push(`Room photos help you compare sharing options (${mediaSummary.room} room shot${mediaSummary.room === 1 ? '' : 's'}).`);
  }
  if (mediaSummary.panorama_360 > 0) {
    lines.push('A 360° tour is included so families can look around before visiting.');
  }
  if (mediaSummary.captions?.length) {
    lines.push(`Photos show ${mediaSummary.captions.slice(0, 6).join(', ')}.`);
  }
  if (hostel.security_deposit != null && Number(hostel.security_deposit) > 0) {
    lines.push(`Security deposit starts from the amount shown on the listing.`);
  }
  lines.push('Edit this draft before publishing — it is not live until you approve it.');
  return lines.join(' ');
};

const tryLlmDraft = async (hostel, mediaSummary) => {
  const key = String(process.env.OPENAI_API_KEY || config.openai?.apiKey || '').trim();
  if (!key) return null;

  const amenities = asList(hostel.amenities);
  const prompt = [
    'Write a short PG/hostel listing description for India (80–120 words).',
    'Plain language. No fake claims. No invented travel times or ratings.',
    `Name: ${hostel.name}`,
    `Place: ${[hostel.area, hostel.city, hostel.state].filter(Boolean).join(', ')}`,
    `Gender policy: ${hostel.gender_policy || 'unisex'}`,
    `Amenities: ${amenities.join(', ') || 'not listed'}`,
    `Photo counts: exterior ${mediaSummary.exterior}, common ${mediaSummary.interior_common}, rooms ${mediaSummary.room}, 360 ${mediaSummary.panorama_360}`,
    `Photo captions: ${(mediaSummary.captions || []).join('; ') || 'none'}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'You draft PG listing copy. Never invent amenities or prices.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      logger.warn(`description LLM failed: HTTP ${res.status}`);
      return null;
    }
    const body = await res.json();
    const text = String(body.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;
    return `${text}\n\n(AI-assisted draft — review before publishing.)`;
  } catch (err) {
    logger.warn(`description LLM error: ${err.message}`);
    return null;
  }
};

const mediaSummaryFor = async (hostelId) => {
  const rows = await PropertyMedia.findAll({
    where: { hostel_id: hostelId, is_published: true },
    attributes: ['category', 'caption'],
  });
  const summary = {
    exterior: 0,
    interior_common: 0,
    room: 0,
    panorama_360: 0,
    total: rows.length,
    captions: [],
  };
  rows.forEach((row) => {
    if (summary[row.category] != null) summary[row.category] += 1;
    const caption = String(row.caption || '').trim();
    if (caption && summary.captions.length < 8) summary.captions.push(caption);
  });
  return summary;
};

const stripDraftNotes = (text) => String(text || '')
  .replace(/\s*Edit this draft before publishing — it is not live until you approve it\.\s*$/i, '')
  .replace(/\s*\(AI-assisted draft — review before publishing\.\)\s*$/i, '')
  .trim();

const serialize = (hostel) => ({
  description: hostel.description || '',
  description_draft: hostel.description_draft || '',
  description_draft_source: hostel.description_draft_source || null,
  description_draft_at: hostel.description_draft_at || null,
  description_origin: hostel.description_origin || null,
  ai_assisted: hostel.description_draft_source === 'llm',
  disclosed: hostel.description_draft_source === 'llm' || hostel.description_origin === 'llm',
  auto_published: false,
});

const getDraft = async (hostel) => serialize(hostel);

const generateDraft = async (hostel) => {
  const mediaSummary = await mediaSummaryFor(hostel.id);
  let source = 'template';
  let text = await tryLlmDraft(hostel, mediaSummary);
  if (text) {
    source = 'llm';
  } else {
    text = buildTemplateDraft(hostel, mediaSummary);
    source = 'template';
  }
  await hostel.update({
    description_draft: text,
    description_draft_source: source,
    description_draft_at: new Date(),
  });
  await hostel.reload();
  return {
    ...serialize(hostel),
    message: source === 'llm'
      ? 'AI draft ready — edit and approve before it goes live'
      : 'Template draft ready — edit and approve before it goes live',
  };
};

const saveDraft = async (hostel, body) => {
  const text = String(body?.description_draft ?? '').trim();
  if (!text) {
    const err = new Error('description_draft is required');
    err.statusCode = 422;
    throw err;
  }
  await hostel.update({
    description_draft: text.slice(0, 8000),
    description_draft_at: new Date(),
    // keep source; owner-edited still disclosed
  });
  await hostel.reload();
  return serialize(hostel);
};

const approveDraft = async (hostel) => {
  const draft = String(hostel.description_draft || '').trim();
  if (!draft) {
    const err = new Error('Generate or paste a draft before approving');
    err.statusCode = 422;
    throw err;
  }
  const origin = hostel.description_draft_source === 'llm' ? 'llm' : 'template';
  await hostel.update({
    description: stripDraftNotes(draft).slice(0, 8000),
    description_origin: origin,
    description_draft: null,
    description_draft_source: null,
    description_draft_at: null,
  });
  await hostel.reload();
  require('./listingProjection').scheduleListingRefresh(hostel.id);
  return {
    ...serialize(hostel),
    message: 'Description published to the listing. Draft cleared.',
  };
};

const discardDraft = async (hostel) => {
  await hostel.update({
    description_draft: null,
    description_draft_source: null,
    description_draft_at: null,
  });
  await hostel.reload();
  return serialize(hostel);
};

module.exports = {
  getDraft,
  generateDraft,
  saveDraft,
  approveDraft,
  discardDraft,
  buildTemplateDraft,
};
