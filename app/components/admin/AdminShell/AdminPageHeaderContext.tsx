'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

type AdminPageHeaderContextValue = {
  mainSlot: HTMLDivElement | null
  setMainSlot: (el: HTMLDivElement | null) => void
  subSlot: HTMLDivElement | null
  setSubSlot: (el: HTMLDivElement | null) => void
  drawerOpen: boolean
  toggleDrawer: () => void
}

const AdminPageHeaderContext = createContext<AdminPageHeaderContextValue>({
  mainSlot: null,
  setMainSlot: () => {},
  subSlot: null,
  setSubSlot: () => {},
  drawerOpen: false,
  toggleDrawer: () => {},
})

/**
 * AdminShell 的頂部控制欄掛載點狀態，外加手機抽屜開關狀態。
 *
 * 主列／副列各自一個獨立掛載點（mainSlot／subSlot），而不是共用一個：
 * 兩者都要各自 position:sticky，且要能各自跟 photos 頁的 inspector
 * 側欄比較層級（主列要蓋過它、副列要被它蓋過）——z-index 只有在「同
 * 一個 stacking context」裡才比得出高低，如果兩者包在同一個 sticky
 * 掛載點裡，就會被那層掛載點的 stacking context 框住，沒辦法各自比
 * 較。兩個掛載點都是 .main 的直接子節點（見 AdminShell.tsx），才有
 * 足夠「可以貼住的捲動空間」——sticky 元件貼多久，取決於它自己的
 * containing block 有多高，包在一個只跟內容一樣高的殼裡（例如疊兩層
 * 才到 .main）馬上就會捲出視窗外，這是先前踩過的坑。
 *
 * 各後台頁面透過 PageHeader 用 portal 把標題／按鈕／副控制欄分別塞進
 * 這兩個掛載點——背景／sticky／滿版都由 AdminShell 統一處理，頁面不
 * 必自己用負 margin 去借版位。跟公開站 Header 的 HeaderSubNavContext
 * 是同一套解法的延伸。
 *
 * 抽屜開關狀態放在這裡，是因為手機版的漢堡選單按鈕現在畫在 PageHeader
 * 的主列裡（取代 AdminShell 原本自己畫的獨立 topbar，避免兩層標題重
 * 複），但實際的抽屜／遮罩仍是 AdminShell 在管——PageHeader 需要一條
 * 路徑觸發它。
 */
export function AdminPageHeaderProvider({
  children,
  drawerOpen,
  toggleDrawer,
}: {
  children: ReactNode
  drawerOpen: boolean
  toggleDrawer: () => void
}) {
  const [mainSlot, setMainSlotState] = useState<HTMLDivElement | null>(null)
  const [subSlot, setSubSlotState] = useState<HTMLDivElement | null>(null)
  const setMainSlot = useCallback(
    (el: HTMLDivElement | null) => setMainSlotState(el),
    []
  )
  const setSubSlot = useCallback(
    (el: HTMLDivElement | null) => setSubSlotState(el),
    []
  )

  return (
    <AdminPageHeaderContext.Provider
      value={{
        mainSlot,
        setMainSlot,
        subSlot,
        setSubSlot,
        drawerOpen,
        toggleDrawer,
      }}
    >
      {children}
    </AdminPageHeaderContext.Provider>
  )
}

export function useAdminPageHeaderSlot() {
  return useContext(AdminPageHeaderContext)
}
