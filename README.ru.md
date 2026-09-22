# Pixel & Ping — панель управления инфраструктурой

[English](README.md) · [فارسی](README.fa.md) · [**Русский**](README.ru.md) · [中文](README.zh.md)

Реальная, готовая к продакшену панель управления инфраструктурой и сетью: управляемые пользователи,
серверы, эндпоинты, порты, настоящие генераторы конфигураций (VLESS / VMess / Trojan / Shadowsocks),
живые TCP/TLS проверки здоровья, приём данных о трафике, аналитика, правила failover, журналы аудита,
API-ключи и доступ на основе ролей — на базе PostgreSQL. Разворачивается на Railway.

**Никаких фейковых данных.** Каждое число на дашборде приходит из запроса к базе данных. После чистой
установки везде отображается `0`, а мастер первого запуска проведёт вас через первоначальную настройку.

---

## Стек технологий

| Слой          | Технология                                          |
| ------------- | ---------------------------------------------------- |
| Фреймворк     | Next.js 16 (App Router) + строгий TypeScript          |
| UI            | Tailwind CSS 4, Framer Motion, иконки Lucide           |
| API           | Next.js Route Handlers (REST, JSON-конверты)           |
| База данных   | PostgreSQL                                             |
| ORM           | Prisma (с миграциями)                                  |
| Аутентификация| Сессии в БД, HttpOnly cookies, хеши scrypt             |
| Валидация     | Zod на каждом записывающем эндпоинте                   |
| Тесты         | Vitest                                                 |

### Структура проекта

```
prisma/                  # схема + SQL-миграции
src/app/                 # страницы фронтенда (App Router)
src/app/api/             # бэкенд REST API (route handlers)
src/components/          # дизайн-система + компоненты оболочки приложения
src/lib/                 # auth, rbac, crypto, validation, services (бизнес-логика)
src/lib/services/        # проверки здоровья, провайдеры, сканер, статистика, джобы
tests/                   # модульные тесты vitest
```

---

## Развёртывание на Railway (пошагово, для новичков)

