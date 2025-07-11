import style from './Header.module.scss'
import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'

export default function Header() {
  return (
    <header className={style.header}>
      <div className={style.header_container}>
        <div className={style.header_logo}></div>
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  )
}
