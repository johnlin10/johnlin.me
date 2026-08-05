# johnlin.me 設計系統

寫給未來的自己。這份文件說明這個網站的設計系統怎麼運作、為什麼這樣設計、以及新增頁面或元件時該怎麼做。

活頁版（真實 CSS 變數即時渲染）在 [`/lab/design`](/lab/design)。這份文件講「為什麼」，活頁講「長什麼樣子」，兩個一起看。

---

## 一、設計原則

**暖色文青，不是冷灰極簡。** 主色是陶土橘（`--accent`），背景是卡其暖白（淺色）／暖黑（深色），不是任何一種通用灰階系統。新增顏色前先想：這個色系放在暖色背景上會不會顯得突兀。

**留白是主角，不是空的地方。** 頁面留白、區塊間距、卡片內距都經過 token 化，目的是讓「呼吸感」在全站一致，而不是每頁各憑手感抓一個數字。密度感受要靠 `--section-py`、`--page-gutter`、`--card-padding` 這些語意別名調整，不要為了單一頁面隨手加一個獨立的 px 值。

**極簡，不是簡陋。** 2026-07 之前這個網站有一整套擬態玻璃（毛玻璃模糊、多層邊框光影）的視覺語言，現在整套拿掉了，改成薄邊框 + 少量陰影。新元件不要再往玻璃感的方向走。

**深淺主題對等。** 兩套主題不是「一套是主要的，另一套將就著用」——語意 token（`--surface`、`--text`、`--accent`……）在兩套主題裡都要給出同樣完整、同樣講究的值。寫死一個顏色前，先確認它在另一個主題下也說得通。

**中文為先，雙語 as-needed。** 介面文案雙語，但排版節奏（字距、行高）要先讓中文舒服，英文只是套進同一個系統，不是反過來。

---

## 二、Token 架構（三層）

```
Layer 1  原始值    _tokens.scss   不分主題：間距 / 圓角 / 字級 / 行高 / 字距 / 動效 / 層級 / 版寬
Layer 2  語意角色   _theme.scss    分明暗：surface / text / border / accent / 回饋色 / 陰影
Layer 3  元件別名   _tokens.scss   page-gutter / section-py / card-padding / control-height …
```

**規則：寫版面只准用 Layer 2 與 Layer 3。** Layer 1（`--space-6`、`--text-lg` 這種數字階）是給 Layer 3 別名或真的找不到合適別名時的escape hatch，不是日常該直接寫的東西。看到一大堆 `var(--space-N)` 散落在一個元件裡，通常代表這個元件其實該有自己的語意別名（參考 `--card-padding`、`--control-height` 的做法）。

所有 token 定義在 `app/styles/`：

| 檔案 | 內容 |
|---|---|
| `_breakpoints.scss` | 斷點 Sass 變數（`$bp-sm`…`$bp-xl`）+ `respond-to()` 系列 mixin |
| `_tokens.scss` | Layer 1 + Layer 3，全部 CSS 變數，`:root` 一份，不分主題 |
| `_theme.scss` | Layer 2，`:root` / `:root.light` / `:root.dark` 三份 |
| `_mixins.scss` | Sass mixin：`flexbox()`、`container()`、`section()`、`eyebrow()`、`meta()`、`card()`、`focus-ring()`、`transition()`、`respond-to()`（透過 `@forward` 從 `_breakpoints` 帶出） |
| `design.scss` | 單一入口，`@forward 'mixins'`。新檔案 `@use '@/app/styles/design' as *;` 就好 |

`_tokens.scss` / `_theme.scss` 是**純 CSS 變數**，只在 `app/layout.tsx` 當全域樣式匯入一次，不要在個別 module.scss 裡 `@use` 它們——那是給 Sass mixin 用的匯入方式，CSS 變數本來就是全域可見，`@use` 進每個 module 只會把整包 `:root {}` 重複輸出到每支 CSS 檔。

### Layer 1：間距

4px 基準階梯，全站間距（padding / margin / gap）唯一真相來源：

