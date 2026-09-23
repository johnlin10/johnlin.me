// OG 圖的版面，scripts/generate-og.mjs 產生靜態圖、知識庫分享頁現場產生圖都用這份。
// 寫成 .mjs 和物件樹（不用 JSX），node 腳本才能直接 import。

// 源起明體，跟站上標題同一套，中英文共用
export const OG_FONT = 'fonts/src/GenKiMin2TW-SB.otf'
export const OG_LOGO = 'public/assets/icons/web-icons/johnlin-logo-256.png'

// 沿用 app/lib/metadata.ts 的 imageWidth / imageHeight 預設值（16:9），
// 改這裡就要一起改那邊，否則 og:image:width 會對不上實際圖檔。
export const OG_WIDTH = 1920
export const OG_HEIGHT = 1080

// 對齊 _theme.scss 的深色主題：底色 --background-color、橘色 --accent、
// 文字 --text / --text-secondary。satori 不吃 oklch，accent 換算成 hex。
const BG = '#14110d'
const ACCENT = '#e8964a'
const TEXT = '#f2ece1'
const TEXT_SECONDARY = '#c3b8a5'

/**
 * 組出一張 OG 圖的元素樹，交給 ImageResponse。
 * @param {object} options
 * @param {string} options.name 大標
 * @param {string[]} options.tagline 大標下面的字，一個元素一行
 * @param {string} [options.logo] logo 的 data URI；不給就不畫 logo 和網域
 * @param {string} [options.brandSuffix] 接在網域後面的字，例如「・知識庫」
 * @param {string} [options.path] 大標上面的小字，知識庫用來放筆記所在的資料夾
 * @returns {import('react').ReactElement} satori 吃的元素樹（不是真的 React 元素，型別借用）
 */
export function ogCard({ name, tagline, logo, brandSuffix = '', path }) {
  return {
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
        logo && {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', marginBottom: 51 },
            children: [
              {
                type: 'img',
                props: { src: logo, width: 64, height: 64, style: { marginRight: 28 } },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: 48, color: ACCENT, letterSpacing: '0.18em' },
                  children: `JOHNLIN.ME${brandSuffix}`,
                },
              },
            ],
          },
        },
        path && {
          type: 'div',
          props: {
            style: { fontSize: 48, color: TEXT_SECONDARY, marginBottom: 32 },
            children: path,
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
            children: tagline.map((line) => ({ type: 'div', props: { children: line } })),
          },
        },
      ].filter(Boolean),
    },
  }
}

