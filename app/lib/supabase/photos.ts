import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreatePhotoInput,
  Photo,
  PhotoDerivative,
  PhotoExif,
  PhotoLocales,
  PhotoLocation,
  PhotoStatus,
  PhotoTakenAtPrecision,
  UpdatePhotoInput,
} from '@/app/types/photo'

type PhotoRow = {
  id: string
  slug: string
  derivatives: unknown
  url_original: string
  url_og: string
  blur_data_url: string | null
  original_mime: string
  original_bytes: number
  width: number
  height: number
  is_hdr: boolean
  taken_at: string
  taken_at_local: string
  taken_at_precision: PhotoTakenAtPrecision
  location: unknown
  exif: unknown
  locales: unknown
  status: PhotoStatus
  created_at: string
  updated_at: string
}

//* ==================== jsonb 正規化 ====================
// 這四個欄位在 DB 是未驗證的 jsonb，而渲染端會拿它們算版面、組 srcSet、
// 除以比例。畸形資料一律濾掉，讓下游可以無條件信任型別。

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 依 w 由小到大排序並去重，srcSet 才能直接展開。 */
function normalizeDerivatives(value: unknown): PhotoDerivative[] {
  if (!Array.isArray(value)) return []
  const byWidth = new Map<number, PhotoDerivative>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { w, url } = item as Record<string, unknown>
    const width = positiveNumber(w)
    const src = nonEmptyString(url)
    if (width === undefined || src === undefined) continue
    byWidth.set(width, { w: width, url: src })
  }
  return [...byWidth.values()].sort((a, b) => a.w - b.w)
}

function normalizeLocation(value: unknown): PhotoLocation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { lat, lng } = value as Record<string, unknown>
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return undefined
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return undefined
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined
  return { lat, lng }
}

function normalizeExif(value: unknown): PhotoExif | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const exif: PhotoExif = {}
  const make = nonEmptyString(raw.make)
  const model = nonEmptyString(raw.model)
  const lens = nonEmptyString(raw.lens)
  if (make) exif.make = make
  if (model) exif.model = model
  if (lens) exif.lens = lens
  const fNumber = positiveNumber(raw.fNumber)
  const exposureTime = positiveNumber(raw.exposureTime)
  const iso = positiveNumber(raw.iso)
  const focalLength = positiveNumber(raw.focalLength)
  if (fNumber !== undefined) exif.fNumber = fNumber
  if (exposureTime !== undefined) exif.exposureTime = exposureTime
  if (iso !== undefined) exif.iso = iso
  if (focalLength !== undefined) exif.focalLength = focalLength
  return Object.keys(exif).length > 0 ? exif : undefined
}

function normalizeLocales(value: unknown): PhotoLocales {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: PhotoLocales = {}
  for (const [locale, fields] of Object.entries(value)) {
    if (!fields || typeof fields !== 'object') continue
    const { caption, locationName } = fields as Record<string, unknown>
    const entry: PhotoLocales[string] = {}
    const c = nonEmptyString(caption)
    const l = nonEmptyString(locationName)
    if (c) entry.caption = c
    if (l) entry.locationName = l
    if (Object.keys(entry).length > 0) result[locale] = entry
  }
  return result
}

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    slug: row.slug,
    derivatives: normalizeDerivatives(row.derivatives),
    urlOriginal: row.url_original,
    urlOg: row.url_og,
    blurDataUrl: row.blur_data_url ?? undefined,
    originalMime: row.original_mime,
    originalBytes: row.original_bytes,
    width: row.width,
    height: row.height,
    isHdr: row.is_hdr,
    takenAt: row.taken_at,
    takenAtLocal: row.taken_at_local,
    takenAtPrecision: row.taken_at_precision,
    location: normalizeLocation(row.location),
    exif: normalizeExif(row.exif),
    locales: normalizeLocales(row.locales),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

//* ==================== 讀取 ====================

/**
 * 攝影牆一次拿全部。版面演算法要先知道所有照片才能算出欄位分配，
 * 沒辦法分頁 —— 這也是規模上限訂在數百張的原因。
 */
