'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import styles from './gradient.module.scss'
import {
  autoSmooth,
  clamp,
  clamp01,
  insertNodeAt,
  mirrorHandle,
  parseGradient,
  sampleStops,
  slopeProfile,
  toCss,
  type CurveNode,
  type Stop,
} from './curve'

// 圖表座標。SVG 用固定 viewBox + width:100%，所以縮放是等比的，
// 指標座標只要按 rect 比例換算就好。
const VB = { w: 520, h: 300 }
const PAD = { l: 38, r: 16, t: 14, b: 24 }
const PLOT = {
  x: PAD.l,
  y: PAD.t,
  w: VB.w - PAD.l - PAD.r,
  h: VB.h - PAD.t - PAD.b,
}

const toSx = (x: number) => PLOT.x + x * PLOT.w
const toSy = (y: number) => PLOT.y + (1 - y) * PLOT.h
const fromSx = (px: number) => (px - PLOT.x) / PLOT.w
const fromSy = (py: number) => 1 - (py - PLOT.y) / PLOT.h

const round3 = (v: number) => Math.round(v * 1000) / 1000

const PRESETS: { name: string; stops: Stop[] }[] = [
  {
    name: 'Header 現況',
    stops: [
      { x: 0, y: 1 },
      { x: 0.4, y: 0.75 },
      { x: 0.55, y: 0.5 },
      { x: 0.7, y: 0.2 },
      { x: 0.85, y: 0.1 },
      { x: 1, y: 0 },
    ],
  },
  {
    name: '線性',
    stops: [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ],
  },
  {
    name: '晚退（尾巴長）',
    stops: [
      { x: 0, y: 1 },
      { x: 0.45, y: 0.92 },
      { x: 0.75, y: 0.45 },
      { x: 1, y: 0 },
    ],
  },
  {
    name: 'S 曲線',
    stops: [
      { x: 0, y: 1 },
      { x: 0.3, y: 0.95 },
      { x: 0.5, y: 0.5 },
      { x: 0.7, y: 0.05 },
      { x: 1, y: 0 },
    ],
  },
]

const DIRECTIONS = ['to bottom', 'to top', 'to right', 'to left']

type DragTarget = { id: string; part: 'node' | 'hIn' | 'hOut' }

