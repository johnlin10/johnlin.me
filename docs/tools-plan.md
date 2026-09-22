# tools.johnlin.me 規劃

課表和短網址這兩個工具的實作規劃，2026-09-15 定案。同一天修訂過兩次：tools 整個改成私人使用、課程顏色改成自己選；學期獨立成一張表，課程加上學分。做完一個階段就回來更新這份，跟 [`blueprint.md`](blueprint.md) 一樣，別讓它跟程式脫節。

第三個工具「完善就學」的規劃另外一份：[`tutoring-plan.md`](tutoring-plan.md)。第四個工具 QR Code 在第六節。知識庫也另外一份：[`kb-plan.md`](kb-plan.md)。

---

## 一、已經定下來的事

| 項目 | 決定 |
|---|---|
| 工具放哪 | `tools.johnlin.me`，跟主站、後台同一個 Next 專案，proxy 依 Host 分流 |
| 管理方式 | 每個工具自己就是一個完整的小 app，編輯和展示在同一頁，admin 完全不碰 |
| 誰能用 | 整個 tools 子網域只給你用，除了 `/login` 都要登入。誰都連得到，但只會看到登入頁 |
| 短網址網域 | 轉址在 `go.johnlin.me/{slug}`，管理頁在 `tools.johnlin.me/links` |
| 上課時間 | 用節次記錄；節次時間表先用常見制度，之後換成學校的 |
| 課表資料 | 學期、課程、老師各一張表。課程屬於某個學期，帶學分；課表的每一格選課程和老師，教室是自由填的文字。v1.6 起每一格還屬於一個人（`person_id`），課表工具可以切換看誰的課表，課程和老師跨人共用 |
| 課程顏色 | 15 種預設顏色（14 種色相加一個灰），每門課自己選 |
| 權限 | 新的表 RLS 一律只給 `is_admin()`；訪客唯一碰得到資料的地方，是短網址轉址用的 `SECURITY DEFINER` 函式 |

權限那條是整份規劃最重要的一點。anon key 是 `NEXT_PUBLIC_` 開頭，任何人都能拿它直接打 PostgREST。只要有一張表開放 anon 讀取，所有欄位就都讀得到，伺服器端怎麼過濾都沒用。

**這次不做**：主站的課表展示、學分統計。之後要做時的想法記在第七節。

---

## 二、預設值（沒意見就照這樣做）

這些我先替你選了，想改直接說。

1. tools 介面雙語，跟後台一樣走 next-intl。學期、課程名稱、老師名字只存一種語言，不做翻譯。
2. tools 可以裝成獨立 PWA，名稱 John Lin Tools／JL Tools，圖示先沿用主站（後台也是這樣）。
3. 課表預設顯示週一到週五，週六日有課才多出那一欄。
4. 新增課程時，顏色預設帶這學期用最少次的那個，可以再改。
5. 學期代號格式 `114-1`、`114-2`，暑修真的遇到再加。打開課表時預設顯示最新的學期。
6. 學分可以不填。沒填和 0 學分是兩回事（像體育可能是 0 學分），所以沒填就存 `null`。
7. 短網址點擊只記時間、來源網域、國家，不記 IP 和 User-Agent。
8. 短網址建立後 slug 不能改，只能改目標網址和備註。要換 slug 就刪掉重建。
9. `go.johnlin.me` 找不到 slug 就回一個簡單的 404 頁，附一個回 johnlin.me 的連結；`go.johnlin.me` 根目錄直接 307 到 johnlin.me。

---

## 三、網址與路由

