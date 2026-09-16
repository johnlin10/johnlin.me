# johnlin.me

個人網站，包含部落格、短文、攝影作品集、自建後台 CMS，以及私人工具（課表、短網址、完善就學排程）。

- 網址：<https://johnlin.me>
- 子網域：`admin.johnlin.me`（後台）、`tools.johnlin.me`（私人工具）、`go.johnlin.me`（短網址）
- 語系：繁體中文（預設，網址不帶前綴）／英文（`/en/...`）
- 部署：Vercel

---

## 目錄

- [技術棧](#技術棧)
- [功能總覽](#功能總覽)
- [架構](#架構)
- [開發](#開發)
- [專案結構](#專案結構)
- [延伸文件](#延伸文件)
- [授權](#授權)

---

## 技術棧

| 分類         | 使用                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| 框架         | Next.js 16（App Router）、React 19、TypeScript 5                                   |
| 樣式         | Sass/SCSS Modules（三層 token 架構）、Tailwind CSS 4（少量使用）                   |
| 資料庫／認證 | Supabase：Postgres + Auth（Google OAuth）+ Storage，`@supabase/ssr` cookie session |
| 物件儲存     | Cloudflare R2（攝影原檔與衍生圖，公開網域 `img.johnlin.me`）                       |
| 編輯器       | Tiptap 3                                                                           |
| AI           | Vercel AI SDK + AI Gateway（後台欄位輔助）                                         |
| i18n         | next-intl 4（`localePrefix: 'as-needed'`）                                         |
| 影像處理     | sharp（伺服器端衍生圖）、exifr（瀏覽器端 EXIF 解析）                               |
| 其他         | Motion（動效）、KaTeX（數學式）、next-themes（主題切換）                           |

---

## 功能總覽

### 前台

| 路由                             | 說明                                                                                                  | 關鍵實作                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/`                              | 首頁。Hero、自介、精選作品、最新文章、攝影入口                                                        | ISR 300s；Hero 的程式碼視窗於執行期以 `fs.readFile` 讀取自身元件原始碼                                                     |
| `/blog`                          | 文章列表                                                                                              | `getPublishedPosts()`，單頁 30 篇                                                                                          |
| `/blog/[slug]`                   | 文章內頁。雙語內容獨立撰寫，缺英文版時退回中文並提示                                                  | Tiptap 產出的 HTML 直接注入；目錄於儲存時預先計算，前台以 `IntersectionObserver` 高亮；KaTeX 補渲染；瀏覽數走 Postgres RPC |
| `/notes` `/notes/[id]`           | 短文動態牆。純文字加最多數張圖，無標題／草稿／分類                                                    | 與文章完全獨立的資料流；原生 `<img>` 圖片網格 + 自製燈箱                                                                   |
| `/photography`                       | 攝影。預設為可拖曳縮放的照片牆，可切換齊行清單（偏好存 localStorage）；SSR／無 JS／爬蟲取得簡化清單 | 視窗虛擬化 + 遠景 LOD；`<img srcSet>` 直連 R2 的 8 階 WebP，繞過 Vercel 圖片最佳化                                         |
| `/photography/[slug]`                | 單張作品頁。拍攝時間、相機鏡頭、地點、HDR                                                             | ISR + `generateStaticParams`；LCP 圖以 `fetchPriority="high"` 載入，聚焦時載原檔                                           |
| `/about`                         | 分章節自介，切章節不換網址                                                                            | `content/about/<slug>.<locale>.md` + react-markdown                                                                        |
| `/lab/design`                    | 設計系統活頁，即時渲染 CSS 變數為色票／間距／字級，可點擊複製                                         | `getComputedStyle` 解析實際計算值                                                                                          |
| `/tutoring/[token]`              | 完善就學的公開唯讀頁，給一起參加的同學看。週時間軸、疊課表比對、這週時段列表與該月時數；只能翻前後一個月 | 不登入，資料走 SECURITY DEFINER 函式 `get_tutoring_board`，token 不對或連結關閉回 404；`noindex`、不帶 Referer，不套主站 Header／Footer |
| `/rss/blog.xml` `/rss/notes.xml` | 兩支獨立 RSS feed                                                                                     | `force-dynamic`，目前僅中文版                                                                                              |

### 後台（`admin.johnlin.me`，需管理員身分）

後台放在獨立子網域，可單獨安裝成 PWA（John Lin Dashboard）。程式碼在 `app/[locale]/admin/`，由 proxy 依 Host 對應過去；主站的 `/admin` 一律回 404。雙語規則與主站相同（中文無前綴、英文 `/en`）。

| 路由                                  | 說明                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | 儀表板，文章與短文的數量統計                                                                                                                                         |
| `/posts`                              | 文章 CRUD。Tiptap 編輯器；草稿階段自動存檔（1.2s debounce／8s 上限），發布後改為手動更新；離開未編輯過的空草稿會自動刪除                                             |
| `/photos`                             | 依年份分段的縮圖牆 + 檢閱欄，支援鍵盤巡覽與批次操作；欄位自動存檔                                                                                                    |
| `/photos/upload`                      | 上傳預檢。瀏覽器端解 EXIF 並產生 slug，確認後才上傳；原檔以 presigned PUT 直傳 R2（避開函式 4.5 MB body 上限），再由 ingest 端點以 sharp 產出各尺寸、OG 圖與模糊佔位 |
| `/notes`                              | 短文發布與刪除                                                                                                                                                       |
| `/categories` `/tags` `/series`       | 分類／標籤／系列管理（系列前台頁面尚未實作）                                                                                                                         |
| `/login`                              | Google OAuth 單一登入方式                                                                                                                                            |

後台使用自行實作的元件庫（`Button`／`Input`／`Modal`／`ConfirmDialog`／`Toast`／`DataTable` 等），未引入外部 UI 套件；tools 子網域共用同一套元件與外殼。

本機開發用 Chrome 開 `http://admin.localhost:3000`（Safari 不一定解析得到 `*.localhost`）。

### 工具（`tools.johnlin.me`，需管理員身分）

私人工具箱，編輯與顯示在同一頁，不經過後台。沿用後台的外殼、側邊欄與 Google 登入，可單獨安裝成 PWA（John Lin Tools）。程式碼在 `app/[locale]/tools/`，分流與守衛規則同後台；主站的 `/tools` 一律回 404。

| 路由            | 說明                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | 工具總覽                                                                                                                                     |
| `/schedule`     | 週課表，依成員與學期切換，每個人一份課表，課程與老師跨人共用。點空格新增時段、點課程編輯，同一天節次重疊會擋下；可整份複製別人的課表。學期有起訖日期，課程有 15 種預設顏色與選填學分 |
| `/tutoring`     | 完善就學排程。月份與週次切換、週一到週五的時間軸，點空白新增輔導時段（任意開始時間、1–8 小時每 0.5 一階）；存檔前檢查週末、參與者與老師的課、重複排程。疊一個人的課表找空檔，下方是每人該月時數（受 40 小時上限的三個方案合計、證照輔導另計）。管理區放成員、課表以外的忙碌時間與公開連結 |
| `/links`        | 短網址管理。沒填 slug 時自動產生 6 碼（避開 l／o／0／1），建立後自動複製；列出總點擊與近 7 天點擊                                           |
| `/links/[slug]` | 單一短網址統計：總計／30 天／7 天點擊、90 天每日長條圖、來源網域與國家排行                                                                  |
| `/login`        | 與後台相同的 Google 登入                                                                                                                     |

週課表的網格是獨立元件 `app/components/schedule/ScheduleGrid`，之後主站要展示課表時直接沿用。完善就學的時間軸是 `WeekTimeline`，時間軸、比對與時數表整組是 `TutoringBoard`，編輯頁與公開頁共用；課表的節次經 `app/lib/schedule/periods.ts` 換算成時間（目前仍是暫定節次時間）。方案名稱學校沒有官方英文，英文介面也用中文。

本機開發開 `http://tools.localhost:3000`。

### 短網址（`go.johnlin.me`）

`go.johnlin.me/<slug>` 由 proxy 直接處理，不進 App Router：呼叫 `resolve_short_link` 查目標並記一筆點擊，查到就 307 轉址（不用 301，改了目標網址馬上生效），查不到回簡單的 404 頁，根路徑轉回主站。slug 不分大小寫。

連結預覽爬蟲與 HEAD 請求照轉但不計點擊；點擊只記來源網域與國家（`x-vercel-ip-country`），不存完整 referrer、IP 或 user agent。

本機開發開 `http://go.localhost:3000/<slug>`。

### AI 輔助

`POST /api/admin/ai` 僅支援四種任務：slug 建議、摘要、封面圖 alt 文字（多模態）、SEO 關鍵字。以 Zod discriminated union 驗證輸入，經 AI Gateway 呼叫模型。欄位為空時直接套用，已有內容時顯示建議卡片供確認，不會覆寫既有內容。

---

## 架構

### 請求流程

```txt
Request
 └─ proxy.ts（Next 16 的 middleware）
     ├─ go.* 子網域：rpc('resolve_short_link') → 307 轉址或 404，不進 App Router
     ├─ 主站：next-intl 語系處理；/admin/*、/tools/* 回 404；/tutoring/[token] 照一般頁面處理
     └─ admin.*／tools.* 子網域：next-intl 語系處理 → 改寫到 /[locale]/admin/*、/[locale]/tools/*
         └─ /login 以外 → Supabase getUser() + rpc('is_admin')，未通過導向 /login
 └─ app/[locale]/layout.tsx（字體、i18n provider、主題、Header/Footer）
 └─ page.tsx
```

`/api/**` 不經過 proxy（matcher 明確排除），因此每支後台 API 需自行呼叫 `requireAdmin()`。

### 資料存取

- 三種 Supabase client 分工：`client.ts`（瀏覽器）、`server.ts`（帶 cookie、受 RLS 約束）、`public.ts`（匿名、可進 `unstable_cache`）。
- **無 service-role key。** 所有寫入均使用 anon key 加呼叫者 session，權限由 Postgres RLS 決定。
- 課表、短網址與完善就學的資料表只有管理員能讀寫；訪客只能透過 SECURITY DEFINER 函式存取：`resolve_short_link` 解析已知的 slug，無法列出連結或點擊紀錄；`get_tutoring_board` 要 token 對上已開啟的公開連結才回資料，而且不回時段備註。時薪與身分別不存。
- 媒體分流：文章與短文圖片存 Supabase Storage；攝影作品存 Cloudflare R2，物件 key 使用不可變的 UUID 前綴。

---

## 開發

### 需求

- Node.js 20+
- Supabase 專案與 Cloudflare R2 bucket（本機開發同樣連遠端服務）

### 啟動

```bash
npm install
npm run dev      # predev 會先執行字型子集化
```

### 指令

| 指令                                | 說明                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `npm run dev`                       | 開發伺服器                                             |
| `npm run build`                     | 正式建置                                               |
| `npm run start`                     | 啟動建置後的伺服器                                     |
| `npm run lint` / `npm run lint:fix` | ESLint                                                 |
| `npm run generate:fonts`            | 產生中文字型子集至 `fonts/`；dev 與 build 前會自動執行 |
| `node scripts/generate-og.mjs`      | 重新產生預設 OG 圖                                     |
| `node --test <路徑>.test.mjs`       | 單元測試（課表節次、短網址 slug、完善就學時數與學期判斷）；要給檔案路徑，不能給資料夾，且需 Node 22.18+ 才能直接載入 `.ts` |

### 環境變數

於專案根目錄建立 `.env`：

| 變數                                        | 用途                                                            |
| ------------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                      | RSS 與 canonical URL                                            |
| `NEXT_PUBLIC_SUPABASE_URL`                  | Supabase 專案網址                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Supabase anon key                                               |
| `AI_GATEWAY_API_KEY`                        | AI Gateway 金鑰，由 AI SDK 依慣例讀取                           |
| `R2_BUCKET`                                 | R2 bucket 名稱                                                  |
| `R2_S3_ENDPOINT`                            | R2 的 S3 相容端點                                               |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 憑證                                                         |
| `NEXT_PUBLIC_R2_PUBLIC_BASE`                | R2 公開存取網域                                                 |
| `R2_KEY_PREFIX`                             | 選用。為物件 key 加上命名空間；本機設定會一併影響實際上傳的照片 |

### 資料庫

`supabase/migrations/` 目前涵蓋攝影、文章每日瀏覽數、課表、短網址與完善就學的資料表；文章等較早建立的資料表與 RPC 函式尚未納入版控，詳見 [`supabase/README.md`](supabase/README.md)。套用方式為手動執行 SQL，未接 Supabase CLI 流程。

---

## 專案結構

```txt
app/
  [locale]/          # 前台頁面、tutoring/ 完善就學公開頁、admin/ 後台（admin.johnlin.me）、tools/ 工具（tools.johnlin.me）
  api/               # /api/admin/ai、/api/admin/photos/*、/api/views
  components/        # 依區塊分組：home / blog / gallery / notes / admin / schedule
  lib/               # supabase / r2 / blog / notes / photos / images / ai / schedule / shortLinks / tutoring …
  styles/            # 設計系統 token：_tokens / _theme / _mixins / _breakpoints
  rss/               # blog.xml、notes.xml
content/about/       # 關於頁 Markdown（<slug>.<locale>.md）
docs/                # 藍圖與設計系統文件
i18n/ messages/      # next-intl 設定與翻譯字串
proxy.ts             # 語系處理、子網域分流與守衛、go 短網址轉址
supabase/migrations/ # SQL schema
scripts/             # 字型子集化、OG 圖產生
```

---

## 延伸文件

| 文件                                             | 內容                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| [`docs/blueprint.md`](docs/blueprint.md)         | 路由地圖、資料層、認證流程、已知落差與待辦。修改程式前建議先讀 |
| [`docs/design-system.md`](docs/design-system.md) | 設計原則與 token 規範；活頁版見 `/lab/design`                  |
| [`docs/tools-plan.md`](docs/tools-plan.md)       | tools 子網域、課表與短網址的規劃與決策                         |
| [`docs/tutoring-plan.md`](docs/tutoring-plan.md) | 完善就學排程與公開頁的規劃、資料表設計與隱私考量               |
| [`supabase/README.md`](supabase/README.md)       | migration 慣例與套用方式                                       |

上述文件會隨程式演進而過期，每輪較大的改動後請一併更新。

---

## 授權

程式碼採 MIT 授權，見 [LICENSE](LICENSE)。網站的文章、照片與設計內容不在授權範圍內。
