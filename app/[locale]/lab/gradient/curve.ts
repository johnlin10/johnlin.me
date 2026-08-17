// 漸層曲線的數學核心。座標一律用 0~1 的正規化空間：
// x = 漸層位置（0% ~ 100%），y = alpha（0 ~ 1）。
// 曲線由一串節點組成，相鄰兩節點之間是一段三次貝茲，控制點就是
// 前一節點的 hOut 與後一節點的 hIn（都存絕對座標，拖起來最直覺）。

export type Point = { x: number; y: number }

export type CurveNode = {
  id: string
  x: number
  y: number
  /** 進入這個節點的控制點；第一個節點用不到，值等於節點本身 */
  hIn: Point
  /** 離開這個節點的控制點；最後一個節點用不到，值等於節點本身 */
  hOut: Point
  /** true 時兩支控制桿保持共線，拖一支另一支跟著轉——接縫平滑的關鍵 */
  smooth: boolean
}

export type Stop = { x: number; y: number }

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

export const clamp01 = (v: number) => clamp(v, 0, 1)

let uid = 0
export const nextId = () => `n${++uid}`

// -------- 貝茲求值 --------

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
}

const lerpPt = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/**
 * 給定 x 求該段貝茲的 t。控制點的 x 在拖曳時就被夾在區段內，
 * 所以 x(t) 單調遞增，二分法一定收斂。
 */
function tForX(x0: number, x1: number, x2: number, x3: number, x: number) {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (cubic(x0, x1, x2, x3, mid) < x) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** 曲線在位置 x 的 alpha */
export function alphaAt(nodes: CurveNode[], x: number): number {
  if (nodes.length === 0) return 0
  if (x <= nodes[0].x) return clamp01(nodes[0].y)
  const last = nodes[nodes.length - 1]
  if (x >= last.x) return clamp01(last.y)

  let i = 0
  while (i < nodes.length - 2 && nodes[i + 1].x < x) i++
  const a = nodes[i]
  const b = nodes[i + 1]
  const t = tForX(a.x, a.hOut.x, b.hIn.x, b.x, x)
  return clamp01(cubic(a.y, a.hOut.y, b.hIn.y, b.y, t))
}

// -------- 自動平滑 --------

/**
 * 用 Fritsch–Carlson 單調三次插值算各節點斜率，再換算成貝茲控制桿。
 * 單調資料（漸層 alpha 幾乎都是）不會過衝，轉折處也不會冒出反向的鼓包。
 */
export function autoSmooth(points: Stop[]): CurveNode[] {
  const pts = [...points].sort((p, q) => p.x - q.x)
  const n = pts.length
  if (n === 0) return []
  if (n === 1) {
    const p = pts[0]
    return [
      {
        id: nextId(),
        x: p.x,
        y: p.y,
        hIn: { ...p },
        hOut: { ...p },
        smooth: true,
      },
    ]
  }

  const dx: number[] = []
  const s: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const d = Math.max(pts[i + 1].x - pts[i].x, 1e-6)
    dx.push(d)
    s.push((pts[i + 1].y - pts[i].y) / d)
  }

  const m: number[] = new Array(n).fill(0)
  m[0] = s[0]
  m[n - 1] = s[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) {
      m[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
    }
  }
  // 端點也夾一下，避免頭尾翹起來
  if (Math.abs(m[0]) > Math.abs(3 * s[0])) m[0] = 3 * s[0]
  if (Math.abs(m[n - 1]) > Math.abs(3 * s[n - 2])) m[n - 1] = 3 * s[n - 2]

  return pts.map((p, i) => {
    const dOut = i < n - 1 ? dx[i] / 3 : 0
    const dIn = i > 0 ? dx[i - 1] / 3 : 0
    return {
      id: nextId(),
      x: p.x,
      y: p.y,
      hIn: { x: p.x - dIn, y: clamp01(p.y - m[i] * dIn) },
      hOut: { x: p.x + dOut, y: clamp01(p.y + m[i] * dOut) },
      smooth: true,
    }
  })
}

/** 把某節點的兩支控制桿拉回共線，moved 是剛剛被拖動的那一支 */
export function mirrorHandle(node: CurveNode, moved: 'hIn' | 'hOut'): CurveNode {
  const src = node[moved]
  const other = moved === 'hIn' ? 'hOut' : 'hIn'
  const cur = node[other]
  const vx = src.x - node.x
  const vy = src.y - node.y
  const len = Math.hypot(vx, vy)
  if (len < 1e-6) return node
  const otherLen = Math.hypot(cur.x - node.x, cur.y - node.y)
  return {
    ...node,
    [other]: {
      x: node.x - (vx / len) * otherLen,
      y: node.y - (vy / len) * otherLen,
    },
  }
}

