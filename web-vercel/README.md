# 审美日课 · Vercel 部署版

这是从 `web/`（Netlify 版）迁移过来的 Vercel 部署版本，**功能完全一致**。
原 `web/` 文件夹一行未动，仍然可以在 Netlify 用。

## 与 `web/` 的差异

| | `web/`（Netlify） | `web-vercel/`（Vercel） |
|---|---|---|
| 函数目录 | `netlify/functions/*.ts` | `api/*.ts` |
| 共享 lib | `netlify/lib/*.ts` | `lib/*.ts` |
| 部署配置 | `netlify.toml` | `vercel.json` |
| 函数 runtime | Netlify Functions（Web Fetch） | Vercel Edge（Web Fetch） |
| 函数定时 | 每个函数文件里 `export const config = { schedule }` | `vercel.json` 的 `crons` 数组 |
| 前端 fetch 路径 | `/api/X`（靠 `netlify.toml` 重写到 functions） | `/api/X`（Vercel 直接映射到 `api/X.ts`） |

所有 4 个函数的逻辑、prompt、wiki 解析策略**完全一致**。

## 部署步骤

### 1. 在 Vercel 导入项目

- vercel.com → Add New Project → Import 你的 GitHub repo
- **Root Directory** 一定要设成 `web-vercel`（不是仓库根，也不是 `web`）
- Framework Preset 会自动识别为 Vite
- Build Command / Output Directory 都不用改（`vercel.json` 里已声明）

### 2. 配 Environment Variables

在 Vercel 项目 Settings → Environment Variables 加这几个（值跟原 Netlify 站完全一样）：

| 变量 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 项目 URL（前端 + 函数共用） |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key（前端用） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role（函数用，跳 RLS） |
| `DEEPSEEK_API_KEY` | DeepSeek API key（curator-draft / daily-curator / extend-seed 用） |
| `ADMIN_EMAIL` | 你的登录邮箱（编辑全局作品看点权限） |

三个 Environment 都勾上：Production / Preview / Development。

### 3. 部署

Push 到 main 自动部署，或在 Vercel Dashboard 点 Redeploy。

### 4. 验证

- 打开网站 → 登录 → 看到今日作品
- 在 Functions 页或 Logs 里能看到 `/api/daily-curator`、`/api/extend-seed` 的调用记录
- 手动测试函数：浏览器访问 `https://<your-domain>/api/daily-curator`（GET 会返回 `skipped: already published`）

### 5. 验证 Cron 配置

部署完后 Vercel Dashboard → 项目 → Settings → Cron Jobs 应该能看到：

- `/api/daily-curator` · `0 0 * * *`（每日 00:00 UTC）
- `/api/extend-seed` · `0 2 1 * *`（每月 1 号 02:00 UTC）

**Hobby（免费）计划注意**：免费版只允许每日及更稀疏的 cron（最频繁一天一次）。
我们的两个 cron 一个 daily 一个 monthly，**都符合 Hobby 限额**（共最多 2 个 cron job，也刚好用满）。

### 6. 切流量

部署稳定后：
- 把你的自定义域名指过来（DNS A 记录或 CNAME）
- 原 Netlify 站可以下线（不删，留着备份；下个月计费周期重置后还能继续用作灾备）

## 本地开发

```bash
cd web-vercel
npm install
npm run dev   # 仅前端，连 Supabase 远端
```

如要本地跑函数 + cron，装 Vercel CLI：

```bash
npm i -g vercel
vercel dev      # 在 localhost:3000 同时跑前端 + api/*
```

`vercel dev` 会读 `.env.local`（自己 cp 一份过来）。

## 计费 / 限额

Vercel Hobby（免费）：
- 部署次数无限
- 函数调用 100k/月
- 带宽 100 GB/月
- 函数执行时间 100h/月
- Cron 2 个、最频繁 daily

10 个朋友规模的日常使用稳态 **远低于免费上限**。
