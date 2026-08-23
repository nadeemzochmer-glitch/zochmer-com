#!/usr/bin/env node
// zochmer.com — automatic content pipeline
// ------------------------------------------------------------
// Fetches recent tech news from curated RSS feeds, asks Claude to draft
// article(s) in the site's exact `content.js` ARTICLES schema, validates
// them strictly, splices them into content.js, rebuilds the site locally
// to catch errors BEFORE anything is published, and (only if everything
// checks out) leaves the change staged for the GitHub Actions workflow to
// commit + push. A git push to `main` then triggers Cloudflare Pages to
// build and deploy automatically — no manual step, no ZIP dragging.
//
// Requires: ANTHROPIC_API_KEY (GitHub Actions repo secret). Node 20+.
//
// Safety net: if the rebuild fails, or produces "undefined" leaks, or the
// model's output doesn't validate against the schema, this script reverts
// content.js and exits non-zero — the workflow will NOT commit or push a
// broken state. Fully automatic does not mean "publish no matter what."
// ------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_PATH = path.join(ROOT, 'assets/js/content.js');
const SEEN_PATH = path.join(__dirname, 'seen.json');
const SOURCES_PATH = path.join(__dirname, 'sources.json');
const COMMIT_MSG_PATH = path.join(__dirname, 'last-commit-message.txt');

const MAX_NEW_ARTICLES = parseInt(process.env.AUTO_CONTENT_MAX || '2', 10);
const MAX_AGE_DAYS = parseInt(process.env.AUTO_CONTENT_MAX_AGE_DAYS || '5', 10);
const MAX_CANDIDATES = parseInt(process.env.AUTO_CONTENT_MAX_CANDIDATES || '18', 10);
const MODEL = process.env.AUTO_CONTENT_MODEL || 'claude-sonnet-4-5';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CATEGORY_SLUGS = [
  'news', 'mobile', 'iphone', 'samsung', 'xiaomi', 'huawei', 'android', 'honor', 'oneplus',
  'realme', 'internet', 'security', 'apps', 'reports', 'computer', 'linux', 'misc', 'tips',
  'reviews', 'compare', 'business', 'spot', 'opinion', 'google', 'facebook', 'instagram',
  'whatsapp', 'tiktok', 'snapchat', 'twitter', 'telegram', 'linkedin', 'youtube', 'ai',
  'digital', 'cloud', 'iot', 'smart', 'gaming', 'cars', 'ev', 'hybrid', 'suv', 'supercars',
  'cartech', 'carbuy', 'bagrut', 'sheets', 'study',
];

// Block types allowed in auto-generated content. Deliberately a SUBSET of
// everything build.mjs supports: no `dl` (we can't verify real download
// URLs unattended), no `more` (can't verify real internal slugs), no
// `fixTitle`/`fix` or `verdict` (those are for hand-checked myth-busting /
// review pieces — auto content sticks to straight news write-ups).
const ALLOWED_BLOCK_KEYS = new Set(['p', 'h', 'note', 'specs', 'steps', 'quote', 'faq']);

function log(...args) {
  console.log(new Date().toISOString(), '—', ...args);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeCdataField(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? stripHtml(m[1]) : '';
}

// Minimal, dependency-free RSS/Atom item extractor. Good enough for the
// curated, well-formed feeds this script targets — not a general parser.
function parseFeed(xml, sourceName) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of itemBlocks) {
    const title = decodeCdataField(block, 'title');
    let link = decodeCdataField(block, 'link');
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href="([^"]+)"/i);
      if (hrefMatch) link = hrefMatch[1];
    }
    const pubDateRaw =
      decodeCdataField(block, 'pubDate') ||
      decodeCdataField(block, 'published') ||
      decodeCdataField(block, 'updated');
    const description =
      decodeCdataField(block, 'description') ||
      decodeCdataField(block, 'content:encoded') ||
      decodeCdataField(block, 'summary');
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
    if (!title || !link) continue;
    items.push({
      source: sourceName,
      title: title.trim(),
      link: link.trim(),
      pubDate: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : null,
      summary: description.slice(0, 900),
    });
  }
  return items;
}

