'use client'

import Image from 'next/image'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import { motion, useReducedMotion } from 'motion/react'
import HeroShowcase from '../HeroShowcase/HeroShowcase'
import style from './Hero.module.scss'

type Paper = { title: string; excerpt: string; date: string }
type HeroPhoto = {
  id: string
  ratio: number
  src?: string
  srcSet?: string
  blur?: string
  original?: string
}

type Props = {
  tagline: string
  name: string
  role: string
  scrollHint: string
  sourceCode: string
  papers?: Paper[]
  photos?: HeroPhoto[]
}

export default function Hero({
  name,
  tagline,
  role,
  scrollHint,
  sourceCode,
  papers,
  photos,
}: Props) {
  const reduce = useReducedMotion()

  return (
    <section className={style.hero}>
      <div className={style.heroInner}>
        <motion.div
          className={style.heroText}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className={style.heroIdentity}>
            <Image
              src={SITE_CONFIG.avatar}
              alt="John Lin"
              width={64}
              height={64}
              className={style.heroAvatar}
              priority
            />
            <p className={style.heroName}>{name}</p>
          </div>
          <h1 className={style.heroTagline}>{tagline}</h1>
          <p className={style.heroRole}>{role}</p>
        </motion.div>

        <HeroShowcase
          sourceCode={sourceCode}
          papers={papers}
          photos={photos}
        />
      </div>

      <div className={style.scrollHint} aria-hidden>
        <span>{scrollHint}</span>
        <span className={style.scrollDot} />
      </div>
    </section>
  )
}
