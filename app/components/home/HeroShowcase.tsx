'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslations } from 'next-intl'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import style from './home.module.scss'

const HeroCodeWindow = dynamic(() => import('./HeroCodeWindow'), {
  ssr: false,
  loading: () => <div className={style.codeWindow} />,
})

// ratio = 寬 / 高。真實照片就緒後只要補上 src，漸層佔位會自動被取代。
type Photo = { id: string; tone: string; ratio: number; src?: string }

const PHOTOS: Photo[] = [
  { id: 'p1', tone: style.tone1, ratio: 3 / 2 },
  { id: 'p2', tone: style.tone2, ratio: 2 / 3 },
  { id: 'p3', tone: style.tone3, ratio: 1 },
  { id: 'p4', tone: style.tone4, ratio: 4 / 5 },
]

// 散落版面：手工調出的「隨手一放」效果，刻意不用 Math.random()，避免 SSR/CSR hydration mismatch。
// xRatio / yRatio 依相片長邊（--long）按比例換算。
// longMobile / longTablet / longDesktop 分別對應手機（大圖展演）、700px中型視窗（無重疊安全比例）與桌面版（精緻全尺寸）。
const MOSAIC_LAYOUT: {
  xRatio: number
  yRatio: number
  rotate: number
  longMobile: string
  longTablet: string
  longDesktop: string
}[] = [
  {
    xRatio: -0.354,
    yRatio: -0.285,
    rotate: -7,
    longMobile: 'clamp(170px, 46vw, 225px)',
    longTablet: 'clamp(170px, 46vw, 225px)',
    longDesktop: '260px',
  },
  {
    xRatio: 0.426,
    yRatio: -0.417,
    rotate: 6,
    longMobile: 'clamp(150px, 41vw, 202px)',
    longTablet: 'clamp(150px, 41vw, 202px)',
    longDesktop: '230px',
  },
  {
    xRatio: -0.317,
    yRatio: 0.32,
    rotate: 10,
    longMobile: 'clamp(156px, 43vw, 210px)',
    longTablet: 'clamp(156px, 43vw, 210px)',
    longDesktop: '240px',
  },
  {
    xRatio: 0.442,
    yRatio: 0.33,
    rotate: -5,
    longMobile: 'clamp(135px, 37vw, 186px)',
    longTablet: 'clamp(135px, 37vw, 186px)',
    longDesktop: '208px',
  },
]

// 白紙定位槽：最前（可讀）→ 中 → 後。三張紙在槽間輪替，讓最新三篇輪流來到最前完整展示。
// xRatio / yRatio 依紙張寬度（--paper-w）按比例換算。
const PAPER_SLOTS: {
  xRatio: number
  yRatio: number
  rotate: number
  z: number
  scale: number
  opacity: number
}[] = [
  { xRatio: 0, yRatio: 0, rotate: -2, z: 30, scale: 1, opacity: 1 },
  { xRatio: 0.25, yRatio: -0.03, rotate: 7, z: 20, scale: 0.95, opacity: 0.5 },
  {
    xRatio: -0.23,
    yRatio: 0,
    rotate: -9,
    z: 10,
    scale: 0.9,
    opacity: 0.38,
  },
]

type Paper = { title: string; excerpt: string; date: string }

type Props = {
  sourceCode: string
  papers?: Paper[]
}

