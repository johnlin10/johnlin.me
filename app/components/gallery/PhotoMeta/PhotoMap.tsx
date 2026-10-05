'use client'

import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { PhotoLocation } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import Icon from '@/app/components/Icon/Icon'
import { STYLE_URL, circlePolygon, mapPalette, themeStyle } from './mapStyle'
import styles from './PhotoMap.module.scss'

interface PhotoMapProps {
  location: PhotoLocation
  /** 觸發鈕上的字；沒填地名時用「查看地圖」 */
  label?: string
}

// 座標存檔時四捨五入到小數 3 位，真實位置落在 ±0.0005° 的格子裡；
// 圈的半徑取格子半對角線，剛好蓋住整格。
const HALF_CELL_M = 55.6

// 照片牆的拖曳、Esc 都掛在外層的 React handler 上，portal 的事件仍會沿 React 樹冒泡上去
const stop = (e: SyntheticEvent) => e.stopPropagation()

/** 地點按鈕＋地圖彈窗。MapLibre 只在打開時才載入。 */
export default function PhotoMap({ location, label }: PhotoMapProps) {
  const t = useTranslations('GalleryPage')
  const locale = useLocale() as SupportedLocale
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    dialogRef.current?.showModal()

    let map: MapLibreMap | undefined
    let cancelled = false
    Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
      fetch(STYLE_URL).then((r) => r.json()),
    ]).then(([maplibre, , baseStyle]) => {
      if (cancelled || !mapRef.current) return
      const palette = mapPalette(document.documentElement.classList.contains('dark'))
      const center: [number, number] = [location.lng, location.lat]
      map = new maplibre.Map({
        container: mapRef.current,
        style: themeStyle(baseStyle, palette, locale),
        center,
        // MapLibre 的圖磚是 512px，縮放級數比點陣圖磚少一級
        zoom: 15,
        minZoom: 3,
        maxZoom: 16,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        // 中日韓字不跟圖磚伺服器要字型，直接用本機字型畫
        localIdeographFontFamily: "'PingFang TC', 'Noto Sans TC', sans-serif",
        // 來源標示改放在底部漸層裡，見下方 .footer
        attributionControl: false,
      })
      // 圈要置中在上下兩條帶子之間的空白處，不是整張地圖的正中間
      map.setPadding({
        top: headerRef.current?.offsetHeight ?? 0,
        bottom: footerRef.current?.offsetHeight ?? 0,
        left: 0,
        right: 0,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
      map.on('load', () => {
        const cos = Math.cos((location.lat * Math.PI) / 180)
        map?.addSource('range', {
          type: 'geojson',
          data: circlePolygon(...center, Math.hypot(HALF_CELL_M, HALF_CELL_M * cos)),
        })
        map?.addLayer({
          id: 'range-fill',
          type: 'fill',
          source: 'range',
          paint: { 'fill-color': palette.accent, 'fill-opacity': 0.2 },
        })
        map?.addLayer({
          id: 'range-line',
          type: 'line',
          source: 'range',
          paint: { 'line-color': palette.accent, 'line-width': 2 },
        })
      })
    })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [open, location.lat, location.lng, locale])

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <Icon name="location-dot" />
        {label || t('map.open')}
      </button>

      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-label={label || t('map.open')}
            onClose={() => setOpen(false)}
            // 點到背景（dialog 本身，不是內容）就關
            onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
            onPointerDown={stop}
            onPointerMove={stop}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={stop}
          >
            <div className={styles.panel}>
              <div ref={mapRef} className={styles.map} />
              <div ref={headerRef} className={styles.header}>
                <span className={styles.title}>{label || t('map.open')}</span>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => dialogRef.current?.close()}
                  aria-label={t('map.close')}
                >
                  <Icon name="xmark" />
                </button>
              </div>
              <div ref={footerRef} className={styles.footer}>
                <p className={styles.note}>{t('map.note')}</p>
                <p className={styles.attribution}>
                  <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">
                    OpenFreeMap
                  </a>{' '}
                  ©{' '}
                  <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">
                    OpenMapTiles
                  </a>{' '}
                  ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap
                  </a>
                </p>
              </div>
            </div>
          </dialog>,
          document.body
        )}
    </>
  )
}
