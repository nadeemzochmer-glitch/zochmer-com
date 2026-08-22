/* =====================================================================
   زوخمر — בונה האתר
   ---------------------------------------------------------------------
   קורא את assets/js/content.js וכותב את כל עמודי ה-HTML כקבצים אמיתיים,
   כדי שגוגל ופייסבוק יראו את התוכן.

   הרצה (מתוך תיקיית האתר):    node build.mjs
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s, 'utf8');
};

/* ---------- חותם גרסה לקבצי העיצוב והקוד ----------
   _headers שומר assets במטמון לשנה. בלי חותם שמשתנה עם התוכן,
   גולש חוזר נתקע עם CSS ישן מול HTML חדש — והעיצוב נשבר. */
const verCache = new Map();
const ver = (rel) => {
  if (verCache.has(rel)) return verCache.get(rel);
  let v = '0';
  try {
    v = crypto.createHash('md5')
      .update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8);
  } catch { /* הקובץ לא קיים — בלי חותם */ }
  verCache.set(rel, v);
  return v;
};
const vurl = (base, rel) => `${base}${rel}?v=${ver(rel)}`;

/* ---------- טעינת התוכן ---------- */
const ctx = { window: undefined };
vm.createContext(ctx);
vm.runInContext(read('assets/js/content.js'), ctx);
/* قاعدة الأسعار — ملف منفصل عشان يتحدّث لحاله بلا ما نلمس المقالات */
try { vm.runInContext(read('prices-data.js'), ctx); } catch { }
const { SITE, CATEGORIES, MENU, HOME_SECTIONS, ARTICLES } = ctx;
const QUICK = ctx.QUICK || [];
const PRICES = ctx.PRICES || [];
const PRICE_BRANDS = ctx.PRICE_BRANDS || {};
const PRICE_KINDS = ctx.PRICE_KINDS || {};
const PRICE_CATS = ctx.PRICE_CATS || {};

const catMap = new Map(CATEGORIES.map((c) => [c.slug, c]));
const cat = (s) => catMap.get(s) || { slug: s, name: s, desc: '' };
/* ---------- ספרות ----------
   הקהל שלנו — דוברי ערבית בישראל — קורא ספרות מערביות (1234567890),
   לא ספרות הודיות-ערביות (١٢٣٤٥٦٧٨٩) שנהוגות במצרים ובמפרץ.
   dg() מנרמל כל ספרה בתוכן בזמן הבנייה, כך שגם אם נכתוב בטעות
   ספרה הודית-ערבית ב-content.js — מה שיוצא לאתר תמיד מערבי. */
const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '٬': ',' };
const dg = (t) => String(t ?? '').replace(/[٠-٩٫٬]/g, (c) => AR_DIGITS[c]);

const esc = (t) => dg(t).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* rt = טקסט עשיר בתוך גוף הכתבה. בורח מהכול ואז מחזיר רק
   <strong> ו-<code> — הדגשה וקוד, בלי שום תגית אחרת. */
const rt = (t, l) => esc(t)
  .replace(/&lt;(\/?)(strong|code)&gt;/g, '<$1$2>')
  /* [[id|טקסט]] → קישור פנימי אמיתי */
  .replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/gi, (m, id, txt) =>
    `<a class="ilink" href="${(l ? l.art(id) : 'a/' + id + '.html')}">${txt}</a>`);
/* plain = מסיר תגיות לגמרי — לתקצירים, ל-JSON-LD ולתוכן עניינים */
const plain = (t) => dg(t).replace(/<[^>]+>/g, '');
/* ---------- פרסומות ----------
   בלי מזהה מפרסם ב-content.js לא נטען שום סקריפט ולא נוצר ads.txt.
   כל יחידה שומרת גובה מינימלי מראש כדי שהעמוד לא יקפוץ בזמן הטעינה. */
const ADS = (SITE.adsense || '').trim();
const SLOTS = SITE.adSlots || {};
const adUnit = (place) => {
  if (!ADS) return '';
  const slot = SLOTS[place] || '';
  return `<aside class="adu adu--${place}" aria-label="إعلان">` +
    '<span class="adu__l">إعلان</span>' +
    `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS)}"` +
    (slot ? ` data-ad-slot="${esc(slot)}"` : '') +
    ' data-ad-format="auto" data-full-width-responsive="true"></ins>' +
    '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></aside>';
};
const adHead = () => ADS
  ? `\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS}" crossorigin="anonymous"></script>`
  : '';
/* ---------- קישורים פנימיים ----------
   שתי דרכים:
   1. ידנית בתוכן:  [[article-id|טקסט הקישור]]
   2. אוטומטית: כל כתבה יכולה להכריז keys — מונחים שכשמוזכרים
      בכתבה אחרת, המופע הראשון שלהם הופך לקישור אליה.
   שמירות: רק בפסקאות p, לא לעצמה, לא בתוך תגית קיימת,
   מופע ראשון בלבד לכל יעד, ומקסימום 4 קישורים אוטומטיים לכתבה. */
const AUTO_MAX = 4;

const byDate = (a, b) => (b.date || '').localeCompare(a.date || '');
const sorted = ARTICLES.slice().sort(byDate);
/* קטגוריית "أخبار" מרכזת: כתבות שסומנו news + כל הידיעות הקצרות (brief) */
const inCat = (slug) => slug === 'news'
  ? sorted.filter((a) => a.cat === 'news' || a.brief)
  : sorted.filter((a) => a.cat === slug);

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب',
  'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const fmtDate = (d) => {
  const p = String(d || '').split('-');
  return p.length === 3 ? `${+p[2]} ${MONTHS[+p[1] - 1]} ${p[0]}` : '';
};

