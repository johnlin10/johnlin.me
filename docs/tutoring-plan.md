# 完善就學排課 規劃

tools 的第三個工具，2026-09-16 定案。跟 [`tools-plan.md`](tools-plan.md) 同一種寫法：做完一個階段就回來更新這份。

---

## 一、要解決什麼

完善就學是學校給經濟不利學生的輔助機制，用課後學習取代工讀。我們參加四個方案：課後輔導（老師開課）、課業共學（同學互相輔導）、競賽輔導（一位指導老師）、證照輔導（學校單位開課）。

實際的麻煩不在制度，在排時間：

1. 要喬出幾個同學都有空的時段，還要避開指導老師的課。
2. 沒有一個地方看得到「這週幾點、在哪裡、誰跟誰」，都靠群組訊息。
3. 每個月要盯著累積時數，月底才發現差幾小時就來不及補。
4. 臨時調時間，整套又要重來一次。

所以這個工具只做三件事：**看得到誰有空**、**排定的時段大家都看得到**、**時數隨時知道剩多少**。

---

## 二、已經定下來的事

| 項目 | 決定 |
|---|---|
| 放哪 | `tools.johnlin.me/tutoring`，跟課表、短網址並列 |
| 誰能編輯 | 只有你。同學的課表、輔導時段全部由你維護 |
| 同學怎麼看 | 主站上一個帶 token 的公開唯讀頁 `johnlin.me/tutoring/{token}`，不必登入、不進搜尋引擎 |
| 公開頁能做什麼 | 切月份看排定的輔導時段、勾選成員疊他們的課表比對、看該月時數 |
| 課表 | **所有人的課表都建在課表工具裡**，完善就學直接讀，不自己存一份。課表以外的忙碌（打工、社團）才記在 `tutoring_busy` |
| 時間顆粒度 | 開始時間任意（15:20 也行），**長度**最少 1 小時、往上每 0.5 小時一階。結束時間由長度推算 |
| 星期 | 只有週一到週五。規定不能排週末，畫出來只是佔掉五天的寬度 |
| 時數上限 | 課後輔導＋課業共學＋競賽輔導，每人每月合計 40 小時。證照輔導另計、不進這個合計 |
| 金額 | 不算。系統只管時間和時數 |
| 結算單位 | 月。頁面的主要單位就是月份，月份底下再切週 |
| 資料權限 | 新的表一律只給 `is_admin()`；公開頁走一支 `SECURITY DEFINER` 函式，只回露得出去的欄位 |

**證照輔導是另一套算法。** 學校按開課總時數分級距核發：5 小時（含）以內 1,500 元、6–10 小時 2,500 元、11–20 小時 5,000 元、21–40 小時 10,000 元、41–80 小時 15,000 元、81 小時以上 18,000 元。級距寫在這裡備查，**系統不算金額**，只把時數加總顯示出來，你自己對照。它也因此不進 40 小時合計，單獨一欄。而且級距看的是**開課總時數**，不是單月，所以那一欄顯示「該月／累計」兩個數字，累計不分月份從頭加。

跟課表的關係是**共用元件、不共用資料**。課表（`schedule_slots`）是你自己的、以節次為單位；這裡是所有人的、以時間為單位。硬要合成一張表，會變成一張什麼都塞得進去但每個欄位都可能是 null 的表。分開，中間用一支「把你的課表匯成忙碌時段」的按鈕接起來就好。

---

## 三、預設值（沒意見就照這樣做）

1. **月份是主要單位**，因為計劃按月結算。頁首切月份，時數統計跟著那個月；月份底下再切週，只在當月的週之間切——要看別的月份就切月份。視圖和統計永遠對得上，不會出現「看著十月的週、下面顯示九月的時數」。跨月的那一週照樣畫完整七天，每場的時數算在自己日期所屬的月份。
2. 週視圖是一張 08:00–22:00 的時間軸。找空檔得靠它：忙碌時段是每週循環的，排在週的格子上才看得出誰有空。
3. 時間軸畫週一到週五五欄。週末不能排輔導，日期落在週末時存檔會擋下來。
4. 排時段時，如果參與者或指導老師在那個時間有課，**擋下來並說是誰**。課表資料不準就先去改課表，不給「仍要儲存」的後門。
5. 同一個人同一時間重複排，一樣擋。
6. 四個方案各一個固定顏色，沿用課程顏色表的 key：課後輔導 `blue`、課業共學 `green`、競賽輔導 `orange`、證照輔導 `violet`。忙碌時段一律灰色。
7. 新增時段預設帶「你點的那一格」或當週的今天 19:00，長度預設 2 小時。
8. 成員分學生和老師兩種。老師只是「要避開的人」，不會被算時數。
9. 忙碌時段綁學期，沿用現有的 `semesters` 表。換學期就建新的一份，舊的留著。
10. 公開頁的 token 隨機 10 碼，存在資料庫裡，可以在編輯頁重新產生（舊連結立刻失效）。

