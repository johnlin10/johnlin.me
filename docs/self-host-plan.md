# 平台出事的備案

起因是 Zeabur 兩次被入侵後停止營運（2026-10）。這份記三件事：每個平台倒了會怎樣、Vercel 倒了怎麼搬到自己的主機、Supabase 倒了怎麼還原。現在不搬，只確保真的要搬時照著做就能動。

---

## 一、每個平台倒了會怎樣

| 平台 | 放什麼 | 倒了會怎樣 | 準備好的 |
|---|---|---|---|
| Vercel | 跑網站 | 網站打不開，資料都還在 | 第三節，照做大約半天 |
| Supabase | 文章、短文、工具資料、登入 | 網站沒有內容，也登不進去 | 每週備份到 R2（第五節） |
| Cloudflare | DNS、R2（照片、文章與短文圖片、資料庫備份）、`www` 轉址 | 網域解析不到，圖片全沒；資料庫備份也在這裡 | **沒有第二份** |
| GitHub | 程式碼、跑備份排程 | 備份停了 | 程式碼在本機也有一份 |
| AI Gateway | studio 的 AI 功能 | 只有 AI 功能壞 | 第四節，改一行 |

Vercel 反而是最好換的：上面沒有獨一無二的東西。真正集中風險的是 Cloudflare 帳號，照片原檔和資料庫備份都只放在那裡。要不要另外存一份，見第七節。

---

## 二、為什麼搬得走

綁 Vercel 的地方都已經處理掉，搬家不用改程式碼：

- `@vercel/analytics`、`@vercel/speed-insights`：只在 Vercel 上載入（`app/layout.tsx` 看 `VERCEL` 變數）。自架後要統計，就開 Cloudflare Web Analytics。
- 短網址點擊的國家：Vercel 給 `x-vercel-ip-country`，自架改讀 Cloudflare 的 `cf-ipcountry`（`proxy.ts`）。DNS 是灰雲時兩個都沒有，國家欄留空。
- `www` → 主網域的轉址：本來就是 Cloudflare 在做，不在 Vercel。
- `vercel.json`：只設區域，自架用不到。
- 登入回呼用相對路徑轉址，不受主機名稱影響。

其他都是 Next.js 本身就有的功能：`proxy.ts` 的子網域分流與登入守門、`revalidateTag` 和 ISR 快取、`next/image`、sharp 產生衍生圖、OG 圖。

### 實測

在本機跑 `NEXT_OUTPUT=standalone npm run build`，照部署腳本的方式複製成一個版本資料夾，用 `node server.js` 跑起來。請求模擬 Caddy 轉進來的樣子（保留 Host，帶 `X-Forwarded-Proto: https`），連正式的 Supabase 和 R2，只讀不寫。

| 項目 | 結果 |
|---|---|
| 首頁、Blog、短文、攝影、About | 200，第二次起 `x-nextjs-cache: HIT` |
| `/zh-tw/blog`、`/gallery` | 307 → `/blog`、308 → `/photography` |
| `hreflang` 標頭 | `https://johnlin.me/...`，跟正式站一樣 |
| 主站 `/studio` | 404 |
| `studio.*`、`tools.*` | 未登入 307 → `/login`，登入頁 200 |
| `go.*` | 不存在的代碼 404，根目錄轉回主站 |
| `/api/admin/*` 未登入 | 401 |
| RSS、sitemap | 200 |

**一定要設 `HOSTNAME=localhost`。** 設成 `127.0.0.1` 時，主站每一頁和登入頁都會 500：Next 會把 `proxy.ts` 的 rewrite 當成外部網址轉發給自己。不設的話雖然正常，但會聽 `0.0.0.0`，外面能繞過 Caddy 直連。

沒測到的有三項，都要等到新主機上才能測：登入後的操作（會寫正式資料庫）、上傳圖片後的 sharp 處理、Linux 上的 build。

---

## 三、搬家步驟

整套只有 Node、Caddy（自動處理 HTTPS）和 systemd（當機自動重啟），不用 Docker 或 Coolify 這類面板。

### 0. 準備

- **主機**：東京的 VPS，2 GB 記憶體以上，Ubuntu 24.04。Hetzner、Vultr、Linode 都有，每月大約 US$5–10。
- **`.env`**：從本機複製一份。`NEXT_PUBLIC_*` 會在 build 時寫進前端，所以要在 build 前放好。
- **現在的 DNS**，切回 Vercel 時用：

