import { type ReactNode } from 'react'
import '@/app/globals.scss'
import '@/app/styles/_colors.scss'

import { Analytics } from '@vercel/analytics/next'

type Props = {
  children: ReactNode
}

// Even though this component is just passing its children through, the presence
// of this file fixes an issue in Next.js 13.4+ where link clicks that switch
// the locale would otherwise be ignored.
export default function RootLayout({ children }: Props) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