| 網址 | 內部路由 | 誰看得到 |
|---|---|---|
| `tools.johnlin.me/` | `app/[locale]/tools/page.tsx` | 你（工具列表） |
| `tools.johnlin.me/login` | `app/[locale]/tools/login` | 所有人 |
| `tools.johnlin.me/schedule` | `app/[locale]/tools/schedule` | 你 |
| `tools.johnlin.me/links` | `app/[locale]/tools/links` | 你 |
| `tools.johnlin.me/links/{slug}` | `app/[locale]/tools/links/[slug]` | 你（單一連結的統計） |
| `tools.johnlin.me/qr` | `app/[locale]/tools/qr` | 你 |
| `go.johnlin.me/{slug}` | 不進 app 路由，proxy 直接回 307 | 所有人 |
| `johnlin.me/tools` | 回 404，跟 `/admin` 一樣 | 沒有人 |

### proxy 的改法

`isAdminHost` 改成一個回傳子網域種類的函式。短網址沒有頁面，也不需要語系和登入，另外用 `isGoHost` 判斷：

```ts
// app/lib/siteConfigs.ts
export function subdomainOf(host: string | null): 'admin' | 'tools' | null
export function isGoHost(host: string | null): boolean
```

[`proxy.ts`](../proxy.ts) 依種類分流：

- **go**：最先處理，不跑 next-intl。把路徑轉小寫當 slug，呼叫 `resolve_short_link`，找到就 307，找不到就 404。這個子網域上每個請求本來就是在查短網址，所以在 proxy 查資料庫沒問題。
- **admin 和 tools**：走同一段程式，差別只在改寫的前綴（`/${locale}/admin/...` 或 `/${locale}/tools/...`）。先跑 next-intl、改寫路徑，除了 `/login` 都要通過 `getUser()` 加 `is_admin`，不是管理員就導去 `/login`。`getUser()` 順便刷新 session，所以 tools 的 RSC 也不用自己寫 cookie。
- **主站**：`ADMIN_PATH` 改成 `/^\/(admin|tools)(?=\/|$)/`，讓 `/tools` 也回 404。

其他要跟著改的：

- `next.config.ts` 的 `allowedDevOrigins` 加上 `tools.localhost`、`go.localhost`。本機用 `tools.localhost:3000`、`go.localhost:3000` 開。
- `Header.tsx` 和 `FooterGate.tsx` 現在是 `segment === 'admin'` 就不顯示，要把 `'tools'` 也加進去。
- tools 直接沿用後台的 `AdminShell`（側邊欄、手機抽屜、帳號、登出），傳 `app="tools"` 換成工具的導覽和文案（`ToolsPage` 命名空間）。頁面標題一樣用後台的 `PageHeader`。
- `manifest.ts` 加 tools 的分支。
- 登入頁：把 `admin/login/page.tsx` 的內容抽成共用元件，admin 和 tools 各自一個 page 包它。`/auth/callback` 用相對路徑導回 `/`，兩個子網域都能直接用，不用改。

### 外部設定

✅ 2026-09-15 完成：Vercel 網域、Cloudflare DNS、Supabase Redirect URL。

---

## 四、課表

### 資料表（`supabase/migrations/0004_schedule.sql`）

```sql
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- '114-1'，排序直接用它
  created_at timestamptz not null default now(),
  constraint semesters_code_format_check
    check (code ~ '^\d{3}-[12]$')
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  -- 學期底下還有課程就刪不掉
  semester_id uuid not null references public.semesters(id) on delete restrict,
  name text not null,
  credits smallint,                -- null = 還沒填，跟 0 學分分開
  color text not null,             -- 顏色 key，對照 app/lib/schedule/colors.ts
  created_at timestamptz not null default now(),
  constraint courses_semester_name_unique
    unique (semester_id, name),
  constraint courses_credits_check
    check (credits >= 0),
  constraint courses_color_format_check
    check (color ~ '^[a-z]+$')
);

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  -- 格子屬於哪個學期由課程決定，這裡不重複存
  -- 還有格子在用的課程刪不掉，介面提示先處理那些格子
  course_id uuid not null references public.courses(id) on delete restrict,
  -- 老師刪掉，格子留著，只是沒有老師
  teacher_id uuid references public.teachers(id) on delete set null,
  day smallint not null,           -- 1 = 週一 … 7 = 週日
  start_period text not null,      -- 節次代號，對照 app/lib/schedule/periods.ts
  end_period text not null,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_slots_day_check
    check (day between 1 and 7)
);

create index if not exists schedule_slots_course_idx
  on public.schedule_slots (course_id);

-- updated_at 觸發器照 photos 的寫法接 set_updated_at()

-- 四張表都一樣：開 RLS，只有管理員能讀寫
alter table public.schedule_slots enable row level security;
create policy schedule_slots_admin_all on public.schedule_slots
  for all using (is_admin()) with check (is_admin());
```

