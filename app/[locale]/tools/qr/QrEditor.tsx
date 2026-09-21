'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { createClient } from '@/app/lib/supabase/client'
import { createQrCode, updateQrCode, type QrCode } from '@/app/lib/supabase/qrCodes'
import {
  QR_DEFAULT_COLORS,
  QR_FIELDS,
  QR_KINDS,
  QR_LEVELS,
  QR_MAX_RADIUS,
  buildPayload,
  finderPath,
  modulesPath,
  withoutFinders,
  type QrKind,
  type QrLevel,
} from '@/app/lib/qr'
import { normalizeTarget } from '@/app/lib/shortLinks'
import { srgbToOklch } from '@/app/lib/color/oklch'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import Modal from '@/app/components/admin/Modal/Modal'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import style from './qr.module.scss'

export type Draft = {
  id?: string
  label: string
  kind: QrKind
  fields: Record<string, string>
  level: QrLevel
  radius: number
  eyeRadius: number
  foreground: string
  /** null 是透明背景 */
  background: string | null
}

// 樣式部分，預覽和下載都只要這些
type Style = Pick<Draft, 'level' | 'radius' | 'eyeRadius' | 'foreground' | 'background'>
type Figure = Pick<Draft, 'label' | 'kind' | 'fields'> & Style

// 明暗差低於這個值，掃描器就不容易分出模組
const MIN_CONTRAST = 0.4

// 靜止區：四週留白至少 4 格，掃描器才分得出哪裡是碼
const MARGIN = 4
// 下載的 PNG 邊長，夠印在 A4 上
const PNG_SIZE = 1024
// 只有這幾個欄位光看名字不知道要填什麼格式
const PLACEHOLDERS = new Set(['url', 'phone', 'lat', 'lng'])

/**
 * 新草稿，沒指定的都用預設樣式。
 * @param overrides 要覆蓋的欄位
 * @returns 草稿
 */
export function newDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    label: '',
    kind: 'url',
    fields: {},
    level: 'M',
    radius: 0.2,
    eyeRadius: 0.3,
    ...QR_DEFAULT_COLORS,
    ...overrides,
  }
}

/**
 * 把一筆資料轉成要編碼進 QR Code 的字串。
 * 網址先走短網址那套正規化（沒寫協定就補 https），其餘交給 buildPayload。
 * @param kind 資料種類
 * @param fields 各欄位的值
 * @returns 要編碼的字串；資料還不完整回空字串
 */
export function payloadOf(kind: QrKind, fields: Record<string, string>): string {
  return buildPayload(
    kind,
    kind === 'url' ? { url: normalizeTarget(fields.url ?? '') ?? '' } : fields,
  )
}

/**
 * 一筆存下來的資料轉成草稿，欄位名從資料庫的底線改成前端的駝峰。
 * @param code 資料庫來的一筆
 * @returns 草稿
 */
export function toDraft(code: QrCode): Draft {
  return {
    id: code.id,
    label: code.label,
    kind: code.kind,
    fields: code.fields,
    level: code.level,
    radius: code.radius,
    eyeRadius: code.eye_radius,
    foreground: code.foreground,
    background: code.background,
  }
}

/**
 * 前景和背景的明暗差。掃描器靠明暗分辨模組，差太小就讀不到；
 * 深底淺碼（反白）也有不少掃描器讀不出來。
 * @param foreground 前景色 #rrggbb
 * @param background 背景色 #rrggbb，透明背景當成白底看
 * @returns 感知明度差，以及前景是不是比背景亮
 */
function contrastOf(foreground: string, background: string | null) {
  const lightness = (hex: string) => {
    const value = Number.parseInt(hex.slice(1), 16)
    return srgbToOklch((value >> 16) & 255, (value >> 8) & 255, value & 255).l
  }
  const front = lightness(foreground)
  const back = lightness(background ?? QR_DEFAULT_COLORS.background)
  return { gap: Math.abs(front - back), inverted: front > back }
}

/**
 * 觸發瀏覽器下載。
 * @param url data: 或 blob: 網址
 * @param filename 檔名
 */
