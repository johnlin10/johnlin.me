import type { Photo } from '@/app/types/photo'

//* ==================== 攝影牆版面演算法 ====================
// 純函式，完全不碰 DOM，也不吃 viewport 尺寸 —— 產出的是「牆座標」下每張照片的
// 絕對矩形。呈現層再用單一 transform（translate + scale）把整面牆搬到畫面上。
// 因此視窗 resize 時這裡的結果完全不用重算，只有 geometry.ts 的 fit 值要更新。

/** 牆座標下的固定欄寬。照片一律等寬，高度隨原始比例變。 */
export const COL_W = 320
/** 照片下方資訊卡在牆座標的高度（含與照片的間距）。 */
export const CARD_H = 68
/** 欄內相鄰照片（含卡片）之間的最小垂直間距。 */
export const GAP_Y = 32
/** 同一年份組內、欄與欄之間的水平間距。 */
export const GAP_X = 48
/** 年份組之間的額外留白，讓時間分段在視覺上讀得出來。 */
export const GROUP_GAP_X = 160
/**
 * 掛畫帶的最小高度。實際帶高取全牆最高欄與此值的較大者。
 * 所有欄與前言一律「向上對齊」（頂端貼齊 y=0）—— 頂邊是唯一的水平基準線，
 * 讓使用者在不同年份照片數差異大時仍有固定的動線起點、不會失去方向感。
 * 底部因各欄張數不同而參差，這是刻意的：參差的下緣就是密度節奏。
 */
export const BAND_MIN_H = 1600
/**
 * 掛畫帶頂端、照片上方預留的高度。年份大字排在這段裡（牆座標為正值），
 * 才不會像先前那樣落在 y<0 被視窗 overflow 裁掉。
 */
export const BAND_TOP = 96
/** 年份大字的頂端 y（牆座標）。 */
export const YEAR_MARKER_Y = BAND_TOP - 60
/** 每欄最多幾張（使用者需求：垂直最多五張）。 */
export const MAX_PER_COL = 5
/** 牆最左端策展前言面板的寬度（與掛畫帶同高）。 */
export const PREFACE_W = 560

/** 缺尺寸時的比例 fallback（近似手機橫拍）。schema 保證 NOT NULL，這只是防呆。 */
const RATIO_FALLBACK = 3 / 2

export interface WallCell {
  photo: Photo
  /** 照片左上角（牆座標） */
  x: number
  y: number
  w: number
  /** 照片本身的高度（= COL_W / ratio），不含卡片 */
  photoH: number
  /** 資訊卡頂端 y（= y + photoH） */
  cardY: number
  cardH: number
  /** 全牆的欄索引（跨年份組連續遞增） */
  col: number
  /** 在該欄內的位置 0..MAX_PER_COL-1 */
  row: number
  year: number
}

export interface WallColumn {
  index: number
  x: number
  year: number
  cellCount: number
}

export interface WallYearGroup {
  year: number
  /** 該組最左欄的左緣 */
  x: number
  /** 該組所有欄的總寬（不含右側 GROUP_GAP_X） */
  width: number
  colStart: number
  colCount: number
}

export interface WallLayout {
  cells: WallCell[]
  columns: WallColumn[]
  groups: WallYearGroup[]
  /** 策展前言面板，在牆座標系內、位於最左端 */
  preface: { x: number; y: number; w: number; h: number }
  width: number
  height: number
  /** 實際採用的帶高（= max(BAND_MIN_H, 最高欄)），所有欄以 height/2 為中線對齊 */
  bandHeight: number
  /** 年份大字排列的頂端 y（牆座標） */
  yearMarkerY: number
}

/** 一欄照片（已切好），連同它的自然內容高度。 */
interface ColumnPlan {
  photos: Photo[]
  year: number
  contentHeight: number
}

/** 版面比例的唯一入口。回傳 w/h，畸形值退回 fallback。 */
export function photoRatio(photo: Photo): number {
  const { width, height } = photo
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return RATIO_FALLBACK
  }
  return width / height
}

/** 一張照片（含卡片）在欄內佔用的高度。 */
function cellHeight(photo: Photo): number {
  return COL_W / photoRatio(photo) + CARD_H
}

function columnContentHeight(photos: Photo[]): number {
  const content = photos.reduce((sum, p) => sum + cellHeight(p), 0)
  return content + GAP_Y * Math.max(0, photos.length - 1)
}

