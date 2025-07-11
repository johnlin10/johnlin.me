import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type IconProp } from '@fortawesome/fontawesome-svg-core'
import {
  faSun,
  faMoon,
  faDesktop,
  faCircleHalfStroke,
} from '@fortawesome/free-solid-svg-icons'

//* 定義可用的圖標名稱類型
export type IconName = 'sun' | 'moon' | 'desktop' | 'circle-half-stroke'

//* 圖標映射表
const iconMap: Record<IconName, IconProp> = {
  sun: faSun,
  moon: faMoon,
  desktop: faDesktop,
  'circle-half-stroke': faCircleHalfStroke,
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