async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'zochmer-auto-content/1.0 (+https://zochmer.com)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log(`⚠️  ${source.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseFeed(xml, source.name);
  } catch (err) {
    log(`⚠️  ${source.name}: ${err.message}`);
    return [];
  }
}

function loadExistingArticles() {
  const src = fs.readFileSync(CONTENT_PATH, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ids: new Set(ctx.ARTICLES.map((a) => a.id)), articles: ctx.ARTICLES, raw: src };
}

function buildSystemPrompt(existingTitles) {
  return `أنت المحرر التقني لموقع "زوخمر" (zochmer.com) — موقع أخبار تقنية بالعربي المحكي (لهجة فلسطينية/شامية محكية، مش فصحى) لجمهور شاب في إسرائيل.

مهمتك: من قائمة أخبار تقنية إنجليزية (عنوان + رابط + ملخص من RSS)، اختر حتى ${MAX_NEW_ARTICLES} قصص وحوّل كل وحدة لمقال عربي كامل بصيغة JSON بالضبط حسب السكيمה التالية.

قواعد صارمة:
1. استعمل فقط معلومات موجودة فعلياً بالملخص المعطى لك. ممنوع تختلق أرقام، أسعار، اقتباسات، أو تفاصيل تقنية مش مذكورة.
2. تجاهل قصص: شائعات/تسريبات غير مؤكدة، إعلانات سطحية بلا محتوى حقيقي، أو أي قصة قريبة جداً من مقال موجود عندنا (شوف القائمة تحت).
3. إذا مفيش قصة تستاهل — رجّع مصفوفة فاضحة []. الجودة أهم من الكمية.
4. اللهجة: عربي محكي طبيعي (مثل: "هيك"، "بس"، "شو"، "منيح") — مش فصحى جامدة، ومش عامية مصرية.
5. الفئة (cat) لازم تكون بالضبط وحدة من هاي القائمة: ${CATEGORY_SLUGS.join(', ')}
6. كل بلوك بجسم المقال (body) لازم يكون وحدة بالضبط من هاي الأنواع: {p:"..."} فقرة، {h:"..."} عنوان فرعي، {note:["عنوان","نص"]} ملاحظة، {specs:[["תווית","قيمة"],...]} جدول مواصفات، {steps:[["عنوان","وصف"],...]} خطوات، {quote:"..."} اقتباس، {faq:[["سؤال","جواب"],...]} أسئلة شائعة. ممنوع أي نوع بلوك غير هيك (وبالتحديד ممنوع verdict, fixTitle, fix, dl, more).
7. id: slug إنجليزي lowercase بشرطات (kebab-case), فريد, يعكس الموضوع.
8. author: 'نديم' دايماً.
9. tags: 2-4 وسوم عربية قصيرة (مثل: "أمن وخصوصية", "دليل عملي", "أبل", "أندرويد").
10. tldr: 3-4 جمل قصيرة تلخص أهم النقاط (اختياري بس مفضّل).
11. طول المقال: 4-8 بلوكات بالـ body، مقال حقيقي مش سطرين.
12. رجّع JSON array فقط — بلا markdown code fence، بلا شرح، بلا نص قبل أو بعد.

عناوين مقالات موجودة عندنا حالياً (لا تكرر نفس الموضوع):
${existingTitles.join('\n')}

سكيمة كل مقال (بالضبط هاي الحقول):
{
  "id": "kebab-case-slug",
  "keys": ["كلمة مفتاحية 1", "..."],
  "title": "عنوان جذاب بالعربي المحكي",
  "dek": "جملة أو جملتين تلخيص تحت العنوان",
  "cat": "one-of-the-slugs-above",
  "date": "${todayISO()}",
  "read": 5,
  "img": null,
  "author": "نديم",
  "tags": ["...", "..."],
  "tldr": ["...", "..."],
  "body": [ {"p": "..."}, {"h": "..."}, {"p": "..."} ]
}`;
}