---

## 四、資料表（`supabase/migrations/0006_tutoring.sql`）

```sql
-- 0008 從 tutoring_people 改名過來：課表工具也用它，不再只屬於完善就學
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null,              -- 'student' | 'teacher'
  created_at timestamptz not null default now(),
  constraint tutoring_people_name_check check (btrim(name) <> ''),
  constraint tutoring_people_role_check check (role in ('student', 'teacher'))
);

-- 0008 加在課表上：每一格屬於誰。課程和老師仍然跨人共用
alter table public.schedule_slots
  add column person_id uuid references public.people(id) on delete cascade;

-- 課表以外的忙碌：打工、社團這種對不上節次的東西
create table if not exists public.tutoring_busy (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.tutoring_people(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  day smallint not null,
  start_time time not null,
  end_time time not null,
  label text,                      -- 選填，像「微積分」
  constraint tutoring_busy_day_check check (day between 1 and 7),
  constraint tutoring_busy_range_check check (end_time > start_time)
);

create table if not exists public.tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  program text not null,           -- after_class | peer | contest | license
  date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  -- 指導老師；老師刪掉時段留著
  teacher_id uuid references public.tutoring_people(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutoring_sessions_program_check
    check (program in ('after_class', 'peer', 'contest', 'license')),
  -- 最少 1 小時，往上每 0.5 小時一階
  constraint tutoring_sessions_duration_check check (
    end_time > start_time
    and extract(epoch from (end_time - start_time)) >= 3600
    and mod(extract(epoch from (end_time - start_time))::int, 1800) = 0
  )
);

create table if not exists public.tutoring_attendees (
  session_id uuid not null references public.tutoring_sessions(id) on delete cascade,
  person_id uuid not null references public.tutoring_people(id) on delete cascade,
  primary key (session_id, person_id)
);

-- 公開頁的 token，只會有一列
create table if not exists public.tutoring_share (
  id boolean primary key default true,
  token text not null unique,
  enabled boolean not null default true,
  constraint tutoring_share_single_row check (id)
);
```

索引：`tutoring_busy (semester_id, person_id)`、`tutoring_sessions (date)`、`tutoring_attendees (person_id)`。`updated_at` 觸發器照 `schedule_slots` 的寫法接 `set_updated_at()`。五張表都開 RLS，policy 一律 `is_admin()`。

幾個選擇的理由：

- **時數不存在資料庫裡，每次從起訖時間算。** 存一份小時數就多一個會跟時間對不上的欄位。加總是幾十筆資料的事，前端算就好。
- **時薪和身分別不存。** 40 小時上限對誰都一樣，金額不影響排時間。存了反而讓「誰是哪一級」這種資訊跟著資料到處跑，公開頁一個手滑就露出去。要算錢的時候再說（第九節）。
- **參與者獨立一張表，不是 `person_id` 陣列。** 課業共學一場好幾個人，時數是按人算的；陣列查不了「這個人這個月幾小時」。
- **忙碌時段用 `time` 不用節次。** 老師的空堂、同學的打工時間本來就不對齊節次。
- **課表只在學期期間有效。** `semesters` 有 `start_date`、`end_date`（0009 加的），完善就學讀所有學期的課表，某一天只套用日期落在學期內的那份，開學前、學期結束後、寒暑假都不算有課，時間軸也不會疊上去。最新的學期沒填的那一邊不設限（跟沒有日期之前的行為一樣）；舊學期要兩個日期都填了才套用，不然它的課會套到每一週，連現在這學期也被擋。判斷寫在 `inTerm()`，有測試。
- **課表不複製一份，每次讀。** `getScheduleBusy()` 直接查 `schedule_slots`，用 `PERIODS` 把節次換算成時間，課名和教室當成備註帶進來。匯入會留下第二份資料，課表改了這邊就過期；直接讀不會，代價只是每次多一次查詢。
- **課程和老師跨人共用，只有時段屬於個人。** 同班的一門課只建一次，每個人各自標自己的時段，同一門課在所有人的課表上也就是同一個顏色，疊起來比對時很好認。代價是課程清單是整個學期的池子，不分人。
- **`tutoring_busy` 只剩課表以外的東西。** 打工、社團這些對不上節次，塞進課表反而要為它們發明假課程。
- **`tutoring_share` 用單列表。** 放環境變數就換不了 token，放程式裡就得重新部署。

