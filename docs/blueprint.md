# johnlin.me 網站藍圖

寫給正要重新認識自己網站的你。這次大更新大部分實作細節是 AI 輔助完成的，這份文件的目的是把「網站現在實際上長什麼樣、怎麼運作」攤開來，讓你之後探索、改動程式時有地圖可以對。

跟 [`design-system.md`](design-system.md) 是同一種寫法：這份講「路由跟功能怎麼接起來」，設計系統那份講「視覺 token 怎麼運作」，兩份一起看。

⚠️ **這份文件不是穩定文件，程式改了就會過期。** 建議之後每次做完一輪大改動，回來更新對應章節，而不是留著讓它跟現實脫節（README.md 和 BLOG_SETUP.md 就是這樣過期的下場——那兩份還寫著 Firebase，但專案早就搬到 Supabase 了，之後可以考慮直接刪掉或重寫）。

---

## 一、技術棧

- **框架**：Next.js 15（App Router）+ React 19 + TypeScript
- **樣式**：Sass/SCSS Modules（`app/styles/` 三層 token 架構，見設計系統文件），另外裝了 Tailwind 4 但站上主要靠 SCSS
- **資料庫 / 認證 / 儲存**：Supabase（Postgres + Auth + Storage），透過 `@supabase/ssr` 做 cookie-based session
- **富文字編輯器**：Tiptap（後台文章編輯器）
- **AI**：Vercel AI SDK（`ai` 套件）+ AI Gateway，只做「欄位輔助」（slug/摘要/alt文字/關鍵字），不做整篇生成
- **i18n**：next-intl，繁中（`zh-tw`，預設、無網址前綴）+ 英文（`en`，`/en/...`）
- **部署**：Vercel，production 網域 `johnlin.me`，你自己另外手動維護一個 `preview.johnlin.me` 別名（不會自動跟著任何分支更新，每次要手動 `vercel alias set`）

---

## 二、整體請求流程

每個請求進來的順序：

```
請求
 └─ proxy.ts（Next 16 前稱 middleware.ts）
     ├─ next-intl 語系處理（決定 /zh-tw or /en 前綴、寫 locale cookie）
     └─ 如果路徑是 /admin/*（且不是 /admin/login）
         └─ 用 request cookies 建一個 Supabase server client
             ├─ getUser()          → 沒登入就導回 /admin/login
             └─ rpc('is_admin')    → 不是 admin 也導回 /admin/login
 └─ app/[locale]/layout.tsx（真正的根 layout，見下方）
 └─ 對應的 page.tsx
```

**關鍵認知：`/api/**` 完全不經過 proxy。** `proxy.ts` 的 matcher 是
`'/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)'`，明確排除 `api`。所以任何後台 API（目前只有 `/api/admin/ai`）都得自己在 route handler 裡再呼叫一次 `requireAdmin()`（`app/lib/supabase/requireAdmin.ts`）做 401/403 檢查，不能假設 proxy 已經擋掉了。這是刻意設計，不是漏洞，但如果你以後新增 `/api/admin/*` 底下的路由，記得每一支都要自己補這個檢查。

**真正的資料安全底線是 Postgres RLS，不是 proxy。** proxy 跟後台頁面的 `AdminShell` 裡的 `getUser()` 都只是「體驗層」的守衛（提早把非管理員導走），就算繞過這些頁面，實際的讀寫權限仍然由 Supabase 的 Row Level Security 政策決定。RLS 規則本身**不在這個 repo 裡**（見第九節）。

### Layout 巢狀

- `app/layout.tsx`：空殼，只放 `<Analytics/>`，存在只是因為 Next.js 需要一個檔案系統意義上的根 layout。
- `app/[locale]/layout.tsx`：真正的根 layout。驗證 `locale` 合法性（不合法就 404）、載入字體（`Noto Sans TC` + 自製「GenKiMin TW」serif，字型子集是 `scripts/generate-fonts.mjs` 在 build 前產生的）、包上 `NextIntlClientProvider` → `ThemeProvider`（next-themes）→ `HeaderSubNavProvider`，渲染全站共用的 `Header`/`Footer`，掛 Google Analytics。
- `app/[locale]/admin/layout.tsx`：`ToastProvider` → `ConfirmDialogProvider` → `AdminShell`。**這一層本身不做任何登入檢查**，完全信任 proxy 已經擋過了。