幾個選擇的理由：

- **課程屬於學期。** 同樣叫「體育」，114-1 和 115-1 各是一筆修課紀錄，學分、顏色都可以不同。之後算學分就是把某個學期的課程學分加起來，不用去格子那邊反推。代價是每學期要重新建課程，不過每學期的課本來就不一樣。
- **老師清單跨學期共用，老師掛在格子上。** 同一位老師可能教你好幾個學期的課，名字只要建一次。
- **學分用 `smallint`。** 台灣的學分幾乎都是整數，真的遇到 0.5 學分再改型別。
- **節次存代號字串（`'3'`、`'N'`），不存它在時間表裡的位置（0、1、2…）。** 之後換成學校的節次表，如果多了第 0 節或晚上的 A–D 節，位置會整排位移，舊資料就對錯格了，代號不會有這個問題。代價是「開始節不能晚於結束節」這種檢查資料庫做不到，改在程式裡檢查。
- **顏色存 key（`'blue'`），不存色碼。** 淺色和深色主題要的是兩組不同的顏色，存色碼就得存兩個，之後想微調顏色也要改資料。存 key 的話，實際顏色全在程式裡決定。

### 課程顏色（`app/lib/schedule/colors.ts`）

```ts
// 色相以 oklch 為準，明度和彩度在 CSS 裡依主題各算一次
export const COURSE_COLORS = [
  { key: 'red', hue: 25 },
  { key: 'orange', hue: 55 },
  { key: 'amber', hue: 75 },
  { key: 'yellow', hue: 95 },
  { key: 'lime', hue: 125 },
  { key: 'green', hue: 145 },
  { key: 'teal', hue: 180 },
  { key: 'cyan', hue: 205 },
  { key: 'sky', hue: 230 },
  { key: 'blue', hue: 255 },
  { key: 'indigo', hue: 275 },
  { key: 'violet', hue: 295 },
  { key: 'purple', hue: 320 },
  { key: 'pink', hue: 350 },
  { key: 'gray', hue: 0, chroma: 0 },
] as const
```

- 格子的 `style` 帶 `--course-hue` 和 `--course-chroma`，SCSS 用 `oklch()` 算出底色和文字色：淺色主題是淡底深字，深色主題是暗底亮字。站上的色彩 token 本來就是 oklch，寫法一致。
- 表上的色相是起點。階段 2 會開瀏覽器在兩個主題下都看過一輪，相鄰顏色太像或文字對比不夠就調整數值。
- 選色介面是一排色票，在新增課程和「課程與老師」面板裡都能改。
- 資料裡出現程式不認得的 key（例如之後刪掉某個顏色）就當成灰色顯示。

### 節次時間表（`app/lib/schedule/periods.ts`）

```ts
// ponytail: 常見制度佔位，之後換成學校的節次表；代號不變的話舊資料不用動
export const PERIODS = [
  { code: '1', start: '08:10', end: '09:00' },
  { code: '2', start: '09:10', end: '10:00' },
  { code: '3', start: '10:10', end: '11:00' },
  { code: '4', start: '11:10', end: '12:00' },
  { code: 'N', start: '12:10', end: '13:00' },
  { code: '5', start: '13:10', end: '14:00' },
  { code: '6', start: '14:10', end: '15:00' },
  { code: '7', start: '15:10', end: '16:00' },
  { code: '8', start: '16:10', end: '17:00' },
  { code: '9', start: '17:10', end: '18:00' },
  { code: '10', start: '18:10', end: '19:00' },
] as const
```

