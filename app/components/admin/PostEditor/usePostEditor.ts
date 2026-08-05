import { useContext } from 'react'
import {
  PostEditorActionsContext,
  PostEditorStateContext,
  type PostEditorActions,
  type PostEditorState,
} from './PostEditorProvider'

export function usePostEditorState(): PostEditorState {
  const ctx = useContext(PostEditorStateContext)
  if (!ctx) throw new Error('usePostEditorState 必須在 PostEditorProvider 內使用')
  return ctx
}

export function usePostEditorActions(): PostEditorActions {
  const ctx = useContext(PostEditorActionsContext)
  if (!ctx) throw new Error('usePostEditorActions 必須在 PostEditorProvider 內使用')
  return ctx
}
