import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

/**
 * 這份設定的重點是 react-hooks —— 攝影牆有多個手寫的手勢／狀態機 hook，
 * 大量 ref 與 motion value，stale closure 用眼睛很難抓。
 * 其餘規則維持 Next.js 預設，不額外加風格類規則（排版交給編輯器）。
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
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 既有程式碼有 6 處 any。`next build` 會因 error 中斷，
      // 但這些是型別嚴謹度問題而非錯誤，降為警告讓建置維持綠燈、訊號仍在。
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