export default function HeroShowcase({
  sourceCode,
  papers: papersProp,
}: Props) {
  const reduce = useReducedMotion()
  const t = useTranslations('HomePage')
  const [active, setActive] = useState<0 | 1 | 2>(0)
  const [isPaused, setIsPaused] = useState(false)
  // 有真實文章就用真實文章，否則回退 i18n 佔位（空資料庫 / 讀取失敗時仍好看）。
  const fallbackPapers = t.raw('hero.papers') as Paper[]
  const papers =
    papersProp && papersProp.length > 0 ? papersProp : fallbackPapers

  useEffect(() => {
    if (reduce || isPaused) return
    const id = setInterval(() => {
      setActive((a) => ((a + 1) % 3) as 0 | 1 | 2)
    }, 5000)
    return () => clearInterval(id)
  }, [active, reduce])

  const tabs: { key: 0 | 1 | 2; icon: IconName; label: string }[] = [
    { key: 0, icon: 'image', label: t('hero.tabs.photos') },
    { key: 1, icon: 'newspaper', label: t('hero.tabs.writing') },
    { key: 2, icon: 'code', label: t('hero.tabs.code') },
  ]

  const layerTransition = {
    duration: reduce ? 0.01 : 0.5,
    ease: [0.23, 1, 0.32, 1] as const,
  }

  return (
    <div className={style.showcase}>
      <div className={style.showcaseStage} aria-hidden>
        <motion.div
          className={style.showcaseLayer}
          animate={{ opacity: active === 0 ? 1 : 0, y: active === 0 ? 0 : 4 }}
          transition={layerTransition}
          style={{ pointerEvents: active === 0 ? 'auto' : 'none' }}
        >
          <div className={style.mosaic}>
            {PHOTOS.map((photo, i) => {
              const pose =
                MOSAIC_LAYOUT[i] ?? MOSAIC_LAYOUT[MOSAIC_LAYOUT.length - 1]
              const posX = `calc(var(--long) * ${pose.xRatio})`
              const posY = `calc(var(--long) * ${pose.yRatio})`
              const hoverX = `calc(var(--long) * ${pose.xRatio * 1.35})`
              const hoverY = `calc(var(--long) * ${pose.yRatio * 1.35})`

              return (
                <motion.div
                  key={photo.id}
                  className={style.mosaicTile}
                  style={{
                    ['--ratio' as string]: photo.ratio,
                    ['--long-m' as string]: pose.longMobile,
                    ['--long-t' as string]: pose.longTablet,
                    ['--long-d' as string]: pose.longDesktop,
                  }}
                  initial={{
                    opacity: 0,
                    x: posX,
                    y: posY,
                    rotate: pose.rotate,
                  }}
                  animate={{
                    opacity: 1,
                    x: posX,
                    y: posY,
                    rotate: pose.rotate,
                  }}
                  transition={{
                    duration: reduce ? 0 : 0.6,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  whileHover={{
                    x: hoverX,
                    y: hoverY,
                    scale: 1.25,
                    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
                    rotate: 0,
                  }}
                >
                  <div
                    className={`${style.heroPhotoArea} ${
                      photo.src ? '' : photo.tone
                    }`}
                  >
                    {photo.src ? (
                      <Image
                        src={photo.src}
                        alt=""
                        fill
                        sizes="220px"
                        className={style.heroCardPhoto}
                      />
                    ) : (
                      <span className={style.heroCardIcon}>
                        <Icon name="camera" size="2x" />
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          className={style.showcaseLayer}
          animate={{ opacity: active === 1 ? 1 : 0, y: active === 1 ? 0 : 4 }}
          transition={layerTransition}
          style={{ pointerEvents: active === 1 ? 'auto' : 'none' }}
        >
          <div className={style.paperStack}>
            {papers.slice(0, 3).map((paper, i) => {
              // 靜態扇形：三張紙固定於前 / 中 / 後槽，hover 哪張就把它抬到最上並放大。
              const pose = PAPER_SLOTS[i] ?? PAPER_SLOTS[0]
              const posX = `calc(var(--paper-w) * ${pose.xRatio})`
              const posY = `calc(var(--paper-w) * ${pose.yRatio})`
              return (
                <motion.div
                  key={i}
                  className={style.paperCard}
                  style={{ zIndex: pose.z }}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: pose.opacity,
                    x: posX,
                    y: posY,
                    rotate: pose.rotate,
                    scale: pose.scale,
                  }}
                  transition={{
                    duration: reduce ? 0 : 0.6,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  whileHover={
                    reduce
                      ? undefined
                      : {
                          opacity: 1,
                          scale: 1.12,
                          rotate: 0,
                          zIndex: 50,
                          transition: {
                            duration: 0.3,
                            ease: [0.23, 1, 0.32, 1],
                          },
                        }
                  }
                >
                  <span className={style.paperDate}>{paper.date}</span>
                  <h3 className={style.paperTitle}>{paper.title}</h3>
                  <p className={style.paperExcerpt}>{paper.excerpt}</p>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          className={style.showcaseLayer}
          animate={{ opacity: active === 2 ? 1 : 0, y: active === 2 ? 0 : 4 }}
          transition={layerTransition}
          style={{ pointerEvents: active === 2 ? 'auto' : 'none' }}
        >
          <HeroCodeWindow code={sourceCode} />
        </motion.div>
      </div>

      <div className={style.showcaseControls}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={style.showcaseTab}
            aria-pressed={active === tab.key}
            aria-label={tab.label}
            onClick={() => {
              setActive(tab.key)
              setIsPaused(true)
            }}
          >
            <Icon name={tab.icon} />
          </button>
        ))}
      </div>
    </div>
  )
}
