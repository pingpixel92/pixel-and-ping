# Pixel & Ping — 基础设施管理面板

[English](README.md) · [فارسی](README.fa.md) · [Русский](README.ru.md) · [**中文**](README.zh.md)

一个真正可用于生产环境的基础设施与网络管理面板：托管用户、服务器、端点、端口、真实的配置生成器
（VLESS / VMess / Trojan / Shadowsocks）、实时 TCP/TLS 健康检查、流量数据接入、分析统计、故障切换规则、
审计日志、API 密钥以及基于角色的访问控制 — 以 PostgreSQL 为后盾，部署在 Railway 上。

**没有任何假数据。** 仪表盘上的每个数字都来自数据库查询。全新安装后各处均显示 `0`，
并会引导你完成首次初始化设置。

---

## 技术栈

| 层级       | 技术                                              |
| ---------- | -------------------------------------------------- |
| 框架       | Next.js 16（App Router）+ 严格模式 TypeScript       |
| UI         | Tailwind CSS 4、Framer Motion、Lucide 图标          |
| API        | Next.js Route Handlers（REST，JSON 信封格式）       |
| 数据库     | PostgreSQL                                         |
| ORM        | Prisma（包含迁移文件）                              |
| 身份认证   | 基于数据库的会话、HttpOnly Cookie、scrypt 哈希      |
| 输入校验   | 每个写入端点均使用 Zod                              |
| 测试       | Vitest                                             |

### 项目结构

```
prisma/                  # 数据库 schema + SQL 迁移
src/app/                 # 前端页面（App Router）
src/app/api/             # 后端 REST API（route handlers）
src/components/          # 设计系统 + 应用外壳组件
src/lib/                 # auth、rbac、crypto、validation、services（业务逻辑）
src/lib/services/        # 健康检查、providers、扫描器、统计、定时任务
tests/                   # vitest 单元测试
```

---

## 部署到 Railway（新手友好，分步指南）