### 公開頁的函式

`0010_tutoring_board.sql` 的 `get_tutoring_board(p_token)`：`security definer`，只 `grant` 給 `anon` 和 `authenticated`。token 不對或連結關掉就回 null，頁面當 404。一次回：

- `month`：台灣時間的這個月。公開頁只能往前、往後翻一個月，因為資料只拿到這麼多。
- `people`：只有 id、名字、身分（同學／老師）。
- `semesters`：全部學期和起訖日期，前端照編輯頁同一套規則（`slotInEffect`）判斷哪一天套哪份課表。
- `slots`：課表工具的格子，帶課名和學期。節次換成時間在 server component 做（`slotsToBusy`），跟編輯頁共用。
- `busy`：課表以外的忙碌時間。
- `sessions`：上個月前一週到下個月後一週的時段，**不含 `note`**，參與者攤平成 id 陣列。
- `license_hours`：每人證照輔導的累計時數，不限月份。

一次來回拿完，資料量幾十筆。

---

## 五、編輯頁（`tools.johnlin.me/tutoring`）

頁首右上是「新增時段」。月份切換（‹ 2026 年 9 月 ›）和週次放在**頁首的第二層**：同底色、同寬、貼齊頁首底緣，看起來跟頁首是一組；但它不是 PageHeader 的 subbar（那個是 fixed），而是頁面最上面的一般區塊，會跟著內容捲走。手機上時間軸直接接在它底下。週次只列當月的週。

週次是一個**置中的滾動選擇器**：捲到哪一格、哪一格就是選的那一週（捲停 120ms 後才更新，不然時間軸會跟著抖），點一格也會把它捲到正中間。兩側用 `mask-image` 淡出，露出前後幾週。判斷「中間是哪一格」要用 `getBoundingClientRect` 比螢幕座標——`offsetLeft` 是相對於定位父層，不是這個捲動容器，用它算出來的中心是錯的。

**上半，週時間軸 `WeekTimeline`**：08:00–22:00，週一到週五五欄。輔導時段照方案上色，忙碌時段是灰色半透明的底。時間軸正下方一排成員 chip，點一下就把那個人的課表疊上去，一次一個——這就是「比對」。放在下面而不是上面，是為了讓時間軸頂上只剩月份和週次兩列。元件放 `app/components/schedule/WeekTimeline/`，跟 `ScheduleGrid` 並列，因為公開頁也要用同一個。

時間軸用百分比定位，不用 CSS grid 的列：任意時間都放得下，13:10 這種不對齊格線的時間也照畫。超出 08:00–22:00 的部分夾在邊界上。

區塊是淡色圓角卡片，左邊一條內縮的圓頭色條（不貼邊），第一行時間、第二行標題。時間行寫起訖（`15:00–17:00`），輔導時段接著用較淡的字寫時數（`2h`）；手機一欄只剩五十幾 px，只留開始時間，結束看區塊高度。時數文字由頁面傳進 `TimelineItem.badge`。課表工具的 `ScheduleGrid` 用同一套卡片，第一行是第一節的開始時間。墊底的灰色課表不畫色條和圓角。

同一天重疊的輔導時段並排，重疊的連成一群、群內欄數一致，寬度才不會參差（`layoutLanes`）。比對**一次只疊一個人**：點一個名字顯示他的課表，點別人就換過去，再點同一個就收起來。忙碌時段鋪滿整欄、半透明墊在輔導時段底下。試過兩種多人一起疊的做法都不好：全部鋪滿整欄會讓同時有課的名字和課名印在一起；每人一條直欄又跟「不同天也是左右排」混在一起。切換著看反而最清楚。

手機上七欄擠在 375px 裡，中文會變成一字一行，所以改成橫向捲動（每欄至少 3.75rem），左邊的時間軸 sticky 不動。

**下半，該月時數**：一列一個學生，欄是三個受上限的方案、合計、證照輔導。合計那格顯示 `5.5 / 40` 加一條進度條，剩 8 小時以內轉黃、超過上限轉紅。證照那欄是「該月／累計」，累計用 `getSessionsOf('license')` 撈全部、不分月份，因為級距看的是開課總時數。老師不在表上——他們不算時數。

