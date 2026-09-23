# Malaz Railway bot/API

هذا المشروع يشغل بوت Discord وواجهة API للقراءة فقط في Railway. لا تضع التوكن داخل GitHub أو ملفات الواجهة.

## Railway Variables

أضف في Railway → Variables:

```text
DISCORD_BOT_TOKEN=توكن البوت
DISCORD_GUILD_ID=1505700340392263720
PUBLIC_SITE_URL=https://رابط-موقع-netlify.app
VISIBLE_ROLE_IDS=معرف_رتبة_1,معرف_رتبة_2
```

لا تضع `DISCORD_BOT_TOKEN` في GitHub.

## Discord Developer Portal

فعّل `Server Members Intent` من Bot → Privileged Gateway Intents، ثم أضف البوت إلى السيرفر مع صلاحية قراءة السيرفر والأعضاء.

## Railway

اربط هذا المستودع، واترك أمر البناء الافتراضي، وسيستخدم Railway:

```text
npm start
```

من Settings → Networking اختر Generate Domain. اختبر الرابط:

```text
https://YOUR-RAILWAY-DOMAIN/health
```

## API

- `GET /health`
- `GET /api/public/server`
- `GET /api/public/roles`
- `GET /api/public/members?q=...`
- `GET /api/public/member/:id`
- `GET /api/public/leaderboard`

الإحصائيات التاريخية للرسائل ووقت الصوت غير متوفرة من Discord تلقائياً؛ هذا المشروع يعرضها كصفر إلى أن تضيف قاعدة بيانات وتسجيل أحداث البوت.