---

## 三、路由地圖

### 前台頁面（`app/[locale]/**`，皆為 Server Component 除非特別註明）

| 路徑 | 檔案 | 說明 |
|---|---|---|
| `/` | `page.tsx` | ISR（`revalidate=300`）。抓最新 3 篇文章（`getCachedLatestPosts`，另包一層 `unstable_cache`），拼出 Hero / WhoAmI / ThreeThings / FeaturedWorks / LatestArticles / PhotographyGlimpse 幾個區塊。Hero 區塊會把 `HeroShowcase.tsx` 自己的原始碼讀出來（`fs.readFile`，最多 200 行）顯示成一個「程式碼視窗」——純視覺效果，不是真的執行程式碼。 |
| `/about` | `about/page.tsx` | 內容來自 `content/about/*.md`（檔名格式 `<slug>.<locale>.md`），用 `react-markdown`+`remark-gfm` 渲染。這是全站**唯一**用到 `react-markdown` 的地方（部落格文章走的是另一條 Tiptap HTML 管線，見下）。分頁靠 client 元件 `ChapterShell` 做 `?chapter=` 切換，SEO 上仍是同一個網址。 |
| `/blog` | `blog/page.tsx` | `getPublishedPosts(pageSize:30)`，無分頁 UI、無分類/標籤篩選（lib 裡已經有 `getPublishedPostsByTag` 但這頁還沒接上）。 |
| `/blog/[slug]` | `blog/[slug]/page.tsx` | 依 slug 撈文章，非 `published` 或不存在就 404。若當前語系沒翻譯，退回顯示 `zh-tw` 內容並提示「英文版尚未提供」。掛載 client 元件 `ViewTracker`（見第四節）。 |
| `/notes` | `notes/page.tsx` | `getPublishedNotes(pageSize:50)`，單欄 feed（像短動態牆）。 |
| `/notes/[id]` | `notes/[id]/page.tsx` | 依 id 查單篇 note。 |
| `/gallery` | `gallery/page.tsx` | **目前是空殼**，只有標題/說明文字，沒有任何資料串接、沒有攝影作品資料模型。首頁的 `PhotographyGlimpse` 區塊也對應是「還沒準備好」的佔位卡片。 |
| `/lab` | `lab/page.tsx` | 實驗頁索引，目前只有一個連到 `/lab/design` 的連結。 |
| `/lab/design` | `lab/design/page.tsx` | 設計系統的「活頁」，把 `_tokens.scss`/`_theme.scss` 裡的 CSS 變數渲染成色票/間距/字級等等，`ColorDisplay` 元件負責解析真實算出來的值並支援點擊複製。 |

### 後台頁面（`app/[locale]/admin/**`，皆為 Client Component 除非特別註明）

