# 自架備案

Vercel 出事時的後路：把網站搬到一台自己租的 Linux 主機（VPS）。現在不搬，這份只記「確定搬得走」和「真的要搬時照著做」。2026-10-17 寫，起因是 Zeabur 兩次被入侵後停止營運。

---

## 一、為什麼搬得走

要搬的只有「跑 Next.js 的那台機器」，資料都不在 Vercel：

| 東西 | 在哪裡 | 搬家時 |
|---|---|---|
| 文章、短文、工具資料、登入 | Supabase | 不動 |
| 照片 | Cloudflare R2（`img.johnlin.me`） | 不動 |
| DNS | Cloudflare | 改 A 紀錄指到新主機 |
| 程式碼 | GitHub | 不動 |
| 網站執行 | Vercel（東京 `hnd1`） | **搬這個** |

綁 Vercel 的只有三樣：

- `@vercel/analytics`、`@vercel/speed-insights`（`app/layout.tsx`）：離開 Vercel 後腳本 404，不影響網站，搬時拿掉，要統計就換 Cloudflare Web Analytics。
- `AI_GATEWAY_API_KEY`：AI Gateway 是 Vercel 的服務。Vercel 只是不再當主機時照樣能用；Vercel 整個不能用時，studio 的 AI 功能要改成直接接供應商（`AI_MODEL` 在 `app/lib/ai/prompts.ts`）。
- `vercel.json`：只設了區域，自架用不到。

其他都是 Next.js 本身的功能，`next start` 就有：`proxy.ts` 的子網域分流與登入守門、`revalidateTag` 和 `unstable_cache` 的快取、`next/image` 的縮圖、sharp 產生照片衍生圖、OG 圖。

---

## 二、2026-10-17 實測

在本機用 `NEXT_OUTPUT=standalone npm run build` 打包，`node server.js` 跑在 3100 埠，連正式 Supabase 和 R2，只讀不寫。

| 項目 | 結果 |
|---|---|
| 首頁、Blog、短文、攝影、About（含單篇） | 200，About 段落數跟正式站一樣（`outputFileTracingIncludes` 有生效） |
| 快取 | 第二次請求 `x-nextjs-cache: HIT`，單篇文章從 0.5 秒降到 0.002 秒 |
| `studio.*`、`tools.*` | 未登入一律導向 `/login`，登入頁 200 |
| 主站 `/studio`、`/tools` | 404 |
| `go.*` 不存在的代碼 | 404（有查到資料庫） |
| `/api/admin/*` 未登入 | 401 |
| `next/image` 縮 Supabase 圖片 | 200 `image/webp` |
| RSS、sitemap、manifest | 200 |
| 瀏覽器開攝影牆 | 照片正常載入；console 只有 Vercel 統計腳本 404 |

沒測到的：登入後的操作（會寫正式資料庫）、照片上傳後的 sharp 處理、Docker 打包（本機沒裝）。這幾樣真的搬時在新主機上測。

---

## 三、要準備的東西

- **主機**：東京或跟 Supabase 同區的 VPS，2 GB 記憶體以上（`next build` 吃記憶體，1 GB 容易被砍），Ubuntu 24.04。Hetzner、Vultr、Linode 都有，大約 US$5–10／月。
- **金鑰**：照 README 的環境變數表抄一份 `.env`。`NEXT_PUBLIC_*` 會在 build 時寫進前端，所以 build 前就要放好。

不用動的：Supabase 的登入轉址網址（網域沒變）、登入 cookie（還是 `.johnlin.me`）、R2 的 CORS（網域沒變）。

---

## 四、搬家步驟

不用 Docker，也不用 Coolify 這類面板，直接在主機上 build、跑。整套就是 Node、Caddy（自動處理 HTTPS）和 systemd（當機自動重啟）。

### 1. 裝環境

```bash
sudo apt update && sudo apt install -y git caddy
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
git clone https://github.com/<帳號>/johnlin.me.git ~/johnlin.me
```

把 `.env` 放到 `~/johnlin.me/.env`。

### 2. 打包

```bash
cd ~/johnlin.me && npm ci && NEXT_OUTPUT=standalone npm run build
cp -R .next/static .next/standalone/.next/static && cp -R public/. .next/standalone/public/
```

一定要在主機上 build：sharp 帶的是作業系統專用的檔案，Mac 上打的包到 Linux 不能用。standalone 會把 `.env` 一起複製進去，這台主機自己用沒問題，但不要把這個資料夾傳到別的地方。

### 3. 常駐

`/etc/systemd/system/johnlin.service`：

```ini
[Service]
WorkingDirectory=/home/ubuntu/johnlin.me/.next/standalone
ExecStart=/usr/bin/node server.js
Environment=PORT=3000 HOSTNAME=127.0.0.1
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now johnlin
```

### 4. HTTPS 和子網域

`/etc/caddy/Caddyfile`，四個網域都交給同一個 Next，Caddy 會保留 Host 標頭，`proxy.ts` 照舊分流：