/** 在 x 處插入節點。用 de Casteljau 分割，曲線形狀完全不變。 */
export function insertNodeAt(nodes: CurveNode[], x: number): CurveNode[] {
  if (nodes.length < 2) return nodes
  if (x <= nodes[0].x + 1e-4 || x >= nodes[nodes.length - 1].x - 1e-4)
    return nodes

  let i = 0
  while (i < nodes.length - 2 && nodes[i + 1].x < x) i++
  const a = nodes[i]
  const b = nodes[i + 1]
  const p0 = { x: a.x, y: a.y }
  const p1 = a.hOut
  const p2 = b.hIn
  const p3 = { x: b.x, y: b.y }
  const t = tForX(p0.x, p1.x, p2.x, p3.x, x)

  const A = lerpPt(p0, p1, t)
  const B = lerpPt(p1, p2, t)
  const C = lerpPt(p2, p3, t)
  const D = lerpPt(A, B, t)
  const E = lerpPt(B, C, t)
  const F = lerpPt(D, E, t)

  const created: CurveNode = {
    id: nextId(),
    x: F.x,
    y: F.y,
    hIn: D,
    hOut: E,
    smooth: true,
  }
  const next = [...nodes]
  next[i] = { ...a, hOut: A }
  next[i + 1] = { ...b, hIn: C }
  next.splice(i + 1, 0, created)
  return next
}

// -------- 取樣成 CSS stops --------

/**
 * 瀏覽器在兩個 color stop 之間是「直線」插值，所以輸出要做的事，是用
 * 盡量少的線段把曲線逼近到看不出來。這裡用遞迴細分：某段的中點與直線
 * 的誤差超過 tol 就切一刀。曲率大的地方自然點多，平的地方點少。
 */
export function sampleStops(nodes: CurveNode[], tol: number): Stop[] {
  if (nodes.length === 0) return []
  const out: Stop[] = []

  const rec = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    depth: number
  ) => {
    if (depth > 7 || x1 - x0 < 0.004) return
    const xm = (x0 + x1) / 2
    const ym = alphaAt(nodes, xm)
    if (Math.abs(ym - (y0 + y1) / 2) <= tol) return
    rec(x0, y0, xm, ym, depth + 1)
    out.push({ x: xm, y: ym })
    rec(xm, ym, x1, y1, depth + 1)
  }

  out.push({ x: nodes[0].x, y: clamp01(nodes[0].y) })
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    rec(a.x, clamp01(a.y), b.x, clamp01(b.y), 0)
    out.push({ x: b.x, y: clamp01(b.y) })
  }

  // 量化到實際會寫進 CSS 的精度（位置 0.1%、alpha 千分位），再把共線的中間點丟掉
  const quant = out.map((p) => ({
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
  }))
  const dedup: Stop[] = []
  for (const p of quant) {
    const prev = dedup[dedup.length - 1]
    if (prev && Math.abs(prev.x - p.x) < 0.0005) {
      dedup[dedup.length - 1] = p
      continue
    }
    dedup.push(p)
  }
  const pruned: Stop[] = []
  for (let i = 0; i < dedup.length; i++) {
    if (i === 0 || i === dedup.length - 1) {
      pruned.push(dedup[i])
      continue
    }
    const prev = pruned[pruned.length - 1]
    const next = dedup[i + 1]
    const span = next.x - prev.x
    const lin =
      span > 0
        ? prev.y + ((next.y - prev.y) * (dedup[i].x - prev.x)) / span
        : dedup[i].y
    if (Math.abs(lin - dedup[i].y) > tol / 2) pruned.push(dedup[i])
  }
  return pruned
}

// -------- CSS 進出 --------

const alphaText = (a: number) => String(Math.round(a * 1000) / 1000)

const posText = (x: number) => {
  const r = Math.round(x * 1000) / 10
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`
}

/** colorExpr 可以是 `var(--x-rgb)`、`250, 246, 238` 或 `#faf6ee` */
export function normalizeColorExpr(raw: string): string {
  const v = raw.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1]
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `${r}, ${g}, ${b}`
  }
  // `250 246 238` 這種空白分隔的新語法，補回逗號才能塞進 rgba(…, a)
  if (/^[\d.\s%]+$/.test(v) && /\s/.test(v.trim())) {
    return v.trim().split(/\s+/).join(', ')
  }
  return v
}

export function toCss(
  stops: Stop[],
  direction: string,
  colorExpr: string,
  { multiline = true, property = true } = {}
) {
  const color = normalizeColorExpr(colorExpr)
  const lines = stops.map(
    (s) => `rgba(${color}, ${alphaText(s.y)}) ${posText(s.x)}`
  )
  if (!multiline) {
    const value = `linear-gradient(${direction}, ${lines.join(', ')})`
    return property ? `background: ${value};` : value
  }
  const indent = property ? '    ' : '  '
  const body = [direction, ...lines].map((l) => indent + l).join(',\n')
  return property
    ? `background: linear-gradient(\n${body}\n  );`
    : `linear-gradient(\n${body}\n)`
}