export default function GradientLab() {
  const [nodes, setNodes] = useState<CurveNode[]>(() =>
    autoSmooth(PRESETS[0].stops)
  )
  const [ghost, setGhost] = useState<Stop[] | null>(PRESETS[0].stops)
  const [showGhost, setShowGhost] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tol, setTol] = useState(0.012)
  const [colorExpr, setColorExpr] = useState('var(--background-color-rgb)')
  const [direction, setDirection] = useState('to bottom')
  const [previewMode, setPreviewMode] = useState<'text' | 'stripes' | 'photo'>(
    'text'
  )
  const [previewSize, setPreviewSize] = useState(96)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragTarget | null>(null)

  const stops = useMemo(() => sampleStops(nodes, tol), [nodes, tol])
  const cssValue = useMemo(
    () => toCss(stops, direction, colorExpr, { multiline: false, property: false }),
    [stops, direction, colorExpr]
  )
  const cssBlock = useMemo(
    () => toCss(stops, direction, colorExpr),
    [stops, direction, colorExpr]
  )
  const profile = useMemo(() => slopeProfile(stops), [stops])
  const ghostProfile = useMemo(
    () => (ghost ? slopeProfile(ghost) : null),
    [ghost]
  )

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const selectedIndex = nodes.findIndex((n) => n.id === selectedId)

  // -------- 指標換算 --------

  const pointerToVb = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { px: 0, py: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      px: ((e.clientX - rect.left) / rect.width) * VB.w,
      py: ((e.clientY - rect.top) / rect.height) * VB.h,
    }
  }, [])

  // -------- 編輯 --------

  const clampHandles = (list: CurveNode[], i: number): CurveNode => {
    const n = list[i]
    const prevX = i > 0 ? list[i - 1].x : n.x
    const nextX = i < list.length - 1 ? list[i + 1].x : n.x
    return {
      ...n,
      hIn: { x: clamp(n.hIn.x, prevX, n.x), y: clamp01(n.hIn.y) },
      hOut: { x: clamp(n.hOut.x, n.x, nextX), y: clamp01(n.hOut.y) },
    }
  }

  const moveNode = (id: string, x: number, y: number) => {
    setNodes((prev) => {
      const i = prev.findIndex((n) => n.id === id)
      if (i < 0) return prev
      const n = prev[i]
      const isFirst = i === 0
      const isLast = i === prev.length - 1
      const nx = isFirst
        ? 0
        : isLast
          ? 1
          : clamp(round3(x), prev[i - 1].x + 0.01, prev[i + 1].x - 0.01)
      const ny = clamp01(round3(y))
      const dx = nx - n.x
      const dy = ny - n.y
      const next = [...prev]
      next[i] = {
        ...n,
        x: nx,
        y: ny,
        hIn: { x: n.hIn.x + dx, y: n.hIn.y + dy },
        hOut: { x: n.hOut.x + dx, y: n.hOut.y + dy },
      }
      next[i] = clampHandles(next, i)
      if (i > 0) next[i - 1] = clampHandles(next, i - 1)
      if (i < next.length - 1) next[i + 1] = clampHandles(next, i + 1)
      return next
    })
  }

  const moveHandle = (id: string, part: 'hIn' | 'hOut', x: number, y: number) => {
    setNodes((prev) => {
      const i = prev.findIndex((n) => n.id === id)
      if (i < 0) return prev
      const n = prev[i]
      if (part === 'hIn' && i === 0) return prev
      if (part === 'hOut' && i === prev.length - 1) return prev
      const lo = part === 'hIn' ? prev[i - 1].x : n.x
      const hi = part === 'hOut' ? prev[i + 1].x : n.x
      let updated: CurveNode = {
        ...n,
        [part]: {
          x: clamp(round3(x), lo, hi),
          y: clamp01(round3(y)),
        },
      }
      if (updated.smooth) updated = mirrorHandle(updated, part)
      const next = [...prev]
      next[i] = updated
      next[i] = clampHandles(next, i)
      return next
    })
  }

  const onPointerDownPart = (e: React.PointerEvent, target: DragTarget) => {
    e.stopPropagation()
    dragRef.current = target
    setSelectedId(target.id)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const { px, py } = pointerToVb(e)
    const x = fromSx(px)
    const y = fromSy(py)
    if (drag.part === 'node') moveNode(drag.id, x, y)
    else moveHandle(drag.id, drag.part, x, y)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
  }

  const onDoubleClickPlot = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * VB.w
    const x = clamp01(fromSx(px))
    const next = insertNodeAt(nodes, round3(x))
    if (next === nodes) return
    const added = next.find((n) => !nodes.some((p) => p.id === n.id))
    setNodes(next)
    if (added) setSelectedId(added.id)
  }

  const deleteNode = (id: string) => {
    setNodes((prev) => {
      const i = prev.findIndex((n) => n.id === id)
      if (i <= 0 || i >= prev.length - 1) return prev
      return prev.filter((n) => n.id !== id)
    })
    setSelectedId(null)
  }

  const toggleSmooth = (id: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        const flipped = { ...n, smooth: !n.smooth }
        return flipped.smooth ? mirrorHandle(flipped, 'hOut') : flipped
      })
    )
  }

  const smoothAll = () => {
    const kept = nodes.map((n) => n.id)
    const rebuilt = autoSmooth(nodes.map((n) => ({ x: n.x, y: n.y })))
    setNodes(rebuilt.map((n, i) => ({ ...n, id: kept[i] ?? n.id })))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selected) return
    const step = e.shiftKey ? 0.05 : 0.005
    const dx =
      e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0
    if (dx === 0 && dy === 0) return
    e.preventDefault()
    moveNode(selected.id, selected.x + dx, selected.y + dy)
  }

  const loadStops = (list: Stop[]) => {
    setNodes(autoSmooth(list))
    setGhost(list)
    setSelectedId(null)
  }

  const doImport = () => {
    const parsed = parseGradient(importText)
    if (!parsed) {
      setImportError('讀不到 stops，貼上整段 linear-gradient(...) 再試一次')
      return
    }
    setImportError(null)
    loadStops(parsed.stops)
    if (parsed.direction && DIRECTIONS.includes(parsed.direction))
      setDirection(parsed.direction)
    if (parsed.colorExpr) setColorExpr(parsed.colorExpr)
  }

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(cssBlock)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  // -------- 繪圖資料 --------

  const curvePath = useMemo(() => {
    if (nodes.length === 0) return ''
    let d = `M ${toSx(nodes[0].x)} ${toSy(nodes[0].y)}`
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]
      const b = nodes[i + 1]
      d += ` C ${toSx(a.hOut.x)} ${toSy(a.hOut.y)}, ${toSx(b.hIn.x)} ${toSy(
        b.hIn.y
      )}, ${toSx(b.x)} ${toSy(b.y)}`
    }
    return d
  }, [nodes])

  const outputPath = useMemo(
    () => stops.map((s) => `${toSx(s.x)},${toSy(s.y)}`).join(' '),
    [stops]
  )
  const ghostPath = useMemo(
    () =>
      ghost ? ghost.map((s) => `${toSx(s.x)},${toSy(s.y)}`).join(' ') : '',
    [ghost]
  )

  const maxSlope = Math.max(
    1e-6,
    ...profile.segs.map((s) => Math.abs(s.slope)),
    ...(ghostProfile?.segs.map((s) => Math.abs(s.slope)) ?? [])
  )

  // 漸層條貼著它「淡出去」的那一側：to bottom 從頂端往下淡，就貼頂
  const horizontal = direction === 'to right' || direction === 'to left'
  const previewStyle: React.CSSProperties = horizontal
    ? {
        width: `${previewSize}px`,
        top: 0,
        bottom: 0,
        left: direction === 'to right' ? 0 : 'auto',
        right: direction === 'to left' ? 0 : 'auto',
      }
    : {
        height: `${previewSize}px`,
        left: 0,
        right: 0,
        top: direction === 'to bottom' ? 0 : 'auto',
        bottom: direction === 'to top' ? 0 : 'auto',
      }

  return (
    <div className={styles.lab}>
      {/* ----- 左：曲線編輯 ----- */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Curve</h2>
          <p className={styles.panelHint}>
            拖節點與控制桿改變化曲線 · 在圖上按兩下加節點 · 節點按兩下刪除
          </p>
        </header>

        <svg
          ref={svgRef}
          className={styles.graph}
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          role="application"
          aria-label="Gradient alpha curve editor"
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClickPlot}
          onKeyDown={onKeyDown}
        >
          {/* 網格 */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={`h${v}`}>
              <line
                className={styles.grid}
                x1={PLOT.x}
                x2={PLOT.x + PLOT.w}
                y1={toSy(v)}
                y2={toSy(v)}
              />
              <text className={styles.axisLabel} x={PLOT.x - 8} y={toSy(v) + 3.5}>
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={`v${v}`}>
              <line
                className={styles.grid}
                y1={PLOT.y}
                y2={PLOT.y + PLOT.h}
                x1={toSx(v)}
                x2={toSx(v)}
              />
              <text
                className={styles.axisLabel}
                x={toSx(v)}
                y={PLOT.y + PLOT.h + 15}
                textAnchor="middle"
              >
                {v * 100}%
              </text>
            </g>
          ))}

          {/* 原始曲線（匯入或 preset 當下的樣子） */}
          {showGhost && ghostPath && (
            <polyline className={styles.ghostLine} points={ghostPath} />
          )}

          {/* 實際輸出的折線 —— 瀏覽器真正畫的東西 */}
          <polyline className={styles.outputLine} points={outputPath} />

          {/* 理想曲線 */}
          <path className={styles.curve} d={curvePath} />

          {/* 輸出 stop 的位置 */}
          {stops.map((s, i) => (
            <circle
              key={`s${i}`}
              className={styles.stopTick}
              cx={toSx(s.x)}
              cy={toSy(s.y)}
              r={2}
            />
          ))}

          {/* 控制桿 */}
          {nodes.map((n, i) => (
            <g key={`h-${n.id}`}>
              {i > 0 && (
                <>
                  <line
                    className={styles.handleArm}
                    x1={toSx(n.x)}
                    y1={toSy(n.y)}
                    x2={toSx(n.hIn.x)}
                    y2={toSy(n.hIn.y)}
                  />
                  <rect
                    className={styles.handle}
                    x={toSx(n.hIn.x) - 4}
                    y={toSy(n.hIn.y) - 4}
                    width={8}
                    height={8}
                    rx={1.5}
                    onPointerDown={(e) =>
                      onPointerDownPart(e, { id: n.id, part: 'hIn' })
                    }
                  />
                </>
              )}
              {i < nodes.length - 1 && (
                <>
                  <line
                    className={styles.handleArm}
                    x1={toSx(n.x)}
                    y1={toSy(n.y)}
                    x2={toSx(n.hOut.x)}
                    y2={toSy(n.hOut.y)}
                  />
                  <rect
                    className={styles.handle}
                    x={toSx(n.hOut.x) - 4}
                    y={toSy(n.hOut.y) - 4}
                    width={8}
                    height={8}
                    rx={1.5}
                    onPointerDown={(e) =>
                      onPointerDownPart(e, { id: n.id, part: 'hOut' })
                    }
                  />
                </>
              )}
            </g>
          ))}

          {/* 節點 */}
          {nodes.map((n) => (
            <circle
              key={n.id}
              className={`${styles.node} ${
                n.id === selectedId ? styles.nodeActive : ''
              }`}
              cx={toSx(n.x)}
              cy={toSy(n.y)}
              r={n.id === selectedId ? 6 : 5}
              onPointerDown={(e) =>
                onPointerDownPart(e, { id: n.id, part: 'node' })
              }
              onDoubleClick={(e) => {
                e.stopPropagation()
                deleteNode(n.id)
              }}
            />
          ))}
        </svg>

        {/* 對齊 x 軸的漸層條 */}
        <div
          className={styles.stripWrap}
          style={{
            marginLeft: `${(PLOT.x / VB.w) * 100}%`,
            marginRight: `${((VB.w - PLOT.x - PLOT.w) / VB.w) * 100}%`,
          }}
        >
          <div className={styles.stripChecker}>
            <div
              className={styles.strip}
              style={{
                background: toCss(stops, 'to right', colorExpr, {
                  multiline: false,
                  property: false,
                }),
              }}
            />
          </div>
        </div>

        {/* 斜率圖：接縫的高低差就是「斷層」的來源 */}
        <div className={styles.slopeBlock}>
          <div className={styles.slopeHead}>
            <span className={styles.slopeTitle}>Slope（dα/dx）</span>
            <span className={styles.slopeMeta}>
              最大接縫落差 {profile.worstJump.toFixed(2)}
              {ghostProfile
                ? ` · 原始 ${ghostProfile.worstJump.toFixed(2)}`
                : ''}
            </span>
          </div>
          <svg
            className={styles.slopeGraph}
            viewBox={`0 0 ${VB.w} 96`}
            aria-hidden="true"
          >
            <line
              className={styles.grid}
              x1={PLOT.x}
              x2={PLOT.x + PLOT.w}
              y1={88}
              y2={88}
            />
            {showGhost &&
              ghostProfile?.segs.map((s, i) => (
                <line
                  key={`gs${i}`}
                  className={styles.ghostLine}
                  x1={toSx(s.x0)}
                  x2={toSx(s.x1)}
                  y1={88 - (Math.abs(s.slope) / maxSlope) * 76}
                  y2={88 - (Math.abs(s.slope) / maxSlope) * 76}
                />
              ))}
            {profile.segs.map((s, i) => (
              <line
                key={`ss${i}`}
                className={styles.slopeSeg}
                x1={toSx(s.x0)}
                x2={toSx(s.x1)}
                y1={88 - (Math.abs(s.slope) / maxSlope) * 76}
                y2={88 - (Math.abs(s.slope) / maxSlope) * 76}
              />
            ))}
          </svg>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.presetRow}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={styles.chip}
                onClick={() => loadStops(p.stops)}
              >
                {p.name}
              </button>
            ))}
            <button type="button" className={styles.chip} onClick={smoothAll}>
              全部平滑
            </button>
          </div>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showGhost}
              onChange={(e) => setShowGhost(e.target.checked)}
            />
            顯示原始曲線
          </label>
        </div>

        {/* 選取節點的精修 */}
        <div className={styles.inspector}>
          {selected ? (
            <>
              <span className={styles.inspectorLabel}>
                節點 {selectedIndex + 1} / {nodes.length}
              </span>
              <label className={styles.numField}>
                位置
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={round3(selected.x * 100)}
                  disabled={
                    selectedIndex === 0 || selectedIndex === nodes.length - 1
                  }
                  onChange={(e) =>
                    moveNode(
                      selected.id,
                      (parseFloat(e.target.value) || 0) / 100,
                      selected.y
                    )
                  }
                />
                <span className={styles.unit}>%</span>
              </label>
              <label className={styles.numField}>
                Alpha
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={round3(selected.y)}
                  onChange={(e) =>
                    moveNode(
                      selected.id,
                      selected.x,
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={selected.smooth}
                  onChange={() => toggleSmooth(selected.id)}
                />
                平滑接點
              </label>
              <button
                type="button"
                className={styles.chip}
                disabled={
                  selectedIndex === 0 || selectedIndex === nodes.length - 1
                }
                onClick={() => deleteNode(selected.id)}
              >
                刪除
              </button>
            </>
          ) : (
            <span className={styles.inspectorLabel}>
              點一個節點來微調數值，方向鍵可以推（Shift 加大步伐）
            </span>
          )}
        </div>
      </section>

      {/* ----- 右：預覽與輸出 ----- */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Preview</h2>
          <p className={styles.panelHint}>
            底下墊了會露餡的內容——有斷層的話這裡最先看得出來
          </p>
        </header>

        <div className={styles.previewStage} data-mode={previewMode}>
          <div className={styles.previewContent} aria-hidden="true">
            {previewMode === 'text' &&
              Array.from({ length: 14 }).map((_, i) => (
                <p key={i}>
                  漸層的斷層通常不在顏色，而在斜率——同一段裡變化速度突然換檔，
                  眼睛就會沿著那條接縫看見一道線。The seam shows up where the
                  slope jumps, not where the color does.
                </p>
              ))}
            {previewMode === 'stripes' && <div className={styles.stripes} />}
            {previewMode === 'photo' && <div className={styles.photo} />}
          </div>
          <div
            className={styles.previewOverlay}
            style={{ ...previewStyle, background: cssValue }}
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>底稿</span>
            <div className={styles.segmented}>
              {(['text', 'stripes', 'photo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.segment} ${
                    previewMode === m ? styles.segmentActive : ''
                  }`}
                  onClick={() => setPreviewMode(m)}
                >
                  {m === 'text' ? '文字' : m === 'stripes' ? '條紋' : '照片'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>厚度</span>
            <input
              type="range"
              min={40}
              max={280}
              step={4}
              value={previewSize}
              onChange={(e) => setPreviewSize(Number(e.target.value))}
            />
            <span className={styles.controlValue}>{previewSize}px</span>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>方向</span>
            <select
              className={styles.select}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>顏色</span>
            <input
              className={styles.text}
              value={colorExpr}
              spellCheck={false}
              onChange={(e) => setColorExpr(e.target.value)}
              placeholder="var(--background-color-rgb) 或 #faf6ee"
            />
          </div>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>精度</span>
            <input
              type="range"
              min={0.002}
              max={0.05}
              step={0.002}
              value={0.052 - tol}
              onChange={(e) => setTol(round3(0.052 - Number(e.target.value)))}
            />
            <span className={styles.controlValue}>{stops.length} stops</span>
          </div>
        </div>

        <div className={styles.output}>
          <div className={styles.outputHead}>
            <span className={styles.outputLabel}>CSS</span>
            <button type="button" className={styles.chip} onClick={copyCss}>
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          <pre className={styles.code}>{cssBlock}</pre>
        </div>

        <div className={styles.output}>
          <div className={styles.outputHead}>
            <span className={styles.outputLabel}>從既有 CSS 匯入</span>
            <button type="button" className={styles.chip} onClick={doImport}>
              匯入
            </button>
          </div>
          <textarea
            className={styles.textarea}
            value={importText}
            spellCheck={false}
            rows={4}
            placeholder="貼上 linear-gradient(...) 整段"
            onChange={(e) => setImportText(e.target.value)}
          />
          {importError && <p className={styles.error}>{importError}</p>}
        </div>
      </section>
    </div>
  )
}