| 紀錄 | 現在指向 |
|---|---|
| `johnlin.me` | A `216.198.79.1` |
| `studio`、`tools`、`go` | CNAME `3d32edf232d0be4b.vercel-dns-017.com` |
| `www` | 橘雲，Cloudflare 轉址，不用動 |

以下指令都假設使用者是 `ubuntu`。

### 1. 開機後的基本設定

```bash
sudo apt update && sudo apt install -y git caddy ufw unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
```

swap 是給 `next build` 用的，2 GB 記憶體 build 到一半偶爾會被系統砍掉。

### 2. 程式碼與金鑰

```bash
git clone https://github.com/johnlin10/johnlin.me.git ~/johnlin.me
```

把 `.env` 放到 `~/johnlin.me/.env`。build 會把它複製進每一版的資料夾，伺服器從那裡讀。

### 3. 常駐服務

`/etc/systemd/system/johnlin.service`：

```ini
[Unit]
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/current
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production PORT=3000 HOSTNAME=localhost
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable johnlin
```

### 4. 第一次部署

```bash
~/johnlin.me/scripts/self-host-deploy.sh
```

腳本會拉最新的 main、build，複製成 `~/releases/<時間>-<commit>/`，讓 `~/current` 指過去，再重啟服務。最多留五版。一定要在主機上 build：sharp 帶的是作業系統專用的檔案，Mac 打的包到 Linux 跑不了。

```bash
curl -sI -H 'Host: johnlin.me' http://localhost:3000/ | head -1
```

回 `HTTP/1.1 200 OK` 就是活著。

### 5. HTTPS 和子網域

`/etc/caddy/Caddyfile`：

```txt
johnlin.me, studio.johnlin.me, tools.johnlin.me, go.johnlin.me {
  tls internal
  encode zstd gzip
  reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

四個網域交給同一個 Next，Caddy 保留 Host 標頭，`proxy.ts` 照舊分流。`tls internal` 是自簽憑證，只在切 DNS 前測試用。

### 6. 切 DNS 前先測

在自己電腦的 `/etc/hosts` 加一行，讓這台電腦先連到新主機：

```txt
<新主機 IP> johnlin.me studio.johnlin.me tools.johnlin.me go.johnlin.me
```

瀏覽器會警告憑證不受信任，略過後逐項檢查：

- [ ] 首頁、一篇文章、攝影牆、About
- [ ] 英文版 `/en`
- [ ] studio 用 Google 登入
- [ ] 在 studio 開一篇測試草稿，上傳一張封面，確認 R2 有四級圖片，然後刪掉草稿
- [ ] tools 打得開
- [ ] 一個真的短網址會轉址

測完把 `/etc/hosts` 那行刪掉。

### 7. 切 DNS

1. 到 Cloudflare 把 `johnlin.me` 的 A 紀錄改成新主機 IP；把 `studio`、`tools`、`go` 刪掉 CNAME，改成 A 紀錄指向同一個 IP。全部用灰雲（僅 DNS）。
2. 刪掉 Caddyfile 裡的 `tls internal`，`sudo systemctl reload caddy`。Caddy 會自動去 Let's Encrypt 申請憑證，大約一分鐘內完成。
3. 不用登入的無痕視窗再看一次首頁和 studio 登入頁。

**Vercel 專案先別刪。** 新主機出問題時，把 DNS 改回第 0 步的表就切回去了。穩定跑一兩週再暫停 Vercel 專案。

### 8. 收尾

- 監控：到 UptimeRobot 之類的免費服務設一個檢查 `https://johnlin.me` 的監控。網站掛了 Vercel 會自己換機器，自架只能靠它寄信通知。
- 系統更新：第 1 步裝的 `unattended-upgrades` 會自動上資安修補。Node 大版本升級要自己來。

---

## 四、之後的維護

| 要做的事 | 指令 |
|---|---|
| 更新網站 | `~/johnlin.me/scripts/self-host-deploy.sh` |
| 切回上一版 | `~/johnlin.me/scripts/self-host-deploy.sh rollback` |
| 看錯誤 | `journalctl -u johnlin -n 100` |
| 改 `.env` | 改 `~/johnlin.me/.env` 後重新部署：每一版的 `.env` 是部署時複製進去的 |