export async function getPublishedPhotos(
  supabase: SupabaseClient
): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('status', 'published')
    .order('taken_at', { ascending: false })
  if (error) throw error
  return (data as PhotoRow[]).map(mapPhoto)
}

/** 首頁 Hero 馬賽克只要最新幾張，不必把整面牆撈回來。 */
export async function getLatestPhotos(
  supabase: SupabaseClient,
  limit: number
): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('status', 'published')
    .order('taken_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as PhotoRow[]).map(mapPhoto)
}

export async function getPhotoBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Photo | null> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? mapPhoto(data as PhotoRow) : null
}

/** 後台以 id 取單張（列表已在手上時不必再查，這支給重整／輪詢用）。 */
export async function getPhotoById(
  supabase: SupabaseClient,
  id: string
): Promise<Photo | null> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapPhoto(data as PhotoRow) : null
}

export async function getPhotosForAdmin(
  supabase: SupabaseClient
): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false })
  if (error) throw error
  return (data as PhotoRow[]).map(mapPhoto)
}

/** slug 唯一性檢查，給上傳流程在 insert 前先探路。 */
export async function getTakenSlugs(
  supabase: SupabaseClient,
  slugs: string[]
): Promise<Set<string>> {
  if (slugs.length === 0) return new Set()
  const { data, error } = await supabase
    .from('photos')
    .select('slug')
    .in('slug', slugs)
  if (error) throw error
  return new Set((data as { slug: string }[]).map((r) => r.slug))
}

//* ==================== 寫入 ====================

export async function createPhoto(
  supabase: SupabaseClient,
  input: CreatePhotoInput
): Promise<string> {
  const { data, error } = await supabase
    .from('photos')
    .insert({
      ...(input.id ? { id: input.id } : {}),
      slug: input.slug,
      derivatives: input.derivatives,
      url_original: input.urlOriginal,
      url_og: input.urlOg,
      blur_data_url: input.blurDataUrl ?? null,
      original_mime: input.originalMime,
      original_bytes: input.originalBytes,
      width: input.width,
      height: input.height,
      is_hdr: input.isHdr ?? false,
      taken_at: input.takenAt,
      taken_at_local: input.takenAtLocal,
      taken_at_precision: input.takenAtPrecision ?? 'day',
      location: input.location ?? null,
      exif: input.exif ?? null,
      locales: input.locales ?? {},
      status: input.status ?? 'published',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updatePhoto(
  supabase: SupabaseClient,
  input: UpdatePhotoInput
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.slug !== undefined) patch.slug = input.slug
  if (input.takenAt !== undefined) patch.taken_at = input.takenAt
  if (input.takenAtLocal !== undefined) patch.taken_at_local = input.takenAtLocal
  if (input.takenAtPrecision !== undefined) {
    patch.taken_at_precision = input.takenAtPrecision
  }
  // location / exif 允許明確清成 null，所以要跟 undefined 分開判斷
  if (input.location !== undefined) patch.location = input.location
  if (input.exif !== undefined) patch.exif = input.exif
  if (input.locales !== undefined) patch.locales = input.locales
  if (input.status !== undefined) patch.status = input.status
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase
    .from('photos')
    .update(patch)
    .eq('id', input.id)
  if (error) throw error
}

/**
 * 批次切換狀態。一趟拍攝回來常常是整批發布，逐張打 updatePhoto 會是 30 個往返。
 */
export async function updatePhotosStatus(
  supabase: SupabaseClient,
  ids: string[],
  status: PhotoStatus
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('photos')
    .update({ status })
    .in('id', ids)
  if (error) throw error
}

export async function deletePhoto(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('photos').delete().eq('id', id)
  if (error) throw error
}

/**
 * 只刪 row。R2 上的物件要另外清（見 app/lib/r2 的 deletePrefix），
 * 兩者刻意分開：孤兒檔案不該擋住一筆已經確定要刪的資料。
 */
export async function deletePhotos(
  supabase: SupabaseClient,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('photos').delete().in('id', ids)
  if (error) throw error
}