### 頁面與操作

- **誰的課表**：頁首的第一個下拉（v1.6 加的），列出 `people` 表裡的人，最後一個選項是「新增成員」。課表的每一格屬於選中的那個人，課程和老師則是整個學期共用。完善就學直接讀這些課表，見 [`tutoring-plan.md`](tutoring-plan.md)。
- **複製課表**：同班的同學共用大部分的課，所以課表空的時候網格上方會出現「從別人複製」，管理區也常駐一個。跟現有時段重疊的會跳過，複製完兩份各自獨立。
- **學期期間**：學期有開學日和結束日（v1.6 加的），在學期的編輯視窗裡填。課表只在這段期間有效，完善就學靠它判斷開學前和寒暑假不算有課。
- **學期切換**：頁首的第二個下拉，列出 `semesters` 表裡的所有學期，新到舊排，預設選最新的。選單最下面是「新增學期」，輸入代號就建好並切過去。切到舊學期就能調閱當時的課表。
- **網格元件 `ScheduleGrid`**：放在 `app/components/schedule/ScheduleGrid`，不放在 tools 底下，因為之後主站的課表展示要直接拿去用。它吃 `{ day, start, end, course, teacher, location, color }[]`，每個欄位都可以是 `null`，是 `null` 就不顯示。可不可以點由 props 決定。
- **點空格**：開 Modal，從選單選課程（只列這學期的）和老師（可以不指定），再填教室、星期、起訖節次。星期和開始節預設帶你點的那格；選了課程之後，老師預設帶這門課上一次的老師。
  - 課程和老師都要先在下方管理區建好，時段裡只能選，不能打字新增。這學期還沒有課程時，Modal 會提示先新增。
- **點已有的格子**：同一個 Modal，多一個刪除（ConfirmDialog）。
- 存檔前檢查同一學期、同一天的節次有沒有重疊，重疊就擋下來提示。
- **顯示優先**：課表在手機上撐滿螢幕寬。課程、老師、學期收在課表下方的管理區（原生 `<details>`，預設收起），跟課表用分隔線隔開。
- **管理區**：每組一個「＋」新增；點整列開編輯 Modal，刪除放在 Modal 裡。學期可以改代號、刪除（底下還有課程就刪不掉）。不另開頁面。

寫入照後台現在的做法：讀寫函式放 `app/lib/supabase/schedule.ts`，client 端直接用 Supabase，RLS 擋掉非管理員。後台的 Modal、Selector、Input、ConfirmDialog、Toast 直接拿來用。

### 假日與補課（`supabase/migrations/0013_calendar_days.sql`，v1.9.0）

課表是週課表，沒有日期，所以國定假日照樣長出課來；完善就學也擋不掉假日排程。
`calendar_days` 就是那份例外清單，一天一列：

```sql
date date primary key,
source_day smallint,   -- null = 放假；1..7 = 那天改上這個星期幾的課
label text not null    -- '孔子誕辰紀念日' / '補 10/9 的課'
```

判斷全部收在 `classDay(date, calendar)`（`app/lib/tutoring.ts`）一個函式裡：平常日回自己的星期幾、
放假回 `null`、補課日回被補的那天。`null` 不會等於任何 `slot.day`，所以三個判斷點都只要把
`dayOfWeek(date)` 換成它：

- `app/[locale]/tools/page.tsx` 的總覽（`pickAgenda` 會自動跳到下一個有課的日子）
- `app/components/schedule/TutoringBoard` 的週看板（含公開頁）
- `TutoringTool` 的 `findClash`：`day === null` 擋假日、`day > 5` 擋週末。
  補課的週六回的是被補的那天（1 或 5），兩關都過，所以補課日照常排得了輔導。

補假幾乎都落在週一或週五 —— 節日在週二或週四，順著週末放四天連假，補的就是被放掉的那一天。
週三的節日只放一天，不補課。

