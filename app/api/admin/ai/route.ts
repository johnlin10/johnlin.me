import { NextResponse, type NextRequest } from 'next/server'
import { generateObject, APICallError } from 'ai'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import {
  AI_MODEL,
  MAX_CONTENT_CHARS,
  MAX_OUTPUT_TOKENS,
  SLUG_SYSTEM_PROMPT,
  DESCRIPTION_SYSTEM_PROMPT,
  COVER_ALT_SYSTEM_PROMPT,
  KEYWORDS_SYSTEM_PROMPT,
} from '@/app/lib/ai/prompts'

const requestBody = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('slug'),
    payload: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
    }),
  }),
  z.object({
    task: z.literal('description'),
    payload: z.object({ content: z.string().min(1) }),
  }),
  z.object({
    task: z.literal('coverAlt'),
    payload: z.object({
      imageUrl: z.string().url(),
      title: z.string().optional(),
    }),
  }),
  z.object({
    task: z.literal('keywords'),
    payload: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
    }),
  }),
])

/**
 * 後台文章編輯器的 AI 輔助端點。middleware 保護不到 /api，權限檢查靠 requireAdmin()。
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
  const body = parsed.data

  try {
    switch (body.task) {
      case 'slug': {
        const { object } = await generateObject({
          model: AI_MODEL,
          schema: z.object({ slug: z.string() }),
          system: SLUG_SYSTEM_PROMPT,
          prompt: `標題：${body.payload.title}\n描述：${body.payload.description ?? ''}`,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        })
        return NextResponse.json({ result: normalizeSlug(object.slug) })
      }

      case 'description': {
        const content = body.payload.content.slice(0, MAX_CONTENT_CHARS)
        const { object } = await generateObject({
          model: AI_MODEL,
          schema: z.object({ description: z.string() }),
          system: DESCRIPTION_SYSTEM_PROMPT,
          prompt: `文章內文：${content}`,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        })
        return NextResponse.json({ result: object.description.trim() })
      }

      case 'coverAlt': {
        const imageUrl = new URL(body.payload.imageUrl)
        if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') {
          return NextResponse.json({ error: '圖片網址無效' }, { status: 400 })
        }
        const { object } = await generateObject({
          model: AI_MODEL,
          schema: z.object({ alt: z.string() }),
          system: COVER_ALT_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: body.payload.title
                    ? `文章標題（僅供參考）：${body.payload.title}`
                    : '請描述這張封面圖片。',
                },
                { type: 'image', image: imageUrl },
              ],
            },
          ],
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        })
        return NextResponse.json({ result: object.alt.trim() })
      }

      case 'keywords': {
        const { object } = await generateObject({
          model: AI_MODEL,
          schema: z.object({ keywords: z.array(z.string()).min(1).max(8) }),
          system: KEYWORDS_SYSTEM_PROMPT,
          prompt: `標題：${body.payload.title}\n描述：${body.payload.description ?? ''}`,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        })
        return NextResponse.json({ result: object.keywords })
      }
    }
  } catch (error) {
    console.error('[api/admin/ai]', error)
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 429) {
        return NextResponse.json({ error: 'AI 服務忙碌，請稍後再試' }, { status: 429 })
      }
      if (error.statusCode === 402) {
        return NextResponse.json({ error: 'AI 額度已用完' }, { status: 402 })
      }
      if (error.statusCode === 403) {
        return NextResponse.json(
          { error: '此模型需要付費額度，請至 Vercel Dashboard 儲值 AI Gateway Credits' },
          { status: 403 }
        )
      }
    }
    return NextResponse.json({ error: 'AI 產生失敗，請稍後再試' }, { status: 500 })
  }
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
