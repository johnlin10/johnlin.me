'use client'

import { useEffect } from 'react'

// 對齊 kb-share.module.scss 的 respond-by-max-width($bp-md)
const DESKTOP = '(min-width: 901px)'

/**
 * 視窗拉寬到桌機時收起手機的目錄卡片。開著的 popover 在 top layer，
 * 不收起來的話桌機側欄會脫離版面、背景也還蓋著遮罩。
 * @param props.id 目錄 popover 的 id
 * @returns 不渲染任何東西
 */
export default function KbNavCloser({ id }: { id: string }) {
  useEffect(() => {
    const mql = matchMedia(DESKTOP)
    const close = () => {
      const nav = document.getElementById(id)
      if (mql.matches && nav?.matches(':popover-open')) nav.hidePopover()
    }
    mql.addEventListener('change', close)
    return () => mql.removeEventListener('change', close)
  }, [id])

  return null
}
