/**
 * 顏色工具函數
 */

/**
 * 取得 CSS 變數的實際顏色值
 * @param colorVar CSS 變數名稱 (例如: --color-red-100)
 * @returns 顏色值 (例如: oklch(0.88 0.0643 22))
 */
export const getColorValue = (colorVar: string): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const rootStyles = getComputedStyle(document.documentElement)
    const colorValue = rootStyles.getPropertyValue(colorVar).trim()
    return colorValue || ''
  } catch (error) {
    console.error('Get color value failed:', error)
    return ''
  }
}

/**
 * 複製顏色值到剪貼板
 * @param colorValue 顏色值
 * @param colorName 顏色名稱
 */
export const copyColorToClipboard = async (
  colorValue: string,
  colorName: string
): Promise<void> => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    await navigator.clipboard.writeText(colorValue)
    console.log(`Copied ${colorName} color value: ${colorValue}`)
  } catch (error) {
    console.error('Copy color value failed:', error)
  }
}

/**
 * 檢查是否為有效的顏色值
 * @param colorValue 顏色值
 * @returns 是否為有效顏色值
 */
export const isValidColor = (colorValue: string): boolean => {
  return colorValue.trim() !== ''
}
