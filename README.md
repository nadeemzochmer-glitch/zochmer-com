# zochmer.com — קוד מקור

זהו קוד המקור המלא של zochmer.com: המחולל הסטטי (`build.mjs`) וכל התוכן (`assets/js/content.js`). זה **לא** מכיל את קבצי ה-HTML הסופיים — אלה נוצרים אוטומטית בכל build (ראה `.gitignore`).

**⚠️ זה אתר שונה לגמרי מ-`zochmer-ai`** (פרויקט נפרד ב-Vercel/Next.js). אל תערבבו בין השניים.

## חיבור ל-Cloudflare Pages (חד-פעמי)

1. **צור repo ריק** ב-GitHub (למשל `zochmer-com`) והעלה אליו את התוכן הזה:
   ```bash
   cd zochmer-com-source
   git init
   git add .
   git commit -m "מקור התחלתי — אחרי תיקון באג הכותרת + 17 כתבות"
   git branch -M main
   git remote add origin https://github.com/<your-username>/zochmer-com.git
   git push -u origin main
   ```
2. **בדשבורד של Cloudflare**: הפרויקט הקיים `zochmer` נוצר במצב Direct Upload ולא ניתן להמיר אותו לגיט — הדרך הנקייה היא ליצור **פרויקט Pages חדש** מחובר ל-git:
   - Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → לבחור את ה-repo שיצרת.
   - **Build command**: `node build.mjs`
   - **Build output directory**: `/` (השורש — `build.mjs` כותב את קבצי ה-HTML ישירות לתיקיית הפרויקט)
   - Framework preset: None
3. אחרי הבנייה הראשונה המוצלחת בפרויקט החדש — לעדכן את הדומיין `zochmer.com` (ב-Custom domains) להצביע לפרויקט החדש במקום לישן, ואז אפשר למחוק את פרויקט ה-Direct Upload הישן.
4. מכאן ואילך: כל `git push` ל-`main` מפעיל build ו-deploy אוטומטית ב-Cloudflare — בלי לגרור ZIP ידנית.

## תוכן אוטומטי (חדשות טכנולוגיה → כתבות, בלי מגע יד)

יש workflow ב-GitHub Actions (`.github/workflows/auto-content.yml`) שרץ **אוטומטית לפי לוח זמנים** (ברירת מחדל: יום ראשון ורביעי, 06:00 UTC), ועושה בעצמו:

1. שולף חדשות טכנולוגיה עדכניות (סלולר, מחשבים, AI, הדרכות) מ-10 מקורות RSS מוכרים (The Verge, TechCrunch, Ars Technica, 9to5Mac/Google, Android Police, SamMobile, BleepingComputer, Engadget, MakeUseOf — הרשימה ב-`scripts/auto-content/sources.json`, אפשר לערוך).
2. שולח את המועמדים ל-Claude, עם כל כללי הסכימה/הסגנון/הקטגוריות של האתר, ומבקש ממנו לבחור עד 2 כתבות איכותיות (לא שמועות, לא כפילות) ולנסח אותן בערבית מדוברת — בדיוק בפורמט של `content.js`.
3. **מוודא הכל בעצמו לפני פרסום**: סכימה תקינה, קטגוריה קיימת, בלוקים מותרים בלבד (בלי `verdict`/`dl`/`more` — אלה דורשים בדיקה ידנית ולא נוצרים אוטומטית), ID ייחודי, ואז מריץ `node build.mjs` ובודק "undefined" leaks. **אם משהו נכשל — הסקריפט מבטל את השינוי ולא מפרסם כלום.** אוטומטי מלא לא אומר "מפרסם בכל מחיר".
4. אם הכל תקין: commit + push אוטומטי ל-`main` → זה מפעיל build+deploy אוטומטי ב-Cloudflare Pages (שהוגדר לעיל) → הכתבה החדשה חיה באתר בלי שאף אחד נגע בכלום.

### הגדרה חד-פעמית (חובה כדי שזה יתחיל לעבוד)

צריך **מפתח API של Anthropic** — זה חייב להיות שלך, אני (Claude) לא יכול/רוצה להחזיק או להזין אותו בשבילך, מטעמי אבטחה:

1. תיכנס ל-[console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.
2. ב-GitHub: `zochmer-com` repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `ANTHROPIC_API_KEY`
   - Value: המפתח שיצרת (תדביק אותו שם, אני לא רואה את הערך).
3. זהו — ה-workflow יתחיל לרוץ אוטומטית לפי הלוח זמנים בפעם הריצה הבאה.

**בדיקה ידנית**: אפשר להריץ את זה עכשיו בלי לחכות ללוח זמנים — `zochmer-com` repo → **Actions** → "Auto content (news → articles)" → **Run workflow**.

### כיוונון (אופציונלי)

ב-GitHub: **Settings → Secrets and variables → Actions → Variables** (לא Secrets — אלה לא סודיים):
- `AUTO_CONTENT_MAX` — כמה כתבות מקסימום בכל ריצה (ברירת מחדל: 2)
- `AUTO_CONTENT_MAX_AGE_DAYS` — כתבות מבוגרות כמה ימים לשקול (ברירת מחדל: 5)
- `AUTO_CONTENT_MODEL` — איזה מודל Claude להשתמש (ברירת מחדל: `claude-sonnet-4-5`; אפשר להחליף למודל זול/מהיר יותר אם רוצים לחסוך בעלות)

לשינוי תדירות (ברירת מחדל: פעמיים בשבוע) — לערוך את ה-`cron` ב-`.github/workflows/auto-content.yml`.

**עלות**: כל ריצה זה קריאת API אחת ל-Claude (כמה אלפי טוקנים) — עלות של סנטים בודדים לריצה, לא יותר.

## איך מוסיפים כתבה / עורכים תוכן

ראה `assets/js/content.js` (מערך `ARTICLES`) ואת ההערות המלאות במסמך `claude/zochmer-com-deploy-guide.md` בפרויקט Claude — שם התיעוד המלא של הסכימה, סוגי הבלוקים, האזהרה על שדות `verdict`, ורשימת הקטגוריות.

לבדיקה מקומית לפני push:
```bash
node build.mjs
grep -rl "undefined" a/*.html c/*.html index.html   # צריך להיות ריק
```

## מבנה

```
build.mjs               # המחולל
prices-data.js           # נתוני מחירים (build-time)
assets/js/content.js     # כל התוכן — SITE / CATEGORIES / MENU / ARTICLES
assets/js/render.js      # קבצים סטטיים (לא נוצרים ע"י build.mjs)
assets/js/site.js
assets/js/search.js
assets/js/tools.js
assets/css/site.css
_headers                # מדיניות cache ל-Cloudflare
_redirects               # הפניות 301
```

קבצים שנוצרים אוטומטית בכל build (לא ב-git — ראה `.gitignore`): `*.html` בשורש, `a/`, `c/`, `sitemap.xml`, `feed.xml`, `robots.txt`, `assets/js/search-index.js`.
