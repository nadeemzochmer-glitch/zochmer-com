/* زوخمر AI — ودجيت الدردشة الذكية العائم، يظهر بكل صفحات الموقع.
   بيتواصل مع /functions/api/chat.js (Cloudflare Pages Function).
   لو ما في مفتاح API معرّف بإعدادات Cloudflare، الودجيت بيعرض رسالة واضحة
   بدل ما ينهار بصمت. */
(function () {
  'use strict';
  if (document.getElementById('zaiRoot')) return;

  var STYLE = document.createElement('style');
  STYLE.textContent = [
    '#zaiRoot{position:fixed;inset-block-end:20px;inset-inline-end:20px;inset-inline-start:auto;z-index:9000;font-family:var(--font);}',
    '#zaiBtn{width:56px;height:56px;border-radius:var(--r-pill);border:var(--bd);background:var(--ac);color:var(--acx);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:var(--sh2, 0 10px 30px rgba(0,0,0,.35));transition:transform .15s ease;}',
    '#zaiBtn:hover{transform:scale(1.06);}',
    '#zaiBtn svg{width:26px;height:26px;}',
    '#zaiPanel{position:fixed;inset-block-end:88px;inset-inline-end:20px;inset-inline-start:auto;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 140px));background:var(--sf);border:var(--bd);border-radius:var(--r-card);box-shadow:var(--sh2, 0 20px 50px rgba(0,0,0,.4));display:none;flex-direction:column;overflow:hidden;z-index:9000;}',
    '#zaiPanel.open{display:flex;}',
    '#zaiHead{display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--sf2);border-bottom:var(--bd);}',
    '#zaiHead .zai-dot{width:9px;height:9px;border-radius:50%;background:#3CCB6F;flex:none;}',
    '#zaiHead b{color:var(--tx);font-size:15px;}',
    '#zaiHead span{color:var(--mut);font-size:12px;display:block;}',
    '#zaiClose{margin-inline-start:auto;background:none;border:0;color:var(--mut);cursor:pointer;width:28px;height:28px;border-radius:var(--r-ctl);display:flex;align-items:center;justify-content:center;}',
    '#zaiClose:hover{background:var(--sf2);color:var(--tx);}',
    '#zaiMsgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}',
    '.zai-m{max-width:86%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;}',
    '.zai-m.u{align-self:flex-start;background:var(--acs, rgba(255,122,24,.14));color:var(--tx);border-bottom-left-radius:4px;}',
    '.zai-m.a{align-self:flex-end;background:var(--sf2);color:var(--tx);border:var(--bd);border-bottom-right-radius:4px;}',
    '.zai-m.sys{align-self:center;background:transparent;color:var(--mut);font-size:12px;text-align:center;}',
    '#zaiTyping{align-self:flex-end;color:var(--mut);font-size:12px;padding:0 4px;display:none;}',
    '#zaiForm{display:flex;gap:8px;padding:12px;border-top:var(--bd);background:var(--sf2);}',
    '#zaiInput{flex:1;resize:none;border:var(--bd);border-radius:var(--r-ctl);background:var(--sf);color:var(--tx);padding:10px 12px;font-family:var(--font);font-size:13.5px;max-height:90px;line-height:1.4;}',
    '#zaiInput:focus{outline:2px solid var(--ac);outline-offset:1px;}',
    '#zaiSend{background:var(--ac);color:var(--acx);border:0;border-radius:var(--r-ctl);padding:0 16px;font-weight:600;cursor:pointer;font-family:var(--font);font-size:13.5px;}',
    '#zaiSend:disabled{opacity:.5;cursor:default;}',
    '@media (max-width:420px){#zaiPanel{inset-inline-end:12px;inset-block-end:80px;}#zaiRoot{inset-inline-end:12px;}}'
  ].join('\n');
  document.head.appendChild(STYLE);

  var root = document.createElement('div');
  root.id = 'zaiRoot';
  root.innerHTML =
    '<button id="zaiBtn" aria-label="افتح مساعد زوخمر الذكي" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.97 0-9 3.58-9 8 0 2.24 1.02 4.27 2.7 5.7-.1.98-.5 2.28-1.4 3.3 1.6.1 3.1-.5 4.2-1.3.8.2 1.6.3 2.5.3 4.97 0 9-3.58 9-8s-4.03-8-9-8z"/></svg>' +
    '</button>' +
    '<div id="zaiPanel" role="dialog" aria-label="مساعد زوخمر الذكي">' +
      '<div id="zaiHead"><span class="zai-dot"></span><div><b>زوخمر AI</b><span>مساعد ذكي — اسأل عن أي شي</span></div>' +
        '<button id="zaiClose" aria-label="إغلاق">✕</button></div>' +
      '<div id="zaiMsgs"></div>' +
      '<div id="zaiTyping">عم يكتب…</div>' +
      '<form id="zaiForm"><textarea id="zaiInput" rows="1" placeholder="اكتب سؤالك هون…" aria-label="سؤالك"></textarea><button id="zaiSend" type="submit">إرسال</button></form>' +
    '</div>';
  document.body.appendChild(root);

  var btn = root.querySelector('#zaiBtn');
  var panel = root.querySelector('#zaiPanel');
  var closeBtn = root.querySelector('#zaiClose');
  var msgsEl = root.querySelector('#zaiMsgs');
  var typingEl = root.querySelector('#zaiTyping');
  var form = root.querySelector('#zaiForm');
  var input = root.querySelector('#zaiInput');
  var sendBtn = root.querySelector('#zaiSend');

  var STORE_KEY = 'zai_history_v1';
  var history = [];
  try {
    var saved = sessionStorage.getItem(STORE_KEY);
    if (saved) history = JSON.parse(saved);
  } catch (e) { history = []; }

  var offline = false; // بيصير true لو الـ API رجّع "no-key" — ما نحاول تاني بنفس الجلسة

  function addMsg(role, text) {
    var el = document.createElement('div');
    el.className = 'zai-m ' + role;
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  function addSys(text) {
    var el = document.createElement('div');
    el.className = 'zai-m sys';
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function render() {
    msgsEl.innerHTML = '';
    if (!history.length) {
      addSys('أهلاً! أنا زوخمر AI. اسأل أي سؤال — تكنولوجيا، دراسة، أو أي موضوع.');
      return;
    }
    history.forEach(function (m) { addMsg(m.role === 'user' ? 'u' : 'a', m.content); });
  }
  render();

  function persist() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-20))); } catch (e) {}
  }

  function openPanel() {
    panel.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    setTimeout(function () { input.focus(); }, 50);
  }
  function closePanel() {
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', function () {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  closeBtn.addEventListener('click', closePanel);

  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  async function send(text) {
    history.push({ role: 'user', content: text });
    addMsg('u', text);
    persist();
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    typingEl.style.display = 'block';
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) })
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.status === 503 || data.error === 'no-key') {
        offline = true;
        addSys('المساعد الذكي لسا مش مفعّل بالموقع — قريباً!');
        return;
      }
      if (!res.ok || !data.reply) {
        addSys('صار خلل مؤقت. جرّب كمان شوي.');
        return;
      }
      history.push({ role: 'assistant', content: data.reply });
      addMsg('a', data.reply);
      persist();
    } catch (err) {
      addSys('في مشكلة بالاتصال. تأكّد من الإنترنت وجرّب تاني.');
    } finally {
      sendBtn.disabled = false;
      typingEl.style.display = 'none';
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    if (offline) { addSys('المساعد الذكي لسا مش مفعّل بالموقع — قريباً!'); return; }
    send(text);
  });
})();
