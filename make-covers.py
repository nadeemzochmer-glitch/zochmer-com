# -*- coding: utf-8 -*-
"""
زوخمر — מחולל תמונות שער
--------------------------------------------------------------------
מייצר תמונת שער ממותגת לכל כתבה שאין לה תמונה משלה, בגודל 1200×630 —
בדיוק הגודל שוואטסאפ, פייסבוק וטוויטר מצפים לו.

הרצה:   python3 make-covers.py
פלט:    assets/img/covers/<id>.png   +   assets/img/og-default.png

התמונות משמשות גם באתר עצמו וגם כתצוגה המקדימה בשיתוף.
כשתהיה תמונה אמיתית לכתבה — פשוט ממלאים את השדה img ב-content.js,
והשער האוטומטי מפסיק לשמש עבורה.
"""
import os
import json
import colorsys
import subprocess, re, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "assets", "img", "covers")
THUMBS = os.path.join(ROOT, "assets", "img", "thumbs")
os.makedirs(OUT, exist_ok=True)
os.makedirs(THUMBS, exist_ok=True)

W, H = 1200, 630
BG = (12, 14, 18)
INK = (240, 242, 246)
MUT = (150, 158, 172)

FONT_AR_BOLD = "/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf"
FONT_AR_REG = "/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf"
FONT_LAT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"

# צבע לכל קטגוריה — נותן לכל תחום זהות משלו
CAT_COLOR = {
    "reviews": (61, 214, 140), "compare": (91, 124, 250), "security": (255, 90, 80),
    "ai": (167, 120, 255), "tips": (255, 176, 32), "internet": (56, 189, 248),
    "mobile": (255, 122, 24), "gaming": (236, 72, 153), "computer": (148, 163, 184),
    "news": (255, 122, 24), "apps": (34, 211, 238), "iphone": (200, 200, 210),
    "samsung": (59, 130, 246), "xiaomi": (255, 122, 24), "android": (61, 214, 140),
}
DEFAULT_COLOR = (255, 122, 24)


def font(path, size):
    return ImageFont.truetype(path, size)


# ── ניקוי טקסט לפי מה שהגופן באמת תומך בו ──────────────────────────
# Noto Kufi Arabic הוא גופן ערבי בלבד: אין בו מקף ארוך, גרשיים או נקודה,
# ולכן תווים כאלה היו מופיעים כריבוע ריק. מחליפים מראש ואז מסננים.
_REPL = {"—": " ", "–": " ", "−": " ", "«": "", "»": "", "\u201c": "", "\u201d": "",
         "\"": "", "'": "", "\u2018": "", "\u2019": "", "…": "", "%": "٪",
         ":": "،", ";": "،", "(": "", ")": "", "[": "", "]": ""}
_SUPPORTED = None


def _supported():
    global _SUPPORTED
    if _SUPPORTED is None:
        from fontTools.ttLib import TTFont as _TT
        f = _TT(FONT_AR_BOLD)
        cm = set()
        for t in f["cmap"].tables:
            cm |= set(t.cmap.keys())
        _SUPPORTED = cm
    return _SUPPORTED


def clean(text):
    for a, b in _REPL.items():
        text = text.replace(a, b)
    cm = _supported()
    out = "".join(ch for ch in text if ch == " " or ord(ch) in cm)
    return re.sub(r"\s{2,}", " ", out).strip()


def ar_draw(d, xy, text, f, fill, anchor="ra"):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, direction="rtl", language="ar")


def ar_width(d, text, f):
    return d.textlength(text, font=f, direction="rtl", language="ar")


def wrap_ar(d, text, f, max_w):
    """שבירת שורות לפי רוחב אמיתי של הטקסט"""
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if ar_width(d, trial, f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def backdrop(color):
    """רקע כהה עם זוהר צבעוני רך ופסים אלכסוניים עדינים"""
    im = Image.new("RGB", (W, H), BG)

    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    cx, cy, r = int(W * 0.17), int(H * 0.78), 430
    for i in range(26, 0, -1):
        t = i / 26
        rr = int(r * t)
        col = tuple(int(BG[k] + (color[k] - BG[k]) * (1 - t) * 0.5) for k in range(3))
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    im = Image.blend(im, glow, 0.85)

    st = Image.new("RGB", (W, H), (0, 0, 0))
    sd = ImageDraw.Draw(st)
    for x in range(-H, W, 26):
        sd.line([(x, H), (x + H, 0)], fill=(255, 255, 255), width=2)
    st = st.filter(ImageFilter.GaussianBlur(1))
    im = Image.blend(im, Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), im, st.convert("L")), 0.018)
    return im