type ParsedGradient = {
  stops: Stop[]
  direction?: string
  colorExpr?: string
}

/** 讀回既有的 linear-gradient，把 stops 拆出來。只認 rgba()/rgb()/transparent。 */
export function parseGradient(css: string): ParsedGradient | null {
  const src = css.trim()
  if (!src) return null

  let direction: string | undefined
  const dirMatch = /(to\s+(?:top|bottom|left|right)(?:\s+(?:left|right))?)|(-?[\d.]+deg)/i.exec(
    src
  )
  if (dirMatch) direction = dirMatch[0].toLowerCase().replace(/\s+/g, ' ')

  const stops: { y: number; x: number | null }[] = []
  let colorExpr: string | undefined

  const fnRe = /\b(rgba?|hsla?)\s*\(/gi
  let match: RegExpExecArray | null
  while ((match = fnRe.exec(src))) {
    let depth = 1
    let i = match.index + match[0].length
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') depth--
      i++
    }
    const inner = src.slice(match.index + match[0].length, i - 1)
    const parts = splitTopLevel(inner)
    // 通道數不固定：rgba(250, 246, 238, .5) 是四段，但 rgba(var(--x-rgb), .5)
    // 只有兩段——整個三元組被 var() 包成一段。所以看的是「最後一段是不是
    // 純數字，而且前面不是剛好三段數字」。
    const last = parts[parts.length - 1] ?? ''
    const lastIsNumber = /^-?[\d.]+%?$/.test(last)
    const hasAlpha =
      parts.length >= 2 && lastIsNumber && parts.length !== 3

    let alpha = 1
    if (hasAlpha) {
      const a = parseFloat(last.replace('%', ''))
      if (!Number.isNaN(a)) alpha = clamp01(last.includes('%') ? a / 100 : a)
    }
    // 輸出一律是 rgba()，所以只有 rgb 家族的顏色抄得回來；hsl 就維持原設定。
    if (colorExpr === undefined && /^rgba?$/i.test(match[1])) {
      colorExpr = (hasAlpha ? parts.slice(0, -1) : parts).join(', ').trim()
    }
    const rest = src.slice(i)
    const posMatch = /^\s*(-?[\d.]+)%/.exec(rest)
    stops.push({ y: alpha, x: posMatch ? parseFloat(posMatch[1]) / 100 : null })
    fnRe.lastIndex = i
  }

  for (const m of src.matchAll(/\btransparent\b\s*(?:(-?[\d.]+)%)?/gi)) {
    stops.push({ y: 0, x: m[1] ? parseFloat(m[1]) / 100 : null })
  }

  if (stops.length < 2) return null

  // 沒寫位置的 stop，照 CSS 規則在前後已知位置之間平均分配
  const resolved: Stop[] = stops.map((s, idx) => ({
    x: s.x ?? (idx === 0 ? 0 : idx === stops.length - 1 ? 1 : NaN),
    y: s.y,
  }))
  for (let i = 0; i < resolved.length; i++) {
    if (!Number.isNaN(resolved[i].x)) continue
    let j = i
    while (j < resolved.length && Number.isNaN(resolved[j].x)) j++
    const start = resolved[i - 1].x
    const end = j < resolved.length ? resolved[j].x : 1
    const gap = (end - start) / (j - i + 1)
    for (let k = i; k < j; k++) resolved[k].x = start + gap * (k - i + 1)
    i = j - 1
  }

  return {
    stops: resolved
      .map((s) => ({ x: clamp01(s.x), y: clamp01(s.y) }))
      .sort((a, b) => a.x - b.x),
    direction,
    colorExpr,
  }
}

function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if ((ch === ',' || ch === '/') && depth === 0) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// -------- 診斷 --------

/**
 * 「斷層」看的是斜率，不是 alpha 本身。實際 render 出來的漸層是折線，
 * 每段斜率是常數，接縫處的斜率跳越大，眼睛就越容易看到那條線。
 */
export function slopeProfile(stops: Stop[]) {
  const segs: { x0: number; x1: number; slope: number }[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const dx = stops[i + 1].x - stops[i].x
    segs.push({
      x0: stops[i].x,
      x1: stops[i + 1].x,
      slope: dx === 0 ? 0 : (stops[i + 1].y - stops[i].y) / dx,
    })
  }
  let worst = 0
  for (let i = 0; i < segs.length - 1; i++) {
    worst = Math.max(worst, Math.abs(segs[i + 1].slope - segs[i].slope))
  }
  return { segs, worstJump: worst }
}