function download(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

/**
 * 檔名用的安全字串。
 * @param label 使用者取的名稱
 * @returns 去掉檔案系統不收的字元
 */
function safeName(label: string): string {
  return label.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'qrcode'
}

/**
 * 一筆資料要畫的東西。預覽、PNG、SVG 都從這裡出來，三邊才不會長得不一樣。
 * 點陣和三個定位點分成兩條 path，各自吃自己的圓角。
 * @param code 種類、欄位值和樣式
 * @returns 邊長（含留白）和兩條 path；資料不完整或太長回 null
 */
function figureOf(code: Pick<Draft, 'kind' | 'fields'> & Style) {
  const text = payloadOf(code.kind, code.fields)
  if (!text) return null
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: code.level })
    return {
      side: modules.size + MARGIN * 2,
      dots: modulesPath(modules.size, withoutFinders(modules.size, modules.data), code.radius),
      eyes: finderPath(modules.size, code.eyeRadius),
    }
  } catch {
    return null
  }
}

/**
 * 畫不出來的原因：必填沒填完，還是資料塞不進一個 QR Code。
 * @param code 種類和欄位值
 * @returns ToolsPage.qr 底下的翻譯鍵
 */
export function failureOf(code: Pick<Draft, 'kind' | 'fields'>) {
  return payloadOf(code.kind, code.fields) ? 'form.tooLong' : 'form.empty'
}

/**
 * 下載 PNG。
 * @param code 名稱、內容和樣式
 * @returns 畫不出來回 false
 */
export function savePng(code: Figure): boolean {
  const figure = figureOf(code)
  if (!figure) return false
  // 整數倍放大，模組邊緣才不會糊掉
  const scale = Math.max(1, Math.round(PNG_SIZE / figure.side))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = figure.side * scale
  const context = canvas.getContext('2d')
  if (!context) return false
  // 透明背景就什麼都不塗，canvas 本來就是透明的
  if (code.background) {
    context.fillStyle = code.background
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.setTransform(scale, 0, 0, scale, MARGIN * scale, MARGIN * scale)
  context.fillStyle = code.foreground
  context.fill(new Path2D(figure.dots))
  context.fill(new Path2D(figure.eyes), 'evenodd')
  download(canvas.toDataURL('image/png'), `${safeName(code.label)}.png`)
  return true
}

/**
 * 下載 SVG。
 * @param code 名稱、內容和樣式
 * @returns 畫不出來回 false
 */
export function saveSvg(code: Figure): boolean {
  const figure = figureOf(code)
  if (!figure) return false
  const square = !code.radius && !code.eyeRadius
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${figure.side} ${figure.side}"${square ? ' shape-rendering="crispEdges"' : ''}>`,
    code.background
      ? `<rect width="${figure.side}" height="${figure.side}" fill="${code.background}"/>`
      : '',
    `<g transform="translate(${MARGIN} ${MARGIN})" fill="${code.foreground}">`,
    `<path d="${figure.dots}"/>`,
    `<path d="${figure.eyes}" fill-rule="evenodd"/>`,
    '</g></svg>',
  ].join('')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  download(url, `${safeName(code.label)}.svg`)
  URL.revokeObjectURL(url)
  return true
}

/**
 * 樣式分頁的一列：左邊標題，右邊控制項。
 * @param props.label 欄位名稱
 * @param props.children 控制項
 * @param props.off 整列變灰、不能操作
 */
function Row({
  label,
  children,
  off,
}: {
  label: string
  children: React.ReactNode
  off?: boolean
}) {
  return (
    <div className={style.row} data-off={off || undefined}>
      <span className={style.rowLabel}>{label}</span>
      {children}
    </div>
  )
}

/**
 * 圓角滑桿。對外一律是 0–1 的比例，各自的實際單位由呼叫端換算。
 * 沒有滑塊，填滿到哪裡就是值在哪裡。
 * @param props.label 欄位名稱
 * @param props.value 0–1
 * @param props.onChange 拉動時回傳 0–1
 * @param props.format next-intl 的 formatter，百分比要跟著語系走
 */
function Slider({
  label,
  value,
  onChange,
  format,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  format: ReturnType<typeof useFormatter>
}) {
  const percent = Math.round(value * 100)
  return (
    <Row label={label}>
      <span className={style.sliderWrap}>
        <input
          className={style.slider}
          type="range"
          min={0}
          max={100}
          step={1}
          // 存的是小數，滑桿走整數百分比，來回都不會累積誤差
          value={percent}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
          style={{ '--p': percent } as React.CSSProperties}
          aria-label={label}
        />
        <span className={style.rowValue}>{format.number(value, { style: 'percent' })}</span>
      </span>
    </Row>
  )
}

