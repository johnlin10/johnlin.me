import { createClient } from '@/app/lib/supabase/server'
import { getPostById } from '@/app/lib/supabase/posts'
import PostEditorShell from './PostEditorShell'

/**
 * 文章編輯流程的外框。文章在伺服器端抓，切換 write ↔ settings 時 layout 不會重跑。
 */
export default async function PostEditorLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const { id } = await params
  const post = await getPostById(await createClient(), id).catch(() => undefined)
  return (
    <PostEditorShell id={id} post={post}>
      {children}
    </PostEditorShell>
  )
}
