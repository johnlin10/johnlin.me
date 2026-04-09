'use client'

import { useEffect, useState } from 'react'
import type { TocItem } from '@/app/types/blog'
import style from './TableOfContents.module.scss'

interface TableOfContentsProps {
  items: TocItem[]
}

/**
 * 文章目錄組件
 */
export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-80px 0px -80% 0px',
      }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [items])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <nav className={style.toc}>
      <h3 className={style.title}>目錄</h3>
      <ul className={style.list}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`${style.item} ${style[`level_${item.level}`]} ${
              activeId === item.id ? style.active : ''
            }`}
          >
            <button onClick={() => handleClick(item.id)}>{item.text}</button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
