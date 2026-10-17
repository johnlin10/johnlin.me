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

## 六、平常可以先做的

- 每半年照第二節在本機跑一次 standalone，確認新加的功能沒有偷偷綁上 Vercel。
- 金鑰外洩比平台倒閉更急。README 的環境變數表就是輪替清單：Supabase anon key 本來就公開，不用換；R2 兩把、`R2_REST_API_TOKEN`、`AI_GATEWAY_API_KEY` 要到各自的後台換新。
