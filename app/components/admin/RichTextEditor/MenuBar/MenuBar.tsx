'use client'

import { Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import style from './MenuBar.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBold,
  faCheck,
  faCircle,
  faCode,
  faHeading,
  faHighlighter,
  faImage,
  faItalic,
  faLink,
  faLinkSlash,
  faList,
  faListOl,
  faListUl,
  faQuoteLeft,
  faRedo,
  faSquareRootVariable,
  faStrikethrough,
  faSubscript,
  faSuperscript,
  faTable,
  faTrash,
  faUnderline,
  faUndo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

interface MenuBarProps {
  editor: Editor | null
  onImageUpload: (file: File) => void
}

/**
 * 編輯器工具列
 */
export default function MenuBar({ editor, onImageUpload }: MenuBarProps) {
  const t = useTranslations('AdminPage.richTextEditor.menuBar')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showMathInput, setShowMathInput] = useState(false)
  const [mathLatex, setMathLatex] = useState('')

  //* 插入連結
  const handleSetLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
      setLinkUrl('')
      setShowLinkInput(false)
    }
  }, [editor, linkUrl])

  //* 取消連結
  const handleUnsetLink = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run()
    }
  }, [editor])

  //* 開啟公式輸入框——游標在既有公式上時預填內容，走「編輯」而非「插入」
  const openMathInput = useCallback(() => {
    if (!editor) return
    setShowLinkInput(false)
    if (editor.isActive('math')) {
      setMathLatex(editor.getAttributes('math').latex || '')
    } else {
      setMathLatex('')
    }
    setShowMathInput(true)
  }, [editor])

  //* 送出公式（新增或更新既有節點的 latex）
  const handleConfirmMath = useCallback(() => {
    if (!editor) return
    const latex = mathLatex.trim()
    if (!latex) {
      setShowMathInput(false)
      return
    }
    if (editor.isActive('math')) {
      editor.chain().focus().updateAttributes('math', { latex }).run()
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'math', attrs: { latex } })
        .run()
    }
    setShowMathInput(false)
  }, [editor, mathLatex])

  //* 插入表格 / 刪除表格
  const handleInsertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const handleDeleteTable = useCallback(() => {
    editor?.chain().focus().deleteTable().run()
  }, [editor])

  //* 圖片上傳
  const handleImageClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        onImageUpload(file)
      }
    }
    input.click()
  }, [onImageUpload])

  //* 插入程式碼區塊
  const handleCodeBlock = useCallback(() => {
    if (editor) {
      editor.chain().focus().toggleCodeBlock().run()
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className={style.menu_bar}>
      {/* 文字格式 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? style.active : ''}
          title={t('bold')}
        >
          <FontAwesomeIcon icon={faBold} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? style.active : ''}
          title={t('italic')}
        >
          <FontAwesomeIcon icon={faItalic} />{' '}
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? style.active : ''}
          title={t('underline')}
        >
          <FontAwesomeIcon icon={faUnderline} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? style.active : ''}
          title={t('strike')}
        >
          <FontAwesomeIcon icon={faStrikethrough} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive('highlight') ? style.active : ''}
          title={t('highlight')}
        >
          <FontAwesomeIcon icon={faHighlighter} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={editor.isActive('subscript') ? style.active : ''}
          title={t('subscript')}
        >
          <FontAwesomeIcon icon={faSubscript} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={editor.isActive('superscript') ? style.active : ''}
          title={t('superscript')}
        >
          <FontAwesomeIcon icon={faSuperscript} />
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 標題 */}
      <div className={style.button_group}>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive('heading', { level: 1 }) ? style.active : ''
          }
          title={t('heading1')}
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>1</code>
        </button>

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive('heading', { level: 2 }) ? style.active : ''
          }
          title={t('heading2')}
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>2</code>
        </button>

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive('heading', { level: 3 }) ? style.active : ''
          }
          title={t('heading3')}
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>3</code>
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 列表 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? style.active : ''}
          title={t('bulletList')}
        >
          <FontAwesomeIcon icon={faListUl} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? style.active : ''}
          title={t('orderedList')}
        >
          <FontAwesomeIcon icon={faListOl} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? style.active : ''}
          title={t('blockquote')}
        >
          <FontAwesomeIcon icon={faQuoteLeft} />
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 連結 */}
      <div className={style.button_group}>
        {!showLinkInput ? (
          <>
            <button
              onClick={() => {
                const previousUrl = editor.getAttributes('link').href
                setLinkUrl(previousUrl || '')
                setShowMathInput(false)
                setShowLinkInput(true)
              }}
              className={editor.isActive('link') ? style.active : ''}
              title={t('insertLink')}
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            {editor.isActive('link') && (
              <button onClick={handleUnsetLink} title={t('removeLink')}>
                <FontAwesomeIcon icon={faLinkSlash} />
              </button>
            )}
          </>
        ) : (
          <div className={style.link_input_wrapper}>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t('linkPlaceholder')}
              className={style.link_input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetLink()
                } else if (e.key === 'Escape') {
                  setShowLinkInput(false)
                }
              }}
            />
            <button onClick={handleSetLink} className={style.link_confirm}>
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => setShowLinkInput(false)}
              className={style.link_cancel}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
      </div>

      <div className={style.divider}></div>

      {/* 媒體與程式碼 */}
      <div className={style.button_group}>
        <button onClick={handleImageClick} title={t('insertImage')}>
          <FontAwesomeIcon icon={faImage} />
        </button>

        <button
          onClick={handleCodeBlock}
          className={editor.isActive('codeBlock') ? style.active : ''}
          title={t('codeBlock')}
        >
          <FontAwesomeIcon icon={faCode} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? style.active : ''}
          title={t('inlineCode')}
        >
          `
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 表格 */}
      <div className={style.button_group}>
        <button onClick={handleInsertTable} title={t('insertTable')}>
          <FontAwesomeIcon icon={faTable} />
        </button>
        {editor.isActive('table') && (
          <button onClick={handleDeleteTable} title={t('deleteTable')}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        )}
      </div>

      <div className={style.divider}></div>

      {/* 數學公式 */}
      <div className={style.button_group}>
        {!showMathInput ? (
          <button
            onClick={openMathInput}
            className={editor.isActive('math') ? style.active : ''}
            title={editor.isActive('math') ? t('editFormula') : t('insertFormula')}
          >
            <FontAwesomeIcon icon={faSquareRootVariable} />
          </button>
        ) : (
          <div className={style.link_input_wrapper}>
            <input
              type="text"
              value={mathLatex}
              onChange={(e) => setMathLatex(e.target.value)}
              placeholder={t('formulaPlaceholder')}
              className={style.link_input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmMath()
                } else if (e.key === 'Escape') {
                  setShowMathInput(false)
                }
              }}
            />
            <button onClick={handleConfirmMath} className={style.link_confirm}>
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => setShowMathInput(false)}
              className={style.link_cancel}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
      </div>

      <div className={style.divider}></div>

      {/* 其他 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title={t('horizontalRule')}
        >
          ―
        </button>

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title={t('undo')}
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title={t('redo')}
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
      </div>
    </div>
  )
}