build 期間舊版照常服務，只有重啟那幾秒會斷線。

### 跟 Vercel 不一樣的地方

| | Vercel | 自架 |
|---|---|---|
| 快取 | 全球 CDN | 這台主機的硬碟，每次部署從空的開始 |
| 預覽部署 | 每個 PR 都有 | 沒有 |
| 回滾 | 點一下 | `rollback`，只能退回還留著的五版 |
| 主機掛了 | 自動換機器 | 網站就掛了，要自己修 |
| 部署 | push 就自動部署 | 要上主機跑腳本 |

只有一台主機，所以 Next 的「多台共用快取」「Server Action 加密金鑰」那些設定都不用管。

### Vercel 整個消失時：AI 功能

AI Gateway 是 Vercel 的服務。Vercel 只是不再當主機時，照樣能用；Vercel 整個不能用時，改成直接接 Google：

```bash
npm i @ai-sdk/google
```

`app/lib/ai/prompts.ts` 的 `AI_MODEL` 改成 `google('gemini-3.5-flash-lite')`（從 `@ai-sdk/google` 匯入），`.env` 換成 `GOOGLE_GENERATIVE_AI_API_KEY`。

---

## 五、Supabase 備份

Supabase 上的資料只有那一份。免費方案沒有能自己下載的備份，posts 這些舊表的結構也還沒進 `supabase/migrations/`，所以每週備份一次。

- **做法**：`.github/workflows/backup-supabase.yml` 每週日 03:00（台灣時間）跑 `supabase db dump`，匯出 `roles`、`schema`、`data` 三份，壓縮後放到 R2 的 `johnlin-backups/supabase/YYYY-MM-DD/`。這個 bucket 不公開。
- **大小**：2026-10 資料庫 14 MB，壓縮後每週幾 MB，R2 免費額度 10 GB，不用設自動刪除。
- **不用備的**：圖片都在 R2，不在 Supabase（v1.21.14 搬完）。
- **失敗通知**：排程失敗 GitHub 會寄信。公開 repo 連續 60 天沒有新 commit，排程會被自動停用。

### 第一次設定（已完成）

1. Cloudflare → R2 → Manage API tokens → 建一把 token，權限 Object Read & Write，只勾 `johnlin-backups`。不要拿網站上傳圖片用的那把，備份外洩時才不會連圖片 bucket 一起賠進去。
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

到 R2 下載某一週的三個檔並解壓縮，還原到新的 Supabase 專案或自架的 Supabase：

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<新資料庫的連線字串>"
```

還原後還要自己做這些：

- 設定 Google 登入和轉址網址。
- 把新的網址和 anon key 換進 `.env`，然後重新部署。`NEXT_PUBLIC_*` 是 build 時寫死的。
- 自架 Supabase 預設是 Postgres 15，備份來自 17，`data.sql` 裡的 `SET transaction_timeout` 要先註解掉。

細節看 Supabase 官方的 [Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)。

---

## 六、平常可以先做的

- **每半年演練一次**：在本機跑 `NEXT_OUTPUT=standalone npm run build`，把 `.next/standalone` 連同 `.next/static`、`public/` 照腳本的方式複製出去，用 `HOSTNAME=localhost PORT=3100 node server.js` 跑起來，再用 curl 帶 `Host` 和 `X-Forwarded-Proto: https` 打第二節那張表的網址。目的是確認新加的功能沒有偷偷綁上 Vercel。
- **金鑰外洩比平台倒閉更急**：README 的環境變數表就是輪替清單。Supabase anon key 本來就公開，不用換；R2 兩把、`R2_REST_API_TOKEN`、`AI_GATEWAY_API_KEY` 要到各自的後台換新。

---

## 七、還沒處理的

- **R2 沒有第二份**：照片原檔、文章與短文圖片、資料庫備份都在同一個 Cloudflare 帳號。帳號被盜或被停用，這些會一起不見。要補的話，選項是定期把 R2 同步到另一家（例如 Backblaze B2）或自己的硬碟。
- **網域也在 Cloudflare**：`johnlin.me` 是在 Cloudflare 註冊的，DNS 也在那裡。帳號拿不回來就連網域都動不了，其他備案都救不了這點。顧好這個帳號：開兩步驟驗證、存好備用碼。要更保險，可以把網域轉到別家註冊商，DNS 留在 Cloudflare。