/**
 * QR Code 編輯彈窗。可以只下載不儲存，儲存才寫進資料庫。
 * @param props.initial 要編輯的草稿；null 是關著
 * @param props.onClose 關閉
 * @param props.onSaved 存進資料庫之後
 * @param props.locked 內容由呼叫端決定：不顯示種類，欄位唯讀
 */
export default function QrEditor({
  initial,
  onClose,
  onSaved,
  locked,
}: {
  initial: Draft | null
  onClose: () => void
  onSaved?: () => void
  locked?: boolean
}) {
  const t = useTranslations('ToolsPage.qr')
  const format = useFormatter()
  const toast = useToast()
  const supabase = useMemo(() => createClient(), [])
  const [draft, setDraft] = useState<Draft | null>(initial)
  const [tab, setTab] = useState<'content' | 'style'>('content')

  useEffect(() => {
    setTab('content')
    setDraft(initial)
  }, [initial])

  const payload = draft ? payloadOf(draft.kind, draft.fields) : ''
  const level = draft?.level

  // 資料超過 QR Code 容量上限會丟例外，接住當成「太長」
  const matrix = useMemo(() => {
    if (!payload || !level) return null
    try {
      return QRCode.create(payload, { errorCorrectionLevel: level })
    } catch {
      return null
    }
  }, [payload, level])

  const setField = (key: string, value: string) =>
    setDraft((prev) => (prev ? { ...prev, fields: { ...prev.fields, [key]: value } } : prev))

  const contrast = draft && contrastOf(draft.foreground, draft.background)
  const warning = !contrast
    ? null
    : contrast.inverted
      ? t('form.invertedWarning')
      : contrast.gap < MIN_CONTRAST
        ? t('form.contrastWarning')
        : null

  const save = async () => {
    if (!draft) return
    const label = draft.label.trim()
    if (!label) return toast.error(t('form.labelRequired'))
    if (!payload) return toast.error(t('form.empty'))
    if (!matrix) return toast.error(t('form.tooLong'))
    const input = {
      label,
      kind: draft.kind,
      fields: draft.fields,
      level: draft.level,
      radius: draft.radius,
      eye_radius: draft.eyeRadius,
      foreground: draft.foreground,
      background: draft.background,
    }
    try {
      if (draft.id) {
        await updateQrCode(supabase, draft.id, input)
        toast.success(t('updated'))
      } else {
        await createQrCode(supabase, input)
        toast.success(t('created'))
      }
      onClose()
      onSaved?.()
    } catch {
      toast.error(t('saveError'))
    }
  }

  return (
    <Modal
      isOpen={!!draft}
      onClose={onClose}
      title={draft?.id ? t('form.editTitle') : t('form.newTitle')}
      size="large"
    >
      {draft && (
        <div className={style.editor}>
          <div className={style.form}>
            <div className={style.tabs} role="tablist">
              {(['content', 'style'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  className={style.tab}
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                >
                  {t(`form.tabs.${name}`)}
                </button>
              ))}
            </div>

            {tab === 'content' ? (
              <>
                <Input
                  label={t('form.label')}
                  value={draft.label}
                  onChange={(label) => setDraft({ ...draft, label })}
                  placeholder={t('form.labelPlaceholder')}
                  required
                />

                {!locked && (
                  <div className={style.field}>
                    <span className={style.fieldLabel}>{t('form.kind')}</span>
                    <div className={style.pills}>
                      {QR_KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={style.pill}
                          aria-pressed={draft.kind === kind}
                          // 換種類就清掉欄位，不同種類的欄位意思不一樣
                          onClick={() => setDraft({ ...draft, kind, fields: {} })}
                        >
                          {t(`kinds.${kind}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {QR_FIELDS[draft.kind].map((field) =>
                  field.multiline ? (
                    <Textarea
                      key={field.key}
                      label={t(`fields.${field.key}`)}
                      value={draft.fields[field.key] ?? ''}
                      onChange={(value) => setField(field.key, value)}
                      required={field.required}
                      disabled={locked}
                      rows={3}
                    />
                  ) : (
                    <Input
                      key={field.key}
                      label={t(`fields.${field.key}`)}
                      value={draft.fields[field.key] ?? ''}
                      onChange={(value) => setField(field.key, value)}
                      placeholder={
                        PLACEHOLDERS.has(field.key) ? t(`placeholders.${field.key}`) : undefined
                      }
                      type={field.inputType ?? 'text'}
                      required={field.required}
                      disabled={locked}
                    />
                  ),
                )}
              </>
            ) : (
              <div className={style.rows}>
                <Row label={t('form.level')}>
                  <div className={style.pills}>
                    {QR_LEVELS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={style.pill}
                        aria-pressed={draft.level === value}
                        onClick={() => setDraft({ ...draft, level: value })}
                      >
                        {t(`levels.${value}`)}
                      </button>
                    ))}
                  </div>
                </Row>

                <Slider
                  label={t('form.corner')}
                  value={draft.radius / QR_MAX_RADIUS}
                  onChange={(ratio) => setDraft({ ...draft, radius: ratio * QR_MAX_RADIUS })}
                  format={format}
                />

                <Slider
                  label={t('form.eye')}
                  value={draft.eyeRadius}
                  onChange={(eyeRadius) => setDraft({ ...draft, eyeRadius })}
                  format={format}
                />

                <Row label={t('form.foreground')}>
                  <label className={style.swatch}>
                    <input
                      type="color"
                      value={draft.foreground}
                      onChange={(event) => setDraft({ ...draft, foreground: event.target.value })}
                      aria-label={t('form.foreground')}
                    />
                    <code>{draft.foreground}</code>
                  </label>
                </Row>

                <Row label={t('form.background')} off={draft.background === null}>
                  <label className={style.swatch}>
                    <input
                      type="color"
                      value={draft.background ?? QR_DEFAULT_COLORS.background}
                      disabled={draft.background === null}
                      onChange={(event) => setDraft({ ...draft, background: event.target.value })}
                      aria-label={t('form.background')}
                    />
                    <code>{draft.background ?? '—'}</code>
                  </label>
                </Row>

                <Row label={t('form.transparent')}>
                  <button
                    type="button"
                    role="switch"
                    className={style.switch}
                    aria-checked={draft.background === null}
                    aria-label={t('form.transparent')}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        background:
                          draft.background === null ? QR_DEFAULT_COLORS.background : null,
                      })
                    }
                  >
                    <span className={style.knob} />
                  </button>
                </Row>

                {warning && <p className={style.warning}>{warning}</p>}
              </div>
            )}
          </div>

          <div className={style.preview}>
            {matrix ? (
              <>
                <svg
                  className={style.qr}
                  viewBox={`0 0 ${matrix.modules.size + MARGIN * 2} ${matrix.modules.size + MARGIN * 2}`}
                  // 直角才吃 crispEdges，有圓角要留抗鋸齒
                  shapeRendering={draft.radius || draft.eyeRadius ? undefined : 'crispEdges'}
                  // 透明背景時讓底下的格紋透出來
                  data-transparent={draft.background === null}
                  role="img"
                  aria-label={t('form.preview')}
                >
                  {draft.background && (
                    <rect
                      width={matrix.modules.size + MARGIN * 2}
                      height={matrix.modules.size + MARGIN * 2}
                      fill={draft.background}
                    />
                  )}
                  <g transform={`translate(${MARGIN} ${MARGIN})`} fill={draft.foreground}>
                    <path
                      d={modulesPath(
                        matrix.modules.size,
                        withoutFinders(matrix.modules.size, matrix.modules.data),
                        draft.radius,
                      )}
                    />
                    <path
                      d={finderPath(matrix.modules.size, draft.eyeRadius)}
                      fillRule="evenodd"
                    />
                  </g>
                </svg>
                <p className={style.info}>
                  {t('form.info', {
                    version: matrix.version,
                    size: matrix.modules.size,
                    bytes: payload.length,
                  })}
                </p>
                <div className={style.downloads}>
                  <Button
                    variant="secondary"
                    size="small"
                    fullWidth
                    onClick={() => savePng(draft) || toast.error(t(failureOf(draft)))}
                  >
                    {t('downloadPng')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    fullWidth
                    onClick={() => saveSvg(draft) || toast.error(t(failureOf(draft)))}
                  >
                    {t('downloadSvg')}
                  </Button>
                </div>
              </>
            ) : (
              <p className={style.placeholder}>{payload ? t('form.tooLong') : t('form.empty')}</p>
            )}
          </div>

          <div className={style.actions}>
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
