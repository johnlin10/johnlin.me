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
  faImage,
} from '@fortawesome/free-solid-svg-icons'

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
  | 'image'

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
  image: faImage,
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