**收合的管理區**（原生 `<details>`，跟課表一樣）：左邊是成員（點名字編名字和身分），中間是忙碌時間——先選一個人，再列出他這學期的所有忙碌時段。帶課名的那幾條是課表工具換算來的，只能看；課表以外的（打工、社團）在這裡加、在這裡改。右邊是公開連結（第六節）。

課表本身在**課表工具**裡維護：頁首多一個「誰的課表」，跟學期切換並列，選了誰就編誰的課表。下拉最後一個是「新增成員」，所以不必先跑去完善就學那頁建人。

同班的同學不必一堂一堂重打：課表是空的時候，網格上方會出現「從別人複製」，管理區也常駐一個。複製會跳過跟現有時段重疊的，所以按第二次不會疊出垃圾。複製完兩份各自獨立——刪掉不上的課、加上自己的選修都不會動到來源。真正共用（一格掛多人）要加一張關聯表，還得在每一格上選人，而同班也一定有人選修不同，划不來。

成員分同學和老師：老師只出現在「指導老師」的選單裡，參與者的 chip 只列同學，時數也只算同學的。

新增時段時，日期預設落在**目前顯示的那一週**，不是今天——不然切到下個月還得再改一次日期。

**新增／編輯時段 Modal**：方案、日期、開始、結束、地點、指導老師、參與者、備註。

- 開始時間是原生 `<input type="time">`，任意分鐘都填得進去；接著選**時長**（1 到 8 小時，0.5 一階），結束時間推算出來顯示在旁邊。規定的顆粒度是長度的顆粒度，15:20 開始上兩小時完全合規，所以不要把它套在開始時間上。
- 參與者是一排可點的名字 chip，只列學生。
- 存檔前依序檢查：是不是週末 → 有沒有選參與者 → 參與者和指導老師有沒有課 → 同一個人有沒有重複排。哪一項不過就說清楚是誰、卡在哪。長度不必檢查，它只能從選單來。
- 重複排那一項，是拿那個日期現場再查一次資料庫，不是拿畫面上已經載入的時段比對。日期改到別的月份時，畫面上的資料根本沒有那一天。
- 編輯時多一個刪除（ConfirmDialog）。

寫入照課表現在的做法：`app/lib/supabase/tutoring.ts` 放讀寫函式，client 端直接打 Supabase，RLS 擋非管理員。Modal、Input、DropdownSelect、ConfirmDialog、Toast 全部沿用後台的。

---

## 六、公開頁（`johnlin.me/tutoring/{token}`）

路由在主站的 `app/[locale]/tutoring/[token]/`，但**不帶個人網站的 Header 和 Footer**（`Header` 和 `FooterGate` 看到 `tutoring` 這個 segment 就不畫），分頁標題也不加網站名稱——它是給同學看的輔導時間表，不是在推銷網站。主題跟著瀏覽者存過的設定或系統，因為切換鈕在 Header 裡。`noIndex`、`referrer: no-referrer`（token 就在網址上，點出去的連結不能把它帶走）。分享預覽用自己的封面（`public/assets/og/tutoring.png`、`tutoring-en.png`，由 `scripts/generate-og.mjs` 產生，不帶 logo 和網域），`og:site_name` 也改成頁面名稱，`og:url` 指回這頁本身。token 不對或連結關掉就 404，而且 404 頁不帶這頁的標題。

編輯頁和公開頁共用 `app/components/schedule/TutoringBoard/`：`useWeekPicker`（月份和週的狀態）、`WeekPicker`（月份切換加週次滾動選擇器）、`TutoringBoard`（時間軸、疊課表比對、該月時數）。編輯頁多傳 `onItemClick` 和 `onEmptyClick`，公開頁不傳，時段就不能點。

- 上面：月份和週的滾動選擇器，月份只有上個月、這個月、下個月；在時間軸上左右滑也能換週，滑到範圍外拉不動。
- 中間：時間軸和比對，下面接這週的時段列表（日期、時間、方案、地點、指導老師、參與者），手機上比時間軸好讀。
- 下面：該月時數，跟編輯頁同一張表。

資料在 server component 用匿名 client 呼叫 `get_tutoring_board`，metadata 和頁面用 React `cache` 共用同一次查詢。月份切換在前端做，不用再來回。

參與者的名字照成員清單的順序排，不照加入的先後，兩頁同一群人都是同一個順序。

### token 管理

編輯頁的管理區多一欄「公開連結」：

