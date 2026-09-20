export type QrKind = 'url' | 'text' | 'wifi' | 'vcard' | 'email' | 'sms' | 'tel' | 'geo'

export type QrField = {
  key: string
  required?: boolean
  multiline?: boolean
  inputType?: 'text' | 'email' | 'url' | 'number'
}

// QR Code 本身只存文字，能掃出什麼取決於這些約定俗成的格式
export const QR_FIELDS: Record<QrKind, QrField[]> = {
  url: [{ key: 'url', required: true, inputType: 'url' }],
  text: [{ key: 'text', required: true, multiline: true }],
  wifi: [
    { key: 'ssid', required: true },
    { key: 'password' },
  ],
  vcard: [
    { key: 'name', required: true },
    { key: 'org' },
    { key: 'title' },
    { key: 'phone' },
    { key: 'email', inputType: 'email' },
    { key: 'url', inputType: 'url' },
  ],
  email: [
    { key: 'email', required: true, inputType: 'email' },
    { key: 'subject' },
    { key: 'body', multiline: true },
  ],
  sms: [
    { key: 'phone', required: true },
    { key: 'message', multiline: true },
  ],
  tel: [{ key: 'phone', required: true }],
  geo: [
    { key: 'lat', required: true, inputType: 'number' },
    { key: 'lng', required: true, inputType: 'number' },
  ],
}

export const QR_KINDS = Object.keys(QR_FIELDS) as QrKind[]

export const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const
export type QrLevel = (typeof QR_LEVELS)[number]

// 兩種圓角的單位不一樣。點陣的是一格的邊長比例，到 0.5 就是圓點；
// 定位點的是整個 7 格圖形的圓角程度，到 1 就是三個同心圓
export const QR_MAX_RADIUS = 0.5

// 三個定位點各佔 7×7 格，位置在每個版本都一樣
const FINDER = 7

export const QR_DEFAULT_COLORS = { foreground: '#000000', background: '#ffffff' }

/**
 * Wi-Fi 格式的跳脫：分隔用的字元前面加反斜線。
 * @param value 原始文字
 * @returns 跳脫後的文字
 */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/**
 * vCard 欄位的跳脫，換行改成字面的 \n。
 * @param value 原始文字
 * @returns 跳脫後的文字
 */