1. **Создайте проект.** Перейдите на [railway.app](https://railway.app) → *New Project* →
   *Deploy from GitHub repo* и выберите этот репозиторий (сначала сделайте fork или запушьте его в свой аккаунт).

2. **Добавьте PostgreSQL.** Внутри того же проекта нажмите *+ New* → *Database* → *Add PostgreSQL*.
   Railway создаст сервис базы данных и предоставит переменную `DATABASE_URL`.

3. **Свяжите переменную с приложением.** Откройте сервис вашего приложения → *Variables* → добавьте
   ссылку на переменную (variable reference): назовите её `DATABASE_URL` и выберите `DATABASE_URL`,
   предоставляемую Postgres.

4. **Добавьте секреты.** Там же в *Variables* добавьте:

   | Переменная       | Как сгенерировать                                             |
   | ---------------- | --------------------------------------------------------------- |
   | `SESSION_SECRET` | выполните локально `openssl rand -hex 32` и вставьте результат   |
   | `ENCRYPTION_KEY` | снова выполните `openssl rand -hex 32` (другое значение)         |

   Опционально: `SETUP_TOKEN` (токен для создания дополнительного админа), `CORS_ORIGIN`.

5. **Развёртывание.** Railway автоматически определит Next.js-приложение (см. `railway.json`). Сборка
   выполняет `prisma generate && next build`; при старте автоматически запускается `prisma migrate deploy`,
   и сервер слушает порт `$PORT`.

6. **Откройте домен.** В сервисе приложения → *Settings* → *Networking* → *Generate Domain*.

7. **Проверьте здоровье.** Откройте `https://<ваш-домен>/health` — вы должны увидеть `{"ok":true}`.

8. **Создайте первого админа.** Откройте `https://<ваш-домен>/setup`. Поскольку в базе ещё нет
   пользователей, страница setup открыта. Создайте администратора — учётные данные никогда не хардкодятся.
   После первичной настройки `/setup` требует переменную окружения `SETUP_TOKEN`.

9. **Готово.** Войдите через `/login` и начните добавлять серверы и пользователей.

### Чек-лист первого развёртывания

- [ ] `/health` возвращает `{"ok":true}`
- [ ] `/setup` создал админа и перенаправил на дашборд
- [ ] Дашборд показывает реальные нули (пока нет пользователей/серверов)
- [ ] Добавьте сервер → нажмите **Test connection** → статус отражает **реальную TCP-пробу**

---

## Локальная разработка

Требования: Node 20+, PostgreSQL (любой локально запущенный экземпляр).

```bash
cp .env.example .env          # затем отредактируйте DATABASE_URL и секреты
npm install
npm run db:push               # или: npm run db:migrate:dev
npm run dev                   # http://localhost:3000
```

Откройте `http://localhost:3000/setup`, чтобы создать первого админа.

### Скрипты

| Команда              | Что делает                                                |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Сервер разработки (порт 3000)                                |
| `npm run build`      | Продакшен-сборка (standalone-вывод)                          |
| `npm run start`      | Запуск продакшен-сервера (учитывает `$PORT`)                 |
| `npm run lint`       | ESLint                                                       |
| `npm test`           | Модульные тесты Vitest                                       |
| `npm run db:migrate` | Применить миграции (`prisma migrate deploy`)                 |
| `npm run db:push`    | Синхронизация схемы без файлов миграций (только для dev)     |

---

## Обзор API

Все ответы используют единый конверт (envelope):

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

### Аутентификация и аккаунты
- `POST /api/auth/login` — email/имя пользователя + пароль (rate limit, аудит)
- `POST /api/auth/logout`
- `POST /api/auth/password` — смена собственного пароля
- `GET /api/me` — пользователь сессии + количество непрочитанных уведомлений
- `PATCH /api/me` — профиль + настройки (язык, уменьшение анимации)
- `GET|POST /api/setup` — инициализация первого админа

### Данные панели
- `GET /api/dashboard` — реальная агрегированная статистика + здоровье
- `GET /api/system/health` — отчёт о базе данных/API/джобах
- `GET|POST /api/users`, `GET|PATCH|DELETE /api/users/:id`
- `GET|POST /api/users/:id/config` — получить / перегенерировать прокси-конфиг
- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/test`, `POST /api/servers/test-all`
- `GET|POST /api/endpoints`, `PATCH|DELETE /api/endpoints/:id`, `POST /api/endpoints/:id/test`
- `GET|POST /api/ports`, `PATCH|DELETE /api/ports/:id`, `POST /api/ports/:id/test`
- `GET|POST /api/configs`, `DELETE /api/configs/:id`, `GET /api/configs/providers`
- `POST /api/scanner` — контролируемая диагностика DNS/TCP/HTTP (rate limit)
- `GET /api/traffic?range=24h|7d|30d|all`
- `GET /api/analytics?range=…`
- `GET /api/logs` — с поиском, фильтрами, пагинацией
- `GET|PATCH /api/notifications`, `POST /api/notifications/read-all`
- `GET|PUT /api/settings`, `POST /api/settings/purge` (админ)
- `GET|POST /api/api-keys`, `DELETE /api/api-keys/:id` (отзыв)
- `GET|POST /api/failover`, `PATCH|DELETE /api/failover/:id`, `POST /api/failover/:id/check`
- `GET /api/search?q=` — поиск для command palette
- `GET /health` — healthcheck для Railway, возвращает `{"ok":true}`

### Приём трафика (для реальных data plane)

Отправляйте записи о потреблении из exporter/proxy API с помощью API-ключа с правом
`traffic:ingest` (ключи создаются в разделе **API Keys** панели):

```bash
curl -X POST https://<ваш-домен>/api/traffic/ingest \
  -H "Authorization: Bearer ppk_…" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"vpnUserId":"…","bytesIn":1048576,"bytesOut":4194304,"requests":42}]}'
```

Страницы трафика и аналитики остаются пустыми, пока не появятся реальные записи — так задумано.

---

## Роли

| Роль     | Возможности                                                                       |
| -------- | ----------------------------------------------------------------------------------- |
| ADMIN    | Всё, включая настройки, API-ключи, журналы аудита, опасную зону                      |
| OPERATOR | Управление пользователями/серверами/эндпоинтами/портами/конфигами/сканером/failover   |
| VIEWER   | Только чтение — дашборды и списки                                                    |

Проверки прав выполняются на бэкенде (`src/lib/rbac.ts` + гарды маршрутов). UI лишь отражает их.

## Заметки по безопасности

- Пароли: scrypt с индивидуальными солью для каждого пользователя, проверка за constant-time.
- Сессии: случайные токены 256 бит, хранится только SHA-256 хеш; HttpOnly + SameSite cookies;
  `Secure` в продакшене; истечение срока и очистка на стороне БД.
- CSRF: изменяющие API-запросы требуют same-origin; cookies SameSite=Lax.
- API-ключи: хранятся как SHA-256 хеши; полный секрет показывается ровно один раз.
- Ограничение частоты: вход (per-IP + per-identifier), сканер, проверки здоровья, ingest, общий API.
- Структурированное логирование с автоматическим скрытием секретов. Stack trace не попадают к клиентам.
- Заголовки безопасности: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Фоновые задачи

Один планировщик с интервалом 60 секунд (запускается из `instrumentation.ts`) выполняет:
проверки здоровья (настраиваемый интервал), сканы истечения срока + уведомления об истечении,
очистку сессий и оценку правил failover. Интервалы ограничены, состояние сохраняется,
поэтому перезапуски никогда не дублируют работу. Дашборд честно сообщает свежесть джобов
(`Healthy / Degraded / Not configured`).