/**
 * 把一年的照片平均切成 ceil(N/MAX_PER_COL) 欄，欄與欄的張數盡量相等。
 *
 * 為什麼不用貪婪填滿：貪婪會在年份邊界與湊不滿一帶時漏出 1–2 張的殘欄，
 * 那些欄一張橫圖孤零零撐在帶子裡（填充率低到剩一成），破壞掛畫牆的整齊感。
 * 平均切分保證沒有殘欄，且每欄 ≤ MAX_PER_COL；照片維持 column-major 的時間順序。
 * 前面的欄（較新）略多一張，讓近期作品稍密。
 */
function splitBalanced(photos: Photo[]): Photo[][] {
  const n = photos.length
  if (n === 0) return []
  const k = Math.ceil(n / MAX_PER_COL)
  const base = Math.floor(n / k)
  const remainder = n % k
  const columns: Photo[][] = []
  let idx = 0
  for (let i = 0; i < k; i++) {
    const size = base + (i < remainder ? 1 : 0)
    columns.push(photos.slice(idx, idx + size))
    idx += size
  }
  return columns
}

/**
 * 產出整面牆的版面。
 *
 * 時間軸方向：最新年份在最左，往右回溯。年份組內照片依 taken_at 由新到舊、
 * column-major 填入（欄內由上而下、跨欄由左而右）。分組讀 taken_at_local 的年份
 * （taken_at 帶時區，跨年夜會歸錯組），排序讀 taken_at。
 */
export function packWall(input: Photo[]): WallLayout {
  // 先依 local 年份分組，確保同年照片一定連續（只靠 taken_at 排序，跨年夜的
  // 時區差可能讓兩張照片交錯到別組）。
  const byYear = new Map<number, Photo[]>()
  for (const photo of input) {
    const year = Number.parseInt(photo.takenAtLocal.slice(0, 4), 10)
    const bucket = byYear.get(year)
    if (bucket) bucket.push(photo)
    else byYear.set(year, [photo])
  }

  // 組內依 taken_at 由新到舊
  for (const bucket of byYear.values()) {
    bucket.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
  }
  // 年份由新到舊（最新在左）
  const years = [...byYear.keys()].sort((a, b) => b - a)

  // Pass 1：把每年切成平衡的欄，算出每欄自然高度。x 只跟固定欄寬有關，先定；
  // y 要等帶高（= 全牆最高欄）確定後才能置中，留到 Pass 2。
  const plans: ColumnPlan[] = []
  const groups: WallYearGroup[] = []
  let x = PREFACE_W + GROUP_GAP_X
  const columnX: number[] = []
  let colCursor = 0

  for (const year of years) {
    const photoColumns = splitBalanced(byYear.get(year)!)
    const groupXStart = x
    for (const colPhotos of photoColumns) {
      plans.push({
        photos: colPhotos,
        year,
        contentHeight: columnContentHeight(colPhotos),
      })
      columnX.push(x)
      x += COL_W + GAP_X
    }
    // 該組最後一欄後面多算的 GAP_X 扣回來
    const groupWidth =
      photoColumns.length > 0 ? x - GAP_X - groupXStart : 0
    groups.push({
      year,
      x: groupXStart,
      width: groupWidth,
      colStart: colCursor,
      colCount: photoColumns.length,
    })
    colCursor += photoColumns.length
    // 年份組之間換成 GROUP_GAP_X（把上面多加的 GAP_X 換掉）
    x = groupXStart + groupWidth + GROUP_GAP_X
  }

  const bandHeight = Math.max(
    BAND_MIN_H,
    ...plans.map((p) => p.contentHeight)
  )

  // Pass 2：每欄頂端貼齊 y=BAND_TOP（向上對齊，頂端留給年份大字），欄內用固定 GAP_Y 緊湊排列。
  const cells: WallCell[] = []
  const columns: WallColumn[] = []
  plans.forEach((plan, i) => {
    const colX = columnX[i]
    let y = BAND_TOP
    plan.photos.forEach((photo, row) => {
      const photoH = COL_W / photoRatio(photo)
      cells.push({
        photo,
        x: colX,
        y,
        w: COL_W,
        photoH,
        cardY: y + photoH,
        cardH: CARD_H,
        col: i,
        row,
        year: plan.year,
      })
      y += photoH + CARD_H + GAP_Y
    })
    columns.push({
      index: i,
      x: colX,
      year: plan.year,
      cellCount: plan.photos.length,
    })
  })

  // 末尾多加的 GROUP_GAP_X 要扣回來；沒有任何照片時牆寬就是前言面板寬
  const width = groups.length > 0 ? x - GROUP_GAP_X : PREFACE_W
  const totalHeight = BAND_TOP + bandHeight

  return {
    cells,
    columns,
    groups,
    preface: { x: 0, y: 0, w: PREFACE_W, h: totalHeight },
    width,
    height: totalHeight,
    bandHeight,
    yearMarkerY: YEAR_MARKER_Y,
  }
}
