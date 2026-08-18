'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type IconProp } from '@fortawesome/fontawesome-svg-core'
import {
  faHome,
  faNewspaper,
  faUser,
  faSun,
  faMoon,
  faDesktop,
  faCircleHalfStroke,
  faChevronDown,
  faArrowRight,
  faArrowLeft,
  faImage,
  faCamera,
  faFlask,
  faGlobe,
  faCode,
  faGaugeHigh,
  faComment,
  faFolder,
  faTag,
  faLayerGroup,
  faRightFromBracket,
  faBars,
  faXmark,
  faCheck,
  faTriangleExclamation,
  faEnvelope,
  faTrash,
  faUpload,
  faWandMagicSparkles,
  faGripVertical,
  faTableCellsLarge,
  faList,
  faFilter,
  faLocationDot,
  faCalendar,
  faEye,
  faEyeSlash,
  faGear,
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

//* 定義可用的圖標名稱類型
export type IconName =
  | 'home'
  | 'newspaper'
  | 'user'
  | 'sun'
  | 'moon'
  | 'desktop'
  | 'circle-half-stroke'
  | 'chevron-down'
  | 'arrow-right'
  | 'arrow-left'
  | 'image'
  | 'camera'
  | 'flask'
  | 'globe'
  | 'code'
  | 'gauge-high'
  | 'comment'
  | 'folder'
  | 'tag'
  | 'layer-group'
  | 'right-from-bracket'
  | 'bars'
  | 'xmark'
  | 'check'
  | 'triangle-exclamation'
  | 'envelope'
  | 'trash'
  | 'upload'
  | 'wand-magic-sparkles'
  | 'grip-vertical'
  | 'table-cells-large'
  | 'list'
  | 'filter'
  | 'location-dot'
  | 'calendar'
  | 'eye'
  | 'eye-slash'
  | 'gear'
  | 'github'

//* 圖標映射表
const iconMap: Record<IconName, IconProp> = {
  home: faHome,
  newspaper: faNewspaper,
  user: faUser,
  sun: faSun,
  moon: faMoon,
  desktop: faDesktop,
  'circle-half-stroke': faCircleHalfStroke,
  'chevron-down': faChevronDown,
  'arrow-right': faArrowRight,
  'arrow-left': faArrowLeft,
  image: faImage,
  camera: faCamera,
  flask: faFlask,
  globe: faGlobe,
  code: faCode,
  'gauge-high': faGaugeHigh,
  comment: faComment,
  folder: faFolder,
  tag: faTag,
  'layer-group': faLayerGroup,
  'right-from-bracket': faRightFromBracket,
  bars: faBars,
  xmark: faXmark,
  check: faCheck,
  'triangle-exclamation': faTriangleExclamation,
  envelope: faEnvelope,
  trash: faTrash,
  upload: faUpload,
  'wand-magic-sparkles': faWandMagicSparkles,
  'grip-vertical': faGripVertical,
  'table-cells-large': faTableCellsLarge,
  list: faList,
  filter: faFilter,
  'location-dot': faLocationDot,
  calendar: faCalendar,
  eye: faEye,
  'eye-slash': faEyeSlash,
  gear: faGear,
  github: faGithub,
}

interface IconProps {
  name: IconName
  className?: string
  size?: 'xs' | 'sm' | 'lg' | 'xl' | '2x'
  color?: string
  [key: string]: any
}

const Icon = ({
  name,
  className = '',
  size = 'sm',
  color,
  ...props
}: IconProps) => {
  const icon = iconMap[name]

  if (!icon) {
    console.error(`Icon "${name}" not found`)
    return null
  }

  return (
    <FontAwesomeIcon
      icon={icon}
      className={className}
      size={size}
      color={color}
      {...props}
    />
  )
}

export default Icon
