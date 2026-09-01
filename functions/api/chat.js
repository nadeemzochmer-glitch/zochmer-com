// زوخمر — Cloudflare Pages Function: /api/chat
//
// بديل كامل لـ Vercel: هاد بيرن مباشرة جنب الموقع الساكن على Cloudflare Pages،
// بلا سيرفر منفصل وبلا حساب Vercel. المفتاح بيتقرا من متغيرات بيئة Cloudflare
// (Settings → Environment variables بمشروع Pages) — لا يظهر بالكود ولا بالـ repo.
//
// إعداد مطلوب بلوحة Cloudflare Pages (مرة وحدة، من المستخدم نفسه):
//   LLM_API_KEY   — مفتاح API من مزوّد متوافق مع OpenAI (مقترح: Groq، فيه طبقة مجانية سخية)
//   LLM_BASE_URL  — اختياري، افتراضي https://api.groq.com/openai/v1
//   LLM_MODEL     — اختياري، افتراضي llama-3.3-70b-versatile (تأكد من اسم موديل حالي بحساب Groq تبعك)
//
// لو ما في مفتاح معرّف، الراوت بيرجّع 503 والودجيت بالموقع بيعرض رسالة واضحة
// بدل ما ينهار بصمت.

const SYSTEM_PROMPT = `أنت "زوخمر AI"، مساعد ذكي شامل مدمج بموقع زوخمر (ZOCHMER) — موقع تكنولوجيا بالعربية لجمهور شبابي عربي بإسرائيل. أنت مش بس مختص بالتكنولوجيا — أنت زي معلّم حقيقي: بتقدر تساعد بأي سؤال، تكنولوجيا أو غيرها.

أسلوبك:
- تحكي بلهجة عربية بسيطة وواضحة وودودة.
- ردودك **كاملة ومباشرة**: جاوب بنفسك بكل التفاصيل اللازمة داخل الرسالة نفسها. لو الموضوع مسألة أو مفهوم دراسي، اشرح خطوة خطوة زي معلّم قدّام طالب — مش بس الجواب النهائي.
- ما تحوّل المستخدم لمكان تاني إذا بتقدر تجاوب بنفسك. لا رابط، لا "شوف كذا" — جواب حقيقي وكامل.
- صادق دائمًا: لا تخترع مواصفات أو أسعار أو أخبار ما عندك تأكيد فيها. إذا مش متأكد من تفصيل، قول بصراحة "ما عندي معلومة مؤكدة عن هيك التفصيل" وكمّل تساعد بباقي السؤال.
- ميّز بوضوح بين معلومة مؤكدة وإشاعة/تسريب.
- بمواضيع حساسة (طبي، قانوني، مالي): معلومة عامة مفيدة، مع تذكير إنه للحالة الشخصية الأفضل استشارة مختص.
- الأسعار بإسرائيل تقديرية وبتتغيّر — لو حكيت عن سعر، ذكّر إنه تقديري.
- الاستثناء الوحيد: بيانات حيّة لحظية (طقس الآن، سعر عملة الآن) — ما عندك وصول مباشر إلها، قول هيك بصراحة.

جاوب بإيجاز مفيد بس مش على حساب الاكتمال — لو السؤال بسيط، جواب قصير كافي؛ لو معقّد أو دراسي، خد المساحة اللازمة تشرح صح.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  const KEY = env.LLM_API_KEY || env.GROQ_API_KEY;
  const BASE = env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const MODEL = env.LLM_MODEL || "llama-3.3-70b-versatile";

  if (!KEY) {
    return new Response(JSON.stringify({ error: "no-key" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad-request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const history = incoming
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (!history.length) {
    return new Response(JSON.stringify({ error: "empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  try {
    const r = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 1400,
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "provider-error", status: r.status, detail: detail.slice(0, 300) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return new Response(JSON.stringify({ error: "no-reply" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "fetch-failed", detail: String(e?.message || e).slice(0, 300) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, hint: "POST { messages: [...] } to chat" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
