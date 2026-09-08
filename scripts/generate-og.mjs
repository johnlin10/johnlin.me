// 生成分享用的預設 Open Graph 圖（public/assets/og/default.png 中文版、
// default-en.png 英文版，皆 1920×1080）。
//
// 為何存在：app/lib/metadata.ts 的 image 預設值要指到一張真的圖，否則首頁、
// /blog、/notes、/gallery、/about 這些沒有自己封面的頁面分享出去全是破圖。
// 內頁（文章、照片、短文）會用自己的封面覆蓋掉這張。
//
// 產物入庫，只在文案或配色改動時手動重跑：node scripts/generate-og.mjs
// 字體用 fonts/src 那套源起明體，跟站上標題同一套，中英文共用。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ImageResponse } from 'next/og.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONT = join(ROOT, 'fonts/src/GenKiMin2TW-SB.otf')
const LOGO = join(ROOT, 'public/assets/icons/web-icons/johnlin-logo-256.png')

const logoDataUri = `data:image/png;base64,${readFileSync(LOGO).toString('base64')}`
const fontData = readFileSync(FONT)

// 尺寸沿用 app/lib/metadata.ts 的 imageWidth / imageHeight 預設值（16:9），
// 改這裡就要一起改那邊，否則 og:image:width 會對不上實際圖檔。
const WIDTH = 1920
const HEIGHT = 1080

// 對齊 _theme.scss 的深色主題：底色 --background-color、橘色 --accent、
// 文字 --text / --text-secondary。satori 不吃 oklch，accent 換算成 hex。
const BG = '#14110d'
const ACCENT = '#e8964a'
const TEXT = '#f2ece1'
const TEXT_SECONDARY = '#c3b8a5'

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
]

for (const { out, name, tagline } of VARIANTS) {
  const image = new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: BG,
          padding: '154px',
          fontFamily: 'GenKiMin',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: 51,
              },
              children: [
                {
                  type: 'img',
                  props: {
                    src: logoDataUri,
                    width: 64,
                    height: 64,
                    style: { marginRight: 28 },
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 48,
                      color: ACCENT,
                      letterSpacing: '0.18em',
                    },
                    children: 'JOHNLIN.ME',
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 109, color: TEXT, marginBottom: 64 },
              children: name,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                fontSize: 70,
                color: TEXT_SECONDARY,
                lineHeight: 1.5,
              },
              children: tagline.map((line) => ({
                type: 'div',
                props: { children: line },
              })),
            },
          },
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: 'GenKiMin', data: fontData, style: 'normal' }],
    }
  )

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(await image.arrayBuffer()))
  console.log(`✓ ${out}`)
}