| 路徑 | 檔案 | 說明 |
|---|---|---|
| `/admin` | `admin/page.tsx` | 儀表板。平行抓 `getPostsForAdmin({})` 與 `getNotesForAdmin()`，前端用 `Array.filter` 算總數/已發布/草稿數（沒有 DB 端聚合），4 張統計卡 + 2 個快速動作按鈕。 |
| `/admin/login` | `admin/login/page.tsx` | 單一顆 Google OAuth 按鈕，只有這一種登入方式，沒有帳密欄位。 |
| `/admin/categories`<br>`/admin/tags`<br>`/admin/series` | 各自的 `page.tsx` | 三頁幾乎同構的 CRUD：列表 + `Modal` 表單（雙語名稱欄位），刪除鍵在 `postCount > 0` 時直接 disable，防止刪掉還有文章在用的分類。`series` 額外有封面圖網址欄位；程式註解說 series 的 schema 已經就緒但**前台的系列頁面「暫緩」**，目前只有後台管理，沒有對外呈現。 |
| `/admin/notes` | `admin/notes/page.tsx` | 純文字輸入框 + 多圖上傳（直接進 `notes` bucket）+ 發布鍵，發完馬上插進下方 feed。沒有編輯功能，只有發布/刪除。 |
| `/admin/posts` | `posts/page.tsx` | 文章列表，狀態篩選（全部/草稿/已發布）。「新增文章」不是開表單，是直接插一筆草稿再導頁（見下）。 |
| `/admin/posts/new` | `posts/new/page.tsx` | Mount 時立刻呼叫 `createDraftPost` 建一筆空白草稿（用 ref 擋 React StrictMode 重複觸發），然後 `router.replace` 到 `/write`。沒有「新增文章」表單畫面，這頁只是個轉場。 |
| `/admin/posts/[id]/layout.tsx` | — | 撈這篇文章、包一層 `PostEditorProvider`+`AiAssistProvider`，讓 `write`/`settings` 兩步共用同一份編輯器狀態，切換步驟不會重新載入。 |
| `/admin/posts/[id]/write` | `write/page.tsx` | 內容編輯步驟：標題、可折疊的副標/摘要、雙語富文字內容（切語系用 `key={locale}` 強制重新 mount 編輯器）。 |
| `/admin/posts/[id]/settings` | `settings/page.tsx` | 設定步驟：slug、分類/標籤/系列選擇器、封面圖、各語系 SEO 欄位、危險操作區。 |
| `/admin/posts/[id]`<br>`/admin/posts/[id]/edit` | 各自 `page.tsx` | **都是導頁用的殘留 stub**，舊版單頁編輯器被拆成 write/settings 兩步之後留下的相容轉址，實際內容都在 `write`。 |
| `/admin/test-editor` | `test-editor/page.tsx` | 沒有掛在導覽列上的開發用測試頁，單純孤立掛一個 `<RichTextEditor>`，不連 Supabase，可以直接刪或用 dev-only 的方式擋起來。 |

### API 路由

| 路徑 | 說明 |
|---|---|
| `POST /api/admin/ai` | 自己呼叫 `requireAdmin()` 做 401/403（因為 proxy 不管 `/api`）。用 Zod discriminated union 驗證 4 種任務：`slug`／`description`／`coverAlt`（會把圖片網址送進去給模型看）／`keywords`。用 Vercel AI SDK 的 `generateObject` 打 `google/gemini-3.5-flash-lite`，把 429/402/403 這幾種 Gateway 錯誤轉成好懂的訊息。 |
| `POST /api/views` | 公開、無驗證。收 `{postId}`，呼叫 `increment_post_view_count` 這個 Postgres RPC（`SECURITY DEFINER`，讓匿名使用者也能加計數但不需要 UPDATE 權限）。防重複瀏覽完全靠前端 `localStorage`（30 分鐘冷卻），沒有伺服器端防灌水，個人網站這樣是夠用的但要知道這件事。 |

### 特殊路由

| 路徑 | 說明 |
|---|---|
| `GET /auth/callback` | 接住 Supabase Google OAuth 的 `?code`，`exchangeCodeForSession` 換出 session cookie，成功導回 `?next`（預設 `/admin`），失敗導回 `/admin/login?error=auth`。 |
| `GET /rss/blog.xml`<br>`GET /rss/notes.xml` | `force-dynamic`，各自抓已發布的文章/notes，用 `app/lib/rss.ts` 的 `rssDocument()` 拼 XML。**只有中文版**，不分語系，這點如果你想做雙語 RSS 需要另外處理。 |

---

## 四、資料層

### Supabase Client 有三種，用途分開

