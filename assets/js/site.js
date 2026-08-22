/* =====================================================================
   سكربت الموقع — القائمة الجانبية، الأكورديون، مبدّل التصاميم،
   شريط تقدّم القراءة، وظهور العناصر عند التمرير.
   ملف واحد لكل الصفحات.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 1. التصميم (ink | paper | pulse) ---------- */
  var THEMES = ['ink', 'paper', 'pulse'];
  var root = document.documentElement;

  function setTheme(name) {
    if (THEMES.indexOf(name) === -1) name = 'ink';
    root.setAttribute('data-theme', name);
    try { localStorage.setItem('site-theme', name); } catch (e) {}
  }
  try {
    var saved = localStorage.getItem('site-theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch (e) {}

  var themeBtn = document.getElementById('themeBtn');
  var themeBox = document.getElementById('themes');
  if (themeBtn && themeBox) {
    themeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      themeBox.hidden = !themeBox.hidden;
    });
    themeBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-set]');
      if (!b) return;
      setTheme(b.getAttribute('data-set'));
      themeBox.hidden = true;
    });
    document.addEventListener('click', function (e) {
      if (!themeBox.hidden && !themeBox.contains(e.target) && e.target !== themeBtn) {
        themeBox.hidden = true;
      }
    });
  }

  /* ---------- 2. القائمة الجانبية ---------- */
  var drawer = document.getElementById('drawer');
  var scrim = document.getElementById('scrim');
  var openBtn = document.getElementById('openMenu');
  var closeBtn = document.getElementById('closeMenu');

  function openDrawer() {
    drawer.classList.add('on');
    scrim.classList.add('on');
    document.body.style.overflow = 'hidden';
    openBtn.setAttribute('aria-expanded', 'true');
    var first = drawer.querySelector('.acc__b, .acc__l');
    if (first) first.focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove('on');
    scrim.classList.remove('on');
    document.body.style.overflow = '';
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus({ preventScroll: true });
  }
  if (drawer && openBtn) {
    openBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (scrim) scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('on')) closeDrawer();
    });

    /* الأكورديون — ثلاث مستويات */
    drawer.addEventListener('click', function (e) {
      var b = e.target.closest('.acc__b');
      if (!b) return;
      var isOpen = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      b.parentElement.classList.toggle('on', !isOpen);
    });
  }

  /* ---------- 2b. الترويسة تصغر عند التمرير ---------- */
  var hd = document.getElementById('hd');
  if (hd) {
    var tick = false;
    var onHd = function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        hd.classList.toggle('sc', window.scrollY > 40);
        tick = false;
      });
    };
    window.addEventListener('scroll', onHd, { passive: true });
    onHd();
  }

  /* ---------- 3. شريط تقدّم القراءة (صفحة المقال) ---------- */
  var prog = document.getElementById('prog');
  if (prog) {
    var onScroll = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 4. ظهور العناصر عند التمرير ---------- */
  var rv = document.querySelectorAll('.rv');
  if (rv.length) {
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rv.forEach(function (x) { x.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      rv.forEach(function (x) { io.observe(x); });
    }
  }

  /* ---------- 5. مُنزلِق الواجهة (سلايدر الصفحة الرئيسية) ---------- */
  var sw = document.querySelector('[data-slider]');
  if (sw) {
    var slides = [].slice.call(sw.querySelectorAll('.sl'));
    var dots   = [].slice.call(sw.querySelectorAll('.hsl__dot'));
    var cur = 0, timer = null, DELAY = 6500;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var show = function (n) {
      cur = (n + slides.length) % slides.length;
      slides.forEach(function (el, i) {
        var on = i === cur;
        el.classList.toggle('on', on);
        if (on) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', 'true');
        /* روابط الشرائح المخفية خارج ترتيب التنقّل بالكيبورد */
        [].forEach.call(el.querySelectorAll('a'), function (a) {
          a.tabIndex = on ? 0 : -1;
        });
      });
      dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); });
    };
    var play  = function () { if (!reduce) { stop(); timer = setInterval(function () { show(cur + 1); }, DELAY); } };
    var stop  = function () { if (timer) { clearInterval(timer); timer = null; } };

    sw.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      var g = b.getAttribute('data-go');
      show(g === 'next' ? cur + 1 : g === 'prev' ? cur - 1 : +g);
      play();
    });

    sw.addEventListener('mouseenter', stop);
    sw.addEventListener('mouseleave', play);
    sw.addEventListener('focusin', stop);
    sw.addEventListener('focusout', play);
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : play();
    });

    /* سحب بالإصبع — الاتجاه معكوس لأن الموقع من اليمين لليسار */
    var x0 = null;
    sw.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    sw.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(cur + (dx > 0 ? 1 : -1));
      x0 = null; play();
    }, { passive: true });

    show(0);
    play();
  }

  /* ---------- 6. سرعة شريط "عاجل" ----------
     المدّة تتحدّد حسب عرض الشريط الفعلي حتى تضلّ السرعة وحدة
     مهما كان عدد العناوين أو طولها. */
  var run = document.querySelector('.ticker__run');
  if (run) {
    var setSpeed = function () {
      var w = run.scrollWidth / 2;            // عرض نسخة وحدة
      if (w > 0) run.style.animationDuration = Math.round(w / 55) + 's';  // ~55 بكسل بالثانية
    };
    setSpeed();
    window.addEventListener('resize', setSpeed, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setSpeed);
  }

  /* ---------- 7. مشاركة وحفظ المقال ----------
     الزرّين كانوا شكل بلا وظيفة. هلق بيشتغلوا فعلياً:
     المشاركة بتستخدم قائمة المشاركة تبع النظام لو موجودة،
     وإلا بتنسخ الرابط. والحفظ بيتخزّن بالمتصفّح — بلا حساب وبلا سيرفر. */
  var SAVE_KEY = 'zx-saved';
  var readSaved = function () {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch (e) { return []; }
  };
  var writeSaved = function (list) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {}
  };

  /* חשוף כדי שגם קוד מחוץ ל-IIFE יוכל להשתמש בו */
  var toast = window.zxToast = function (msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () {
      t.classList.remove('on');
      setTimeout(function () { t.remove(); }, 300);
    }, 2200);
  };

  var art = document.querySelector('.art');
  if (art) {
    var url = (document.querySelector('link[rel=canonical]') || {}).href || location.href;
    var title = (document.querySelector('.art__t') || {}).textContent || document.title;

    /* مشاركة */
    var shareBtn = document.querySelector('.acts [aria-label="مشاركة"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url)
            .then(function () { toast('اننسخ الرابط'); })
            .catch(function () { toast('ما قدرنا ننسخ الرابط'); });
        } else {
          toast(url);
        }
      });
    }

    /* حفظ */
    var saveBtn = document.querySelector('.acts [aria-label="حفظ"]');
    if (saveBtn) {
      var id = location.pathname.split('/').pop().replace(/\.html$/, '');
      var paint = function () {
        var on = readSaved().some(function (x) { return x.id === id; });
        saveBtn.classList.toggle('on', on);
        saveBtn.setAttribute('aria-pressed', String(on));
        saveBtn.setAttribute('aria-label', on ? 'إزالة من المحفوظات' : 'حفظ');
      };
      saveBtn.addEventListener('click', function () {
        var list = readSaved();
        var i = list.findIndex(function (x) { return x.id === id; });
        if (i > -1) { list.splice(i, 1); writeSaved(list); paint(); toast('انشال من المحفوظات'); }
        else {
          list.unshift({ id: id, title: title.trim(), url: url, at: Date.now() });
          writeSaved(list); paint(); toast('انحفظ — بتلاقيه بصفحة المحفوظات');
        }
      });
      paint();
    }
  }

  /* صفحة المحفوظات */
  var savedWrap = document.querySelector('[data-saved-list]');
  if (savedWrap) {
    var render = function () {
      var list = readSaved();
      if (!list.length) {
        savedWrap.innerHTML = '<p class="res">لسا ما حفظت ولا مقال. افتح أي مقال واضغط على أيقونة الحفظ فوق.</p>';
        return;
      }
      savedWrap.innerHTML = '<div class="panel"><div class="rows">' + list.map(function (x, i) {
        return '<a class="rw" href="' + x.url + '"><span class="rw__n">' + (i + 1) + '</span>' +
          '<span class="rw__b"><b class="rw__t">' + x.title.replace(/[<>&]/g, '') + '</b></span></a>';
      }).join('') + '</div></div>' +
      '<p style="margin-top:16px"><button class="chip chip--sm" data-saved-clear>امسح كل المحفوظات</button></p>';
      var clr = savedWrap.querySelector('[data-saved-clear]');
      if (clr) clr.addEventListener('click', function () {
        writeSaved([]); render(); toast('انمسحت المحفوظات');
      });
    };
    render();
  }
})();

  /* زر "نسخ الرابط" بشريط المشاركة — بيشتغل على كل الأزرار اللي فيها data-copy */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    e.preventDefault();
    var v = b.getAttribute('data-copy');
    var done = function () { if (window.zxToast) window.zxToast('انتسخ الرابط'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(done).catch(function () {});
    } else {
      var i = document.createElement('input');
      i.value = v; document.body.appendChild(i); i.select();
      try { document.execCommand('copy'); done(); } catch (err) {}
      document.body.removeChild(i);
    }
  });

  /* ---------- فلترة صفحة الأسعار ----------
     كل الصفوف موجودة بالـHTML من الأوّل — الفلترة بتخفي وبتظهر بس.
     يعني الصفحة بتشتغل كاملة حتى لو الجافاسكربت ما حمّل، وجوجل بيشوف كل الأسعار. */
  (function () {
    var body = document.querySelector('[data-price-body]');
    if (!body) return;
    var rows = [].slice.call(body.querySelectorAll('tr'));
    var none = document.querySelector('[data-price-none]');
    var count = document.querySelector('[data-price-count]');
    var f = { band: '', brand: '', kind: '', ctype: '' };

    var apply = function () {
      var shown = 0;
      var lo = 0, hi = Infinity;
      if (f.band) { var pr = f.band.split('-'); lo = +pr[0]; hi = +pr[1]; }
      rows.forEach(function (r) {
        var p = +r.getAttribute('data-p');
        var ok = (!f.brand || r.getAttribute('data-b') === f.brand)
              && (!f.ctype || r.getAttribute('data-c') === f.ctype)
              && (!f.kind || r.getAttribute('data-k') === f.kind || r.getAttribute('data-k') === 'mix')
              && p >= lo && p <= hi;
        r.hidden = !ok;
        if (ok) shown++;
      });
      if (none) none.hidden = shown > 0;
      if (count) count.textContent = shown === rows.length
        ? rows.length + ' سعر'
        : shown + ' من ' + rows.length + ' سعر';
    };

    ['band', 'brand', 'kind', 'ctype'].forEach(function (key) {
      var btns = [].slice.call(document.querySelectorAll('[data-' + key + ']'));
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          btns.forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          f[key] = b.getAttribute('data-' + key);
          apply();
        });
      });
    });
    apply();
  })();
