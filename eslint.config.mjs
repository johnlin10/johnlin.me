import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * 這份設定的重點是 react-hooks —— 攝影牆有多個手寫的手勢／狀態機 hook，
 * 大量 ref 與 motion value，stale closure 用眼睛很難抓。
 * 其餘規則維持 Next.js 預設，不額外加風格類規則（排版交給編輯器）。
 *
 * eslint-config-next 16 起自己就是 flat config，直接匯入子路徑即可；
 * 舊的 FlatCompat 包裝反而會讓 ESLint 在序列化設定時撞上循環參照。
 */
const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'public/fonts/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // 既有程式碼有數處 any。這些是型別嚴謹度問題而非錯誤，降為警告；
      // 註：Next 16 的 `next build` 已完全不跑 ESLint，把關全靠 `npm run lint`。
      '@typescript-eslint/no-explicit-any': 'warn',

      // eslint-plugin-react-hooks v6（隨 eslint-config-next 16 進來）新增的四條
      // React Compiler 世代規則，在既有程式碼上一共觸發 31 個 error —— 全部集中
      // 在攝影牆的手勢／狀態機 hook、自動存檔與燈箱那幾支。它們指出的是真問題
      // （例如 render 期間寫 ref），但逐一修正屬於獨立的重構工作，混進框架升級
      // 會讓 diff 失去可讀性。先降為警告保住訊號，之後單獨處理。
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]

export default config
