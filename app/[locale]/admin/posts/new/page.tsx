import PostEditor from '@/app/components/admin/PostEditor/PostEditor'
import Page from '@/app/components/Page/Page'

/**
 * 新增文章頁面
 */
export default function NewPostPage() {
  return (
    <Page maxWidth="100%">
      <PostEditor mode="create" />
    </Page>
  )
}
