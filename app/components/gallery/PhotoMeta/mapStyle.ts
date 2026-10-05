import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { SupportedLocale } from '@/app/types/blog'

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

type Role =
  | 'land'
  | 'park'
  | 'water'
  | 'residential'
  | 'building'
  | 'road'
  | 'casing'
  | 'boundary'
  | 'label'
  | 'labelStrong'
  | 'labelWater'
  | 'halo'
  | 'accent'

// 色票取自 _theme.scss 的暖色系；MapLibre 讀不到 CSS 變數，只能寫死
const PALETTES: Record<'light' | 'dark', Record<Role, string>> = {
  light: {
    land: '#f2ece0',
    park: '#e4e2cf',
    water: '#cdd5d4',
    residential: '#eee7da',
    building: '#e6dccb',
    road: '#fffaf3',
    casing: '#dbcfb9',
    boundary: '#b8ab93',
    label: '#5c5344',
    labelStrong: '#201b13',
    labelWater: '#5f7380',
    halo: '#faf6ee',
    accent: '#ca6719',
  },
  dark: {
    land: '#1e1a14',
    park: '#22221a',
    water: '#141a1c',
    residential: '#211d17',
    building: '#29241c',
    road: '#3a3227',
    casing: '#29241c',
    boundary: '#5a5040',
    label: '#c3b8a5',
    labelStrong: '#f2ece1',
    labelWater: '#7d8f99',
    halo: '#14110d',
    accent: '#e98a35',
  },
}

export type MapPalette = (typeof PALETTES)['light']

export function mapPalette(dark: boolean): MapPalette {
  return PALETTES[dark ? 'dark' : 'light']
}

// 依 Positron 的圖層 id 分類；先比對到的先贏
const FILL_ROLES: [RegExp, Role][] = [
  [/^(park|landcover_wood)/, 'park'],
  [/^water/, 'water'],
  [/^building/, 'building'],
  [/^landuse/, 'residential'],
  [/dashline/, 'road'],
  [/casing|subtle|^railway|taxiway/, 'casing'],
  [/^(highway|tunnel|aeroway)/, 'road'],
  [/^boundary/, 'boundary'],
]

function fillRole(id: string): Role {
  return FILL_ROLES.find(([re]) => re.test(id))?.[1] ?? 'land'
}

function labelRole(id: string): Role {
  if (id.startsWith('water')) return 'labelWater'
  if (/^label_(city|town|state|country)/.test(id)) return 'labelStrong'
  return 'label'
}

/** 中文版只顯示中文名、英文版只顯示英文名，不要 Positron 的「拉丁＋原文」並列。 */
function nameField(locale: SupportedLocale): ExpressionSpecification {
  return locale === 'en'
    ? ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]
    : ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name']]
}

/** 把 Positron 換成站上的色票與語系。 */
export function themeStyle(
  style: StyleSpecification,
  palette: MapPalette,
  locale: SupportedLocale
): StyleSpecification {
  const layers = style.layers.map((layer) => {
    const paint: Record<string, unknown> = { ...('paint' in layer ? layer.paint : {}) }
    const layout: Record<string, unknown> = { ...('layout' in layer ? layer.layout : {}) }

    if (layer.type === 'symbol') {
      // 公路編號的白框在這麼小的地圖上只是雜訊
      if (/shield/.test(layer.id)) layout.visibility = 'none'
      else if (JSON.stringify(layout['text-field'] ?? '').includes('name')) {
        layout['text-field'] = nameField(locale)
        paint['text-color'] = palette[labelRole(layer.id)]
        paint['text-halo-color'] = palette.halo
      }
    } else {
      const color = palette[fillRole(layer.id)]
      for (const key of ['background-color', 'fill-color', 'line-color']) {
        if (key in paint) paint[key] = color
      }
      if ('fill-outline-color' in paint) paint['fill-outline-color'] = palette.casing
    }
    return { ...layer, paint, layout } as typeof layer
  })
  return { ...style, layers }
}

/** 公尺為半徑的圓，畫成 64 邊形（MapLibre 的 circle 圖層半徑是像素，不能用）。 */
export function circlePolygon(lng: number, lat: number, radiusM: number) {
  const dLat = radiusM / 111_320
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]
  })
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  }
}
