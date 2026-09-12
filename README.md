# johnlin.me

個人網站，包含部落格、短文、攝影作品集與自建後台 CMS。

- 網址：<https://johnlin.me>
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
| `/rss/blog.xml` `/rss/notes.xml` | 兩支獨立 RSS feed                                                                                     | `force-dynamic`，目前僅中文版                                                                                              |

### 後台（`/admin`，需管理員身分）

| 路由                                              | 說明                                                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                          | 儀表板，文章與短文的數量統計                                                                                                                                         |
| `/admin/posts`                                    | 文章 CRUD。Tiptap 編輯器；草稿階段自動存檔（1.2s debounce／8s 上限），發布後改為手動更新；離開未編輯過的空草稿會自動刪除                                             |
| `/admin/photos`                                   | 依年份分段的縮圖牆 + 檢閱欄，支援鍵盤巡覽與批次操作；欄位自動存檔                                                                                                    |
| `/admin/photos/upload`                            | 上傳預檢。瀏覽器端解 EXIF 並產生 slug，確認後才上傳；原檔以 presigned PUT 直傳 R2（避開函式 4.5 MB body 上限），再由 ingest 端點以 sharp 產出各尺寸、OG 圖與模糊佔位 |
| `/admin/notes`                                    | 短文發布與刪除                                                                                                                                                       |
| `/admin/categories` `/admin/tags` `/admin/series` | 分類／標籤／系列管理（系列前台頁面尚未實作）                                                                                                                         |
| `/admin/login`                                    | Google OAuth 單一登入方式                                                                                                                                            |

後台使用自行實作的元件庫（`Button`／`Input`／`Modal`／`ConfirmDialog`／`Toast` 等），未引入外部 UI 套件。

### AI 輔助

`POST /api/admin/ai` 僅支援四種任務：slug 建議、摘要、封面圖 alt 文字（多模態）、SEO 關鍵字。以 Zod discriminated union 驗證輸入，經 AI Gateway 呼叫模型。欄位為空時直接套用，已有內容時顯示建議卡片供確認，不會覆寫既有內容。

---

## 架構

### 請求流程

```txt
Request
 └─ proxy.ts（Next 16 的 middleware）
     ├─ next-intl 語系處理
     └─ /admin/* → Supabase getUser() + rpc('is_admin')，未通過導向 /admin/login
 └─ app/[locale]/layout.tsx（字體、i18n provider、主題、Header/Footer）
 └─ page.tsx
```

`/api/**` 不經過 proxy（matcher 明確排除），因此每支後台 API 需自行呼叫 `requireAdmin()`。

### 資料存取

- 三種 Supabase client 分工：`client.ts`（瀏覽器）、`server.ts`（帶 cookie、受 RLS 約束）、`public.ts`（匿名、可進 `unstable_cache`）。
- **無 service-role key。** 所有寫入均使用 anon key 加呼叫者 session，權限由 Postgres RLS 決定。
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

`supabase/migrations/` 目前僅涵蓋 `photos` 表，其餘資料表與 RPC 函式尚未納入版控，詳見 [`supabase/README.md`](supabase/README.md)。套用方式為手動執行 SQL，未接 Supabase CLI 流程。

---

## 專案結構

```txt
app/
  [locale]/          # 前台頁面與 /admin 後台
  api/               # /api/admin/ai、/api/admin/photos/*、/api/views
  components/        # 依區塊分組：home / blog / gallery / notes / admin
  lib/               # supabase / r2 / blog / notes / photos / images / ai …
  styles/            # 設計系統 token：_tokens / _theme / _mixins / _breakpoints
  rss/               # blog.xml、notes.xml
content/about/       # 關於頁 Markdown（<slug>.<locale>.md）
docs/                # 藍圖與設計系統文件
i18n/ messages/      # next-intl 設定與翻譯字串
proxy.ts             # 語系處理與 /admin 守衛
supabase/migrations/ # SQL schema
scripts/             # 字型子集化、OG 圖產生
```

---

## 延伸文件

| 文件                                             | 內容                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| [`docs/blueprint.md`](docs/blueprint.md)         | 路由地圖、資料層、認證流程、已知落差與待辦。修改程式前建議先讀 |
| [`docs/design-system.md`](docs/design-system.md) | 設計原則與 token 規範；活頁版見 `/lab/design`                  |
| [`supabase/README.md`](supabase/README.md)       | migration 慣例與套用方式                                       |

上述文件會隨程式演進而過期，每輪較大的改動後請一併更新。

---

## 授權

程式碼採 MIT 授權，見 [LICENSE](LICENSE)。網站的文章、照片與設計內容不在授權範圍內。
