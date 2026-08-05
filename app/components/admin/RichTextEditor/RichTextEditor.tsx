'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TableKit } from '@tiptap/extension-table'
import CharacterCount from '@tiptap/extension-character-count'
import { common, createLowlight } from 'lowlight'
import MenuBar from './MenuBar/MenuBar'
import { Math } from './extensions/Math'
import style from './RichTextEditor.module.scss'

// 上標/下標互斥——套用其中一個時自動關掉另一個，符合排版慣例。
const ExclusiveSubscript = Subscript.extend({ excludes: 'superscript' })
const ExclusiveSuperscript = Superscript.extend({ excludes: 'subscript' })

const lowlight = createLowlight(common)

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  onImageUpload?: (file: File) => void
  /** 'boxed'（預設）＝ 原本帶邊框、固定高度的樣式；'bare' ＝ 融入頁面版面，無邊框、高度由外部撐開，也不渲染內建工具列 */
  variant?: 'boxed' | 'bare'
  onEditorReady?: (editor: Editor | null) => void
  autofocus?: boolean
}

/**
 * 富文本編輯器組件
 * 基於 TipTap，提供 Notion-like 的編輯體驗
 */
export default function RichTextEditor({
  content,
  onChange,
  placeholder,
  onImageUpload,
  variant = 'boxed',
  onEditorReady,
  autofocus = false,
}: RichTextEditorProps) {
  const t = useTranslations('AdminPage.richTextEditor')
  const resolvedPlaceholder = placeholder ?? t('defaultPlaceholder')
  //* 用 ref 存最新的 callback，避免 inline arrow 造成每次 render 都重觸發 onEditorReady
  const onImageUploadRef = useRef(onImageUpload)
  onImageUploadRef.current = onImageUpload
  const onEditorReadyRef = useRef(onEditorReady)
  onEditorReadyRef.current = onEditorReady

  //* 處理圖片上傳（工具列按鈕與拖放/貼上共用）
  const insertImageFile = (file: File, editorInstance: Editor | null) => {
    if (onImageUploadRef.current) {
      onImageUploadRef.current(file)
    } else {
      // 如果沒有提供上傳函數，使用 base64 預覽
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target?.result as string
        editorInstance?.chain().focus().setImage({ src: url }).run()
      }
      reader.readAsDataURL(file)
    }
  }

  //* 初始化編輯器
  const editor = useEditor({
    immediatelyRender: false, // 修復 SSR 錯誤
    autofocus,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 使用 CodeBlockLowlight 取代
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'editor-code-block',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
      ExclusiveSubscript,
      ExclusiveSuperscript,
      TableKit.configure({ table: { resizable: true } }),
      CharacterCount,
      Math,
      Placeholder.configure({
        placeholder: resolvedPlaceholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: style.editor_content,
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (f) => f.type.startsWith('image/')
        )
        if (files.length === 0) return false
        event.preventDefault()
        files.forEach((file) => insertImageFile(file, editor))
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (f) => f.type.startsWith('image/')
        )
        if (files.length === 0) return false
        event.preventDefault()
        files.forEach((file) => insertImageFile(file, editor))
        return true
      },
    },
  })

  useEffect(() => {
    onEditorReadyRef.current?.(editor ?? null)
  }, [editor])

  const handleToolbarImageUpload = (file: File) => insertImageFile(file, editor)

  if (variant === 'bare') {
    return (
      <div className={`${style.rich_text_editor} ${style.bare}`}>
        <EditorContent editor={editor} className={style.editor_wrapper} />
      </div>
    )
  }

  return (
    <div className={`${style.rich_text_editor} ${style.boxed}`}>
      <MenuBar editor={editor} onImageUpload={handleToolbarImageUpload} />
      <EditorContent editor={editor} className={style.editor_wrapper} />
    </div>
  )
}