function escapeVcard(value: string): string {
  return value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

/**
 * 把表單欄位組成要編碼進 QR Code 的字串。
 * @param kind 資料種類
 * @param values 各欄位的值
 * @returns 要編碼的字串；必填沒填完或格式不對回空字串
 */
export function buildPayload(kind: QrKind, values: Record<string, string>): string {
  const v = (key: string) => (values[key] ?? '').trim()
  if (QR_FIELDS[kind].some((field) => field.required && !v(field.key))) return ''

  switch (kind) {
    case 'url':
      // 呼叫端先用 normalizeTarget() 正規化過（跟短網址同一套規則）
      return v('url')
    case 'text':
      return v('text')
    case 'wifi': {
      const password = v('password')
      const parts = [
        `T:${password ? 'WPA' : 'nopass'}`,
        `S:${escapeWifi(v('ssid'))}`,
        ...(password ? [`P:${escapeWifi(password)}`] : []),
      ]
      return `WIFI:${parts.map((part) => `${part};`).join('')};`
    }
    case 'vcard': {
      const name = v('name')
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        // N 是必填欄位，只有全名就全放在 given name
        `N:;${escapeVcard(name)};;;`,
        `FN:${escapeVcard(name)}`,
        v('org') && `ORG:${escapeVcard(v('org'))}`,
        v('title') && `TITLE:${escapeVcard(v('title'))}`,
        v('phone') && `TEL;TYPE=CELL:${escapeVcard(v('phone'))}`,
        v('email') && `EMAIL:${escapeVcard(v('email'))}`,
        v('url') && `URL:${escapeVcard(v('url'))}`,
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\r\n')
    }
    case 'email': {
      const query = (['subject', 'body'] as const)
        .filter((key) => v(key))
        .map((key) => `${key}=${encodeURIComponent(v(key))}`)
        .join('&')
      return `mailto:${v('email')}${query ? `?${query}` : ''}`
    }
    case 'sms':
      return `SMSTO:${v('phone')}:${v('message')}`
    case 'tel':
      return `tel:${v('phone').replace(/[^\d+]/g, '')}`
    case 'geo': {
      const [lat, lng] = [Number(v('lat')), Number(v('lng'))]
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return ''
      return `geo:${lat},${lng}`
    }
  }
}

/**
 * 小數點後三位就夠，再多只是讓 path 變長。
 * @param value 數字
 * @returns 修過的數字
 */
function round(value: number): number {
  return Number(value.toFixed(3))
}

/**
 * 三個定位點的左上角座標：左上、右上、左下。
 * @param size 每邊幾個模組
 * @returns 三組 [x, y]
 */
export function finderOrigins(size: number): [number, number][] {
  return [
    [0, 0],
    [size - FINDER, 0],
    [0, size - FINDER],
  ]
}

/**
 * 把三個定位點的格子清成空的，剩下的才是要當點陣畫的部分。
 * 定位點四周本來就有一圈空白分隔，清掉不會影響旁邊模組的圓角判斷。
 * @param size 每邊幾個模組
 * @param data 逐列排好的模組
 * @returns 新的一份模組資料，原本的不動
 */
export function withoutFinders(size: number, data: Uint8Array | number[]): Uint8Array {
  const rest = Uint8Array.from(data)
  for (const [ox, oy] of finderOrigins(size)) {
    for (let y = oy; y < oy + FINDER; y++) {
      for (let x = ox; x < ox + FINDER; x++) rest[y * size + x] = 0
    }
  }
  return rest
}

/**
 * 一個圓角正方形的 path。半徑等於邊長一半時就是圓形。
 * @param x 左上角 x
 * @param y 左上角 y
 * @param side 邊長
 * @param radius 圓角半徑
 * @returns path 片段
 */
function roundedSquare(x: number, y: number, side: number, radius: number): string {
  const r = round(Math.min(Math.max(radius, 0), side / 2))
  const straight = round(side - r * 2)
  const arc = (dx: number, dy: number) => (r ? `a${r} ${r} 0 0 1 ${dx} ${dy}` : '')
  return (
    `M${round(x + r)} ${round(y)}` +
    `h${straight}${arc(r, r)}` +
    `v${straight}${arc(-r, r)}` +
    `h${-straight}${arc(-r, -r)}` +
    `v${-straight}${arc(r, -r)}z`
  )
}

/**
 * 三個定位點的 path：外環、中間挖空、中心點三層同心方形。
 *
 * 三層的半徑是往內減，不是按各自的尺寸等比例縮：每往內縮一格，半徑就減一格。
 * 這樣環的寬度在轉角和直線上都是一格；等比例縮的話轉角會胖一圈（外圈 7 格用
 * 半徑 1.58 時，轉角的環寬會變成 1.23 格），看起來就像每層圓角一樣大。
 * 半徑減到 0 的那層就是直角，這是對的——外圈還不夠圓的時候，內層本來就不該先圓。
 *
 * 這條 path 要配 fill-rule="evenodd"，中間那層才會變成真的洞——背景設成透明時
 * 不能靠塗一塊背景色蓋掉。
 * @param size 每邊幾個模組
 * @param roundness 圓角程度，0 是直角，1 是三個同心圓
 * @returns path 的 d 屬性
 */
export function finderPath(size: number, roundness = 0): string {
  // 外圈半徑最大是 3.5（7 格的一半），到這裡就是正圓
  const outer = Math.min(Math.max(roundness, 0), 1) * 3.5
  return finderOrigins(size)
    .map(
      ([x, y]) =>
        roundedSquare(x, y, 7, outer) +
        roundedSquare(x + 1, y + 1, 5, outer - 1) +
        roundedSquare(x + 2, y + 2, 3, outer - 2),
    )
    .join('')
}

/**
 * 把 QR Code 的模組矩陣畫成一條 SVG path，一個深色模組一個 1×1 方格。
 *
 * 有圓角時只倒「外側」的角：一個角的上下左右兩個鄰居都是空的才倒，
 * 所以連成一整條的模組中間不會被咬出缺口，只有整塊圖形的外緣變圓。
 * @param size 每邊幾個模組
 * @param data 逐列排好的模組，非 0 是深色
 * @param radius 圓角半徑，0 到 0.5（0.5 是圓點）
 * @returns path 的 d 屬性
 */
export function modulesPath(
  size: number,
  data: Uint8Array | number[],
  radius = 0,
): string {
  const dark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && !!data[y * size + x]
  const r = Math.min(Math.max(radius, 0), 0.5)
  let d = ''

  for (let i = 0; i < size * size; i++) {
    if (!data[i]) continue
    const x = i % size
    const y = Math.floor(i / size)
    if (!r) {
      d += `M${x} ${y}h1v1h-1z`
      continue
    }
    const [up, down, left, right] = [
      dark(x, y - 1),
      dark(x, y + 1),
      dark(x - 1, y),
      dark(x + 1, y),
    ]
    const tl = !up && !left ? r : 0
    const tr = !up && !right ? r : 0
    const br = !down && !right ? r : 0
    const bl = !down && !left ? r : 0
    d += `M${round(x + tl)} ${y}`
    d += `h${round(1 - tl - tr)}`
    if (tr) d += `a${tr} ${tr} 0 0 1 ${tr} ${tr}`
    d += `v${round(1 - tr - br)}`
    if (br) d += `a${br} ${br} 0 0 1 ${-br} ${br}`
    d += `h${round(-(1 - br - bl))}`
    if (bl) d += `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}`
    d += `v${round(-(1 - bl - tl))}`
    if (tl) d += `a${tl} ${tl} 0 0 1 ${tl} ${-tl}`
    d += 'z'
  }
  return d
}