function buildUserPrompt(candidates) {
  const lines = candidates.map((c, i) =>
    `[${i}] المصدر: ${c.source}\nالعنوان: ${c.title}\nرابط: ${c.link}\nملخص: ${c.summary || '(لا يوجد ملخص)'}\n`
  );
  return `هاي القصص المرشّحة (${candidates.length}):\n\n${lines.join('\n')}\n\nاختر الأفضل وحوّلهم لـ JSON array حسب التعليمات.`;
}

async function callClaude(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('');
  return text;
}

function extractJsonArray(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON array found in model output');
  return JSON.parse(t.slice(start, end + 1));
}

function validateArticle(a, existingIds, seenInBatch) {
  const errors = [];
  if (!a || typeof a !== 'object') return ['not an object'];
  if (!a.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) errors.push('bad id');
  else if (existingIds.has(a.id) || seenInBatch.has(a.id)) errors.push(`duplicate id: ${a.id}`);
  if (!a.title || typeof a.title !== 'string') errors.push('missing title');
  if (!a.dek || typeof a.dek !== 'string') errors.push('missing dek');
  if (!CATEGORY_SLUGS.includes(a.cat)) errors.push(`bad category: ${a.cat}`);
  if (!Array.isArray(a.keys) || !a.keys.length) errors.push('missing keys[]');
  if (!Array.isArray(a.tags) || !a.tags.length) errors.push('missing tags[]');
  if (!Array.isArray(a.body) || a.body.length < 2) errors.push('body too short');
  else {
    for (const block of a.body) {
      const blockKeys = Object.keys(block || {});
      if (blockKeys.length !== 1 || !ALLOWED_BLOCK_KEYS.has(blockKeys[0])) {
        errors.push(`disallowed block type: ${blockKeys.join(',')}`);
      }
    }
  }
  if (a.author !== 'نديم' && a.author !== 'زوخمر') errors.push('bad author');
  return errors;
}