| 檔案 | 用途 |
|---|---|
| `app/lib/supabase/client.ts` | `createBrowserClient()`，給 Client Component 用（登入按鈕、編輯器裡的圖片上傳） |
| `app/lib/supabase/server.ts` | `createClient()`（async），包 Next 的 `cookies()`，給 Server Component / Route Handler / Server Action 用，會帶呼叫者的登入身份做 RLS 判斷 |
| `app/lib/supabase/public.ts` | `createPublicClient()`，純 `@supabase/supabase-js`，不帶 cookie、`persistSession:false`，專門給可以塞進 `unstable_cache` 的匿名查詢用（帶 cookie 的 client 會強迫該路由變成動態渲染，這支特別繞開這個問題） |

**沒有 service-role client。** 所有寫入/管理操作都是「一般 anon key + 呼叫者的 session cookie」，權限全部交給 Postgres RLS 判斷，程式碼裡完全找不到繞過 RLS 的後門 key。

### 資料表（從程式裡的查詢反推出來的，這個 repo 沒有 schema 檔案）

| 資料表 | 主要欄位（推測） | 備註 |
|---|---|---|
| `posts` | `id, slug, status(draft/published), category_id, series_id, series_order, cover_image(jsonb), locales(jsonb, 依 zh-tw/en 各自存 title/description/content(HTML)/seo/toc), view_count, created_at, updated_at, published_at` | `published_at` 由 DB trigger 在第一次發布時寫入 |
| `post_tags` | `post_id, tag_id` | 單純 join table |
| `categories` | `id, slug, locales(jsonb), created_at` | |
| `tags` | `id, slug, locales(jsonb), created_at` | |
| `series` | `id, slug, locales(jsonb), cover_image(text), created_at` | schema 就緒但前台 UI 暫緩 |
| `notes` | `id, content, images(jsonb[]), status, created_at, published_at` | 單語言，無 slug/title/分類 |

### RPC 函式

- `is_admin()` — 無參數，回傳 boolean，`proxy.ts` 和 `requireAdmin.ts` 都靠它判斷管理員身份。
- `increment_post_view_count(post_id)` — `SECURITY DEFINER`，讓匿名瀏覽也能加計數。

兩個函式的實際 SQL 邏輯都**只存在 Supabase 後台**，這個 repo 裡沒有 migrations 資料夾、沒有任何 `.sql` 檔案（見第九節，這是要注意的落差）。

### 圖片/媒體儲存

`app/lib/supabase/storage.ts` 的 `uploadImage()` 直接呼叫 **Supabase Storage** 的 JS SDK（`supabase.storage.from(bucket).upload()` + `getPublicUrl()`），bucket 分 `blog`（封面圖、內文圖）跟 `notes`（短動態圖）。編輯器貼上/拖曳圖片如果變成 base64 內嵌，會在儲存前被 `uploadAndReplaceImagesInHtml()` 掃出來重新上傳成真正的網址。

### 環境變數（實際被程式讀到的）

- Supabase：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- AI：`AI_GATEWAY_API_KEY`（沒有任何程式碼直接讀它，是 AI SDK Gateway provider 依慣例自己撿的）
- 站台：`NEXT_PUBLIC_SITE_URL`（RSS、metadata canonical URL 用）
- **`.env` 裡還留著一整組 Firebase 變數**，但 `app/` 底下沒有任何程式碼讀取它們，純粹是遷移後沒清掉的殘留。

---

## 五、身份驗證流程

1. `/admin/login` 按鈕呼叫 `supabase.auth.signInWithOAuth({provider:'google', redirectTo:'/auth/callback?next=/admin'})`。
2. Google 導回 `/auth/callback?code=...`，`exchangeCodeForSession` 換出 session、寫入 cookie。
3. 之後每個請求，`proxy.ts` 對 `/admin/*` 路徑重建一個 server client 讀 cookie、呼叫 `getUser()` + `rpc('is_admin')` 判斷放不放行。
4. `AdminShell` 裡也會呼叫一次 `getUser()`，但那只是拿來顯示大頭貼/名字，**不是安全檢查**。
5. `is_admin()` 怎麼判斷「誰是管理員」——是 email allowlist？是 role 欄位？——**完全看不到**，因為邏輯在 Supabase 後台，這個 repo 裡沒有任何程式碼或 SQL 定義它。