```
--space-1   4px      --space-8   32px
--space-2   8px      --space-10  40px
--space-3   12px     --space-12  48px
--space-4   16px     --space-16  64px
--space-5   20px     --space-20  80px
--space-6   24px     --space-24  96px
                      --space-32  128px
```

寫一個新的 padding/margin/gap 時，先量現有效果最接近的頁面用了多少，四捨五入吸附到最近一階，不要用像 `13px`、`22px` 這種不在階梯上的數字。

### Layer 1：圓角

```
--radius-xs    4px    小標籤、行內程式碼
--radius-sm    8px    小按鈕、小圖框
--radius-md    12px   輸入框、一般按鈕、小卡片
--radius-lg    16px   卡片、Modal、大容器
--radius-xl    24px   大型面板
--radius-pill  999px  藥丸形（導覽連結、標籤、CTA）
```

### Layer 1：字級

**不是** 16px 倍數表，是錨在這個網站實際在用的字級上，目的是中文正文不會被硬拉大或拉小：

```
--text-3xs  0.75rem   --text-lg   1.125rem
--text-2xs  0.8rem    --text-xl   1.25rem
--text-xs   0.85rem   --text-2xl  1.5rem
--text-sm   0.9rem    --text-3xl  2rem
--text-md   1rem
```

流體大標另外三階，隨版寬縮放：`--text-display-sm`（1.5–2.2rem）、`--text-display`（1.9–2.6rem）、`--text-display-lg`（2–2.8rem）。首頁 Hero、頁面大標題這種「一頁只有一個」的巨大字級用這三個，不要自己寫 `clamp()`。

### Layer 1：行高 / 字距

```
--leading-tight    1.3    大標題
--leading-snug     1.45   標題、短句
--leading-normal   1.6    UI 文字、一般段落
--leading-relaxed  1.75   正文
--leading-loose    1.9    中文長文、需要呼吸感的引言
```

```
--tracking-tight   0.01em
--tracking-normal  0.02em   一般內文
--tracking-wide    0.04em   標題、強調文字
--tracking-wider   0.08em
--tracking-widest  0.18em   eyebrow（大寫小標）
```

中文行高普遍比西文寬鬆（0.02–0.04em 字距、1.6 以上行高），這是刻意的——中文字形密度高，太緊會糊成一團。看到很緊的行高/字距，先確認不是複製英文排版慣例複製錯了。

### Layer 1：動效 / 層級 / 版寬

動效三階，錨在全站原本最常用的 0.2s / 0.3s / 0.35s，不是憑空的整數：

```
--duration-fast  0.2s   微互動（hover 變色、icon）
--duration       0.3s   一般過場（面板、抽屜、卡片位移）
--duration-slow  0.35s  較大幅度的位移
--ease                  cubic-bezier(0.23, 1, 0.32, 1)，全站預設緩動
--ease-out              cubic-bezier(0.2, 0.7, 0.2, 1)，卡片類 hover 常用
```

層級（新元件疊層前先查這裡，別再憑感覺寫數字）：

```
--z-base     0
--z-raised   10    局部浮起（懸停卡片、下拉箭頭）
--z-sticky   100
--z-header   500   Header
--z-drawer   900   Menu 抽屜
--z-modal    1000  Modal
--z-toast    1100  Toast 通知
```

> AdminShell 的抽屜／topbar／scrim（120 / 150 / 200）是例外：那是後台側邊欄自己的區域性堆疊順序，跟公開站的 Header/Drawer 不會同時出現在同一個畫面，所以沒有納入全域層級表。新增後台疊層時比照這三個數字的相對關係，不要跟全域表混用。

版寬：

```
--width-feed     600px   短文 / 單欄列表
--width-content  720px   文章正文
--width-wide     1080px  首頁／關於／Footer／需要側欄的版面
--width-max      1280px  最寬容器
--width-prose    66ch    純文字段落上限
```

### Layer 2：語意色