**沒有「補班日」這種列**：2025 年修法後政府已經取消補班，[開放資料](https://data.gov.tw/dataset/14718)
的辦公日曆表裡查不到（2026 全年 0 筆），學校要補哪一天是學校自己決定的，一律手動填。

**匯入**（`app/lib/holidays.ts` + `app/api/admin/holidays/route.ts`）：讀 Google 的「台灣的節慶假日」
ics，抓今年和明年的國定假日。政府開放資料只有 CSV，而且每年一份、要先抓 150KB 的 metadata
再用中文標題比對當年度的資源，改個名就壞；ics 是固定網址、一次涵蓋 2021–2027。

要濾掉兩種東西才會對：

- `DESCRIPTION` 是「假日節慶」的（元宵、冬至、婦女節…不放假），只留「國定假日」
- 落在週末的（2/14、10/10 那種本來就不上課）

濾完 2026 剩 16 筆，跟辦公日曆表的「平日放假」逐筆相同，而且名稱更完整
（政府版 4 筆只寫「補假」，ics 寫「和平紀念日 補假」）。

寫入走 `importCalendarDays()` 的 `ignoreDuplicates` —— 已經有的日子完全不動，
自己改過的標籤不會被蓋掉，重按也安全。跨站抓取要走 route handler，瀏覽器直接抓會被 CORS 擋。
解析放在 `app/lib/holidays.ts` 而不是 route 裡，是為了 `.mjs` 測試能 import 得到；
同樣的理由，那裡的週末判斷沒有共用 `tutoring.ts` 的 `dayOfWeek`。

**編輯頁**：`app/components/schedule/HolidayEditor`，一個 Modal，沒有路由也不進側邊欄 ——
它是課表和完善就學的擴充，不是獨立的功能。兩頁的管理區（`<details>`）各掛一個「假日」group
開它。課表頁用不到假日資料，所以只在開啟時才去讀；完善就學隨首屏一起帶下來。

一年只有十幾列，所以 `getCalendarDays()` 一次全撈，切月份、翻頁都不重抓。

---

## 五、短網址

### 資料表（`supabase/migrations/0005_short_links.sql`）

```sql
create table if not exists public.short_links (
  slug text primary key,
  target_url text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint short_links_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  -- proxy 的 matcher 會跳過開頭是 api、auth、trpc 的路徑，這種 slug 永遠到不了轉址邏輯
  constraint short_links_slug_reserved_check
    check (slug !~ '^(api|auth|trpc)'),
  constraint short_links_target_url_check
    check (target_url ~ '^https?://')
);

create table if not exists public.short_link_clicks (
  id bigint generated always as identity primary key,
  slug text not null references public.short_links(slug) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer_host text,
  country text
);

create index if not exists short_link_clicks_slug_clicked_at_idx
  on public.short_link_clicks (slug, clicked_at desc);

-- 兩張表都開 RLS，只有管理員能讀寫（寫法同課表）

-- 查目標網址和記一筆點擊在同一個函式裡，一次來回就好
create or replace function public.resolve_short_link(
  p_slug text, p_referrer_host text, p_country text, p_log boolean
) returns text
language sql
volatile
security definer
set search_path to 'public'
as $function$
  with link as (
    select slug, target_url from public.short_links where slug = p_slug
  ), logged as (
    -- 主查詢沒用到也會執行，Postgres 的 data-modifying CTE 一定跑一次
    insert into public.short_link_clicks (slug, referrer_host, country)
    select slug, left(p_referrer_host, 255), left(p_country, 2)
    from link where p_log
  )
  select target_url from link;
$function$;
```

slug 格式只允許小寫字母、數字和連字號，所以 `_next`、`_vercel` 和帶點的路徑本來就進不來。唯一要另外擋的就是 matcher 跳過的那三個開頭。

### 轉址（`proxy.ts` 的 go 分支）

```ts
if (kind === 'go') {
  const slug = pathname.slice(1).toLowerCase()
  if (!slug) return NextResponse.redirect(SITE_CONFIG.url, 307)
  const { data: target } = await createPublicClient().rpc('resolve_short_link', {
    p_slug: slug,
    p_referrer_host: refererHost(request.headers.get('referer')),
    p_country: request.headers.get('x-vercel-ip-country'),
    p_log: request.method === 'GET' && !LINK_PREVIEW_BOT.test(request.headers.get('user-agent') ?? ''),
  })
  return target ? NextResponse.redirect(target, 307) : shortLinkNotFound()
}
```

- 用 307。回應不帶快取標頭，瀏覽器和 Vercel 都不會快取，改了目標網址馬上生效。
- 連結貼到 LINE、IG、Slack 時，預覽爬蟲會先抓一次。這種請求照樣轉址，只是不記錄，判斷直接用 proxy 裡現成的 `LINK_PREVIEW_BOT`。清單沒涵蓋到的爬蟲還是會被算進去，點擊數拿來看趨勢就好。
- 來源只存網域。完整的 referrer 可能帶查詢字串，沒必要存。
- 國家讀 Vercel 給的 `x-vercel-ip-country`。

### 產生 slug（`app/lib/shortLinks.ts`）

```ts
// 去掉 l、o、0、1，剩 32 個字元；256 剛好是 32 的倍數，取餘數不會偏向某些字元
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function randomSlug(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('')
}
```

6 碼大約 10.7 億種組合。碰撞時資料庫會回 unique violation（`23505`），重試最多三次。只用小寫是因為短網址常常要照著投影片或海報手打，不分大小寫比較不會打錯。不用裝 nanoid。

### 管理頁

- `/links` 右上角「新增短網址」開 Modal：目標網址、自訂 slug（留空就自動產生）、備註。目標網址沒寫協定會自動補 `https://`；建好直接複製 `go.johnlin.me/xxx`。
- 目標網址存檔前用 `new URL()` 檢查，只接受 http 和 https，資料庫也有 check 再擋一次。
- 清單用後台的 DataTable，欄位有 slug（旁邊有複製鈕）、目標、備註、總點擊、近 7 天點擊、建立日期。點整列進統計頁；編輯和刪除收在每列的「⋯」選單，刪除時點擊紀錄一起刪。目標和備註太長就單行截斷。
- `/links/{slug}`：近 90 天每日點擊、來源網域排行、國家排行。先用簡單的長條列表，不裝圖表套件。

### 已知限制

- `resolve_short_link` 跟 `increment_post_view_count` 一樣，任何人都能直接呼叫它來灌點擊數。以個人用量來說可以接受。
- 短網址本身就是公開的。自訂的短 slug（像 `cv`）很好猜，不要用短網址藏不想公開的東西。

---

## 六、QR Code

2026-09-20 加的第四個工具，`tools.johnlin.me/qr`。

### 機制備忘（免得下次又忘記）

QR Code 裡面只有一串文字，沒有別的。所謂支援很多種資料，是掃描器看開頭的前綴決定要做什麼：`https://` 開網頁、`WIFI:` 問要不要連網路、`BEGIN:VCARD` 問要不要存聯絡人、`mailto:` `SMSTO:` `tel:` `geo:` 各自開對應的 App。所以這個工具的本體是「表單 → 組出正確格式的字串 → 畫成圖」，真正容易出錯的是跳脫字元（Wi-Fi 密碼裡的 `;`、vCard 值裡的 `,`），不是編碼。

另外兩件事會影響 UI：資料越多格子越密（版本越高），太密會掃不動；容錯等級 L/M/Q/H 決定最多能遮掉多少（7%／15%／25%／30%），等級越高格子越密。預設 M。

### 決定

| 項目 | 決定 |
|---|---|
| 支援格式 | 網址、純文字、Wi-Fi、聯絡人（vCard 3.0）、Email、簡訊、電話、位置，共 8 種 |
| 編碼 | 用 `qrcode` 套件（自己寫要三百行 Reed-Solomon）。畫圖不用它的 renderer，`create()` 拿模組矩陣自己畫成 SVG path，React 才能直接渲染、也不必 `dangerouslySetInnerHTML` |
| 存不存 | 存。`qr_codes` 一張表，存的是**表單欄位**不是編碼後的字串，這樣叫回表單還能改 |
| 外觀 | 不放 logo。顏色、圓角可以調，但預設值是最好掃的那組 |
| 圓角 | 點陣和定位點分開設，各一根無級滑桿（0–100%）。點陣只倒外側的角，連成一條的模組中間不會斷開；定位點是三層同心方形，半徑往內每層減一格，拉到底變成三個同心圓 |
| 顏色 | 本體和背景各一個色票，背景可以設成透明。明暗差不夠或反白時出警告，但不擋 |
| 表單 | 分「內容」和「樣式」兩個分頁，右邊的預覽兩個分頁都看得到 |
| 介面文案 | 欄位底下不放說明文字。這份文件才是說明書，介面只留「做錯了會怎樣」的即時警告（目前只有顏色對比那兩條） |
| 控制項 | 樣式分頁一律是「左標題、右控制項」的列。離散選項用藥丸（容錯等級）、連續值用膠囊滑桿、顏色用圓色票、開關用 switch——不同性質的東西不共用同一種樣子 |
| 下載 | PNG（1024px）和 SVG 兩種，不存也能直接下載 |

### 資料表（`0015_qr_codes.sql`、`0016_qr_radius.sql`、`0017_qr_style.sql`）

`id`、`label`、`kind`、`fields`（jsonb）、`level`、`radius`、`eye_radius`、`foreground`、`background`、`created_at`、`updated_at`。每個樣式欄位都有 check 擋值（色碼是 `^#[0-9a-f]{6}$`，`background` 為 null 表示透明），RLS 一樣只給 `is_admin()`。欄位名用 `fields` 不用 `values`，後者是 SQL 保留字。

樣式跟著資料走而不是當介面設定，因為從清單直接下載時也要跟當初看到的長一樣。

兩種圓角的單位不同，別搞混：`radius` 是一格的邊長比例（0–0.5，0.5 是圓點），`eye_radius` 是整個 7 格定位點的圓角程度（0–1，1 是圓環）。

### 程式

- `app/lib/qr.ts`：欄位定義 `QR_FIELDS` 和 `buildPayload()`（組字串＋跳脫）、`modulesPath()`（矩陣畫成 path）。純函式，沒有任何 import，測試在 `qr.test.mjs`。
- 網址的正規化沿用短網址的 `normalizeTarget()`，在元件層呼叫——`qr.ts` 一旦 import 別的檔案，`node --test` 就跑不動（它不認得沒有副檔名的相對路徑）。
- 表單是資料驅動的：`QR_FIELDS[kind]` 列出欄位，元件照著渲染 Input／Textarea，加一種格式只要加一組欄位定義和翻譯。
- 預覽、PNG、SVG 都從 `figureOf()` 出來，三邊不會長得不一樣。PNG 是把同一條 path 丟進 `new Path2D()` 用 canvas 畫的——套件自己的 canvas renderer 只畫得出方格，畫不出圓角。
- 點陣和定位點是兩條 path：`withoutFinders()` 把三個 7×7 挖掉之後才畫點陣，定位點由 `finderPath()` 自己畫成三層同心方形。定位點那條要配 `fill-rule="evenodd"`，中間那圈才是真的洞——背景透明時不能靠塗背景色蓋掉。
- 定位點三層的半徑是**往內減**，不是按各自尺寸等比例縮：每內縮一格，半徑減一格。等比例縮的話環在轉角會胖一圈（外圈半徑 1.58 時，轉角環寬 1.23 格、直線邊 1 格），看起來就像每層圓角一樣大。減到 0 的那層就是直角，這是對的。
- 兩根滑桿對外都是 0–100%，實際單位在呼叫端換算（點陣乘 `QR_MAX_RADIUS`，定位點直接用）。滑桿是原生 `<input type="range">` 改的，照 iOS 的標準滑桿長：細軌道（5px）＋ 圓形旋鈕，hover／拖曳時旋鈕放大 1.12 倍。軌道用 `linear-gradient` 上色，切點是 `calc(var(--p) * (100% - 旋鈕寬) / 100 + 旋鈕寬 / 2)`——直接用百分比的話，填色邊緣會跟旋鈕中心差半個旋鈕。旋鈕在兩個主題都是白的（深色主題用 `--surface` 會跟面板同色，變成空心圈）。
- 明暗差用既有的 `srgbToOklch()` 算（在元件裡呼叫，理由同上）。差距小於 0.4 或本體比背景亮就出警告。

### 已知限制

- 換資料類型會清掉已填的欄位。不同類型的同名欄位意思不一樣，留著更容易搞混。
- 資料太長（超過版本 40 的容量）會出提示，要自己刪欄位或降容錯等級。
- 沒有掃描功能，只有產生。
- 圓角是 0.5 的圓點配低容錯時，掃描成功率會掉，提示文字有寫，但沒有擋。

---

## 七、分階段

| 階段 | 內容 | 建議版本 |
|---|---|---|
| 1. tools 地基 ✅ | `subdomainOf`、proxy 分流、共用登入、manifest、Header／Footer 隱藏、工具首頁 | v1.5 Beta 1 |
| 2. 課表 ✅ | 0004 migration、節次表、課程顏色、學期切換、ScheduleGrid、編輯 Modal、課程與老師面板 | v1.5 Beta 2 |
| 3. 短網址 ✅ | 0005 migration、proxy 的 go 分支、slug 產生、管理頁、統計頁 | v1.5 Beta 3 |
| 課表介面調整 ✅ | 手機滿版、管理區收合、整列點擊編輯 | v1.5 Beta 4 |
| 表格去外框 ✅ | DataTable 無外框、捲動延伸到頁面內距、圓角 hover | v1.5 Beta 5 |
| 後台列表操作收進選單 ✅ | 標籤整列點擊編輯、標籤與文章的刪除收進「⋯」選單 | v1.5 Beta 6 |
| 4. QR Code ✅ | 0015 migration、8 種資料格式、即時預覽、PNG／SVG 下載、存成清單 | v1.11.0 |

開發在 `feat/tools` 分支，每個階段一個 commit，版本號用 v1.5 Beta x；整批併回 main 時才是 v1.5.0。

節次重疊檢查和 `randomSlug` 各留一個小測試，其他不另外寫。

---

## 八、之後再做（這次不做）

### 學分統計

學分欄位這次先留著。之後要算的時候，每學期學分就是該學期課程的 `credits` 加總，總學分再把各學期加起來。必修／選修、通識類別、成績這些之後要用到再加欄位。

### 主站的課表展示

目的是讓別人知道你什麼時候有空。先把想法記下來，到時候再細談：

- 主站開一個頁面，直接用 `ScheduleGrid`。
- 課表的表維持只給管理員。主站透過一支 `SECURITY DEFINER` 函式讀取，函式只回傳你勾選要露出的欄位，沒勾的欄位是 `null`，資料不會離開資料庫。
- 公開開關、要公開哪個學期、欄位勾選，都放在 tools 的課表頁裡（它們管的是你自己的資料，一樣不進 admin）。三個欄位全關的話，訪客只看得到灰色的「有課」色塊。

---

## 九、順手發現的

- proxy 的 matcher 用 `(?!api|trpc|_next|_vercel|auth|...)`，會讓主站所有開頭是 api、auth、trpc 的路徑跳過 next-intl，像將來如果有 `/authors` 這種頁面就會出問題。現在沒有這種頁面，先記著。