```txt
johnlin.me, studio.johnlin.me, tools.johnlin.me, go.johnlin.me {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}

www.johnlin.me {
  redir https://johnlin.me{uri} permanent
}
```

`www` 現在是 Vercel 幫忙導回主網域，搬走後改由 Caddy 做。

```bash
sudo systemctl reload caddy
```

### 5. 切 DNS

先在本機改 `/etc/hosts` 把四個網域指到新主機 IP，確認都正常（這時才測登入、上傳照片）。沒問題再到 Cloudflare 把四筆紀錄加上 `www` 改成新主機的 A 紀錄，先用「僅 DNS」（灰雲），讓 Caddy 順利拿到憑證；穩定後可以開橘雲，換到 Cloudflare 的 CDN 和防 DDoS，SSL 模式設 Full (strict)。

### 6. 之後更新

```bash
cd ~/johnlin.me && git pull && npm ci && NEXT_OUTPUT=standalone npm run build \
  && cp -R .next/static .next/standalone/.next/static && cp -R public/. .next/standalone/public/ \
  && sudo systemctl restart johnlin
```

build 期間舊版還在跑，重啟那幾秒會斷線。個人站可以接受；不想斷再考慮兩份輪替。

---

## 五、跟 Vercel 不一樣的地方

| | Vercel | 自架 |
|---|---|---|
| 快取放哪 | 全球 CDN | 這台主機的硬碟（`.next/cache`），開橘雲後 Cloudflare 會快取靜態檔 |
| 預覽部署 | 每個 PR 都有 | 沒有 |
| 回滾 | 點一下 | `git checkout` 上一版再 build |
| 系統更新、資安修補 | 不用管 | 要自己 `apt upgrade`，建議開 `unattended-upgrades` |
| 主機掛了 | 自動換機器 | 網站就掛了，要自己修 |

只有一台主機，所以 Next 的「多台共用快取」「Server Action 加密金鑰」那些設定都不用管。

---

## 六、Supabase 備份

Vercel 上沒有獨一無二的東西，程式碼都在 GitHub；Supabase 上的資料卻只有那一份。免費方案沒有自己能下載的備份，posts 這些舊表的結構也還沒進 `supabase/migrations/`，所以每週備份一次。

- **做法**：`.github/workflows/backup-supabase.yml` 每週日 03:00（台灣時間）跑 `supabase db dump`，匯出 `roles`、`schema`、`data` 三份，壓縮後放到 R2 的 `johnlin-backups/supabase/YYYY-MM-DD/`。這個 bucket 不公開。
- **大小**：2026-10 資料庫 14 MB，壓縮後每週幾 MB，R2 免費額度 10 GB，不用設自動刪除。
- **沒備到的**：Storage 裡文章和短文的圖片（`blog`、`notes` 兩個 bucket，18 個檔、141 MB），照片在 R2 不受影響。
- **失敗通知**：排程失敗 GitHub 會寄信。公開 repo 連續 60 天沒有新 commit，排程會被自動停用。

### 第一次設定

1. Cloudflare → R2 → Manage API tokens → 建一把 token，權限 Object Read & Write，只勾 `johnlin-backups`。不要拿網站上傳照片用的那把，備份外洩時才不會連照片 bucket 一起賠進去。
2. Supabase → Connect → Session pooler，複製 URI，把 `[YOUR-PASSWORD]` 換成資料庫密碼。忘了就到 Database Settings 重設，網站用的是 anon key，不受影響。
3. 在專案根目錄設 GitHub secrets（會提示貼上，值不會留在終端機紀錄）：

```bash
gh secret set SUPABASE_DB_URL
gh secret set R2_BACKUP_ACCESS_KEY_ID
gh secret set R2_BACKUP_SECRET_ACCESS_KEY
grep '^R2_S3_ENDPOINT=' .env | cut -d= -f2- | gh secret set R2_S3_ENDPOINT
```

4. push 之後手動跑一次：`gh workflow run backup-supabase.yml`，再到 Actions 看結果，最後一步會列出上傳的三個檔案。

### 還原

到 R2 下載某一週的三個檔、解壓縮，還原到新的 Supabase 專案或自架 Supabase：

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<新資料庫的連線字串>"
```

還原後還要自己做：Google 登入的設定和轉址網址、新的 anon key 換進 `.env`、Storage 的圖片另外搬。自架 Supabase 預設是 Postgres 15，備份來自 17，`data.sql` 裡的 `SET transaction_timeout` 要先註解掉。細節看 Supabase 官方的 [Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)。

---

## 七、平常可以先做的

- 每半年照第二節在本機跑一次 standalone，確認新加的功能沒有偷偷綁上 Vercel。
- 金鑰外洩比平台倒閉更急。README 的環境變數表就是輪替清單：Supabase anon key 本來就公開，不用換；R2 兩把、`R2_REST_API_TOKEN`、`AI_GATEWAY_API_KEY` 要到各自的後台換新。