```
表面   --surface / --surface-2 / --surface-3 / --surface-raised / --surface-sunken
文字   --text / --text-secondary / --text-muted / --text-on-accent
邊框   --border / --border-strong / --border-focus
主色   --accent / --accent-hover / --accent-soft / --accent-contrast
回饋   --danger / --danger-soft / --success / --success-soft / --warning / --warning-soft / --info / --info-soft
陰影   --shadow-sm / --shadow-md / --shadow-lg / --shadow-xl / --shadow-focus
```

- `--surface` vs `--surface-2` vs `--surface-3`：一頁裡最多疊三階背景（例如首頁奇偶區塊交錯用 surface/surface-2），疊超過三階通常代表版面資訊層次太多，該拆頁或拆區塊，不是繼續加 surface-4。
- 回饋色的色相跟 `--accent`（陶土橘，約 52°）刻意錯開——`--danger` 在 25° 附近、`--success` 在 145° 附近，降低飽和度，放在暖色背景旁邊才不會很跳。**不要**直接用網路上抄來的高飽和紅/綠。
- 陰影用暖褐色（`rgba(61, 49, 30, …)`），不是純黑。純黑陰影疊在卡其底色上會顯得髒、發灰。深色主題下陰影改回黑，因為暖褐在暗背景上顯不出層次。
- `--shadow-focus` 是鍵盤聚焦環（`0 0 0 3px var(--accent-soft)`），取代瀏覽器預設藍框——新的可聚焦元件用 `@include focus-ring;` 而不是自己寫 outline。

### Layer 3：元件別名

```
--page-gutter      頁面左右邊距，桌機 48px／平板 32px／手機 24px，自帶響應式
--section-py       區塊上下留白，clamp(64px, 12vh, 128px)
--stack-gap        直向堆疊間距，預設 --space-6
--card-padding     卡片內距，預設 --space-5
--card-gap         卡片之間的間距，預設 --space-6
--card-radius      卡片圓角，預設 --radius-md
--control-height   一般控制項高度，40px
--control-height-sm 小型控制項高度，32px
--field-radius     輸入框圓角，預設 --radius-sm
--inline-gap       行內元素間距，預設 --space-3
```

`--page-gutter` 是**全站頁面邊距唯一真相來源**——不管是 `PageContainer`、首頁 `section`、Footer，全部從這裡拿值。改邊距只改這一個變數，不要在個別頁面寫 `padding: 0 48px`。

---

## 三、版面規範

### 容器怎麼選

用 `@include container($width)`（在 `_mixins.scss`）或 `<PageContainer maxWidth="...">`：

| 用途 | 值 | 寬度 |
|---|---|---|
| 短文列表、短文詳情 | `feed` | 600px |
| 文章正文、大部分內頁 | `content`（預設） | 720px |
| 首頁、關於、Footer、有側欄的版面 | `wide` | 1080px |
| 極少數需要更寬的版面 | `max` | 1280px |
| 滿版（不加左右邊距/寬度限制） | `full` | 無限制 |

新頁面預設用 `content`，除非內容明顯需要更寬（例如兩欄版面、卡片網格）。**不要新開一個 900px、1000px 這種不在表上的寬度**——先看能不能用最近的既有值。

### 兩層版面 vs 一層版面

- **一層**（`PageContainer` 這種）：容器自己吃 `--page-gutter` 當左右 padding，直接把內容包住。多數子頁面用這個。
- **兩層**（首頁 `.section` > `.container` 這種）：外層 `section()` 吃 `--page-gutter`（左右）+ `--section-py`（上下），內層只負責 `max-width` + `margin: 0 auto`，**不能再疊一次左右 padding**。兩層版面用在「整段背景要滿版到視窗邊緣，但內容要置中收窄」的情境（例如交錯背景色的首頁分段）。

判斷用哪一層：背景色需不需要頂到視窗邊緣？需要 → 兩層；不需要 → 一層就夠。

### 頁首怎麼拼