def brand(d, color):
    """סמל הברק + שם האתר, בפינה העליונה הימנית"""
    bx, by, s = W - 84, 54, 56
    d.rounded_rectangle([bx, by, bx + s, by + s], radius=16, fill=(255, 122, 24))
    # ברק
    cxp = [(bx + 34, by + 11), (bx + 14, by + 34), (bx + 27, by + 34),
           (bx + 24, by + 47), (bx + 43, by + 24), (bx + 30, by + 24)]
    d.polygon(cxp, fill=(12, 14, 18))
    ar_draw(d, (bx - 18, by + 6), clean("زوخمر"), font(FONT_AR_BOLD, 36), INK)


def footer(d, color):
    d.text((W - 84, H - 62), "zochmer.com", font=font(FONT_LAT, 24), fill=MUT, anchor="ra")
    d.rounded_rectangle([84, H - 66, 84 + 74, H - 66 + 8], radius=4, fill=color)


def make_cover(title, cat_name, cat_slug, path):
    title = clean(title)
    cat_name = clean(cat_name)
    color = CAT_COLOR.get(cat_slug, DEFAULT_COLOR)
    im = backdrop(color)
    d = ImageDraw.Draw(im)
    brand(d, color)

    # תווית הקטגוריה
    fc = font(FONT_AR_BOLD, 26)
    tw = ar_width(d, cat_name, fc)
    pad_x, pad_y, right = 22, 12, W - 84
    d.rounded_rectangle([right - tw - pad_x * 2, 168, right, 168 + 26 + pad_y * 2],
                        radius=99, fill=color)
    ar_draw(d, (right - pad_x, 176), cat_name, fc, (12, 14, 18))

    # הכותרת
    size = 62
    while size > 34:
        ft = font(FONT_AR_BOLD, size)
        lines = wrap_ar(d, title, ft, W - 168)
        if len(lines) <= 3:
            break
        size -= 4
    ft = font(FONT_AR_BOLD, size)
    lines = wrap_ar(d, title, ft, W - 168)[:3]
    lh = int(size * 1.55)
    y = 268
    for ln in lines:
        ar_draw(d, (W - 84, y), ln, ft, INK)
        y += lh

    footer(d, color)
    im.convert("RGB").save(path, "JPEG", quality=88, optimize=True, progressive=True)
    return path


def _shade(c, f):
    """f<1 = כהה יותר, f>1 = בהיר יותר"""
    return tuple(max(0, min(255, int(v * f if f <= 1 else v + (255 - v) * (f - 1)))) for v in c)