/* ---------- אייקונים ---------- */
const I = {
  burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  spark: '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 9.8c-.6-.8-1.6-1.1-2.7-1.1-1.4 0-2.4.7-2.4 1.8 0 2.5 5.2 1.3 5.2 3.8 0 1.2-1.1 1.9-2.6 1.9-1.2 0-2.2-.4-2.8-1.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  share: '<circle cx="17" cy="6" r="2.5"/><circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M9.2 10.8l5.6-3.2M9.2 13.2l5.6 3.2"/>',
  save: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  arrow: '<path d="M14 6l-6 6 6 6"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="1.2"/><circle cx="15" cy="9.5" r="1.2"/><circle cx="9.5" cy="15" r="1.2"/>',
  bolt: '<path d="M13.5 2.5L4.5 13.5h6l-1 8 9-11h-6z"/>',
  /* أيقونات المشاركة — واتساب أولاً لأنه القناة الأساسية عنّا */
  wa: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3a8.5 8.5 0 1 1 15.4-4.6z"/><path d="M8.9 8.4c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3-.1.5.3.6 1.4 1.9 2.6 2.4.2.1.4.1.5-.1l.5-.6c.1-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .4-.2 1.1-.5 1.3-.3.2-.9.5-1.6.4-2-.3-4.6-2.2-5.7-4.6-.3-.7-.4-1.5-.1-2.1z" fill="currentColor" stroke="none"/>',
  tg: '<path d="M21 4.5L2.8 11.3c-.6.2-.6.8 0 1l4.6 1.5 1.7 5.2c.2.5.5.6.9.2l2.4-2.2 4.6 3.4c.5.3.9.1 1-.5L22 5.3c.1-.6-.3-1-1-.8z"/><path d="M7.4 13.8L17.5 7.6 9.7 15.2"/>',
  fb: '<path d="M14.5 8.5h2.2V5.6h-2.6c-2.2 0-3.6 1.4-3.6 3.6v1.6H8.2v3h2.3V21h3.2v-7.2h2.4l.4-3h-2.8V9.6c0-.7.3-1.1.8-1.1z" fill="currentColor" stroke="none"/>',
  link: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"/>'
};
const ico = (n, w = 22, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
const CHEV = ico('chev', 18, 'chev');

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23FF7A18'/%3E%3Cpath d='M18 4L8 18h7l-1.2 10L24 13h-7z' fill='%230C0E12'/%3E%3C/svg%3E";

/* ---------- קישורים (עם קידומת לפי עומק התיקייה) ---------- */
const L = (d) => ({
  asset: (p) => d + p,
  home: d + 'index.html',
  cat: (s) => `${d}c/${s}.html`,
  art: (a) => `${d}a/${a}.html`,
  page: (p) => d + p
});

/* ---------- אילו קטגוריות "חיות" ----------
   קטגוריה בלי כתבות = עמוד ריק. עמודים ריקים פוגעים בדירוג בגוגל
   ובסיכוי לאישור AdSense. לכן: מסתירים אותן מהתפריט, מהמפה ומהאתר —
   אבל *הורה* נשאר אם לילד שלו יש כתבות (למשל "السيارات" מעל תתי-הקטגוריות). */
const artCount = new Map();
for (const a of ARTICLES) {
  artCount.set(a.cat, (artCount.get(a.cat) || 0) + 1);
  if (a.brief && a.cat !== 'news') artCount.set('news', (artCount.get('news') || 0) + 1);
}

const kidSlugs = (raw) => {
  const x = typeof raw === 'string' ? { cat: raw } : raw;
  const out = [];
  for (const k of (x.kids || [])) {
    const ki = typeof k === 'string' ? { cat: k } : k;
    if (ki.cat) out.push(ki.cat);
    out.push(...kidSlugs(ki));
  }
  return out;
};

const liveSet = new Set([...artCount.keys()].filter((s) => artCount.get(s) > 0));
/* הורים שיש להם ילד חי */
const walkMenu = (items) => {
  for (const raw of items) {
    const x = typeof raw === 'string' ? { cat: raw } : raw;
    if (x.cat && kidSlugs(x).some((k) => liveSet.has(k))) liveSet.add(x.cat);
    if (x.kids) walkMenu(x.kids);
  }
};
walkMenu(MENU);
const isLive = (slug) => liveSet.has(slug);

/* ---------- תפריטים ---------- */
function itemOf(x) {
  if (typeof x === 'string') return { label: cat(x).name, slug: x };
  if (x.cat) return { label: x.label || cat(x.cat).name, slug: x.cat, kids: x.kids, mark: x.mark };
  return { label: x.label, page: x.page, kids: x.kids, mark: x.mark, top: x.top };
}

/* هل هذا العنصر (أو أي فرع تحته) هو الصفحة الحالية؟ */
function itemHas(it, active) {
  if (!active) return false;
  if (it.slug === active || it.page === active || it.label === active) return true;
  if (!it.kids) return false;
  return it.kids.some((k) => itemHas(itemOf(k), active));
}

/* الأولاد اللي فعلاً إلهم محتوى — عشان ما ينفتح أكورديون فاضي */
function liveKids(it) {
  if (!it.kids) return [];
  return it.kids.filter((k) => {
    const ki = itemOf(k);
    if (ki.page) return true;
    if (ki.kids && ki.kids.length) return liveKids(ki).length > 0;
    return !ki.slug || isLive(ki.slug);
  });
}

function drawerTree(l, items = MENU, lv = 0) {
  return items.filter((raw) => {
    const i = itemOf(raw);
    if (i.slug && !isLive(i.slug)) return false;
    if (!i.slug && !i.page && !liveKids(i).length) return false;
    return true;
  }).map((raw) => {
    const it = itemOf(raw);
    const href = it.slug ? l.cat(it.slug) : it.page ? l.page(it.page) : '#';
    if (!liveKids(it).length)
      return `<a class="acc__l lv${lv}" href="${href}">${esc(it.label)}</a>`;
    const self = it.slug
      ? `<a class="acc__l acc__l--all lv${lv + 1}" href="${href}">كل ${esc(it.label)}</a>` : '';
    return `<div class="acc lv${lv}"><button class="acc__b" aria-expanded="false"><span>${esc(it.label)}</span>${CHEV}</button><div class="acc__p"><div class="acc__pi">${self}${drawerTree(l, it.kids, lv + 1)}</div></div></div>`;
  }).join('');
}

function megaNav(l, active) {
  return MENU.filter((raw) => { const i = itemOf(raw); return i.top !== false && (!i.slug || isLive(i.slug)); })
    .map((raw) => {
    const it = itemOf(raw);
    const href = it.slug ? l.cat(it.slug) : it.page ? l.page(it.page) : '#';
    const on = itemHas(it, active) ? ' on' : '';
    if (!it.kids || !it.kids.length)
      return `<a class="nv__i${it.mark ? ' nv__i--' + it.mark : ''}${on}" href="${href}">${esc(it.label)}</a>`;
    const cols = [], solos = [];
    for (const k of it.kids) {
      const ki = itemOf(k);
      if (!(!ki.slug || isLive(ki.slug))) continue;
      if (ki.kids && ki.kids.length) {
        const links = ki.kids.map(itemOf).filter((g) => !g.slug || isLive(g.slug))
          .map((gi) =>
            `<a href="${gi.slug ? l.cat(gi.slug) : l.page(gi.page)}">${esc(gi.label)}</a>`).join('');
        if (!links) continue;
        cols.push(`<div class="mg__c"><b>${esc(ki.label)}</b>${links}</div>`);
      } else {
        solos.push(`<a href="${ki.slug ? l.cat(ki.slug) : l.page(ki.page)}">${esc(ki.label)}</a>`);
      }
    }
    if (solos.length) cols.push(`<div class="mg__c"><b>أقسام</b>${solos.join('')}</div>`);
    /* مجموعة بلا محتوى حيّ — ما بتنعرض إطلاقاً */
    if (!cols.length) {
      if (!it.slug && !it.page) return '';
      return `<a class="nv__i${on}" href="${href}">${esc(it.label)}</a>`;
    }
    /* آخر تلات مقالات من القسم — قائمة صغيرة، مش صورة عملاقة */
    const pool = (it.slug ? inCat(it.slug) : sorted).slice(0, 3);
    const feat = pool.length
      ? `<div class="mg__f"><span class="mg__k">الأحدث بهالقسم</span>${pool.map((t) =>
          `<a class="mgr" href="${l.art(t.id)}"><span class="mgr__i">${media(t, l)}</span>` +
          `<span class="mgr__b"><b>${esc(clip(t.title, 62))}</b>` +
          `<i>${esc(cat(t.cat).name)} · ${t.read || 4} دقائق</i></span></a>`).join('')}</div>`
      : '';
    /* رابط القسم نفسه — عشان العنوان الرئيسي يضلّ قابل للفتح */
    const all = it.slug
      ? `<a class="mg__all" href="${href}">شوف كل ${esc(it.label)}${ico('arrow', 14)}</a>` : '';
    return `<div class="nv__g"><button class="nv__i nv__i--h${on}" aria-expanded="false">${esc(it.label)}${CHEV}</button><div class="mg"><div class="mg__l"><div class="mg__in">${cols.join('')}</div>${all}</div>${feat}</div></div>`;
  }).join('');
}

/* ---------- תמונות ----------
   סדר עדיפות: תמונה אמיתית מ-content.js → שער אוטומטי מ-make-covers.py →
   ריבוע מקום שמור. og:image נופל בסוף על og-default.png.               */
const has = (rel) => fs.existsSync(path.join(ROOT, rel));

const coverOf = (a) => {
  if (a.img) return a.img;
  const auto = `assets/img/covers/${a.id}.jpg`;
  return has(auto) ? auto : null;
};

/* thumbOf = התמונה שמוצגת *באתר*, בלי הכותרת בתוכה.
   coverOf נשאר ל-og:image בלבד (שם הכותרת בתמונה דווקא מועילה).
   בלי ההפרדה הזו הכותרת מופיעה פעמיים — פעם בתמונה ופעם כטקסט לידה. */
const thumbOf = (a) => {
  if (a.img) return a.img;
  const auto = `assets/img/thumbs/${a.id}.webp`;
  return has(auto) ? auto : null;
};

const OG_DEFAULT = fs.existsSync(path.join(ROOT, 'assets/img/og-default.png'))
  ? 'assets/img/og-default.png' : '';

const media = (a, l) => {
  const src = thumbOf(a);
  if (!src) return '<span class="ph">صورة</span>';
  /* תמונה אמיתית מתארת את הכתבה → alt אמיתי.
     תמונת מותג מיוצרת היא קישוט בלבד → alt ריק, שקורא מסך לא יקריא רעש. */
  const alt = a.img ? esc(plain(a.title)) : '';
  return `<img src="${l.asset(esc(src))}" alt="${alt}" loading="lazy" decoding="async" width="1200" height="630">`;
};

/* variant='lead' = הכתבה המובילה בעמוד: רחבה, תמונה בצד, טיפוגרפיה גדולה.
   בלעדיה כל העמוד הוא רשת אחידה של ריבועים זהים — נכון פונקציונלית,
   אבל בלי שום היררכיה שאומרת לקורא במה להתחיל. */
/* ---------- بطاقة المقال ----------
   تلات أشكال مختلفة، مش شكل واحد مكرّر:

   1. مقال معه صورة حقيقية  → الصورة بتاخد المساحة، لأنها بتحكي إشي.
   2. مقال بلا صورة حقيقية  → بطاقة نصّية: العنوان هو البطل، بلا صورة
      مولّدة بتاخد نص البطاقة وما بتقول ولا معلومة.
   3. خبر سريع              → سطر مضغوط، لأنه خبر مش مقال.

   الفكرة: الصفحة صار فيها إيقاع — أحجام وأشكال مختلفة —
   بدل شبكة مربّعات متطابقة. */
function card(a, l, variant) {
  const c = cat(a.cat);
  const lead = variant === 'lead';
  const real = !!a.img;

  const tags = `<a class="tag" href="${l.cat(c.slug)}">${esc(c.name)}</a>`
    + (a.brief ? '<span class="brieftag">خبر سريع</span>' : '')
    + (a.fixpost ? '<span class="fixtag">تصحيح خبر</span>' : '');
  const meta = `<span class="cd__m">${fmtDate(a.date)}${a.read ? ' · ' + a.read + ' دقائق' : ''}</span>`;
  const ttl = `<a class="cd__t cd__t--real" href="${l.art(a.id)}"><h3>${esc(a.title)}</h3>`
    + (a.dek ? `<p>${esc(a.dek)}</p>` : '') + '</a>';

  /* ── خبر سريع بلا صورة: سطر مضغوط ── */
  if (a.brief && !real && !lead) {
    return `<article class="rowcard${a.fixpost ? ' rowcard--fix' : ''}" data-cat="${esc(c.slug)}">
      <a class="rowcard__l" href="${l.art(a.id)}">
        <span class="rowcard__k">${tags}</span>
        <h3 class="rowcard__t">${esc(a.title)}</h3>
        ${a.dek ? `<p class="rowcard__d">${esc(a.dek)}</p>` : ''}
        ${meta}
      </a>
    </article>`;
  }

  /* ── بلا صورة حقيقية: بطاقة نصّية، العنوان هو البطل ── */
  if (!real) {
    return `<article class="cd cd--txt${a.brief ? ' cd--brief' : ''}${a.fixpost ? ' cd--fix' : ''}${lead ? ' cd--lead' : ''}" data-cat="${esc(c.slug)}">
      <div class="cd__b">${tags}${ttl}${meta}</div>
      <span class="cd__mark" aria-hidden="true">${ico(a.fixpost ? 'swap' : a.brief ? 'bolt' : 'spark', 108)}</span>
    </article>`;
  }

  /* ── معه صورة حقيقية ── */
  const pic = `<a class="cd__i" href="${l.art(a.id)}" tabindex="-1" aria-hidden="true">${media(a, l)}</a>`;
  return `<article class="cd${a.brief ? ' cd--brief' : ''}${a.fixpost ? ' cd--fix' : ''}${lead ? ' cd--lead' : ''}">${pic}` +
    `<div class="cd__b">${tags}${ttl}${meta}</div></article>`;
}

function row(a, i, l) {
  /* תמונה קטנה רק כשיש צילום אמיתי — שער אוטומטי נחתך לריבוע ונראה רע */
  const thumb = a.img ? `<span class="rw__i"><img src="${l.asset(esc(a.img))}" alt="" loading="lazy"></span>` : '';
  return `<a class="rw${thumb ? '' : ' rw--flat'}" href="${l.art(a.id)}"><span class="rw__n">${i + 1}</span>` +
    `<span class="rw__b"><b class="rw__t">${esc(a.title)}</b>` +
    `<span class="rw__m">${fmtDate(a.date)}</span></span>${thumb}</a>`;
}

/* الأدوات بالشريط الجانبي — كل وحدة بتوصل لمكانها الفعلي بصفحة الأدوات،
   مع سطر توضيحي قصير. اللي لسا مش جاهز مبيّن كـ"قريباً" بدل ما يوهم. */
const TOOLS = [
  ['أسعار الأجهزة عنّا', 'coin', 'كل الأسعار بالشيكل بمكان واحد', 'prices.html'],
  ['أسعار العملات', 'coin', 'دولار ويورو بالشيكل', 'tools.html#fx'],
  ['الطقس الآن', 'sun', 'مع توقّعات 3 أيام', 'tools.html#wx'],
  ['الوقت والتاريخ', 'clock', 'ميلادي وهجري', 'tools.html#time'],
  ['قارن جهازين', 'swap', 'قريباً', '']
];

/* skip = id בודד או רשימת/סט מזהים שכבר מוצגים בעמוד.
   בלי זה "הأكثر قراءة" מציג בדיוק את אותן כתבות שכבר בראש העמוד. */
function sidebar(l, skip) {
  const out = skip == null ? new Set()
    : (typeof skip === 'string' ? new Set([skip]) : new Set(skip));
  let top = sorted.filter((a) => !out.has(a.id)).slice(0, 5);
  if (top.length < 5) top = sorted.filter((a) => a.id !== (typeof skip === 'string' ? skip : null)).slice(0, 5);
  const rank = top.length
    ? top.map((a, i) => row(a, i, l)).join('')
    : '<p class="empty">لسا ما في مقالات.</p>';
  const tools = TOOLS.map(([t, k, sub, href]) => {
    const inner = `<span class="tool__i">${ico(k, 20)}</span>` +
      `<span class="tool__t"><b>${t}</b><span>${sub}</span></span>`;
    return href
      ? `<a class="tool" href="${l.page(href)}">${inner}${ico('arrow', 16, 'tool__c')}</a>`
      : `<span class="tool tool--soon">${inner}</span>`;
  }).join('');
  return `<aside class="side">
  <section class="panel"><h2>الأكثر قراءة</h2><div class="rank">${rank}</div></section>
  <section class="panel"><h2>الأدوات</h2><div class="tools">${tools}</div></section>
  ${ADS ? adUnit('side') : ''}
</aside>`;
}

/* ---------- שלד העמוד ---------- */
/* ---------- אורך הכותרת והתיאור בגוגל ----------
   גוגל חותך כותרת מעל ~60 תו ותיאור מעל ~160. חיתוך באמצע מילה
   נראה כמו תקלה. clip() חותך על גבול מילה ומוסיף שלוש נקודות. */
const clip = (t, max) => {
  const x = plain(t).replace(/\s+/g, ' ').trim();
  if (x.length <= max) return x;
  const cut = x.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[،,.\-–—:]$/, '') + '…';
};
/* הכותרת מקבלת את שם האתר רק אם נשאר מקום */
const seoTitle = (t) => {
  const base = plain(t).trim();
  const suffix = ' — ' + SITE.name;
  return base.length + suffix.length <= 60 ? base + suffix : clip(base, 60);
};
const seoDesc = (d, fallback) => {
  const x = plain(d || '').trim();
  if (x.length >= 70) return clip(x, 158);
  const extra = (fallback || '').trim();
  const joined = extra && !x.includes(extra) ? (x ? x + ' ' + extra : extra) : x;
  return clip(joined, 158);
};