列表頁（Blog / Notes / Lab 這類）的頁首用共用元件 `<PageHeader />`（`app/components/PageHeader/`），不要每頁各自寫一份 eyebrow/title/lead。`size="lg"` 給主要內容類頁面，`size="md"` 給次要頁面。

### 卡片怎麼拼

用 `@include card;`（`_mixins.scss`）打底（`surface-2` + 細邊框 + `card-radius` + `card-padding`），hover 時的位移/陰影/邊框變化自己疊加在呼叫端——`card()` 故意不管這段，因為每種卡片的 hover 手感不一樣（PostCard 是上浮＋暖褐陰影，WorkCard 是邊框加深＋陰影，ThingCard 是連傾斜角度一起復位）。

---

## 四、什麼時候不要用 token

- **裝飾性、刻意固定不隨主題變化的視覺**：例如首頁 Hero 的相片/紙張擬物效果、程式碼編輯器視窗（oneDark 配色）——這些「看起來就是實體照片 / 紙張 / 固定暗色編輯器」，不該隨網站深淺主題切換，維持字面值，不接語意色 token。
- **prose 內文的內部間距**（文章正文、TipTap 編輯器輸出）：用 `em` 相對單位，跟著各自的字級走，這是排版慣例，不是版面留白，不用往 `--space-N` 硬套。
- **純裝飾用的細節數字**：icon 尺寸、頭像直徑、精確到 1px 的裝飾線寬——這些是視覺尺寸決定，不是「元素之間的留白」，不必勉強對齊 4px 階梯。
- **後台內部區域性堆疊順序**（AdminShell 的 topbar/scrim/sidebar）：見上面層級章節的例外說明。

---

## 五、新增頁面 / 元件檢查清單

1. 頁面外層用 `PageContainer`，挑最接近的 `maxWidth`；需要頁首就用 `PageHeader`。
2. 顏色只寫語意 token（`--text`、`--surface-2`、`--accent`……），不要寫 hex/rgb 字面值，除非是上面「什麼時候不要用 token」列出的例外。
3. 間距（padding / margin / gap）吸附到 `--space-N` 階梯，優先找有沒有現成的 Layer 3 別名可用。
4. 字級、行高、字距都走 token，不要寫 `1.23rem` 這種隨手數字。
5. 圓角走 `--radius-*`，陰影走 `--shadow-*`，過場走 `--duration-*` + `--ease`。
6. 新的可聚焦互動元件（按鈕、連結、輸入框）補 `@include focus-ring;`。
7. 深色/淺色都手動切一次確認可讀性，尤其是新加的回饋色或裝飾色。
8. 手機寬度（375）、平板（768）、桌機（1440）都看一次，別只看桌機。
9. 寫完後跑一次 `grep -rE '#[0-9a-fA-F]{3,8}|rgba?\([0-9]' --include='*.module.scss' app`，確認新增的硬寫顏色都是刻意的例外並加註解說明原因。

---

## 六、明確禁止事項

- **不要**在 module.scss 裡寫死 hex/rgba 顏色（裝飾性例外除外，且要加註解說明為什麼）。
- **不要**新增獨立的 px 間距值——找 `--space-N` 或 Layer 3 別名。
- **不要**繞過 Layer 2/3 直接大量堆疊 Layer 1 token；那通常代表少了一個語意別名，該去 `_tokens.scss` 補一個，而不是繼續在呼叫端疊參數。
- **不要**新增斷點。目前只有 `$bp-sm`(600) / `$bp-md`(900) / `$bp-lg`(1024) / `$bp-wide`(1128) / `$bp-xl`(1280) 五個，`respond-to('phone'|'tablet'|'desktop')` 涵蓋多數情境。
- **不要**恢復擬態玻璃（毛玻璃模糊、多層光影邊框）視覺——2026-07 已經整套移除，這是刻意的美術方向決定，不是還沒做完。
- **不要**在單一 module.scss 裡各自 `@use '@/app/styles/mixins'` 又 `@use '@/app/styles/breakpoints'`——一律 `@use '@/app/styles/design' as *;`，一個入口拿到全部 mixin。
