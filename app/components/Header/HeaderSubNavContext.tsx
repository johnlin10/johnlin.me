'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type HeaderSubNavContextValue = {
  slot: HTMLDivElement | null
  setSlot: (el: HTMLDivElement | null) => void
}

const HeaderSubNavContext = createContext<HeaderSubNavContextValue>({
  slot: null,
  setSlot: () => {},
})

/**
 * Header 的次導覽掛載點狀態。Header 本身把它的掛載點 DOM 節點寫進這裡，
 * 任何頁面（例如 About 的章節列）再透過 useHeaderSubNavSlot() 取得節點，
 * 用 portal 把內容塞進 Header 的固定列裡——背景/版位交給 Header 統一處理，
 * 不必再由頁面自己用負 margin 去「借」Header 的背景。
 */
export function HeaderSubNavProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<HTMLDivElement | null>(null)
  const setSlot = useCallback((el: HTMLDivElement | null) => setSlotState(el), [])

  return (
    <HeaderSubNavContext.Provider value={{ slot, setSlot }}>
      {children}
    </HeaderSubNavContext.Provider>
  )
}

export function useHeaderSubNavSlot() {
  return useContext(HeaderSubNavContext)
}
