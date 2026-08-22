/* =====================================================================
   زوخمر — أدوات الصفحة: العملات، الطقس، الوقت
   ---------------------------------------------------------------------
   كل شي بيشتغل بالمتصفّح مباشرة، بلا سيرفر وبلا مفاتيح API.
   لو خدمة وقعت، الأداة بتقول هيك بدل ما تضلّ "جاري التحميل".
   ===================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('[data-page="tools"]')) return;

  var AR = function (n, d) {
    return Number(n).toLocaleString('ar-EG-u-nu-latn', {
      minimumFractionDigits: d == null ? 2 : d,
      maximumFractionDigits: d == null ? 2 : d
    });
  };
  var fail = function (el, msg) {
    if (el) el.innerHTML = '<span class="tp__err">' + (msg || 'ما قدرنا نجيب البيانات هلق — جرّب بعدين.') + '</span>';
  };

  /* ---------- 1. العملات ---------- */
  var fxRows = document.querySelector('[data-fx-rows]');
  var fxDate = document.querySelector('[data-fx-date]');
  var fxAmt = document.querySelector('[data-fx-amt]');
  var fxCur = document.querySelector('[data-fx-cur]');
  var fxOut = document.querySelector('[data-fx-out]');
  var rates = null;

  var NAMES = {
    USD: 'دولار أمريكي', EUR: 'يورو', JOD: 'دينار أردني',
    EGP: 'جنيه مصري', GBP: 'جنيه إسترليني', TRY: 'ليرة تركية'
  };

  var calc = function () {
    if (!rates || !fxOut) return;
    var c = fxCur.value, a = parseFloat(fxAmt.value);
    if (!rates[c] || !isFinite(a)) { fxOut.textContent = '—'; return; }
    fxOut.textContent = AR(a * rates[c]) + ' ₪';
  };

  /* مصدرين للصرف — لو الأول وقع بنجرّب التاني قبل ما نعلن فشل */
  var FX_HOSTS = ['https://api.frankfurter.dev/v1/latest?base=ILS',
                  'https://api.frankfurter.app/latest?from=ILS'];
  var fxTry = function (i) {
    if (i >= FX_HOSTS.length) return Promise.reject(0);
    return fetch(FX_HOSTS[i])
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return fxTry(i + 1); });
  };

  if (fxRows) {
    fxTry(0)
      .then(function (d) {
        /* الخدمة بتعطي كم عملة أجنبية بالشيكل الواحد — إحنا بدنا العكس */
        rates = {};
        Object.keys(NAMES).forEach(function (c) {
          if (d.rates && d.rates[c]) rates[c] = 1 / d.rates[c];
        });
        var keys = Object.keys(rates);
        if (!keys.length) throw 0;
        fxRows.innerHTML = keys.map(function (c) {
          return '<div class="fx__row"><span>' + NAMES[c] + '</span>' +
            '<b>' + AR(rates[c]) + ' ₪</b></div>';
        }).join('');
        if (fxDate) fxDate.textContent = 'سعر يوم ' + d.date;
        /* المصدر ما بيغطّي كل العملات — منشيل من القائمة أي وحدة ما إجا إلها سعر،
           حتى ما يختار المستخدم عملة وبعدين يطلعله شرطة. */
        if (fxCur) {
          fxCur.innerHTML = keys.map(function (c) {
            return '<option value="' + c + '">' + NAMES[c] + '</option>';
          }).join('');
        }
        calc();
      })
      .catch(function () {
        fail(fxRows);
        if (fxDate) fxDate.textContent = 'غير متاح هلق';
      });
  }
  if (fxAmt) fxAmt.addEventListener('input', calc);
  if (fxCur) fxCur.addEventListener('change', calc);

  /* ---------- 2. الطقس ---------- */
  var wxNow = document.querySelector('[data-wx-now]');
  var wxDays = document.querySelector('[data-wx-days]');
  var wxPlace = document.querySelector('[data-wx-place]');

  /* رموز الطقس حسب معيار WMO */
  var CODE = {
    0: ['صحو', '☀️'], 1: ['صحو غالباً', '🌤️'], 2: ['غيوم متفرّقة', '⛅'], 3: ['غائم', '☁️'],
    45: ['ضباب', '🌫️'], 48: ['ضباب متجمّد', '🌫️'],
    51: ['رذاذ خفيف', '🌦️'], 53: ['رذاذ', '🌦️'], 55: ['رذاذ كثيف', '🌧️'],
    61: ['مطر خفيف', '🌦️'], 63: ['مطر', '🌧️'], 65: ['مطر غزير', '🌧️'],
    71: ['ثلج خفيف', '🌨️'], 73: ['ثلج', '🌨️'], 75: ['ثلج كثيف', '❄️'],
    80: ['زخّات', '🌦️'], 81: ['زخّات قويّة', '🌧️'], 82: ['زخّات عنيفة', '⛈️'],
    95: ['عاصفة رعدية', '⛈️'], 96: ['رعدية مع بَرَد', '⛈️'], 99: ['رعدية شديدة', '⛈️']
  };
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  var loadWx = function (lat, lon, label) {
    if (!wxNow) return;
    wxNow.innerHTML = '<span class="sk sk--m"></span>';
    var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto';
    fetch(u)
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var c = d.current, k = CODE[c.weather_code] || ['—', '🌡️'];
        wxNow.innerHTML =
          '<span class="wx__ico">' + k[1] + '</span>' +
          '<span class="wx__t">' + Math.round(c.temperature_2m) + '°</span>' +
          '<span class="wx__d"><b>' + k[0] + '</b>' +
          '<span>بتحسّها ' + Math.round(c.apparent_temperature) + '° · رطوبة ' +
          Math.round(c.relative_humidity_2m) + '٪ · رياح ' +
          Math.round(c.wind_speed_10m) + ' كم/س</span></span>';
        if (wxPlace && label) wxPlace.textContent = label;
        if (wxDays && d.daily) {
          wxDays.innerHTML = d.daily.time.slice(1).map(function (t, i) {
            var kk = CODE[d.daily.weather_code[i + 1]] || ['—', '🌡️'];
            var dn = DAYS[new Date(t + 'T12:00:00').getDay()];
            return '<div class="wx__day"><span>' + dn + '</span><span>' + kk[1] + '</span>' +
              '<b>' + Math.round(d.daily.temperature_2m_max[i + 1]) + '°</b>' +
              '<small>' + Math.round(d.daily.temperature_2m_min[i + 1]) + '°</small></div>';
          }).join('');
        }
      })
      .catch(function () { fail(wxNow); });
  };

  if (wxNow) {
    /* الافتراضي: الناصرة. الموقع الدقيق بس لو المستخدم طلبه بنفسه. */
    loadWx(32.70, 35.30, 'الناصرة');
    var geo = document.querySelector('[data-wx-geo]');
    if (geo && navigator.geolocation) {
      geo.addEventListener('click', function () {
        geo.textContent = 'جاري تحديد الموقع…';
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            geo.textContent = 'استخدم موقعي';
            loadWx(pos.coords.latitude.toFixed(2), pos.coords.longitude.toFixed(2), 'موقعك الحالي');
          },
          function () { geo.textContent = 'ما قدرنا نحدّد موقعك'; },
          { timeout: 8000 }
        );
      });
    } else if (geo) {
      geo.hidden = true;
    }
  }

  /* ---------- 3. الوقت والتاريخ ---------- */
  var clock = document.querySelector('[data-clock]');
  var greg = document.querySelector('[data-greg]');
  var hijri = document.querySelector('[data-hijri]');

  if (clock) {
    var tick = function () {
      var n = new Date();
      clock.textContent = n.toLocaleTimeString('ar-EG-u-nu-latn', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
      if (greg) {
        greg.textContent = n.toLocaleDateString('ar-EG-u-nu-latn', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }
      if (hijri) {
        try {
          hijri.textContent = n.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
        } catch (e) { hijri.textContent = '—'; }
      }
    };
    tick();
    setInterval(tick, 1000);
  }
})();