function head({ title, desc, url, image, depth = '', type = 'website', jsonld = '' }) {
  image = image || OG_DEFAULT;
  const canon = SITE.domain.replace(/\/$/, '') + '/' + url;
  const img = image ? SITE.domain.replace(/\/$/, '') + '/' + image : '';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="${SITE.theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(clip(title, 88))}</title>
<meta name="description" content="${esc(clip(desc, 158))}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="ar_AR">
<meta property="og:title" content="${esc(clip(title, 88))}">
<meta property="og:description" content="${esc(clip(desc, 200))}">
<meta property="og:url" content="${canon}">
${img ? `<meta property="og:image" content="${img}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<link rel="icon" href="${FAVICON}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="${depth}feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"></noscript>
<link rel="stylesheet" href="${vurl(depth, 'assets/css/site.css')}">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}${adHead()}
</head>
<body>
`;
}

/* شريط الأقسام السريع — بديل القائمة الكبيرة على الجوال واللوح */
function quickRail(l, active) {
  const items = QUICK.map(itemOf).filter((i) => !i.slug || isLive(i.slug));
  if (!items.length) return '';
  return `<nav class="qr" aria-label="أقسام سريعة"><div class="wrap qr__in">${items.map((i) => {
    const href = i.slug ? l.cat(i.slug) : l.page(i.page);
    const on = itemHas(i, active) ? ' on' : '';
    const mk = i.mark ? ' qr__c--' + i.mark : '';
    return `<a class="qr__c${mk}${on}" href="${href}">${esc(i.label)}</a>`;
  }).join('')}</div></nav>`;
}

function header(l, active = '') {
  return `<header class="hd" id="hd"><div class="wrap hd__in">
  <button class="ib" id="openMenu" aria-expanded="false" aria-controls="drawer" aria-label="فتح القائمة">${ico('burger')}</button>
  <a class="bd" href="${l.home}" aria-label="${esc(SITE.name)} — الصفحة الرئيسية"><span class="bmk">${ico('bolt', 22)}</span><span class="bd__t">${esc(SITE.name)}<i class="bd__s">${esc(SITE.short || '')}</i></span></a>
  <nav class="nv" aria-label="التنقّل الرئيسي">${megaNav(l, active)}</nav>
  <div class="hd__r">
    <button class="ib" id="themeBtn" aria-label="تبديل التصميم" title="تبديل التصميم">${ico('palette')}</button>
    <a class="ib" href="${l.page('search.html')}" aria-label="بحث">${ico('search')}</a>
    <a class="cta" href="${l.page('prices.html')}">${ico('coin', 18)}<span class="cta__l">الأسعار</span></a>
  </div>
</div>
<div class="themes" id="themes" hidden>
  <button data-set="ink"><i class="sw sw--ink"></i>حبر</button>
  <button data-set="paper"><i class="sw sw--paper"></i>ورق</button>
  <button data-set="pulse"><i class="sw sw--pulse"></i>نبض</button>
</div>
</header>
${quickRail(l, active)}
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="قائمة الأقسام">
  <div class="drawer__h"><strong>الأقسام</strong>
    <button class="ib" id="closeMenu" aria-label="إغلاق">${ico('close')}</button></div>
  <div class="drawer__p">
    <a class="dpin dpin--hot" href="${l.page('prices.html')}">${ico('coin', 20)}<span><b>أسعار السوق</b><i>مرصودة بالشيكل من المحلّات</i></span></a>
    <a class="dpin" href="${l.page('fixes.html')}">${ico('swap', 20)}<span><b>تصحيح الأخبار</b><i>خبر انتشر غلط — وشو الحقيقة</i></span></a>
  </div>
  <div class="drawer__s">${drawerTree(l)}</div>
</aside>
`;
}

const FOOT_COLS = [
  ['الأقسام', ['news', 'mobile', 'security', 'apps', 'computer']],
  ['محاور', ['tips', 'reviews', 'compare', 'spot', 'opinion']],
  ['موضوعات', ['ai', 'digital', 'cloud', 'iot', 'gaming']]
];
const FOOT_PAGES = [['الأسعار', 'prices.html'], ['تصحيح الأخبار', 'fixes.html'], ['من نحن', 'about.html'], ['المحرّر', 'author.html'], ['اتصل بنا', 'contact.html'],
  ['سياسة الخصوصية', 'privacy.html'], ['المحفوظات', 'saved.html'], ['شروط الاستخدام', 'terms.html'],
  ['الإفصاح التسويقي', 'disclosure.html']];

function footer(l, page) {
  const cols = FOOT_COLS.map(([t, slugs]) => {
    const live = slugs.filter(isLive);
    if (!live.length) return '';
    return `<div class="ft__c"><b>${t}</b>${live.map((s) =>
      `<a href="${l.cat(s)}">${esc(cat(s).name)}</a>`).join('')}</div>`;
  }).join('') +
    `<div class="ft__c"><b>الموقع</b>${FOOT_PAGES.map(([t, p]) =>
      `<a href="${l.page(p)}">${t}</a>`).join('')}</div>`;
  const soc = ['google', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'youtube'].filter(isLive);
  return `<footer class="ft"><div class="wrap">
  <div class="ft__in">
    <div class="ft__brand"><a class="bd" href="${l.home}"><span class="bmk">${ico('bolt', 22)}</span><span>${esc(SITE.name)}</span></a>
      <p>${esc(SITE.tagline)}</p>
      <div class="ft__soc">${soc.map((s) => `<a href="${l.cat(s)}">${esc(cat(s).name)}</a>`).join('')}</div></div>
    ${cols}
  </div>
  <div class="ft__bar"><span>© 2026 ${esc(SITE.name)} — كل الحقوق محفوظة</span>
    <span>zochmer.com</span></div>
</div></footer>
${page === 'search.html' ? `<script src="${vurl(l.asset(''), 'assets/js/search-index.js')}"></script>` : ''}
<script src="${vurl(l.asset(''), 'assets/js/site.js')}"></script>
<script src="${vurl(l.asset(''), 'assets/js/search.js')}"></script>
<script src="${vurl(l.asset(''), 'assets/js/tools.js')}" defer></script>
${SITE.analytics ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${SITE.analytics}"}'></script>` : ''}
</body></html>
`;
}

const sec = (title, sub, inner, more) =>
  `<section class="sec"><div class="sh"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>` +
  (more ? `<a class="more" href="${more}">كل المقالات</a>` : '') + `</div>${inner}</section>`;

/* ═══════════════ עמוד הבית ═══════════════ */
/* ---------- شريط الأسعار بالصفحة الرئيسية ----------
   أهم إشي بالموقع لازم يبين بالصفحة الأولى، مش بس بالتذييل. */
function priceBand(l) {
  if (!PRICES.length) return '';
  const rows = PRICES.slice().sort((a, b) => a.p - b.p);
  const pick = [
    rows.find((r) => r.p >= 900 && r.p < 1600),
    rows.find((r) => r.p >= 1600 && r.p < 2400),
    rows.find((r) => r.p >= 2400 && r.p < 3200),
    rows.find((r) => r.p >= 3200 && r.p < 4600)
  ].filter(Boolean);
  const checked = rows.map((r) => r.d).sort().pop();
  return `<section class="pband">
    <div class="pband__h">
      <div>
        <h2>أسعار الأجهزة عنّا</h2>
        <p>${rows.length} سعر مرصود من السوق المحلّي بالشيكل — مش محوّل من دولار. آخر فحص ${fmtDate(checked)}</p>
      </div>
      <a class="pband__cta" href="${l.page('prices.html')}">افتح الجدول الكامل ${ico('arrow', 16)}</a>
    </div>
    <div class="pband__g">
      ${pick.map((r) => `<a class="pcard" href="${l.page('prices.html')}">
        <span class="pcard__n">${esc(r.n)}</span>
        <span class="pcard__p">${NIS(r.p)} <small>₪</small></span>
        <span class="pcard__s">${esc(r.s && r.s !== '—' ? r.s + ' · ' : '')}${esc((PRICE_KINDS[r.k] || [''])[0])}</span>
      </a>`).join('')}
    </div>
  </section>`;
}

function pageIndex() {
  const l = L('');
  const hero = sorted.find((a) => a.featured) || sorted[0];
  /* מגלשת הכותרת: הכתבה המובילה + ארבע אחריה.
     כל שקופית היא קישור אמיתי עם כותרת כטקסט — גוגל קורא את כולן.
     בלי JS נראית הראשונה בלבד, וזה בסדר גמור.                     */
  /* מעדיפים כתבות עם צילום אמיתי — מגלשה בלי תמונות נראית ריקה.
     אם אין מספיק כאלה, ממלאים בחדשות ביותר.                        */
  const pool = sorted.filter((a) => a !== hero);
  const withPic = pool.filter((a) => thumbOf(a));
  const slides = [hero, ...withPic.slice(0, 4)].filter(Boolean);
  for (const a of pool) { if (slides.length >= 5) break; if (!slides.includes(a)) slides.push(a); }
  const rest = sorted.filter((a) => !slides.includes(a));

  const slideHTML = slides.map((a, i) => `
    <article class="sl${thumbOf(a) ? '' : ' sl--text'}${i === 0 ? ' on' : ''}" data-i="${i}" ${i ? 'aria-hidden="true"' : ''}>
      ${thumbOf(a) ? `<span class="sl__i">
        <img class="sl__bg" src="${l.asset(esc(thumbOf(a)))}" alt="" aria-hidden="true" loading="lazy">
        <img class="sl__fg" src="${l.asset(esc(thumbOf(a)))}" alt="" ${i ? 'loading="lazy"' : ''}>
      </span>` : ''}
      <div class="sl__b">
        <a class="tag tag--hot" href="${l.cat(a.cat)}">${esc(cat(a.cat).name)}</a>
        ${i === 0 ? `<h1 class="sl__t"><a href="${l.art(a.id)}">${esc(a.title)}</a></h1>`
                  : `<h2 class="sl__t"><a href="${l.art(a.id)}">${esc(a.title)}</a></h2>`}
        <p class="sl__d">${esc(a.dek || '')}</p>
        <span class="cd__m">${fmtDate(a.date)} · ${a.read || 5} دقائق قراءة</span>
      </div>
    </article>`).join('');

  const dots = slides.map((a, i) =>
    `<button class="hsl__dot${i === 0 ? ' on' : ''}" data-go="${i}" aria-label="شريحة ${i + 1}"><i></i></button>`).join('');

  const heroHTML = slides.length ? `<section class="hero is-live">
  <div class="hsl" data-slider data-n="${slides.length}">
    <div class="hsl__track">${slideHTML}</div>
    <button class="hsl__a hsl__a--prev" data-go="prev" aria-label="السابق">${ico('arrow', 20)}</button>
    <button class="hsl__a hsl__a--next" data-go="next" aria-label="التالي">${ico('arrow', 20)}</button>
    <div class="hsl__dots">${dots}</div>
  </div>
  <div class="hero__side">${rest.slice(0, 2).map((a) => card(a, l)).join('')}</div>
</section>` : '<section class="hero"><p class="empty">لسا ما في مقالات — قريباً.</p></section>';

  /* פס "عاجل" לא חוזר על הכתבות שכבר מוצגות מיד מתחתיו */
  const heroIds = new Set([...slides, ...rest.slice(0, 2)].map((a) => a.id));
  /* שורת "عاجل" נעה: שני עותקים זהים של אותה רשימה, והאנימציה
     מזיזה את הרצועה בדיוק חצי מרוחבה — כך הלולאה נסגרת בלי קפיצה. */
  const tickItems = sorted.filter((a) => !heroIds.has(a.id)).slice(0, 8)
    .map((a) => `<a href="${l.art(a.id)}">${esc(a.title)}</a>`).join('');
  const ticker = tickItems
    ? `<div class="ticker__run"><span class="ticker__c">${tickItems}</span>` +
      `<span class="ticker__c" aria-hidden="true">${tickItems}</span></div>`
    : '';

  /* לא חוזרים על כתבה שכבר הופיעה בכותרת הראשית או במקטע קודם */
  const seen = new Set(heroIds);

  let secN = 0;
  const sections = HOME_SECTIONS.map((s) => {
    /* cat:'*' = הכתבות החדשות ביותר מכל הקטגוריות */
    /* cat:'*' = הכול · cats:[...] = כמה קטגוריות יחד (למשל כל ענף הרכב) */
    const pool = s.fix ? sorted.filter((a) => a.fixpost)
      : s.cat === '*' ? sorted
      : s.cats ? sorted.filter((a) => s.cats.includes(a.cat))
      : inCat(s.cat);
    const list = pool.filter((a) => !seen.has(a.id)).slice(0, s.limit);
    if (!list.length) return '';
    list.forEach((a) => seen.add(a.id));
    const g = list.length === 1 ? 'g1' : list.length === 2 ? 'g2' : 'g3';
    const more = s.fix ? l.page('fixes.html') : s.cat === '*' ? l.page('search.html') : l.cat(s.cat || s.cats[0]);
    /* פרסומת אחת בלבד בעמוד הבית — אחרי המקטע הראשון */
    const ad = (++secN === 1) ? adUnit('home') : '';
    return sec(s.title, s.sub, `<div class="g ${g}">${list.map((a) => card(a, l)).join('')}</div>`, more) + ad;
  }).join('');

  const chipsBrands = ['iphone', 'samsung', 'xiaomi', 'huawei', 'android', 'honor', 'oneplus', 'realme'].filter(isLive)
    .map((s) => `<a class="chip" href="${l.cat(s)}">${esc(cat(s).name)}</a>`).join('');
  const chipsSocial = ['google', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'youtube', 'twitter', 'telegram'].filter(isLive)
    .map((s) => `<a class="chip" href="${l.cat(s)}">${esc(cat(s).name)}</a>`).join('');

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: SITE.name, url: SITE.domain, inLanguage: 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.domain}/search.html?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });

  return head({ title: `${SITE.name} — ${SITE.tagline}`, desc: SITE.desc, url: '', jsonld }) +
    header(l, 'الرئيسية') + `<main class="wrap">
  <div class="ticker"><b>عاجل</b><div class="ticker__t is-live">${ticker}</div></div>
  ${heroHTML}
  <div class="chipbar">${chipsBrands}</div>
  ${priceBand(l)}
  <div class="cols"><div>${sections}</div>${sidebar(l, seen)}</div>
  ${(() => {
    /* מקטע הרשתות: כרטיסים אמיתיים אם יש, וצ'יפים בכל מקרה.
       כותרת ריקה בלי כלום מתחתיה נראית כמו תקלה. */
    const soc = ['google', 'facebook', 'instagram', 'whatsapp', 'tiktok',
                 'youtube', 'twitter', 'telegram', 'snapchat', 'linkedin'];
    const list = sorted.filter((a) => soc.includes(a.cat) && !seen.has(a.id)).slice(0, 3);
    list.forEach((a) => seen.add(a.id));
    const g = list.length === 1 ? 'g1' : list.length === 2 ? 'g2' : 'g3';
    const cards = list.length
      ? `<div class="g ${g}">${list.map((a) => card(a, l)).join('')}</div>`
      : '';
    return `<section class="sec"><div class="sh"><div><h2>التواصل الاجتماعي</h2>` +
      `<p>${list.length ? 'أخبار المنصات' : 'تصفّح حسب المنصّة'}</p></div></div>` +
      cards + `<div class="chipbar chipbar--sec">${chipsSocial}</div></section>`;
  })()}
</main>` + footer(l);
}

/* ═══════════════ עמוד קטגוריה ═══════════════ */
/* ---------- صفحة المحرّر ----------
   E-E-A-T: جوجل بيسأل "مين كتب هاد ولیش نصدّقه". صفحة محرّر حقيقية
   مع سياسة تحرير واضحة بترفع ثقة القارئ وترتيب الموقع مع بعض. */
/* ---------- صفحة الأسعار ----------
   هاي الصفحة هي سبب وجود الموقع بجملة وحدة: أسعار حقيقية بالشيكل
   من السوق المحلّي، بمكان واحد، مع تاريخ الرصد. المقالات بتشرح،
   وهاي بتجاوب على السؤال المباشر: "معي كذا شيكل — شو بياخدني أبعد؟" */
const NIS = (n) => new Intl.NumberFormat('en-US').format(n);

/* ---------- صفحة التصحيحات ----------
   هوية الموقع بجملة: إحنا مش بنعيد نشر الخبر، بنفحصه.
   هون بتلاقي كل خبر انتشر غلط بالعربي وصحّحناه. */
function pageFixes() {
  const l = L('');
  const list = sorted.filter((a) => a.fixpost);
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'تصحيح الأخبار', url: `${SITE.domain}/fixes.html`, inLanguage: 'ar'
  });
  return head({
    title: `تصحيح الأخبار — ${SITE.name}`,
    desc: 'أخبار تقنية انتشرت بالعربي وفيها غلط — وشو الحقيقة فعلياً. منرجع للمصدر الأصلي، منقارن، ومنكتب شو انقال وشو صار. قسم ثابت بزوخمر.',
    url: 'fixes.html', depth: '', jsonld
  }) + header(l, 'fixes.html') + `<main class="wrap">
  <nav class="crumb" aria-label="مسار"><a href="${l.home}">الرئيسية</a>${ico('arrow', 14)}<span>تصحيح الأخبار</span></nav>
  <header class="chead"><h1>تصحيح الأخبار</h1>
    <p>خبر بينتشر بكل المواقع العربية، وبيطلع فيه غلط. هون منرجع للمصدر الأصلي ومنكتب شو صار فعلاً.
       <b>${list.length} تصحيح</b></p></header>
  <section class="fxi">
    <b>ليش هالقسم موجود</b>
    <p>أغلب المواقع التقنية العربية بتترجم الخبر بسرعة عشان تسبق غيرها. لمّا يكون في غلط بالترجمة أو
       بالفهم، الغلط بينتشر بعشرات المواقع بنفس اليوم — وبيضل موجود بعد ما يتصحّح بالمصدر الأصلي.
       إحنا بنرجع للبيان الرسمي أو لوثيقة المحكمة أو لصفحة الشركة، وبنكتب شو انقال بالضبط.</p>
  </section>
  <div class="cols"><div>
    ${list.length ? card(list[0], l, 'lead') + (list.length > 1
      ? `<div class="g g3">${list.slice(1).map((a) => card(a, l)).join('')}</div>` : '')
      : '<p class="empty">لسا ما في تصحيحات.</p>'}
  </div>${sidebar(l)}</div>
</main>` + footer(l, 'fixes.html');
}

function pagePrices() {
  const l = L('');
  const rows = PRICES.slice().sort((a, b) => a.p - b.p);
  const brands = [...new Set(rows.map((r) => r.b))];
  const cats = [...new Set(rows.map((r) => r.c || 'phone'))];
  const bands = [
    ['0-1500', 'لحدّ 1,500'], ['1500-2500', '1,500 – 2,500'],
    ['2500-4000', '2,500 – 4,000'], ['4000-99999', 'فوق 4,000']
  ];
  const checked = rows.length ? rows.map((r) => r.d).sort().pop() : '';

  const tr = (r) => {
    const kind = PRICE_KINDS[r.k] || ['', ''];
    return `<tr data-b="${esc(r.b)}" data-p="${r.p}" data-k="${esc(r.k)}" data-c="${esc(r.c || 'phone')}">
      <td class="pr__n"><b>${esc(r.n)}</b>${r.s && r.s !== '—' ? `<span class="pr__s">${esc(r.s)}</span>` : ''}
        ${r.t ? `<span class="pr__t">${rt(r.t, l)}</span>` : ''}</td>
      <td class="pr__b">${esc(PRICE_BRANDS[r.b] || r.b)}</td>
      <td class="pr__p"><b>${NIS(r.p)}</b> <span>₪</span>${r.e ? `<span class="pr__e">بإيلات ${NIS(r.e)}</span>` : ''}</td>
      <td><span class="kd kd--${esc(r.k)}" title="${esc(kind[1])}">${esc(kind[0])}</span></td>
      <td class="pr__a">${r.a ? `<a href="${l.art(r.a)}">التفاصيل</a>` : ''}</td>
    </tr>`;
  };

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'أسعار الأجهزة بالسوق المحلّي', numberOfItems: rows.length,
    itemListElement: rows.slice(0, 40).map((r, i) => ({
      '@type': 'ListItem', position: i + 1, name: `${r.n} ${r.s || ''}`.trim()
    }))
  });

  return head({
    title: `أسعار الأجهزة عنّا بالشيكل — ${SITE.name}`,
    desc: `قاعدة أسعار محدَّثة لأجهزة السوق المحلّي بالشيكل — ${rows.length} سعر مرصود من محلّات ومستوردين، مع تاريخ الرصد والفرق بين الاستيراد الرسمي والموازي. فلتر حسب ميزانيتك.`,
    url: 'prices.html', depth: '', jsonld
  }) + header(l, 'prices.html') + `<main class="wrap">
  <nav class="crumb" aria-label="مسار"><a href="${l.home}">الرئيسية</a>${ico('arrow', 14)}<span>الأسعار</span></nav>
  <header class="chead"><h1>أسعار الأجهزة عنّا</h1>
    <p>${rows.length} سعر مرصود من السوق المحلّي بالشيكل — مش محوّل من دولار.
       <b>آخر فحص ${fmtDate(checked)}</b></p></header>

  <div class="pfl" role="group" aria-label="فلترة">
    <div class="pfl__g"><span class="pfl__l">النوع</span>
      <button class="chip chip--sm on" data-ctype="">الكل</button>
      ${cats.map((k) => `<button class="chip chip--sm" data-ctype="${esc(k)}">${esc(PRICE_CATS[k] || k)}</button>`).join('')}
    </div>
    <div class="pfl__g"><span class="pfl__l">الميزانية</span>
      <button class="chip chip--sm on" data-band="">الكل</button>
      ${bands.map(([v, t]) => `<button class="chip chip--sm" data-band="${v}">${t}</button>`).join('')}
    </div>
    <div class="pfl__g"><span class="pfl__l">الماركة</span>
      <button class="chip chip--sm on" data-brand="">الكل</button>
      ${brands.map((b) => `<button class="chip chip--sm" data-brand="${esc(b)}">${esc(PRICE_BRANDS[b] || b)}</button>`).join('')}
    </div>
    <div class="pfl__g"><span class="pfl__l">الاستيراد</span>
      <button class="chip chip--sm on" data-kind="">الكل</button>
      <button class="chip chip--sm" data-kind="off">رسمي</button>
      <button class="chip chip--sm" data-kind="grey">موازي</button>
    </div>
  </div>

  <p class="pfl__c" data-price-count></p>

  <div class="ptw">
    <table class="pt">
      <thead><tr><th>الجهاز</th><th>الماركة</th><th>السعر</th><th>الاستيراد</th><th></th></tr></thead>
      <tbody data-price-body>${rows.map(tr).join('')}</tbody>
    </table>
    <p class="pt__none" data-price-none hidden>ما في أجهزة بهالفلترة. جرّب توسّع الميزانية.</p>
  </div>

  <section class="pnote">
    <b>كيف بنجمع هالأرقام</b>
    <ul>
      <li>كل سعر مرصود من محلّ أو مستورد بالسوق المحلّي، مش محوّل من الدولار.</li>
      <li>السعر المعروض هو <strong>أرخص سعر لقيناه</strong> — بتلاقي أغلى منه بمحلّات تانية.</li>
      <li>«رسمي» يعني كفالة من المستورد المحلّي. «موازي» يعني الكفالة من المحلّ نفسه.</li>
      <li>أسعار إيلات معفاة من الضريبة — لازم الشراء والاستلام يصيروا هناك.</li>
      <li>الأسعار بتتحرّك كل كم أسبوع. خُد الرقم كنقطة انطلاق للمقارنة، مش كسعر ثابت.</li>
    </ul>
  </section>
</main>` + footer(l, 'prices.html');
}

function pageAuthor() {
  const l = L('');
  const ap = SITE.authorProfile || { name: SITE.author, role: '', bio: '', lines: [] };
  const mine = sorted;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person', name: ap.name, jobTitle: ap.role, description: plain(ap.bio),
      url: `${SITE.domain}/author.html`,
      worksFor: { '@type': 'Organization', name: SITE.name, url: SITE.domain }
    }
  });
  return head({
    title: `${ap.name} — ${SITE.name}`,
    desc: plain(ap.bio).slice(0, 160), url: 'author.html', depth: '', jsonld
  }) + header(l, 'author.html') + `<main class="wrap">
  <nav class="crumb" aria-label="مسار"><a href="${l.home}">الرئيسية</a>${ico('arrow', 14)}<span>${esc(ap.name)}</span></nav>
  <header class="aup">
    <div class="aup__av" aria-hidden="true">${esc(ap.name.slice(0, 1))}</div>
    <div class="aup__b">
      <h1>${esc(ap.name)}</h1>
      <p class="aup__role">${esc(ap.role)}</p>
      <p class="aup__bio">${rt(ap.bio, l)}</p>
    </div>
  </header>
  ${(ap.lines && ap.lines.length) ? `<section class="aup__pol">
    <b>كيف بنشتغل</b>
    <ul>${ap.lines.map((x) => `<li>${rt(x, l)}</li>`).join('')}</ul>
  </section>` : ''}
  <header class="chead"><h2>كل المقالات <b>${mine.length}</b></h2></header>
  ${card(mine[0], l, 'lead')}
  <div class="g g3">${mine.slice(1).map((a) => card(a, l)).join('')}</div>
</main>` + footer(l);
}

function pageCategory(c) {
  const l = L('../');
  const list = inCat(c.slug);
  /* הראשונה מקבלת טיפול מוביל, השאר ברשת — היררכיה במקום ריבועים זהים */
  const [first, ...rest] = list;
  const mid = rest.slice(0, 2);
  const tail = rest.slice(2);
  const grid = list.length
    ? (first ? card(first, l, 'lead') : '') +
      (mid.length ? `<div class="g g2">${mid.map((a) => card(a, l)).join('')}</div>` : '') +
      (tail.length ? `<div class="g g3">${tail.map((a) => card(a, l)).join('')}</div>` : '')
    : '<p class="empty">ما في مقالات بهالقسم بعد — قريباً.</p>';
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: c.name, url: `${SITE.domain}/c/${c.slug}.html`, inLanguage: 'ar'
  });
  return head({
    title: `${c.name} — ${SITE.name}`, desc: c.desc || `${c.name} — ${SITE.name}`,
    url: `c/${c.slug}.html`, depth: '../', jsonld
  }) + header(l, c.slug) + `<main class="wrap">
  <nav class="crumb" aria-label="مسار"><a href="${l.home}">الرئيسية</a>${ico('arrow', 14)}<span>${esc(c.name)}</span></nav>
  <header class="chead"><h1>${esc(c.name)}</h1>
    <p>${esc(c.desc)} <b>${list.length} مقال</b></p></header>
  <div class="cols"><div>${grid}</div>${sidebar(l)}</div>
</main>` + footer(l);
}

/* מפת מונח → כתבה, מהארוך לקצר כדי שביטוי ארוך ינצח מילה בודדת */
const KEYMAP = (() => {
  const out = [];
  for (const a of ARTICLES) for (const k of (a.keys || [])) out.push([k, a.id]);
  return out.sort((x, y) => y[0].length - x[0].length);
})();

/* מוסיף קישורים פנימיים לגוף הכתבה, בלי לגעת בכותרות ובטבלאות */
function autoLink(body, selfId) {
  if (!KEYMAP.length) return body;
  const used = new Set([selfId]);
  let count = 0;
  const doText = (t) => {
    if (typeof t !== 'string' || count >= AUTO_MAX) return t;
    for (const [key, id] of KEYMAP) {
      if (count >= AUTO_MAX) break;
      if (used.has(id)) continue;
      /* לא נוגעים בטקסט שכבר בתוך קישור ידני או תגית */
      if (/\[\[/.test(t)) continue;
      /* בערבית המונח כמעט אף פעם לא מופיע ערום — לפניו ו/ب/ل/ك/ف
         או ال. לכן מחפשים גם עם תחילית, ומקשרים את המילה כפי שהיא. */
      const bare = key.replace(/^ال/, '');
      const re = new RegExp('(^|[\\s،.:؛"«(])((?:[وبلكف])?(?:ال)?' +
        bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'u');
      const m = re.exec(t);
      if (!m) continue;
      const i = m.index + m[1].length;
      t = t.slice(0, i) + `[[${id}|${m[2]}]]` + t.slice(i + m[2].length);
      used.add(id);
      count++;
    }
    return t;
  };
  return body.map((b) => {
    if (b.p) return { ...b, p: doText(b.p) };
    if (b.note) return { ...b, note: [b.note[0], doText(b.note[1])] };
    return b;
  });
}

/* ═══════════════ עמוד כתבה ═══════════════ */
function blockHTML(b, l) {
  if (b.h) return `<h2 id="h-${esc(b.h).replace(/\s+/g, '-')}">${esc(b.h)}</h2>`;
  if (b.p) return `<p>${rt(b.p, l)}</p>`;
  if (b.quote) return `<blockquote class="quote quote--real">${rt(b.quote, l)}</blockquote>`;
  if (b.img) return `<figure class="figure"><img src="${l.asset(esc(b.img))}" alt="" loading="lazy">` +
    (b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : '') + '</figure>';
  if (b.specs) return '<div class="specs"><b>جدول المواصفات</b>' + b.specs.map((r) =>
    `<div class="spec"><span>${rt(r[0])}</span><span>${rt(r[1])}</span></div>`).join('') + '</div>';
  if (b.steps) return '<ol class="steps">' + b.steps.map((s) =>
    `<li><b>${rt(s[0], l)}</b>${s[1] ? `<span>${rt(s[1], l)}</span>` : ''}</li>`).join('') + '</ol>';
  if (b.note) return `<div class="callout"><b>${rt(b.note[0], l)}</b><p>${rt(b.note[1], l)}</p></div>`;
  if (b.verdict) {
    const v = b.verdict;
    return '<section class="verdict">' +
      '<div class="verdict__h">' +
      (v.score ? `<span class="score">${esc(v.score)} <small>/ 10</small></span>` : '') +
      `<h2>الخلاصة</h2><p>${rt(v.text || '')}</p></div><div class="pc">` +
      `<div class="good"><h3>الإيجابيات</h3><ul>${(v.pros || []).map((p) => `<li>${rt(p)}</li>`).join('')}</ul></div>` +
      `<div class="bad"><h3>السلبيات</h3><ul>${(v.cons || []).map((p) => `<li>${rt(p)}</li>`).join('')}</ul></div>` +
      '</div></section>';
  }
  if (b.faq) return '<section class="faq"><h2>أسئلة شائعة</h2>' + b.faq.map((q) =>
    `<details class="faq__i"><summary>${esc(plain(q[0]))}</summary><p>${rt(q[1])}</p></details>`).join('') +
    '</section>';
  /* {dl:[['اسم البرنامج','https://الموقع-الرسمي','ملاحظة'], …]}
     روابط تنزيل من الموقع الرسمي للمنتج فقط — بلا وسطاء وبلا مواقع تجميع. */
  if (b.dl) return '<div class="dlbox"><b>تنزيل من الموقع الرسمي</b>' +
    '<p class="dlbox__n">هاي روابط لمواقع الشركات المطوّرة نفسها. ما بنستضيف ولا ملف عنّا، وما بنحطّ روابط لمواقع تجميع أو نسخ معدّلة.</p>' +
    '<div class="dls">' + b.dl.map((d) =>
      `<a class="dl" href="${esc(d[1])}" target="_blank" rel="nofollow noopener external">` +
      `<span class="dl__i">${ico('arrow', 18)}</span>` +
      /* bdi = عزل اتجاه النصّ. بلاها "7-Zip" بتنقلب لـ"Zip-7" جوّا سياق عربي. */
      `<span class="dl__t"><b><bdi>${rt(d[0])}</bdi></b>${d[2] ? `<span>${rt(d[2])}</span>` : ''}` +
      `<bdi class="dl__u">${esc(String(d[1]).replace(/^https?:\/\//, '').split('/')[0])}</bdi></span></a>`).join('') +
    '</div></div>';
  /* {more:['article-id','نصّ الإحالة']} — إحالة لمقال تاني بنص المقال */
  if (b.more) {
    const t = ARTICLES.find((x) => x.id === b.more[0]);
    if (!t) return '';
    return `<aside class="readmore"><span class="readmore__l">اقرأ كمان</span>` +
      `<a href="${l.art(t.id)}">${rt(b.more[1] || t.title)}</a></aside>`;
  }
  /* fix = تصحيح خبر انتشر غلط. كل صفّ: شو انتشر، وشو الحقيقة.
     هاد قلب هوية الموقع — إحنا مش بنعيد نشر الخبر، بنفحصه. */
  if (b.fix) return '<div class="fixb"><b class="fixb__h">' +
    (b.fixTitle ? rt(b.fixTitle, l) : 'شو انتشر — وشو الحقيقة') + '</b>' +
    b.fix.map((r) => '<div class="fxr">' +
      `<div class="fxr__s"><span class="fxr__k">اللي انتشر</span><p>${rt(r[0], l)}</p></div>` +
      `<div class="fxr__t"><span class="fxr__k">الحقيقة</span><p>${rt(r[1], l)}</p></div>` +
      '</div>').join('') + '</div>';

  if (b.price) {
    const st = b.price.stores || [];
    /* חנות בלי כתובת נשארת טקסט ולא קישור מת. הגילוי הנאות
       מוצג רק אם באמת יש קישור שותפים אחד לפחות. */
    /* '#' בנתונים הישן = "אין קישור" ולא קישור אמיתי */
    const url = (s) => (s[2] && s[2] !== '#' ? s[2] : '');
    const anyLink = st.some((s) => url(s));
    return '<div class="pricebox"><b>الأسعار محلياً</b>' +
      `<div class="bignum">${esc(b.price.best)} <small>${esc(b.price.label || 'أرخص سعر لقيناه')}</small></div>` +
      '<div class="stores">' + st.map((s) => url(s)
        ? `<a class="store" href="${esc(url(s))}" rel="nofollow sponsored"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></a>`
        : `<div class="store store--flat"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('') +
      '</div>' +
      (anyLink ? '<p class="disc">إفصاح: بعض الروابط أعلاه روابط تسويق بالعمولة — بنحصل على عمولة صغيرة بدون أي فرق بالسعر عليك.</p>' : '') +
      (b.price.note ? `<p class="disc">${rt(b.price.note, l)}</p>` : '') +
      '</div>';
  }
  return '';
}

/* ---------- سرگ המשתף ----------
   واتساب هو القناة الأساسية عند جمهورنا، فبياخد الزر الكبير.
   الروابط بتتبنى على السيرفر بلا جافاسكربت — بتشتغل حتى لو الصفحة ما حمّلت السكربت. */
function shareBar(a) {
  const url = `${SITE.domain}/a/${a.id}.html`;
  const txt = plain(a.title);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(txt);
  return `<section class="shb" aria-label="مشاركة المقال">
    <b class="shb__h">عجبك المقال؟ شاركه</b>
    <div class="shb__r">
      <a class="shb__b shb__b--wa" href="https://wa.me/?text=${t}%20-%20${u}" target="_blank" rel="noopener">${ico('wa', 20)}<span>واتساب</span></a>
      <a class="shb__b" href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">${ico('tg', 19)}<span>تلجرام</span></a>
      <a class="shb__b" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">${ico('fb', 19)}<span>فيسبوك</span></a>
      <button class="shb__b" data-copy="${esc(url)}">${ico('link', 19)}<span>نسخ الرابط</span></button>
    </div>
  </section>`;
}

/* ---------- الأسعار الحيّة داخل المقال ----------
   المقال بينكتب مرّة، والسعر بيتغيّر كل كم أسبوع. عشان هيك السعر
   ما بينكتب بالمقال — بينسحب من قاعدة الأسعار وقت البناء.
   يعني تحديث سطر واحد بملف الأسعار بيحدّث كل المقالات المرتبطة فيه. */
const PRICES_BY_ART = (() => {
  const m = new Map();
  for (const r of PRICES) if (r.a) { if (!m.has(r.a)) m.set(r.a, []); m.get(r.a).push(r); }
  for (const [, v] of m) v.sort((x, y) => x.p - y.p);
  return m;
})();

function livePrices(a, l) {
  const rows = PRICES_BY_ART.get(a.id);
  if (!rows || !rows.length) return '';
  const checked = rows.map((r) => r.d).sort().pop();
  const show = rows.slice(0, 8);
  return `<section class="lvp">
    <div class="lvp__h"><b>الأسعار الحالية عنّا</b>
      <span>مرصودة ${fmtDate(checked)}</span></div>
    <div class="lvp__l">
      ${show.map((r) => `<div class="lvp__r">
        <span class="lvp__n">${esc(r.n)}${r.s && r.s !== '—' ? ` <small>${esc(r.s)}</small>` : ''}</span>
        <span class="lvp__k kd kd--${esc(r.k)}">${esc((PRICE_KINDS[r.k] || [''])[0])}</span>
        <span class="lvp__p">${NIS(r.p)} <small>₪</small></span>
      </div>`).join('')}
    </div>
    ${rows.length > show.length ? `<p class="lvp__m">و${rows.length - show.length} سعر تاني بالجدول الكامل.</p>` : ''}
    <a class="lvp__c" href="${l.page('prices.html')}">كل الأسعار عنّا بالشيكل ${ico('arrow', 15)}</a>
  </section>`;
}

function pageArticle(a) {
  const l = L('../');
  const c = cat(a.cat);
  const i = sorted.indexOf(a);
  const prev = sorted[i + 1], next = sorted[i - 1];
  const body = autoLink(a.body || [], a.id).map((b) => blockHTML(b, l)).join('');
  const toc = (a.body || []).filter((b) => b.h)
    .map((b) => `<a href="#h-${esc(b.h).replace(/\s+/g, '-')}">${esc(b.h)}</a>`).join('');
  const related = sorted.filter((x) => x.id !== a.id && x.cat === a.cat).slice(0, 3);
  const rel = (related.length ? related : sorted.filter((x) => x.id !== a.id).slice(0, 3))
    .map((x) => card(x, l)).join('');

  const faqBlock = (a.body || []).find((x) => x.faq);
  const graph = [{
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: a.title, description: a.dek || '', inLanguage: 'ar',
    datePublished: a.date, dateModified: a.updated || a.date,
    author: { '@type': 'Person', name: a.author || SITE.author, url: `${SITE.domain}/author.html` },
    publisher: { '@type': 'Organization', name: SITE.name },
    mainEntityOfPage: `${SITE.domain}/a/${a.id}.html`,
    ...(coverOf(a) ? { image: [`${SITE.domain}/${coverOf(a)}`] } : {})
  }];
  if (faqBlock) graph.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqBlock.faq.map((q) => ({
      '@type': 'Question', name: plain(q[0]),
      acceptedAnswer: { '@type': 'Answer', text: plain(q[1]) }
    }))
  });
  graph.push({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${SITE.domain}/` },
      { '@type': 'ListItem', position: 2, name: c.name, item: `${SITE.domain}/c/${c.slug}.html` },
      { '@type': 'ListItem', position: 3, name: a.title }
    ]
  });
  const jsonld = graph.map((g) => JSON.stringify(g)).join('</script>\n<script type="application/ld+json">');

  return head({
    title: `${a.title} — ${SITE.name}`, desc: a.dek || SITE.desc,
    url: `a/${a.id}.html`, depth: '../', type: 'article', image: coverOf(a) || OG_DEFAULT, jsonld
  }) + header(l, a.cat) + `<div class="prog" id="prog"></div>
<main class="wrap">
  <nav class="crumb" aria-label="مسار"><a href="${l.home}">الرئيسية</a>${ico('arrow', 14)}
    <a href="${l.cat(c.slug)}">${esc(c.name)}</a>${ico('arrow', 14)}<span>${esc(a.title)}</span></nav>
  <div class="cols cols--art">
    <article class="art">
      <header class="ah${a.img ? ' ah--img' : ' ah--text'}">
        ${a.img ? `<div class="ah__m">
          <img class="ah__bg" src="${l.asset(esc(a.img))}" alt="" aria-hidden="true">
          <img class="ah__fg" src="${l.asset(esc(a.img))}" alt="${esc(plain(a.title))}">
        </div>` : ''}
        <div class="ah__b">
          <a class="tag tag--hot" href="${l.cat(c.slug)}">${esc(c.name)}</a>${a.brief ? '<span class="brieftag brieftag--big">خبر سريع</span>' : ''}${a.fixpost ? '<span class="fixtag fixtag--big">تصحيح خبر</span>' : ''}
          <h1 class="art__t">${esc(a.title)}</h1>
          <p class="art__d">${esc(a.dek || '')}</p>
          <div class="art__meta">
            <a class="who" href="${l.page('author.html')}"><span class="av">${esc((SITE.authorProfile ? SITE.authorProfile.name : SITE.author).slice(0, 1))}</span><span><b>${esc(a.author || SITE.author)}</b><span>${esc(SITE.authorProfile ? SITE.authorProfile.role : 'محرّر')}</span></span></a>
            <span class="dot"></span><span>${fmtDate(a.date)}</span>
            <span class="dot"></span><span>${a.read || 5} دقائق قراءة</span>
            ${a.updated ? `<span class="upd">آخر تحديث ${fmtDate(a.updated)}</span>` : ''}
            <span class="acts"><button class="ib" aria-label="مشاركة">${ico('share', 20)}</button>
              <button class="ib" aria-label="حفظ">${ico('save', 20)}</button></span>
          </div>
        </div>
      </header>
      ${a.tldr && a.tldr.length ? `<div class="tldr is-live"><b>بالسريع</b><ul>${a.tldr.map((t) => `<li>${rt(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="body is-live">${body}</div>
      ${adUnit('article')}
      ${livePrices(a, l)}
      ${(a.tags && a.tags.length) ? `<div class="tags">${a.tags.map((t) =>
        `<a class="chip chip--sm" href="${l.page('search.html')}?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${shareBar(a)}
      <nav class="prevnext">
        ${prev ? `<a href="${l.art(prev.id)}"><small>السابق</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
        ${next ? `<a class="nx" href="${l.art(next.id)}"><small>التالي</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
      </nav>
      <section class="sec"><div class="sh"><div><h2>اقرأ كمان</h2><p>مقالات من نفس القسم</p></div></div>
        <div class="g g3">${rel}</div></section>
    </article>
    <aside class="side">
      ${toc ? `<section class="panel panel--toc"><h2>بهالمقال</h2><div class="toc">${toc}</div></section>` : ''}
      ${sidebar(l, a.id).replace('<aside class="side">', '').replace('</aside>', '')}
    </aside>
  </div>
</main>` + footer(l);
}

/* ═══════════════ עמודים סטטיים ═══════════════ */
function pageSearch() {
  const l = L('');
  const cats = [['', 'الكل'], ['news', 'أخبار'], ['reviews', 'مراجعات'], ['compare', 'مقارنات'],
    ['tips', 'نصائح'], ['security', 'أمن'], ['ai', 'ذكاء اصطناعي'], ['mobile', 'هواتف']];
  return head({ title: `بحث — ${SITE.name}`, desc: `ابحث بكل مقالات ${SITE.name} — مراجعات هواتف، أسعار محلّية بالشيكل، أدوات ذكاء اصطناعي، وشروحات عملية بالعربي. اكتب اسم جهاز أو موضوع وشوف كل ما كتبناه عنه.`, url: 'search.html' }) +
    header(l) + `<main class="wrap" data-page="search">
  <header class="chead chead--search"><h1>بحث</h1>
    <form class="sbox" onsubmit="return false">
      <input type="search" data-search-input placeholder="اكتب كلمة للبحث…" aria-label="بحث">
      <button class="cta">${ico('search', 18)}<span class="cta__l">ابحث</span></button></form>
    <div class="chipbar">${cats.map(([s, t], i) =>
      `<a class="chip chip--sm${i === 0 ? ' on' : ''}" href="#" data-search-cat="${s}">${t}</a>`).join('')}</div>
  </header>
  <p class="res" data-search-info>اكتب كلمة للبحث</p>
  <div class="g g3" data-search-results></div>
</main>` + footer(l, 'search.html');
}

function pageTools() {
  const l = L('');
  return head({ title: `مركز الأدوات — ${SITE.name}`,
    desc: 'أدوات سريعة: سعر الدولار واليورو بالشيكل، الطقس، والوقت والتاريخ الهجري.',
    url: 'tools.html' }) +
    header(l, 'الأدوات') + `<main class="wrap" data-page="tools">
  <header class="chead"><h1>مركز الأدوات</h1>
    <p>أرقام بتلزمك كل يوم — بتتحدّث لحالها، بلا تسجيل وبلا تطبيق.</p></header>

  <div class="tpg">
    <section class="tp" id="fx" data-tool="fx">
      <div class="tp__h"><span class="tp__i">${ico('coin', 22)}</span>
        <div><b>أسعار العملات بالشيكل</b><span data-fx-date>جاري التحميل…</span></div></div>
      <div class="tp__b">
        <div class="fx" data-fx-rows><span class="sk sk--l"></span><span class="sk sk--m"></span></div>
        <form class="fx__calc" onsubmit="return false">
          <input type="number" inputmode="decimal" value="100" data-fx-amt aria-label="المبلغ">
          <select data-fx-cur aria-label="العملة">
            <option value="USD">دولار أمريكي</option>
            <option value="EUR">يورو</option>
            <option value="JOD">دينار أردني</option>
            <option value="EGP">جنيه مصري</option>
            <option value="GBP">جنيه إسترليني</option>
            <option value="TRY">ليرة تركية</option>
          </select>
          <b data-fx-out>—</b>
        </form>
      </div>
    </section>

    <section class="tp" id="wx" data-tool="wx">
      <div class="tp__h"><span class="tp__i">${ico('sun', 22)}</span>
        <div><b>الطقس الآن</b><span data-wx-place>حسب موقعك</span></div></div>
      <div class="tp__b">
        <div class="wx" data-wx-now><span class="sk sk--m"></span></div>
        <div class="wx__days" data-wx-days></div>
        <button class="chip chip--sm" data-wx-geo>استخدم موقعي</button>
      </div>
    </section>

    <section class="tp" id="time" data-tool="time">
      <div class="tp__h"><span class="tp__i">${ico('clock', 22)}</span>
        <div><b>الوقت والتاريخ</b><span>ميلادي وهجري</span></div></div>
      <div class="tp__b">
        <div class="clock" data-clock>—</div>
        <div class="tp__rows">
          <div class="tp__row"><span>ميلادي</span><b data-greg>—</b></div>
          <div class="tp__row"><span>هجري</span><b data-hijri>—</b></div>
        </div>
      </div>
    </section>
  </div>
  <p class="disc">مصادر الأرقام: أسعار الصرف من بنك مركزي أوروبي عبر خدمة مفتوحة، والطقس من خدمة أرصاد مفتوحة. الأسعار إرشادية وبتختلف عن سعر البنك أو الصرّاف.</p>
</main>` + footer(l);
}

function simplePage(file, title, intro, blocks) {
  const l = L('');
  return head({ title: `${title} — ${SITE.name}`, desc: intro, url: file }) + header(l, title) +
    `<main class="wrap">
  <header class="chead"><h1>${esc(title)}</h1><p>${esc(intro)}</p></header>
  <div class="cols"><div class="prose body is-live">${blocks.map((b) =>
      b.h ? `<h2>${esc(b.h)}</h2>` : `<p>${esc(b.p)}</p>`).join('')}</div>${sidebar(l)}</div>
</main>` + footer(l);
}

function page404() {
  const l = L('');
  return head({ title: `الصفحة مش موجودة — ${SITE.name}`, desc: 'الصفحة اللي بتدوّر عليها مش موجودة أو انتقلت. ارجع للرئيسية أو استعمل البحث للوصول لكل مقالات زوخمر — مراجعات، أسعار محلّية، وشروحات بالعربي.', url: '404.html' }) +
    header(l) + `<main class="wrap">
  <header class="chead" style="text-align:center;border:0">
    <h1 style="font-size:clamp(3rem,2rem+6vw,6rem)">404</h1>
    <p>الصفحة اللي بتدوّر عليها مش موجودة — يمكن انحذفت أو الرابط غلط.</p>
    <p><a class="cta" href="${l.home}">رجوع للرئيسية</a></p>
  </header>
</main>` + footer(l);
}

/* ═══════════════ הרצה ═══════════════ */
const written = [];
const out = (p, s) => { write(p, s); written.push(p); };

out('index.html', pageIndex());
out('search.html', pageSearch());
out('tools.html', pageTools());

out('about.html', simplePage('about.html', 'من نحن',
  `${SITE.name} — موقع تقني بالعربي المحكي من جوّا البلاد. أسعار حقيقية بالشيكل، مراجعات بعد استعمال فعلي، وتصحيح الأخبار اللي بتنتشر غلط بالعربي.`, [
  { h: 'ليش الموقع موجود' },
  { p: 'في فجوة ما حدا بيسدّها: المواقع التقنية العربية بتكتب من القاهرة أو دبي أو الرياض، بأسعار دولار أو خليج. والمواقع التقنية المحلّية بتكتب بالعبري. اللي بيحكي عربي وساكن هون بيقع بالنص.' },
  { h: 'تلات أشياء بتميّزنا' },
  { p: '<strong>الأول: اللغة.</strong> منكتب بالعربي اللي بنحكيه، مش بالفصحى. مش عشان نكون مختلفين — عشان المعلومة توصل أسرع.' },
  { p: '<strong>التاني: الأسعار.</strong> كل سعر بالموقع مرصود من محلّ أو مستورد بالبلاد، بالشيكل، مع تاريخ الرصد. ما بنحوّل من دولار ولا مرّة. عنّا صفحة أسعار كاملة بتقدر تفلترها حسب ميزانيتك.' },
  { p: '<strong>التالت: منصحّح.</strong> لمّا خبر تقني ينتشر بالعربي وفيه غلط — منرجع للمصدر الأصلي، للبيان الرسمي أو لوثيقة المحكمة، ومنكتب شو انقال بالضبط. عنّا قسم ثابت لهاد.' },
  { h: 'كيف بنشتغل' },
  { p: 'كل مراجعة بتنكتب بعد استعمال حقيقي. إذا ما جرّبنا إشي، بنقول إنه ما جرّبناه. ولمّا ما نكون متأكّدين من معلومة، منقول إنها إشاعة أو تسريب — مش خبر.' },
  { h: 'تواصل' },
  { p: 'في اقتراح أو ملاحظة؟ صفحة «اتصل بنا» مفتوحة دايماً.' }
]));

out('contact.html', simplePage('contact.html', 'اتصل بنا',
  'اقتراح، ملاحظة، أو تصحيح لمقال — بنقرأ كل رسالة وبنردّ. إذا لقيت غلط بسعر أو بمعلومة، احكيلنا وبنصلّحه ونكتب إنه انصلّح.', [
  { h: 'للتواصل' },
  { p: 'اكتبلنا على البريد الإلكتروني، أو من خلال صفحاتنا على مواقع التواصل.' },
  { h: 'تصحيح خبر' },
  { p: 'إذا لقيت غلط بمقال — احكيلنا وبنصلّحه ونكتب إنه انصلّح.' }
]));

out('privacy.html', simplePage('privacy.html', 'سياسة الخصوصية',
  'شو بنجمع وشو ما بنجمعه بزوخمر — بلغة واضحة بلا مصطلحات قانونية. ما بنجمع أسماء ولا أرقام هواتف، وبنشرح بالضبط شو بتعمل أدوات الإحصاء.', [
  { h: 'المعلومات اللي بنجمعها' },
  { p: 'بنستعمل أدوات إحصاء لمعرفة عدد الزوّار والصفحات الأكثر قراءة. ما بنجمع أسماء ولا أرقام هواتف.' },
  { h: 'الكوكيز' },
  { p: 'الموقع بيحفظ بجهازك إعداد التصميم اللي اخترته فقط.' },
  { h: 'روابط خارجية' },
  { p: 'بعض الروابط بتوديك لمواقع تانية — سياسة الخصوصية عندهم مش مسؤوليتنا.' }
]));

out('terms.html', simplePage('terms.html', 'شروط الاستخدام',
  'قواعد بسيطة لاستخدام زوخمر — حقوق المحتوى والاقتباس، وتنبيه مهمّ حول الأسعار والمواصفات: الأسعار بتتغيّر باستمرار، تأكّد من سعر المتجر قبل الشراء.', [
  { h: 'المحتوى' },
  { p: 'كل المقالات ملك الموقع. ممنوع نسخها كاملة بدون إذن، بس مسموح الاقتباس مع ذكر المصدر ورابط.' },
  { h: 'الأسعار والمواصفات' },
  { p: 'الأسعار بتتغيّر باستمرار. بنحدّثها قدّ ما بنقدر، بس تأكّد من سعر المتجر قبل الشراء.' }
]));

out('disclosure.html', simplePage('disclosure.html', 'الإفصاح التسويقي',
  'كيف بيتموّل زوخمر — بشفافية كاملة. شرح واضح لروابط العمولة والإعلانات، وليش ما بيأثروا على رأينا بأي جهاز أو خدمة بنكتب عنها.', [
  { h: 'روابط بالعمولة' },
  { p: 'بعض روابط الشراء بالموقع هي روابط تسويق بالعمولة. إذا اشتريت من خلالها، بنحصل على عمولة صغيرة من المتجر — بدون أي فرق بالسعر عليك.' },
  { h: 'هاد ما بيأثر على رأينا' },
  { p: 'ما بنمدح منتج لأنه بيدفع أكثر. إذا منتج مش منيح، بنقول إنه مش منيح — حتى لو عليه عمولة.' }
]));

out('saved.html', (() => {
  const l = L('');
  return head({ title: `المحفوظات — ${SITE.name}`,
    desc: 'المقالات اللي حفظتها من زوخمر — محفوظة بمتصفّحك إنت بس، بلا حساب وبلا تسجيل وبلا ما تروح لأي سيرفر. احفظ مقال بضغطة وارجعله وقت ما بدّك.',
    url: 'saved.html' }) + header(l, 'المحفوظات') + `<main class="wrap">
  <header class="chead"><h1>المحفوظات</h1>
    <p>المقالات اللي حفظتها. مخزّنة بمتصفّحك إنت بس — ما بنشوفها وما بتروح لأي سيرفر.</p></header>
  <div class="cols"><div data-saved-list></div>${sidebar(l)}</div>
</main>` + footer(l);
})());

out('404.html', page404());

out('prices.html', pagePrices());
out('fixes.html', pageFixes());
out('author.html', pageAuthor());
for (const c of CATEGORIES) if (isLive(c.slug)) out(`c/${c.slug}.html`, pageCategory(c));
for (const a of ARTICLES) out(`a/${a.id}.html`, pageArticle(a));

/* sitemap + robots */
const urls = [
  '', 'search.html', 'prices.html', 'fixes.html', 'tools.html', 'about.html', 'author.html', 'contact.html', 'privacy.html',
  'terms.html', 'disclosure.html', 'saved.html',
  ...CATEGORIES.filter((c) => isLive(c.slug)).map((c) => `c/${c.slug}.html`),
  ...ARTICLES.map((a) => `a/${a.id}.html`)
];
const base = SITE.domain.replace(/\/$/, '');
out('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => {
    const a = ARTICLES.find((x) => `a/${x.id}.html` === u);
    return `  <url><loc>${base}/${u}</loc>` +
      (a ? `<lastmod>${a.date}</lastmod>` : '') +
      `<changefreq>${u === '' ? 'daily' : 'weekly'}</changefreq></url>`;
  }).join('\n') + '\n</urlset>\n');

/* ---------- אינדקס החיפוש ----------
   קודם נטען content.js (728KB) בכל עמוד באתר, רק בשביל עמוד החיפוש.
   עכשיו נבנה אינדקס רזה — בלי גוף הכתבות — ונטען אותו רק שם. */
out('assets/js/search-index.js',
  'var ARTICLES=' + JSON.stringify(sorted.map((a) => ({
    id: a.id, title: a.title, dek: a.dek || '', cat: a.cat,
    date: a.date, read: a.read || 5, img: a.img || null,
    tags: a.tags || []
  }))) + ';\nvar CATEGORIES=' + JSON.stringify(CATEGORIES.filter((c) => isLive(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name }))) + ';\n');

/* ---------- RSS ----------
   מקורא-חדשות, טלגרם, ואגרגטורים קוראים את זה. גם גוגל אוהב אותו. */
const cdata = (t) => `<![CDATA[${String(t ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const rfc822 = (d) => {
  const p = String(d || '').split('-');
  if (p.length !== 3) return '';
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 9)).toUTCString();
};
out('feed.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
  `  <title>${cdata(SITE.name)}</title>\n` +
  `  <link>${base}/</link>\n` +
  `  <description>${cdata(SITE.desc)}</description>\n` +
  '  <language>ar</language>\n' +
  `  <lastBuildDate>${rfc822(sorted[0] && sorted[0].date)}</lastBuildDate>\n` +
  `  <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
  sorted.slice(0, 40).map((a) => {
    const img = coverOf(a);
    return '  <item>\n' +
      `    <title>${cdata(a.title)}</title>\n` +
      `    <link>${base}/a/${a.id}.html</link>\n` +
      `    <guid isPermaLink="true">${base}/a/${a.id}.html</guid>\n` +
      `    <pubDate>${rfc822(a.date)}</pubDate>\n` +
      `    <category>${cdata(cat(a.cat).name)}</category>\n` +
      `    <description>${cdata(a.dek || '')}</description>\n` +
      (img ? `    <enclosure url="${base}/${img}" type="image/${img.endsWith('.png') ? 'png' : img.endsWith('.webp') ? 'webp' : 'jpeg'}" length="0"/>\n` : '') +
      '  </item>';
  }).join('\n') +
  '\n</channel>\n</rss>\n');

/* ads.txt — גוגל דורש אותו כדי לאמת בעלות על מלאי הפרסום */
if (ADS) out('ads.txt',
  `google.com, ${ADS.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

out('robots.txt',
  `User-agent: *\nAllow: /\nDisallow: /_dev/\nDisallow: /_to_delete/\n\nSitemap: ${base}/sitemap.xml\n`);

console.log(`✅ ${written.length} קבצים נבנו`);
/* ניקוי עמודים ישנים: קטגוריה שהתרוקנה או כתבה שנמחקה משאירות
   קובץ יתום שגוגל ממשיך לסרוק. מוחקים כל מה שלא נבנה עכשיו. */
const liveCats = CATEGORIES.filter((c) => isLive(c.slug)).map((c) => c.slug);
const keep = { c: new Set(liveCats), a: new Set(ARTICLES.map((a) => a.id)) };
let removed = 0;
for (const dir of ['c', 'a']) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.html')) continue;
    if (!keep[dir].has(f.slice(0, -5))) { fs.unlinkSync(path.join(full, f)); removed++; }
  }
}
console.log(`   ${liveCats.length} עמודי קטגוריה · ${ARTICLES.length} עמודי כתבות` +
  (removed ? `  (נמחקו ${removed} עמודים יתומים)` : ''));
console.log(`   sitemap.xml עם ${urls.length} כתובות`);
