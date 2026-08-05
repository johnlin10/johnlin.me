import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { incrementViewCount } from '@/app/lib/supabase/posts'

/**
 * POST /api/views
 * 接收 { postId } 並呼叫 Supabase RPC 累加瀏覽數。
 * 去重邏輯由前端 localStorage cooldown 負責。
 */
export async function POST(request: NextRequest) {
  try {
    const { postId } = (await request.json()) as { postId?: string }

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid postId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    await incrementViewCount(supabase, postId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