---

## 六、後台 CMS 細節

### 編輯器（Tiptap）

`RichTextEditor.tsx` 掛載的擴充套件：`StarterKit`（關掉內建 codeBlock）、`Image`、`Link`、`CodeBlockLowlight`、`Underline`、`TextAlign`、`Highlight`、自訂互斥的 `Subscript`/`Superscript`、`TableKit`、`CharacterCount`、自製的 `Math` 節點（KaTeX 渲染，用 LaTeX 輸入框編輯）、`Placeholder`。

> `package.json` 裡的 `@tiptap/extension-color` 和 `@tiptap/extension-text-style` **沒有任何地方 import**，是沒用到的依賴，可以清掉。

- **內容儲存格式是 HTML 字串，不是 Tiptap JSON。** `editor.getHTML()` 直接存進 `posts.locales.<lang>.content`。
- **儲存機制**：`useAutosave`（1.2 秒 debounce / 8 秒硬上限）**只在 `status==='draft'` 時啟用**。文章一旦發布，自動存檔就關掉了，之後編輯要手動按「更新」。
- **Slug 是手動輸入，故意不用 `slugify` 這個依賴**——註解說它處理純中文標題會出問題。有 500ms debounce 的唯一性檢查，加上一顆呼叫 AI 建議 slug 的按鈕。
- 發布會檢查：標題必填、slug 必填且符合 `^[a-z0-9]+(-[a-z0-9]+)*$`、slug 再查一次唯一性、掃掉殘留的 base64 圖片。

### 文章 CRUD 全流程

列表（依狀態篩選）→ 點「新文章」直接建草稿轉頁到 `/write` → `write`（標題/摘要/雙語內容）→ `settings`（slug/分類/標籤/系列/封面/SEO）→ 發布或存草稿。離開一篇「從沒被動過的草稿」時會靜默刪除這筆孤兒資料（`isPristineDraft()`）。

### Notes 跟 Posts 是完全獨立的兩套系統

Notes 沒有標題、沒有 slug、沒有雙語、沒有草稿流程（一律直接 `published`）、沒有分類標籤系列。就是一個貼文字+最多幾張圖、發了就上牆的輕量微網誌，跟正式的部落格文章系統是分開的兩條資料流，只是共用同一套後台介面風格。

### AI 輔助——刻意做得很克制

只有 4 種任務：slug 建議、摘要、封面圖 alt 文字（多模態，把圖傳給模型看）、SEO 關鍵字。程式碼註解明講這是「幫忙填欄位，不是代寫標題或內文」。如果欄位是空的就直接套用建議；欄位已經有內容，則跳一張建議卡片讓你按「套用/取消」，不會默默覆蓋你寫的東西。

### 共用元件

`Button`/`Input`/`Textarea`/`Selector`/`Modal`/`ConfirmDialog`/`Toast`——一套手刻的、沒有用外部 UI 套件的極簡元件庫，後台所有頁面統一在用同一套，`ConfirmDialogProvider`/`ToastProvider` 掛在 admin layout 最外層，取代掉原生的 `window.confirm`/`alert`。

---

## 七、前台功能細節

