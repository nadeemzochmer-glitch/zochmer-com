/* =====================================================================
   قاعدة الأسعار المحلّية — المصدر الوحيد لكل سعر بالموقع
   ---------------------------------------------------------------------
   كل صفّ = جهاز واحد بسعة واحدة، بسعر مرصود من السوق المحلّي.
   k  = نوع الاستيراد:  'off' رسمي · 'grey' موازي · 'mix' الاثنين بالسوق
   d  = تاريخ الرصد. الصفّ اللي ما انفحص من فترة بينعرض بتنبيه.
   a  = مزهر المقال اللي فيه التفاصيل (اختياري)
   e  = سعر إيلات بلا ضريبة (اختياري)
   ===================================================================== */
var PRICES = [
  /* ── سامسونج ── */
  { n: 'Galaxy Z Flip8', b: 'samsung', s: '256GB', p: 3799, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Flip8', b: 'samsung', s: '512GB', p: 4149, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8', b: 'samsung', s: '256GB', p: 5749, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8', b: 'samsung', s: '512GB', p: 6099, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8', b: 'samsung', s: '1TB', p: 7199, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8 Ultra', b: 'samsung', s: '256GB', p: 6499, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8 Ultra', b: 'samsung', s: '512GB', p: 6899, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy Z Fold8 Ultra', b: 'samsung', s: '1TB', p: 7899, k: 'off', d: '2026-08-13', a: 'galaxy-fold8-flip8-prices-israel' },
  { n: 'Galaxy S26', b: 'samsung', s: '256GB', p: 2225, k: 'grey', d: '2026-08-13', a: 'phone-prices-israel-august-2026', t: 'وبالاستيراد الرسمي من 2,590' },
  { n: 'Galaxy S26', b: 'samsung', s: '512GB', p: 2770, k: 'mix', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy S26+', b: 'samsung', s: '256GB', p: 2670, k: 'mix', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy S26+', b: 'samsung', s: '512GB', p: 3085, k: 'mix', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy S26 Ultra', b: 'samsung', s: '256GB', p: 3699, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy S26 Ultra', b: 'samsung', s: '512GB', p: 4399, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy S26 Ultra', b: 'samsung', s: '1TB', p: 5299, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Galaxy Buds4', b: 'samsung', s: '—', p: 390, k: 'mix', d: '2026-08-13', a: 'galaxy-buds4-israel', c: 'audio' },
  { n: 'Galaxy Buds4 Pro', b: 'samsung', s: '—', p: 551, k: 'mix', d: '2026-08-13', a: 'galaxy-buds4-israel', c: 'audio' },
  { n: 'Galaxy Watch8 40mm', b: 'samsung', s: '—', p: 695, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Galaxy Watch8 44mm', b: 'samsung', s: '—', p: 699, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Galaxy Watch8 Classic 46mm', b: 'samsung', s: '—', p: 1249, k: 'off', d: '2026-08-13', c: 'watch' },

  /* ── آبل ── */
  { n: 'iPhone 17', b: 'apple', s: '256GB', p: 2812, k: 'mix', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'iPhone Air', b: 'apple', s: '256GB', p: 2899, k: 'off', d: '2026-08-13', a: 'iphone-air', t: 'أوسع توفّر بالسوق — 25 عرض' },
  { n: 'iPhone 17 Pro', b: 'apple', s: '256GB', p: 4899, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026', e: 4152, t: 'وبالاستيراد الموازي من 3,903' },
  { n: 'iPhone 17 Pro Max', b: 'apple', s: '256GB', p: 5059, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026', e: 4287 },

  /* ── شاومي · ريدمي · بوكو ── */
  { n: 'POCO M8 5G', b: 'xiaomi', s: '256GB', p: 999, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'POCO M8 5G', b: 'xiaomi', s: '512GB', p: 1149, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Redmi Note 15 Pro', b: 'xiaomi', s: '256GB', p: 1159, k: 'off', d: '2026-08-13', a: 'redmi-note-17-5g' },
  { n: 'Redmi Note 15 Pro 5G', b: 'xiaomi', s: '512GB', p: 1499, k: 'off', d: '2026-08-13', a: 'redmi-note-17-5g' },
  { n: 'POCO X8 Pro', b: 'xiaomi', s: '512GB', p: 1999, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 17T', b: 'xiaomi', s: '256GB', p: 2299, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 17T', b: 'xiaomi', s: '512GB', p: 2499, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'POCO F8 Ultra', b: 'xiaomi', s: '512GB', p: 3068, k: 'mix', d: '2026-08-13', a: 'poco-f8-ultra', e: 2679 },
  { n: 'Xiaomi 17T Pro', b: 'xiaomi', s: '512GB', p: 3199, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 17T Pro', b: 'xiaomi', s: '1TB', p: 3649, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 17', b: 'xiaomi', s: '512GB', p: 3899, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 15 Ultra', b: 'xiaomi', s: '512GB', p: 4399, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'Xiaomi 17 Ultra', b: 'xiaomi', s: '512GB', p: 5299, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },

  /* ── جوجل — كلها استيراد موازي ── */
  { n: 'Pixel 10a', b: 'google', s: '128GB', p: 1549, k: 'grey', d: '2026-08-13', a: 'pixel-grey-import-israel' },
  { n: 'Pixel 10', b: 'google', s: '128GB', p: 2099, k: 'grey', d: '2026-08-13', a: 'pixel-grey-import-israel' },
  { n: 'Pixel 10', b: 'google', s: '256GB', p: 2180, k: 'grey', d: '2026-08-13', a: 'pixel-grey-import-israel' },
  { n: 'Pixel 9 Pro', b: 'google', s: '128GB', p: 2778, k: 'grey', d: '2026-08-13', a: 'google-pixel-9-pro', t: 'انتبه: Pixel 10 Pro الأحدث بنفس السعر تقريباً' },
  { n: 'Pixel 10 Pro', b: 'google', s: '128GB', p: 2789, k: 'grey', d: '2026-08-13', a: 'pixel-grey-import-israel' },
  { n: 'Pixel 10 Pro XL', b: 'google', s: '256GB', p: 3449, k: 'grey', d: '2026-08-13', a: 'pixel-grey-import-israel' },
  { n: 'Pixel Fold', b: 'google', s: '256GB', p: 2899, k: 'grey', d: '2026-08-13', a: 'google-pixel-fold', t: 'نفس الجهاز بيوصل 5,530 بمحلّات تانية' },

  /* ── ون بلس ── */
  { n: 'OnePlus Nord 5', b: 'oneplus', s: '256GB', p: 1499, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'OnePlus Nord 4', b: 'oneplus', s: '256GB', p: 1650, k: 'mix', d: '2026-08-13', a: 'oneplus-nord-4', e: 1425 },
  { n: 'OnePlus Nord 6', b: 'oneplus', s: '256GB', p: 1844, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'OnePlus 12', b: 'oneplus', s: '512GB', p: 2740, k: 'mix', d: '2026-08-13', a: 'oneplus-12', e: 2499, t: 'نسخة 256 غيغا اختفت من السوق' },
  { n: 'OnePlus 15', b: 'oneplus', s: '256GB', p: 3048, k: 'off', d: '2026-08-13', a: 'phone-prices-israel-august-2026' },
  { n: 'OnePlus Open', b: 'oneplus', s: '512GB', p: 5730, k: 'off', d: '2026-08-13', a: 'oneplus-open', t: 'تقريباً ضعف سعر OnePlus 15 الأحدث' },

  /* ── ريلمي ── */
  { n: 'Realme 16 Pro', b: 'realme', s: '256GB', p: 1790, k: 'mix', d: '2026-08-13', a: 'realme-12-pro' },
  { n: 'Realme P4 Power', b: 'realme', s: '256GB', p: 1790, k: 'mix', d: '2026-08-13' },
  { n: 'Realme 16', b: 'realme', s: '256GB', p: 1890, k: 'mix', d: '2026-08-13', a: 'realme-12-pro' },
  { n: 'Realme 16 Pro+', b: 'realme', s: '256GB', p: 2090, k: 'mix', d: '2026-08-13', a: 'realme-12-pro' },
  { n: 'Realme GT 8 Pro', b: 'realme', s: '256GB', p: 3690, k: 'mix', d: '2026-08-13' },

  /* ── موتورولا ── */
  { n: 'Motorola Razr Fold', b: 'motorola', s: '512GB', p: 6349, k: 'grey', d: '2026-08-13', a: 'motorola-razr-2026', t: 'الرسمي أغلى بـ141 شيكل بس' },
/* ── كونسولات ── */
  { n: 'Nintendo Switch 1', b: 'nintendo', s: '—', p: 848, k: 'mix', d: '2026-08-13', c: 'console' },
  { n: 'Xbox Series S', b: 'xbox', s: '512GB', p: 1595, k: 'off', d: '2026-08-13', c: 'console', e: 1400 },
  { n: 'Nintendo Switch 2', b: 'nintendo', s: '—', p: 1678, k: 'grey', d: '2026-08-13', c: 'console', e: 1515, t: 'الاستيراد الرسمي بيطلب 2,059 — فرق 381 شيكل على نفس الجهاز' },
  { n: 'PlayStation 5 Slim Digital', b: 'sony', s: '1TB', p: 1849, k: 'off', d: '2026-08-13', c: 'console', e: 1750, t: 'أرخص من نسخة 825 غيغا الأقدم' },
  { n: 'Nintendo Switch 2 + Mario Kart', b: 'nintendo', s: '—', p: 1973, k: 'mix', d: '2026-08-13', c: 'console' },
  { n: 'PlayStation 5 Digital (الأقدم)', b: 'sony', s: '825GB', p: 2026, k: 'off', d: '2026-08-13', c: 'console', t: 'أغلى بـ177 شيكل من الجيل الأحدث بتخزين أكبر' },
  { n: 'PlayStation 5 Slim', b: 'sony', s: '1TB', p: 2231, k: 'off', d: '2026-08-13', c: 'console', e: 2000 },
  { n: 'Xbox Series X', b: 'xbox', s: '1TB', p: 2510, k: 'mix', d: '2026-08-13', c: 'console', e: 2259, t: 'نسخة بلا قرص أغلى — 2,579' },
  { n: 'PlayStation 5 Pro', b: 'sony', s: '2TB', p: 3299, k: 'off', d: '2026-08-13', c: 'console', e: 2789 },
  { n: 'Steam Deck OLED', b: 'valve', s: '512GB', p: 3499, k: 'grey', d: '2026-08-13', c: 'console', t: 'ما في مستورد رسمي لفالف عنّا' },

  /* ── صوت ── */
  { n: 'AirPods 4', b: 'apple', s: '—', p: 395, k: 'mix', d: '2026-08-13', c: 'audio', e: 338 },
  { n: 'AirPods 4 (عزل ضجيج)', b: 'apple', s: '—', p: 564, k: 'mix', d: '2026-08-13', c: 'audio', e: 454 },
  { n: 'AirPods Pro 2', b: 'apple', s: '—', p: 699, k: 'mix', d: '2026-08-13', c: 'audio' },
  { n: 'AirPods Pro 3', b: 'apple', s: '—', p: 727, k: 'mix', d: '2026-08-13', c: 'audio', e: 602, t: 'أوسع توفّر — 41 عرض' },
  { n: 'Sony WH-1000XM6', b: 'sony', s: '—', p: 1144, k: 'mix', d: '2026-08-13', c: 'audio', e: 1018, t: 'نزل حوالي 38٪ عن سعر إطلاقه' },
  { n: 'AirPods Max', b: 'apple', s: 'USB-C', p: 1686, k: 'mix', d: '2026-08-13', c: 'audio', e: 1449 },

  /* ── ساعات ── */
  { n: 'Garmin Forerunner 55', b: 'garmin', s: '—', p: 649, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Apple Watch SE 2', b: 'apple', s: '44mm', p: 674, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Apple Watch SE 3', b: 'apple', s: '40mm GPS', p: 949, k: 'off', d: '2026-08-13', c: 'watch', e: 848 },
  { n: 'Apple Watch Series 11', b: 'apple', s: '42mm GPS', p: 1239, k: 'mix', d: '2026-08-13', c: 'watch', e: 1058, t: 'أرخص من Series 10 الأقدم' },
  { n: 'Apple Watch Series 11', b: 'apple', s: '46mm GPS', p: 1325, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Garmin Instinct 3 Solar', b: 'garmin', s: '45mm', p: 1387, k: 'mix', d: '2026-08-13', c: 'watch' },
  { n: 'Apple Watch Ultra 3', b: 'apple', s: '49mm', p: 2734, k: 'mix', d: '2026-08-13', c: 'watch', t: 'أرخص من Ultra 2 بسوار Trail' },

  /* ── لابتوبات ── */
  { n: 'Lenovo V15 G4', b: 'lenovo', s: '8GB · 256GB', p: 1250, k: 'mix', d: '2026-08-13', c: 'laptop', t: 'بلا نظام تشغيل — رخصة ويندوز بتزيد 400–500' },
  { n: 'HP Victus 15 (RTX 4050)', b: 'hp', s: '8GB · 512GB', p: 3338, k: 'mix', d: '2026-08-13', c: 'laptop', t: 'بلا نظام تشغيل' },
  { n: 'Lenovo ThinkPad E14 Gen 7', b: 'lenovo', s: '16GB · 512GB', p: 3669, k: 'mix', d: '2026-08-13', c: 'laptop', t: 'كفالة 3 سنين بالموقع · بلا نظام' },
  { n: 'Asus TUF Gaming F16', b: 'asus', s: '16GB · 1TB', p: 4069, k: 'off', d: '2026-08-13', c: 'laptop', t: 'مع ويندوز 11' },
  { n: 'MacBook Air 13.6 M5', b: 'apple', s: '16GB · 512GB', p: 4559, k: 'off', d: '2026-08-13', c: 'laptop', e: 3869, t: 'أرخص وأوسع توفّراً من جيل M4 الأقدم' },
  { n: 'MacBook Air 15 M5', b: 'apple', s: '16GB', p: 5208, k: 'mix', d: '2026-08-13', c: 'laptop' },
  { n: 'HP OMEN MAX 16 (RTX 5070)', b: 'hp', s: '32GB · 1TB', p: 7288, k: 'off', d: '2026-08-13', c: 'laptop', t: 'بلا نظام تشغيل' }
];

var PRICE_BRANDS = {
  samsung: 'سامسونج', apple: 'آبل', xiaomi: 'شاومي', google: 'جوجل',
  oneplus: 'ون بلس', realme: 'ريلمي', motorola: 'موتورولا',
  sony: 'سوني', nintendo: 'نينتندو', xbox: 'إكس بوكس', valve: 'فالف',
  lenovo: 'لينوفو', hp: 'HP', asus: 'أسوس', garmin: 'جارمن'
};
/* c = نوع الجهاز. الافتراضي هاتف. */
var PRICE_CATS = {
  phone: 'هواتف', console: 'كونسولات', audio: 'سمّاعات',
  watch: 'ساعات', laptop: 'لابتوبات'
};
var PRICE_KINDS = {
  off: ['استيراد رسمي', 'كفالة من المستورد المحلّي'],
  grey: ['استيراد موازي', 'الكفالة من المحلّ مش من الشركة'],
  mix: ['الاثنين بالسوق', 'اسأل البائع أيّهم قبل ما تدفع']
};
