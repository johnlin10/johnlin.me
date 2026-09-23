import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getKbSharedNote } from '@/app/lib/supabase/kb'
import { splitNote } from '@/app/lib/kb'
import { OG_FONT, OG_HEIGHT, OG_LOGO, OG_WIDTH, ogCard } from '@/app/lib/og-card.mjs'

// 字型 13MB，每個執行個體只讀一次
const font = readFile(join(process.cwd(), OG_FONT))
const logo = readFile(join(process.cwd(), OG_LOGO)).then(
  (data) => `data:image/png;base64,${data.toString('base64')}`,
)

/**
 * 知識庫分享頁的 OG 圖：筆記所在的資料夾、筆記標題，加「分享給你的筆記」。
 * 跟分享頁一樣走分享函式，token 不對或看不到那篇就 404，撤銷後也拿不到。
 * @param request `?token=&path=&locale=`，path 是帶 .md 的分享路徑
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const token = params.get('token')
  const path = params.get('path')
  const note = token && path && (await getKbSharedNote(createPublicClient(), token, path))
  if (!note) return new Response(null, { status: 404 })

  const locale = params.get('locale') === 'en' ? 'en' : 'zh-tw'
  const t = await getTranslations({ locale, namespace: 'KbShare' })
  return new ImageResponse(
    ogCard({
      name: splitNote(note.path, note.content).title,
      // 分享路徑的資料夾，跟分享頁網址一樣，不露出 vault 的完整路徑
      path: note.path.split('/').slice(0, -1).join(' / '),
      tagline: [t('description')],
      logo: await logo,
      brandSuffix: t('ogBrand'),
    }),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [{ name: 'GenKiMin', data: await font, style: 'normal' }],
      // 分享頁每次現場讀，撤銷要立刻生效，圖也不快取
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