- **首頁**：ISR 5 分鐘，撈最新 3 篇文章給兩個區塊共用（不重複查詢）。`FeaturedWorks` 跟 `ThreeThings` 兩個區塊是**寫死的陣列**（外部專案連結、興趣卡片），不是 CMS 資料，想換內容要直接改程式碼。`PhotographyGlimpse` 是刻意設計的空狀態（幽靈相框佔位），因為攝影功能還沒做。
- **部落格文章渲染管線**：Tiptap 編輯器產出 HTML → 存進 DB → 前台用 `dangerouslySetInnerHTML` 直接注入 → `PostContent` 這個 client 元件額外做一次「補渲染」，把數學公式的 `[data-math]` 佔位節點用 KaTeX 渲染出來。**跟 `/about` 頁的 Markdown 管線是兩條完全不同的路**，`react-markdown` 只有 `/about` 在用。
- **目錄（TOC）不是即時從頁面 DOM 產生的**，是編輯器儲存時就寫進 `locales.<lang>.toc` 的預先計算資料，前台只是拿現成資料配 `IntersectionObserver` 做捲動高亮。
- **Notes 前台**：單欄 feed，卡片是純文字+最多 3 張圖網格，用原生 `<img>`（不是 `next/image`，這點跟 `PostCard` 不同）。
- **Gallery / Lab**：Gallery 目前是空頁面，沒有資料模型。Lab 只有一個連到 `/lab/design`（設計系統活頁）的入口。

---

## 八、i18n 與設計系統

- `i18n/routing.ts`：兩個語系 `en`/`zh-tw`，預設 `zh-tw`，`localePrefix:'as-needed'`——預設語系網址不帶前綴（`/blog`），英文才有前綴（`/en/blog`）。
- 翻譯字串放在 `messages/<locale>.json`，依頁面/區塊分 key（`HomePage`、`BlogPage`……）。
- 設計系統三層 token 架構（`_tokens.scss`/`_theme.scss`），細節見 [`design-system.md`](design-system.md) 和活頁 `/lab/design`。主色是暖橘（`oklch(0.62 0.15 52)`），背景是卡其白/暖黑，陰影用暖棕色調而不是純黑。
- 主題切換（`next-themes`）靠 `<html>` 的 `class` 屬性切 `.light`/`.dark`，實際顏色在 `_theme.scss` 定義。

---

## 九、⚠️ 重要落差與待釐清事項

這些是探索過程中發現、**跟你原本認知或先前決策對不上**的地方，值得你自己確認一輪：

1. **媒體儲存實際上是 Supabase Storage，不是 R2。** 整個 repo 找不到任何 R2/S3/Cloudflare 相關程式碼或環境變數（`.env` 裡也沒有）。如果你先前決定「媒體走 R2」，目前的實作並沒有照做——除非 Supabase 專案後台把 Storage 的底層接到了外部 S3 相容的 R2 bucket（Supabase 支援這種接法，但這個設定在 repo 裡看不到，得去 Supabase 後台確認）。這點建議直接去 Supabase Dashboard 的 Storage 設定確認一下，免得以為在用 R2 但其實不是。

2. **短網址導向功能目前完全不存在。** commit 記錄裡有一次「復原短網址導向功能」，但更後面的地基整理把它整個刪掉了，commit 訊息明講是「未來以獨立模組實作」。目前 proxy、`next.config.ts`、路由裡都沒有任何 `/u/[slug]` 或短網址邏輯——如果你以為這功能還在，它其實只存在於 git 歷史裡。

3. **資料庫 schema 跟 RLS 規則完全沒有版本控制。** 這個 repo 沒有 `supabase/` 目錄、沒有任何 migration 或 `.sql` 檔案。`is_admin()`、`increment_post_view_count()` 這兩個 RPC，還有所有資料表的 RLS 政策，都只存在 Supabase 專案後台，換一台電腦、或哪天要重建這個專案，這些邏輯無法從程式碼重現。這是目前最大的「單點故障」風險——建議之後找時間把現有的 schema/RLS 用 `supabase db dump` 之類的方式拉一份存進 repo。

4. **`is_admin()` 怎麼判斷你是管理員，完全不透明。** 沒有 email allowlist 常數、沒有 role 欄位，邏輯藏在 Supabase 後台的 Postgres 函式裡。如果之後要加第二個管理員帳號，你得去 Supabase 後台改，不是改程式碼。

5. **Firebase 殘留還沒清乾淨。** `.env` 裡一整組 Firebase 變數、`next.config.ts` 裡一條 Firebase Storage 的圖片網域白名單（註解已經寫「可移除」）、`node_modules` 裡的 `@firebase` 依賴，都是遷移後沒清掉的殘留，可以放心整批刪除。

