import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { LINK_COVER_EDGE, toWebp } from '@/app/lib/images/noteDerivatives'
import { noteLinkCoverKey } from '@/app/lib/r2/keys'
import { putObject } from '@/app/lib/r2/objects'
import type { LinkPreview } from '@/app/types/note'

const TIMEOUT_MS = 5000
// YouTube 的 og:title 在 700KB 左右（head 前面塞滿內嵌腳本）；讀到 </head> 就會提早停
const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const USER_AGENT = 'Mozilla/5.0 (compatible; johnlin.me link preview; +https://johnlin.me)'

// 對方的封面圖只收這幾種，一律轉成 webp 存
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

// 本機、內網、鏈路本地、保留位址：伺服器幫忙抓網址時不能被拿來打這些地方
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 3],
] as const) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6')

function isBlockedAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) return blocked.check(mapped[1], 'ipv4')
  return blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4')
}

/**
 * 只放行解析到公開位址的 http(s) 網址。
 * ponytail: 檢查跟 fetch 各解析一次 DNS，擋不住 DNS rebinding；端點只有管理員能打，先這樣。
 */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new Error('blocked address')
  }
}

/** 手動跟轉址，每一跳都重新檢查位址。 */
async function safeFetch(input: string, accept: string): Promise<Response> {
  let url = new URL(input)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept },
    })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    if (!res.ok) throw new Error(`status ${res.status}`)
    return res
  }
  throw new Error('too many redirects')
}

/**
 * 讀到 limit 位元組為止；stopAt 有給就在出現該字串時提早停（HTML 讀到 </head> 就夠了）。
 */
async function readCapped(res: Response, limit: number, stopAt?: string): Promise<Uint8Array> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  const probe = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
    if (size >= limit || (stopAt && probe.decode(value, { stream: true }).includes(stopAt))) {
      await reader.cancel()
      break
    }
  }
  return Buffer.concat(chunks).subarray(0, limit)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** 收集 <meta property|name=… content=…>，key 一律小寫。 */
function readMeta(html: string): Map<string, string> {
  const meta = new Map<string, string>()
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
    }
    const key = (attrs.property ?? attrs.name)?.toLowerCase()
    if (key && attrs.content && !meta.has(key)) meta.set(key, decodeEntities(attrs.content).trim())
  }
  return meta
}

function clip(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || undefined
}

/** 封面圖轉成 webp 存到 R2 notes/links/；任何一步失敗就回 undefined，卡片照樣可以沒有圖。 */
async function copyImage(src: string): Promise<string | undefined> {
  try {
    const res = await safeFetch(src, 'image/*')
    const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!IMAGE_TYPES.has(type)) return undefined
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return undefined
    const bytes = await readCapped(res, MAX_IMAGE_BYTES + 1)
    if (bytes.byteLength > MAX_IMAGE_BYTES) return undefined

    const { body } = await toWebp(bytes, LINK_COVER_EDGE)
    return await putObject(noteLinkCoverKey(randomUUID()), body, 'image/webp')
  } catch (error) {
    console.warn('[api/admin/link-preview] image', src, error)
    return undefined
  }
}

const requestBody = z.object({ url: z.string().url() })

/**
 * 短文編輯器的網址預覽：讀對方網頁的 OG／Twitter／<title>，封面圖轉存到 R2。
 * proxy 保護不到 /api，權限檢查靠 requireAdmin()。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  const parsed = requestBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  const { url } = parsed.data

  try {
    const res = await safeFetch(url, 'text/html,application/xhtml+xml')
    const type = res.headers.get('content-type') ?? ''
    if (!/html/i.test(type)) throw new Error(`content-type ${type}`)

    const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8'
    const bytes = await readCapped(res, MAX_HTML_BYTES, '</head>')
    let html: string
    try {
      html = new TextDecoder(charset).decode(bytes)
    } catch {
      html = new TextDecoder().decode(bytes)
    }

    const meta = readMeta(html)
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    const title = clip(
      meta.get('og:title') ?? meta.get('twitter:title') ?? (titleTag && decodeEntities(titleTag)),
      200
    )
    if (!title) throw new Error('no title')

    const imageSrc = meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image')
    const image = imageSrc ? await copyImage(new URL(imageSrc, url).href) : undefined

    const result: LinkPreview = {
      url,
      title,
      description: clip(
        meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'),
        300
      ),
      siteName: clip(meta.get('og:site_name'), 80),
      image,
    }
    return NextResponse.json({ result })
  } catch (error) {
    console.warn('[api/admin/link-preview]', url, error)
    return NextResponse.json({ error: '抓不到這個網址的預覽' }, { status: 422 })
  }
}