1. **创建项目。** 访问 [railway.app](https://railway.app) → *New Project* →
   *Deploy from GitHub repo*，选择本仓库（请先 fork 或推送到你自己的账号）。

2. **添加 PostgreSQL。** 在同一项目中点击 *+ New* → *Database* → *Add PostgreSQL*。
   Railway 会创建数据库服务并提供 `DATABASE_URL` 变量。

3. **将变量关联到你的应用。** 打开你的应用服务 → *Variables* → 添加变量引用（variable reference）：
   命名为 `DATABASE_URL`，并选择 Postgres 提供的 `DATABASE_URL`。

4. **添加密钥。** 仍在 *Variables* 中，添加：

   | 变量             | 生成方式                                             |
   | ---------------- | ----------------------------------------------------- |
   | `SESSION_SECRET` | 在本地运行 `openssl rand -hex 32` 并粘贴输出结果       |
   | `ENCRYPTION_KEY` | 再次运行 `openssl rand -hex 32`（使用不同的值）        |

   可选：`SETUP_TOKEN`（用于创建额外管理员的引导令牌）、`CORS_ORIGIN`。

5. **部署。** Railway 会自动识别 Next.js 应用（见 `railway.json`）。构建阶段执行
   `prisma generate && next build`；启动时自动运行 `prisma migrate deploy`，
   并监听 `$PORT` 端口。

6. **打开你的域名。** 在应用服务中 → *Settings* → *Networking* → *Generate Domain*。

7. **验证健康状态。** 访问 `https://<你的域名>/health` — 应看到 `{"ok":true}`。

8. **创建第一个管理员。** 打开 `https://<你的域名>/setup`。由于数据库中还没有用户，
   setup 页面处于开放状态。创建你的管理员 — 凭据永远不会被硬编码。
   初始化完成后，`/setup` 需要环境变量 `SETUP_TOKEN` 才能访问。

9. **完成。** 在 `/login` 登录，开始添加服务器和用户。

### 首次部署检查清单

- [ ] `/health` 返回 `{"ok":true}`
- [ ] `/setup` 已创建管理员并跳转到仪表盘
- [ ] 仪表盘显示真实的零值（尚无用户/服务器）
- [ ] 添加一台服务器 → 点击 **Test connection** → 状态反映的是**真实的 TCP 探测**结果

---

## 本地开发

环境要求：Node 20+、PostgreSQL（任意本地运行的实例）。

```bash
cp .env.example .env          # 然后编辑 DATABASE_URL 和密钥
npm install
npm run db:push               # 或者：npm run db:migrate:dev
npm run dev                   # http://localhost:3000
```

打开 `http://localhost:3000/setup` 创建第一个管理员。

### 脚本命令

| 命令                 | 作用                                            |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | 开发服务器（端口 3000）                          |
| `npm run build`      | 生产环境构建（standalone 输出）                  |
| `npm run start`      | 运行生产服务器（遵循 `$PORT`）                   |
| `npm run lint`       | ESLint                                          |
| `npm test`           | Vitest 单元测试                                  |
| `npm run db:migrate` | 应用迁移（`prisma migrate deploy`）              |
| `npm run db:push`    | 不通过迁移文件直接同步 schema（仅限开发环境）    |

---

## API 概览

所有响应均使用统一的信封（envelope）格式：

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

### 认证与账户
- `POST /api/auth/login` — 邮箱/用户名 + 密码（有限速，记录审计日志）
- `POST /api/auth/logout`
- `POST /api/auth/password` — 修改自己的密码
- `GET /api/me` — 会话用户 + 未读通知数量
- `PATCH /api/me` — 个人资料 + 偏好设置（语言、减少动效）
- `GET|POST /api/setup` — 首个管理员初始化

### 面板数据
- `GET /api/dashboard` — 真实的聚合统计 + 健康状态
- `GET /api/system/health` — 数据库/API/定时任务报告
- `GET|POST /api/users`、`GET|PATCH|DELETE /api/users/:id`
- `GET|POST /api/users/:id/config` — 获取 / 重新生成代理配置
- `GET|POST /api/servers`、`PATCH|DELETE /api/servers/:id`、`POST /api/servers/:id/test`、`POST /api/servers/test-all`
- `GET|POST /api/endpoints`、`PATCH|DELETE /api/endpoints/:id`、`POST /api/endpoints/:id/test`
- `GET|POST /api/ports`、`PATCH|DELETE /api/ports/:id`、`POST /api/ports/:id/test`
- `GET|POST /api/configs`、`DELETE /api/configs/:id`、`GET /api/configs/providers`
- `POST /api/scanner` — 受控的 DNS/TCP/HTTP 诊断（有限速）
- `GET /api/traffic?range=24h|7d|30d|all`
- `GET /api/analytics?range=…`
- `GET /api/logs` — 支持搜索、筛选、分页
- `GET|PATCH /api/notifications`、`POST /api/notifications/read-all`
- `GET|PUT /api/settings`、`POST /api/settings/purge`（管理员）
- `GET|POST /api/api-keys`、`DELETE /api/api-keys/:id`（吊销）
- `GET|POST /api/failover`、`PATCH|DELETE /api/failover/:id`、`POST /api/failover/:id/check`
- `GET /api/search?q=` — 命令面板搜索
- `GET /health` — Railway 健康检查，返回 `{"ok":true}`

### 流量接入（用于真实数据面）

使用具有 `traffic:ingest` 权限的 API 密钥，从 exporter/代理 API 推送用量记录
（在面板的 **API Keys** 中创建密钥）：

```bash
curl -X POST https://<你的域名>/api/traffic/ingest \
  -H "Authorization: Bearer ppk_…" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"vpnUserId":"…","bytesIn":1048576,"bytesOut":4194304,"requests":42}]}'
```

在真实记录产生之前，流量和分析页面会保持空白 — 这是刻意设计。

---

## 角色

| 角色     | 权限                                                                 |
| -------- | --------------------------------------------------------------------- |
| ADMIN    | 一切权限，包括设置、API 密钥、审计日志、危险区域                      |
| OPERATOR | 管理用户/服务器/端点/端口/配置/扫描器/故障切换                        |
| VIEWER   | 只读 — 仪表盘和列表                                                   |

权限检查在后端执行（`src/lib/rbac.ts` + 路由守卫），UI 仅作镜像展示。

## 安全说明

- 密码：scrypt 加每用户独立盐值，恒定时间（constant-time）校验。
- 会话：256 位随机令牌，仅存储 SHA-256 哈希；HttpOnly + SameSite Cookie；
  生产环境启用 `Secure`；数据库侧过期控制 + 清理任务。
- CSRF：变更类 API 请求要求同源（same-origin）；Cookie 为 SameSite=Lax。
- API 密钥：以 SHA-256 哈希存储；完整密钥只显示一次。
- 速率限制：登录（per-IP + per-identifier）、扫描器、健康测试、流量接入、通用 API。
- 结构化日志并自动脱敏机密信息。堆栈跟踪不会暴露给客户端。
- 安全响应头：`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`。

## 后台任务

一个 60 秒调度器（从 `instrumentation.ts` 启动）负责执行：
健康检查（间隔可配置）、到期扫描 + 到期提醒通知、
会话清理、故障切换规则评估。各任务间隔有界且状态持久化，
因此重启后不会重复执行。仪表盘会如实报告任务的新鲜度
（`Healthy / Degraded / Not configured`）。
