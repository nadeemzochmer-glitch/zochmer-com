/* =====================================================================
   زوخمر — חיפוש חי בצד הלקוח
   כל שאר העמודים נבנים מראש ל-HTML על ידי build.mjs. הקובץ הזה משרת
   רק את search.html.
   ===================================================================== */
(function () {
  'use strict';
  var page = document.querySelector('[data-page="search"]');
  if (!page || typeof ARTICLES === 'undefined') return;

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var catOf = function (slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return { slug: slug, name: slug };
  };
  var MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب',
                'أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
  var fmtDate = function (d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? (+p[2]) + ' ' + MONTHS[(+p[1]) - 1] + ' ' + p[0] : '';
  };
  var media = function (a) {
    return a.img ? '<img src="' + esc(a.img) + '" alt="" loading="lazy">'
                 : '<span class="ph">صورة</span>';
  };
  function cardHTML(a) {
    var c = catOf(a.cat);
    return '<article class="cd">' +
      '<a class="cd__i" href="a/' + esc(a.id) + '.html">' + media(a) + '</a>' +
      '<div class="cd__b"><a class="tag" href="c/' + esc(c.slug) + '.html">' + esc(c.name) + '</a>' +
      '<a class="cd__t cd__t--real" href="a/' + esc(a.id) + '.html"><h3>' + esc(a.title) + '</h3>' +
      (a.dek ? '<p>' + esc(a.dek) + '</p>' : '') + '</a>' +
      '<span class="cd__m">' + esc(fmtDate(a.date)) +
      (a.read ? ' · ' + a.read + ' دقائق قراءة' : '') + '</span></div></article>';
  }

  var input = document.querySelector('[data-search-input]');
  var out = document.querySelector('[data-search-results]');
  var info = document.querySelector('[data-search-info]');
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-search-cat]'));
  var activeCat = '';

  function textOf(a) {
    var t = a.title + ' ' + (a.dek || '') + ' ' + catOf(a.cat).name;
    (a.tldr || []).forEach(function (x) { t += ' ' + x; });
    (a.body || []).forEach(function (b) { t += ' ' + (b.h || b.p || b.quote || ''); });
    return t.toLowerCase();
  }

  function run() {
    var q = (input.value || '').trim();
    var list = ARTICLES.slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
    if (activeCat) list = list.filter(function (a) { return a.cat === activeCat; });
    if (q) {
      var t = q.toLowerCase();
      list = list.filter(function (a) { return textOf(a).indexOf(t) > -1; });
    }
    out.innerHTML = list.map(cardHTML).join('');
    info.innerHTML = list.length ? '<b>' + list.length + '</b> نتيجة'
      : (q ? 'ما في نتائج لـ «' + esc(q) + '»' : 'اكتب كلمة للبحث');
  }

  input.addEventListener('input', run);
  chips.forEach(function (ch) {
    ch.addEventListener('click', function (e) {
      e.preventDefault();
      chips.forEach(function (x) { x.classList.remove('on'); });
      ch.classList.add('on');
      activeCat = ch.getAttribute('data-search-cat');
      run();
    });
  });
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) input.value = q0;
  run();
})();