6. **未使用的依賴**：`@tiptap/extension-color`、`@tiptap/extension-text-style` 裝了但沒 import，`slugify` 也裝了但實際 slug 生成刻意不用它。

7. **明確「做一半」或「暫緩」的功能**（不是 bug，是設計上刻意留白，但你應該知道現況）：
   - Gallery 頁面完全是空殼，沒有資料模型
   - Series（系列文章）後台管理已經做好，但前台完全沒有對外的系列頁面
   - `/admin/test-editor` 是沒掛導覽的開發測試頁，可以刪或擋起來
   - `/admin/posts/[id]` 和 `/admin/posts/[id]/edit` 是舊版編輯器留下的轉址殘留頁面

8. **README.md 和 BLOG_SETUP.md 已經完全過期**，兩份都還在講 Firebase，跟現在的 Supabase 架構對不上，容易誤導之後回來看文件的自己。

9. **proxy 拒絕放行時會丟掉 Supabase 剛續期的 cookie。** `proxy.ts` 的 Supabase cookie adapter 把更新後的 auth cookie 寫在 next-intl 產生的 `response` 上，但守衛判定不放行時回傳的是一個全新的 `NextResponse.redirect(...)`，那些 cookie 就沒了。實務上影響有限（不放行本來就要重新登入），但 session 只在放行路徑上會被續期。修法是把 `response.cookies.getAll()` 複製到 redirect response 上。Beta 3 升級時刻意不動它，好讓升級的 diff 保持乾淨。

10. **靜態產生依賴 `setRequestLocale`，而它是 next-intl 的舊 API。** `app/[locale]/layout.tsx` 呼叫 `setRequestLocale(locale)`，少了它，`/gallery/[slug]` 那 104 頁會整批退回動態渲染（Next 16 起不再讓 `app/lib/metadata.ts` 裡 `getLocale().catch()` 把錯誤吞掉）。next-intl 官方建議改用 `next/root-params`，那是獨立的遷移工作。

11. **eslint-plugin-react-hooks v6 的四條新規則被降為警告。** `refs`／`set-state-in-effect`／`immutability`／`preserve-manual-memoization` 在既有程式碼上共 31 個違規，集中在攝影牆的手勢與狀態機 hook、自動存檔與燈箱。它們指出的是真問題（例如 render 期間寫 ref），設定在 `eslint.config.mjs` 裡刻意降級以免升級 diff 被淹沒，是明確的待辦。

12. **首頁的原始碼展示面板有檔案追蹤漏洞。** `app/[locale]/page.tsx` 在執行期用 `readFile` 讀 `app/components/home/HeroShowcase.tsx` 當展示內容，但 `next.config.ts` 的 `outputFileTracingIncludes` 只涵蓋 `/[locale]/about`。讀不到時 `catch` 回傳「原始碼讀取失敗」字串——跟 About 頁同一類的安靜失效。目前正式站正常，但這是靠運氣。

---

## 十、如果你想繼續探索，這裡是切入點

- 想搞懂「文章怎麼從編輯器變成前台頁面」→ 從 `app/components/admin/PostEditor/` 開始跟到 `app/lib/supabase/posts.ts` 再到 `app/[locale]/blog/[slug]/page.tsx`。
- 想搞懂「權限怎麼擋」→ `proxy.ts` → `app/lib/supabase/requireAdmin.ts` → 去 Supabase 後台找 `is_admin()` 的定義。
- 想加新功能（例如真的把 Gallery 做起來）→ 參考 `notes` 這條線（全站最簡單完整的 CRUD 範例：`app/lib/supabase/notes.ts` + `admin/notes/page.tsx` + `notes/page.tsx`），複雜度比 `posts` 低很多，適合當模板。
- 想確認媒體儲存到底是不是 R2 → 直接去 Supabase Dashboard → Storage → 看 bucket 的底層設定。
