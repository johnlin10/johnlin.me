'use client'

import SharedSaveIndicator from '@/app/components/admin/SaveIndicator/SaveIndicator'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'

/** 文章編輯器的存檔指示器：只負責把 Provider 的狀態接到通用元件上。 */
export default function SaveIndicator() {
  const { saveState, lastSavedAt } = usePostEditorState()
  const { retrySave } = usePostEditorActions()

  return (
    <SharedSaveIndicator
      state={saveState}
      lastSavedAt={lastSavedAt}
      onRetry={retrySave}
    />
  )
}
