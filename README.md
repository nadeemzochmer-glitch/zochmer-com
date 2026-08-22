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