- 還沒建立時只有「建立連結」。
- 建立後顯示完整網址，可以複製、關閉／開啟、重新產生（ConfirmDialog，舊連結立刻失效）。
- token 10 碼，在瀏覽器用 `crypto.getRandomValues` 產生，字元表去掉 0/O、1/l/I 這些容易看錯的。`tutoring_share` 是單列表，一律 upsert。

### 語系

介面照常中英雙語，但方案名稱（完善就學、課後輔導、課業共學、競賽輔導、證照輔導）學校沒有官方英文，`en.json` 裡也用中文，不自己翻。

---

## 七、不放進公開頁的東西

完善就學的參加資格本身就是經濟狀況的資訊。頁面會被貼進群組、截圖轉傳，所以：

- 不顯示身分別、時薪、金額，這些資料庫裡根本不存。
- 不顯示計劃名稱以外的任何個人備註；`note` 欄位只給你自己看。
- token 保護加 `noIndex`，但這只擋搜尋引擎和亂猜，**拿到連結的人就看得到**。連結當成「群組內部的東西」，不要貼到公開場合。

---

## 八、分階段

| 階段 | 內容 | 版本 |
|---|---|---|
| 1 ✅ | 0006 migration、`app/lib/tutoring.ts`（時間工具、方案、時數計算）、`WeekTimeline` 元件 | v1.6 Beta 1 |
| 2 ✅ | 編輯頁：月份與週切換、時間軸、新增／編輯時段、衝突檢查、成員與忙碌時段管理 | v1.6 Beta 2 |
| 3 ✅ | 0007 migration、精確的開始時間與時長、我的課表直接讀課表工具、只畫週一到週五 | v1.6 Beta 3 |
| 4 ✅ | 0008 migration、課表工具支援多人、完善就學讀所有人的課表 | v1.6 Beta 4 |
| 5 ✅ | 月時數表、課表複製 | v1.6 Beta 5 |
| 修 ✅ | 時數表捲動延伸到頁面內距；0009 migration、學期起訖日期，課表只在學期期間有效 | v1.6 Beta 5 |
| 修 ✅ | 深色主題下課表的灰色調暗；比對一次只疊一個人；區塊改成時間領頭、內縮色條的卡片，輔導時段加時數（課表頁同步） | v1.6 Beta 6 |
| 6 ✅ | 0010 migration、`get_tutoring_board` 函式、公開頁、token 管理；時間軸、比對、時數表抽成共用的 `TutoringBoard` | v1.6 Beta 7 |

開發在 `feat/tutoring` 分支，一個階段一個 commit，整批併回 main 才是 v1.6.0。

時數計算和衝突檢查各留一個小測試（照 `periods.test.mjs` 的寫法），其他不另外寫：

```bash
node --test app/lib/tutoring.test.mjs
```

時間工具、方案和時數計算全放在 `app/lib/tutoring.ts` 一個檔案裡。本來拆成 `time.ts` 和 `programs.ts`，但 Node 的 TS 剝離要求相對 import 帶副檔名，跨檔 import 測試就跑不起來，而為了這個去動全專案的 tsconfig 不划算。

---

## 九、待確認與之後再做

- **假日已經有了（v1.9.0）。** 國定假日和補課日放在 `calendar_days`，排程檢查會擋掉假日，
  補課的週六照被補的那天算忙碌。資料表和編輯頁見 [`tools-plan.md`](tools-plan.md) 第四節的「假日與補課」。
  國定假日可以從公開行事曆（ics）一鍵匯入。
  還沒做的：週六欄位 —— 看板目前只畫週一到週五，補課的週六看不到。
- **金額。** 目前確定不做。真要做，課後輔導那三個方案是每十小時 3,000／4,000（看身分別），證照輔導照第二節的級距表。做了就得在 `tutoring_people` 存身分別，而那個欄位絕對不能進公開頁的函式。
- **`PERIODS` 還是佔位的節次表。** `app/lib/schedule/periods.ts` 裡的節次時間是常見制度，不是學校的。你的課表換算成忙碌時段時用的就是它，所以那份表不準，衝突檢查就跟著不準。要用之前先把學校真正的節次時間填進去。
- **同學自己登入編輯。** 要走到這一步得加一層成員角色、整套 RLS 和邀請流程，工作量是現在這版的三四倍。先用「你維護＋公開唯讀」跑一學期，真的卡在改時間再說。
- **臨時調時間的通知。** 現在改了時段，同學得自己回去看頁面。之後可以考慮在公開頁標「三天內有異動」。
