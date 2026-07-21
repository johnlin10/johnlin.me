// 生成自架的源起明體（GenKiMin TW）unicode-range 分片。
//
// 為何存在：CJK 字體很大，我們保留「整套字」但用 cn-font-split 切成上百個
// woff2 分片，瀏覽器只會下載每個頁面實際用到的分片。分片產物體積大且數量多，
// 因此不入庫（見 .gitignore），改由本腳本在 predev / prebuild 時生成。
//
// 來源：fonts/src/GenKiMin2TW-SB.otf（SIL OFL，源自 ButTaiwan/genyo-font v2.100）
// 產物：public/fonts/genkimin/（*.woff2 + genkimin.css）
//
// 產物已存在則直接略過（冪等，很快）。要強制重生請先刪除 public/fonts/genkimin/。

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontSplit } from 'cn-font-split'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SRC = join(ROOT, 'fonts/src/GenKiMin2TW-SB.otf')
const OUT = join(ROOT, 'public/fonts/genkimin')
const CSS = join(OUT, 'genkimin.css')

const FAMILY = 'GenKiMinTW'
const WEIGHT = '600' // 只自架 SemiBold 一個字重當作顯示襯線

const log = (msg) => console.log(`[fonts] ${msg}`)

// 冪等：產物已在就跳過
if (existsSync(CSS) && readdirSync(OUT).some((f) => f.endsWith('.woff2'))) {
  log('分片已存在，略過生成。')
  process.exit(0)
}

if (!existsSync(SRC)) {
  console.error(`[fonts] 找不到來源字型：${SRC}`)
  process.exit(1)
}

log('開始切分（保留全字集，不砍字）…')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

await fontSplit({
  input: readFileSync(SRC),
  outDir: OUT,
  // 直接指定 family/字重/檔名，省去後處理
  css: {
    fontFamily: FAMILY,
    fontWeight: WEIGHT,
    fontDisplay: 'swap',
    localFamily: '', // 不輸出 local()，強制使用自架分片
    fileName: 'genkimin.css', // 檔名為字面值，需自帶副檔名
    commentBase: false, // 去掉冗長的授權/名稱表註解，縮小 CSS
    commentNameTable: false,
    commentUnicodes: false,
  },
  reporter: false, // 關閉分析報告（CLI 會因此卡住不結束）
  testHtml: false, // 不產生測試 HTML
  silent: true,
})

// 清掉非字型產物（manifest 等），只留 woff2 + css
for (const f of readdirSync(OUT)) {
  if (!f.endsWith('.woff2') && f !== 'genkimin.css') {
    rmSync(join(OUT, f), { force: true })
  }
}

// 保險：若仍殘留 local()，一併移除
let css = readFileSync(CSS, 'utf8')
if (css.includes('local(')) {
  css = css.replace(/local\("[^"]*"\),?/g, '')
  writeFileSync(CSS, css, 'utf8')
}

const count = readdirSync(OUT).filter((f) => f.endsWith('.woff2')).length
log(`完成：${count} 片 woff2 + genkimin.css → public/fonts/genkimin/`)

// FFI 可能留著 handle，明確結束以免卡住 build
process.exit(0)
