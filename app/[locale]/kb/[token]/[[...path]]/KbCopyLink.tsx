'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import style from './kb-share.module.scss'

/**
 * 複製這篇的網址。location.pathname 是編碼過的，中文和全形標點都會轉成 %XX：
 * 網址列複製出來的是原字，LINE 碰到「、」這類全形標點就把網址切斷。
 */
export default function KbCopyLink() {
  const t = useTranslations('KbShare')
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  const copy = async () => {
    const ok = await (
      navigator.clipboard?.writeText(location.origin + location.pathname) ?? Promise.reject()
    ).then(
      () => true,
      () => false,
    )
    setState(ok ? 'copied' : 'error')
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button type="button" className={style.copyLink} onClick={copy}>
      <Icon name={state === 'copied' ? 'check' : 'link'} />
      {t(state === 'idle' ? 'copyLink' : state)}
    </button>
  )
}
