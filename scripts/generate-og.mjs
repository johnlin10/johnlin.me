// 生成分享用的預設 Open Graph 圖（public/assets/og/default.png 中文版、
// default-en.png 英文版，皆 1920×1080），以及完善就學公開頁自己的一組
// （tutoring.png、tutoring-en.png）。
//
// 為何存在：app/lib/metadata.ts 的 image 預設值要指到一張真的圖，否則首頁、
// /blog、/notes、/gallery、/about 這些沒有自己封面的頁面分享出去全是破圖。
// 內頁（文章、照片、短文）會用自己的封面覆蓋掉這張。
//
// 產物入庫，只在文案或配色改動時手動重跑：node scripts/generate-og.mjs
// 版面在 app/lib/og-card.mjs，知識庫分享頁現場產生的圖也用它。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ImageResponse } from 'next/og.js'
import { OG_FONT, OG_HEIGHT, OG_LOGO, OG_WIDTH, ogCard } from '../app/lib/og-card.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const logo = `data:image/png;base64,${readFileSync(join(ROOT, OG_LOGO)).toString('base64')}`
const fontData = readFileSync(join(ROOT, OG_FONT))

// 文案取自 messages/{locale}.json 的 HomePage.tagline，跟首頁保持一致。
const VARIANTS = [
  {
    out: join(ROOT, 'public/assets/og/default.png'),
    name: '林昌龍 · John Lin',
    tagline: ['影像捕捉瞬間，', '文字刻畫思考，', '程式建構秩序。'],
  },
  {
    out: join(ROOT, 'public/assets/og/default-en.png'),
    name: 'John Lin',
    tagline: [
      'Capturing moments in images,',
      'tracing thought in words,',
      'building order in code.',
    ],
  },
  // 完善就學公開頁是給同學的，不帶 logo 和網域，看起來不像在推銷個人網站
  {
    out: join(ROOT, 'public/assets/og/tutoring.png'),
    brand: false,
    name: '完善就學輔導時間',
    tagline: ['輔導時段、課表比對、', '每個月的時數。'],
  },
  {
    out: join(ROOT, 'public/assets/og/tutoring-en.png'),
    brand: false,
    name: '完善就學 schedule',
    tagline: ['Tutoring sessions, timetables,', 'and monthly hours.'],
  },
]

for (const { out, brand = true, name, tagline } of VARIANTS) {
  const image = new ImageResponse(ogCard({ name, tagline, logo: brand ? logo : undefined }), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [{ name: 'GenKiMin', data: fontData, style: 'normal' }],
  })

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(await image.arrayBuffer()))
  console.log(`✓ ${out}`)
}