function spliceIntoContent(rawContentJs, newArticles) {
  const marker = 'window.ARTICLES = ARTICLES';
  const markerIdx = rawContentJs.indexOf(marker);
  if (markerIdx === -1) throw new Error('Could not find window.ARTICLES assignment marker');
  const before = rawContentJs.slice(0, markerIdx);
  const closeIdx = before.lastIndexOf('\n];');
  if (closeIdx === -1) throw new Error('Could not find ARTICLES array closing bracket');
  const insertion = newArticles.map((a) => ',\n\n' + JSON.stringify(a, null, 2)).join('');
  return rawContentJs.slice(0, closeIdx) + insertion + '\n' + rawContentJs.slice(closeIdx + 1);
}

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set. Add it as a repo secret (Settings → Secrets and variables → Actions).');
    process.exit(1);
  }

  const sources = loadJSON(SOURCES_PATH, []);
  const seen = loadJSON(SEEN_PATH, { seenLinks: [] });
  const seenSet = new Set(seen.seenLinks);
  const { ids: existingIds, articles: existingArticles, raw: rawContentJs } = loadExistingArticles();

  log(`Fetching ${sources.length} RSS sources…`);
  const allItemsArrays = await Promise.all(sources.map(fetchFeed));
  const allItems = allItemsArrays.flat();
  log(`Fetched ${allItems.length} raw items.`);

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = allItems.filter((it) => {
    if (seenSet.has(it.link)) return false;
    if (!it.pubDate) return true; // keep undated items rather than drop them silently
    return new Date(it.pubDate).getTime() >= cutoff;
  });
  log(`${fresh.length} fresh, unseen items after date/dedupe filter.`);

  // Round-robin across sources so one noisy feed can't crowd out the rest.
  const bySource = {};
  for (const it of fresh) (bySource[it.source] ||= []).push(it);
  const candidates = [];
  let added = true;
  while (added && candidates.length < MAX_CANDIDATES) {
    added = false;
    for (const src of Object.keys(bySource)) {
      const arr = bySource[src];
      if (arr.length) {
        candidates.push(arr.shift());
        added = true;
        if (candidates.length >= MAX_CANDIDATES) break;
      }
    }
  }

  // Mark all considered candidates as seen regardless of outcome, so a
  // rejected story isn't re-offered to the model every single run.
  const newSeenLinks = [...seenSet, ...candidates.map((c) => c.link)].slice(-2000);

  if (!candidates.length) {
    log('No fresh candidates this run — nothing to do.');
    fs.writeFileSync(SEEN_PATH, JSON.stringify({ seenLinks: newSeenLinks }, null, 2));
    fs.writeFileSync(COMMIT_MSG_PATH, '🤖 Auto content: no qualifying stories this run');
    return;
  }

  log(`Asking ${MODEL} to pick and draft up to ${MAX_NEW_ARTICLES} article(s) from ${candidates.length} candidates…`);
  const existingTitles = existingArticles.map((a) => `- ${a.title}`);
  const system = buildSystemPrompt(existingTitles);
  const user = buildUserPrompt(candidates);
  const raw = await callClaude(system, user);
  let drafted;
  try {
    drafted = extractJsonArray(raw);
  } catch (err) {
    console.error('❌ Failed to parse model output as JSON:', err.message);
    console.error('--- raw output (first 2000 chars) ---');
    console.error(raw.slice(0, 2000));
    process.exit(1);
  }
  log(`Model returned ${drafted.length} draft article(s).`);

  const seenInBatch = new Set();
  const valid = [];
  for (const a of drafted) {
    const errors = validateArticle(a, existingIds, seenInBatch);
    if (errors.length) {
      log(`⚠️  Rejected "${a && a.title}" — ${errors.join('; ')}`);
      continue;
    }
    a.date = todayISO();
    if (typeof a.read !== 'number' || a.read < 1) a.read = 5;
    if (a.img === undefined) a.img = null;
    seenInBatch.add(a.id);
    valid.push(a);
  }
  const finalArticles = valid.slice(0, MAX_NEW_ARTICLES);

  fs.writeFileSync(SEEN_PATH, JSON.stringify({ seenLinks: newSeenLinks }, null, 2));

  if (!finalArticles.length) {
    log('No article survived validation — nothing to publish this run.');
    fs.writeFileSync(COMMIT_MSG_PATH, '🤖 Auto content: no article passed validation this run');
    return;
  }

  log(`Splicing ${finalArticles.length} article(s) into content.js…`);
  const updatedContentJs = spliceIntoContent(rawContentJs, finalArticles);
  fs.writeFileSync(CONTENT_PATH, updatedContentJs);

  log('Rebuilding site to verify…');
  try {
    execSync('node build.mjs', { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Build failed — reverting content.js. Not publishing.');
    execSync(`git checkout -- ${JSON.stringify(path.relative(ROOT, CONTENT_PATH))}`, { cwd: ROOT });
    process.exit(1);
  }

  // Safety check: no "undefined" leaked into generated HTML.
  let leaked = '';
  try {
    leaked = execSync(
      'grep -rl "undefined" a/*.html c/*.html index.html 2>/dev/null || true',
      { cwd: ROOT }
    ).toString().trim();
  } catch {
    // grep exits non-zero on no matches in some shells; ignore.
  }
  if (leaked) {
    console.error('❌ "undefined" leaked into generated HTML — reverting. Files:\n' + leaked);
    execSync(`git checkout -- ${JSON.stringify(path.relative(ROOT, CONTENT_PATH))}`, { cwd: ROOT });
    process.exit(1);
  }

  const titles = finalArticles.map((a) => `- ${a.title} (${a.cat})`).join('\n');
  const commitMsg = `🤖 Auto content: ${finalArticles.length} new article(s)\n\n${titles}`;
  fs.writeFileSync(COMMIT_MSG_PATH, commitMsg);
  log('✅ Done. content.js updated and verified — ready to commit.');
}

export { parseFeed, validateArticle, spliceIntoContent, extractJsonArray, CATEGORY_SLUGS, ALLOWED_BLOCK_KEYS };

// Only run the pipeline when this file is executed directly (not when
// imported for testing).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
