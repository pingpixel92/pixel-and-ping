# Pixel & Ping — پنل مدیریت زیرساخت

<div dir="rtl">

[English](README.md) · [**فارسی**](README.fa.md) · [Русский](README.ru.md) · [中文](README.zh.md)

یک پنل مدیریت زیرساخت و شبکه‌ی واقعی و آماده‌ی تولید (Production-Ready): کاربران مدیریت‌شده، سرورها،
اندپوینت‌ها، پورت‌ها، سازنده‌ی کانفیگ واقعی (VLESS / VMess / Trojan / Shadowsocks)، چک سلامت زنده‌ی TCP/TLS،
دریافت داده‌ی ترافیک، آنالیتیکس، قوانین Failover، لاگ‌های حسابرسی، کلیدهای API و
دسترسی مبتنی بر نقش (RBAC) — با پشتوانه‌ی PostgreSQL. مستقر روی Railway.

**هیچ داده‌ی تقلبی وجود ندارد.** هر عدد در داشبورد مستقیماً از یک کوئری دیتابیس می‌آید. نصب تازه در همه‌جا
`0` نشان می‌دهد و شما را در راه‌اندازی اولیه قدم‌به‌قدم همراهی می‌کند.

---

## استک فناوری

| لایه       | فناوری                                            |
| ---------- | -------------------------------------------------- |
| فریم‌ورک   | Next.js 16 (App Router) + TypeScript سخت‌گیرانه     |
| رابط کاربری | Tailwind CSS 4، Framer Motion، آیکون‌های Lucide    |
| API        | Next.js Route Handlers (REST با پاکت JSON)         |
| دیتابیس    | PostgreSQL                                         |
| ORM        | Prisma (همراه با migration)                        |
| احراز هویت | نشست‌های مبتنی بر دیتابیس، کوکی HttpOnly، هش scrypt |
| اعتبارسنجی | Zod روی تمام endpointهای نوشتن                     |
| تست‌ها     | Vitest                                             |

### ساختار پروژه

```
prisma/                  # اسکیما + migrationهای SQL
src/app/                 # صفحات فرانت‌اند (App Router)
src/app/api/             # بک‌اند REST API (route handlers)
src/components/          # سیستم طراحی + کامپوننت‌های پوسته‌ی اپ
src/lib/                 # auth، rbac، crypto، validation، services (منطق کسب‌وکار)
src/lib/services/        # چک سلامت، پروایدرها، اسکنر، آمار، jobها
tests/                   # تست‌های واحد vitest
```

---

## استقرار روی Railway (مخصوص مبتدی‌ها، قدم‌به‌قدم)