def make_thumb(cat_name, cat_slug, aid, path):
    """
    תמונת התצוגה *באתר*.

    הגרסה הקודמת היתה כהה כמעט-שחורה, ולכן על ערכת "paper" הבהירה
    היא נראתה כמו חור בעמוד. עכשיו זו שדה צבע בגוון הקטגוריה —
    בהירות בינונית שיושבת טוב גם על רקע כהה וגם על רקע קרם.
    בלי לוגו ובלי כתובת: התמונה נחתכת לפס רחב והם נקטעו ממילא.
    """
    base = CAT_COLOR.get(cat_slug, DEFAULT_COLOR)
    # גיוון גוון קל לפי מזהה הכתבה: כל הקטגוריה נשארת באותה משפחת צבע,
    # אבל עמוד קטגוריה שלם לא נראה כמו אותה תמונה משוכפלת 10 פעם.
    seed0 = sum(ord(c) * (i + 3) for i, c in enumerate(aid))
    h, sat, v = colorsys.rgb_to_hsv(*[x / 255 for x in base])
    h = (h + ((seed0 % 7) - 3) * 0.022) % 1.0
    sat = max(0.18, min(1.0, sat + ((seed0 // 7) % 5 - 2) * 0.035))
    v = max(0.30, min(1.0, v + ((seed0 // 13) % 5 - 2) * 0.030))
    color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(h, sat, v))
    hi, lo = _shade(color, 1.18), _shade(color, 0.42)

    # מדרון אלכסוני בין שני גווני הקטגוריה
    grad = Image.new("RGB", (W, H))
    gp = grad.load()
    for y in range(H):
        for x in range(0, W, 4):
            t = (x / W * 0.72) + (y / H * 0.28)
            col = (int(hi[0] + (lo[0] - hi[0]) * t),
                   int(hi[1] + (lo[1] - hi[1]) * t),
                   int(hi[2] + (lo[2] - hi[2]) * t))
            for k in range(4):
                if x + k < W:
                    gp[x + k, y] = col
    im = grad

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov, "RGBA")

    seed = sum(ord(c) * (i + 7) for i, c in enumerate(aid))
    cx = 300 + (seed % 5) * 120
    cy = H // 2
    variant = seed % 4
    WH = (255, 255, 255)

    if variant == 0:                       # טבעות
        for i in range(6):
            r = 300 - i * 46
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=WH + (64 - i * 6,), width=14)
    elif variant == 1:                     # מלבנים מקוננים
        for i in range(6):
            o = i * 46
            x0, y0, x1, y1 = cx - 310 + o, cy - 225 + o, cx + 310 - o, cy + 225 - o
            if x1 - x0 < 40 or y1 - y0 < 40:
                break
            d.rounded_rectangle([x0, y0, x1, y1], radius=min(52, (y1 - y0) // 2),
                                outline=WH + (60 - i * 6,), width=14)
    elif variant == 2:                     # עמודות
        for i in range(8):
            x = cx - 300 + i * 78
            h = 130 + ((seed >> i) % 5) * 66
            d.rounded_rectangle([x, cy + 220 - h, x + 52, cy + 220],
                                radius=22, fill=WH + (58 - i * 4,))
    else:                                  # מעוינים
        for i in range(5):
            o = i * 54
            d.polygon([(cx, cy - 280 + o), (cx + 280 - o, cy), (cx, cy + 280 - o), (cx - 280 + o, cy)],
                      outline=WH + (62 - i * 8,), width=14)

    # הילה רכה בפינה — מוסיפה עומק בלי להפריע לטקסט שמעל
    hal = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hal)
    for i in range(18):
        r = 340 - i * 18
        hd.ellipse([W - 120 - r, -60 - r, W - 120 + r, -60 + r], fill=WH + (5,))
    ov = Image.alpha_composite(ov, hal.filter(ImageFilter.GaussianBlur(24)))

    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    im.save(path, "WEBP", quality=84, method=6)
    return path


def make_default():
    color = DEFAULT_COLOR
    im = backdrop(color)
    d = ImageDraw.Draw(im)
    brand(d, color)
    ft = font(FONT_AR_BOLD, 66)
    ar_draw(d, (W - 84, 250), clean("أخبار ومراجعات تقنية"), ft, INK)
    ar_draw(d, (W - 84, 350), clean("بالعربي وبأسعار محلية"), ft, color)
    footer(d, color)
    p = os.path.join(ROOT, "assets", "img", "og-default.png")
    im.save(p, "PNG", optimize=True)
    return p


# ---------- קריאת התוכן מ-content.js ----------
def load_articles():
    """
    קורא את הכתבות דרך node ולא דרך regex.
    הגרסה הקודמת פספסה 22 כתבות בשקט כי היא הניחה סדר שדות קבוע —
    וכל כתבה שפוספסה נשארה בלי תמונה באתר.
    """
    js = (
        "const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);"
        "vm.runInContext(fs.readFileSync('assets/js/content.js','utf8'),c);"
        "console.log(JSON.stringify({"
        "cats:Object.fromEntries(c.CATEGORIES.map(x=>[x.slug,x.name])),"
        "arts:c.ARTICLES.map(a=>({id:a.id,title:a.title,cat:a.cat,has_img:!!a.img}))"
        "}));"
    )
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True,
                         text=True, check=True).stdout
    data = json.loads(out)
    return data["cats"], data["arts"]


if __name__ == "__main__":
    cats, arts = load_articles()
    made = 0
    for a in arts:
        if a["has_img"]:
            continue
        name = cats.get(a["cat"], a["cat"])
        # שער עם כותרת — ל-og:image (שיתוף בוואטסאפ/פייסבוק)
        make_cover(a["title"], name, a["cat"], os.path.join(OUT, a["id"] + ".jpg"))
        # תמונה בלי כותרת — לתצוגה באתר עצמו
        make_thumb(name, a["cat"], a["id"], os.path.join(THUMBS, a["id"] + ".webp"))
        made += 1
        print("  ✓", a["id"], "·", name)
    make_default()
    print(f"\n✅ {made} שערים (og) + {made} תמונות אתר + og-default.png")
