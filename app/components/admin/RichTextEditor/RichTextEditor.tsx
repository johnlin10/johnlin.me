'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { common, createLowlight } from 'lowlight'
import MenuBar from './MenuBar/MenuBar'
import style from './RichTextEditor.module.scss'

const lowlight = createLowlight(common)

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  onImageUpload?: (file: File) => void
}

/**
 * 富文本編輯器組件
 * 基於 TipTap，提供 Notion-like 的編輯體驗
 */
export default function RichTextEditor({
  content,
  onChange,
  placeholder = '開始撰寫...',
  onImageUpload,
}: RichTextEditorProps) {
  //* 處理圖片上傳
  const handleImageUpload = (file: File) => {
    if (onImageUpload) {
      onImageUpload(file)
    } else {
      // 如果沒有提供上傳函數，使用 base64 預覽
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target?.result as string
        editor?.chain().focus().setImage({ src: url }).run()
      }
      reader.readAsDataURL(file)
    }
  }

  //* 初始化編輯器
  const editor = useEditor({
    immediatelyRender: false, // 修復 SSR 錯誤
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
      Placeholder.configure({
        placeholder,
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
    },
  })

  return (
    <div className={style.rich_text_editor}>
      <MenuBar editor={editor} onImageUpload={handleImageUpload} />
      <EditorContent editor={editor} className={style.editor_wrapper} />
    </div>
  )
}