1. **ساخت پروژه.** به [railway.app](https://railway.app) بروید ← *New Project* ←
   *Deploy from GitHub repo* و این مخزن را انتخاب کنید (اول آن را fork کنید یا به حساب خودتان پوش کنید).

2. **افزودن PostgreSQL.** داخل همان پروژه روی *+ New* کلیک کنید ← *Database* ← *Add PostgreSQL*.
   Railway یک سرویس دیتابیس می‌سازد و متغیر `DATABASE_URL` را در اختیار می‌گذارد.

3. **اتصال متغیر به اپلیکیشن.** سرویس اپ خودتان را باز کنید ← *Variables* ← یک variable reference
   اضافه کنید: نامش را `DATABASE_URL` بگذارید و `DATABASE_URL` منتشرشده توسط Postgres را انتخاب کنید.

4. **افزودن رمزهای مخفی.** همچنان در *Variables* این‌ها را اضافه کنید:

   | متغیر            | نحوه‌ی ساخت                                              |
   | ---------------- | -------------------------------------------------------- |
   | `SESSION_SECRET` | دستور `openssl rand -hex 32` را محلی اجرا و خروجی را بچسبانید |
   | `ENCRYPTION_KEY` | دوباره `openssl rand -hex 32` را اجرا کنید (مقدار متفاوت)    |

   اختیاری: `SETUP_TOKEN` (توکن ساخت ادمین اضافه)، `CORS_ORIGIN`.

5. **استقرار.** Railway اپ Next.js را خودکار تشخیص می‌دهد (به `railway.json` نگاه کنید). بیلد،
   `prisma generate && next build` را اجرا می‌کند؛ هنگام استارت، `prisma migrate deploy` به‌صورت خودکار
   اجرا می‌شود و سرور روی `$PORT` گوش می‌دهد.

6. **باز کردن دامنه.** در سرویس اپ ← *Settings* ← *Networking* ← *Generate Domain*.

7. **بررسی سلامت.** به `https://<your-domain>/health` بروید — باید `{"ok":true}` ببینید.

8. **ساخت اولین ادمین.** `https://<your-domain>/setup` را باز کنید. چون دیتابیس هنوز هیچ کاربری ندارد،
   صفحه‌ی setup باز است. ادمین خودتان را بسازید — اطلاعات ورود هرگز در کد هاردکد نمی‌شود.
   بعد از راه‌اندازی اولیه، `/setup` به متغیر محیطی `SETUP_TOKEN` نیاز دارد.

9. **تمام.** در `/login` وارد شوید و شروع به افزودن سرور و کاربر کنید.

### چک‌لیست اولین استقرار

- [ ] `/health` مقدار `{"ok":true}` برمی‌گرداند
- [ ] `/setup` ادمین را ساخت و به داشبورد هدایت کرد
- [ ] داشبورد صفرهای واقعی نشان می‌دهد (هنوز کاربر/سروری وجود ندارد)
- [ ] یک سرور اضافه کنید ← دکمه‌ی **Test connection** ← وضعیت، حاصل یک **پروب واقعی TCP** است

---

## توسعه‌ی محلی

پیش‌نیازها: Node 20+ و PostgreSQL (هر نمونه‌ی محلی در حال اجرا).

```bash
cp .env.example .env          # سپس DATABASE_URL و رمزها را ویرایش کنید
npm install
npm run db:push               # یا: npm run db:migrate:dev
npm run dev                   # http://localhost:3000
```

برای ساخت اولین ادمین، `http://localhost:3000/setup` را باز کنید.

### اسکریپت‌ها

| دستور                | کارکرد                                              |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | سرور توسعه (پورت 3000)                               |
| `npm run build`      | بیلد پروداکشن (خروجی standalone)                     |
| `npm run start`      | اجرای سرور پروداکشن (از `$PORT` پیروی می‌کند)        |
| `npm run lint`       | ESLint                                               |
| `npm test`           | تست‌های واحد Vitest                                  |
| `npm run db:migrate` | اعمال migrationها (`prisma migrate deploy`)          |
| `npm run db:push`    | همگام‌سازی اسکیما بدون فایل migration (فقط توسعه)    |

---

## نمای کلی API

همه‌ی پاسخ‌ها از یک پاکت (envelope) یکسان استفاده می‌کنند:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

### احراز هویت و حساب‌ها
- `POST /api/auth/login` — ایمیل/نام‌کاربری + رمز عبور (محدودشده‌ی نرخ، با ثبت حسابرسی)
- `POST /api/auth/logout`
- `POST /api/auth/password` — تغییر رمز عبور خودی
- `GET /api/me` — کاربر نشست + تعداد اعلان خوانده‌نشده
- `PATCH /api/me` — پروفایل + تنظیمات (زبان، کاهش انیمیشن)
- `GET|POST /api/setup` — راه‌اندازی اولین ادمین

### داده‌های پنل
- `GET /api/dashboard` — آمار تجمعی واقعی + سلامت
- `GET /api/system/health` — گزارش دیتابیس/API/jobها
- `GET|POST /api/users`، `GET|PATCH|DELETE /api/users/:id`
- `GET|POST /api/users/:id/config` — دریافت / بازتولید کانفیگ پروکسی
- `GET|POST /api/servers`، `PATCH|DELETE /api/servers/:id`، `POST /api/servers/:id/test`، `POST /api/servers/test-all`
- `GET|POST /api/endpoints`، `PATCH|DELETE /api/endpoints/:id`، `POST /api/endpoints/:id/test`
- `GET|POST /api/ports`، `PATCH|DELETE /api/ports/:id`، `POST /api/ports/:id/test`
- `GET|POST /api/configs`، `DELETE /api/configs/:id`، `GET /api/configs/providers`
- `POST /api/scanner` — عیب‌یابی کنترل‌شده‌ی DNS/TCP/HTTP (محدودشده‌ی نرخ)
- `GET /api/traffic?range=24h|7d|30d|all`
- `GET /api/analytics?range=…`
- `GET /api/logs` — قابل جستجو، فیلتردار، صفحه‌بندی‌شده
- `GET|PATCH /api/notifications`، `POST /api/notifications/read-all`
- `GET|PUT /api/settings`، `POST /api/settings/purge` (ادمین)
- `GET|POST /api/api-keys`، `DELETE /api/api-keys/:id` (ابطال)
- `GET|POST /api/failover`، `PATCH|DELETE /api/failover/:id`، `POST /api/failover/:id/check`
- `GET /api/search?q=` — جستجوی Command Palette
- `GET /health` — healthcheck مخصوص Railway، خروجی `{"ok":true}`

### دریافت ترافیک (برای data planeهای واقعی)

رکوردهای مصرف را از یک exporter/API پروکسی با کلید API دارای دسترسی
`traffic:ingest` ارسال کنید (کلیدها را در بخش **API Keys** پنل بسازید):

```bash
curl -X POST https://<your-domain>/api/traffic/ingest \
  -H "Authorization: Bearer ppk_…" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"vpnUserId":"…","bytesIn":1048576,"bytesOut":4194304,"requests":42}]}'
```

صفحات ترافیک و آنالیتیکس تا وقتی رکورد واقعی وجود نداشته باشد خالی می‌مانند — این عمدی است.

---

## نقش‌ها

| نقش      | دسترسی‌ها                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| ADMIN    | همه‌چیز، شامل تنظیمات، کلیدهای API، لاگ‌های حسابرسی، بخش خطر                   |
| OPERATOR | مدیریت کاربران/سرورها/اندپوینت‌ها/پورت‌ها/کانفیگ‌ها/اسکنر/failover              |
| VIEWER   | فقط خواندنی — داشبورد و لیست‌ها                                                |

بررسی دسترسی‌ها در بک‌اند انجام می‌شود (`src/lib/rbac.ts` + گاردهای روت‌ها). رابط کاربری فقط آن‌ها را منعکس می‌کند.

## نکات امنیتی

- رمزهای عبور: scrypt با salt اختصاصی هر کاربر و مقایسه‌ی constant-time.
- نشست‌ها: توکن‌های تصادفی ۲۵۶ بیتی، فقط هش SHA-256 ذخیره می‌شود؛ کوکی‌های HttpOnly + SameSite؛
  در پروداکشن `Secure`؛ انقضا و پاکسازی سمت دیتابیس.
- CSRF: درخواست‌های تغییردهنده‌ی API نیازمند same-origin هستند؛ کوکی‌ها SameSite=Lax.
- کلیدهای API: به‌صورت هش SHA-256 ذخیره می‌شوند؛ راز کامل فقط یک‌بار نمایش داده می‌شود.
- محدودسازی نرخ: ورود (per-IP + per-identifier)، اسکنر، تست‌های سلامت، ingest، API عمومی.
- لاگ‌گذاری ساختاریافته با پوش‌کردن خودکار اسرار. هیچ stack trace‌ای به کلاینت نمی‌رسد.
- هدرهای امنیتی: `X-Frame-Options`، `X-Content-Type-Options`، `Referrer-Policy`، `Permissions-Policy`.

## Jobهای پس‌زمینه

یک زمان‌بند ۶۰ ثانیه‌ای (استارت از `instrumentation.ts`) این کارها را انجام می‌دهد:
چک‌های سلامت (بازه‌ی قابل تنظیم)، اسکن انقضا + اعلان‌های هشدار انقضا،
پاکسازی نشست‌ها و ارزیابی قوانین failover. بازه‌ها محدود و وضعیت ذخیره می‌شود،
بنابراین ری‌استارت هیچ‌وقت کار تکراری ایجاد نمی‌کند. داشبورد تازگی jobها را صادقانه گزارش می‌کند
(`Healthy / Degraded / Not configured`).

</div>
