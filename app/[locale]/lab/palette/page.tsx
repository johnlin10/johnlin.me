import PageContainer from '@/app/components/PageContainer/PageContainer'
import ColorDisplay from '@/app/components/ColorDisplay/ColorDisplay'
import styles from './palette.module.scss'
import { useTranslations } from 'next-intl'

function PalettePage() {
  const t = useTranslations('LabPage.PalettePage')
  const palette = [
    {
      name: 'Red',
      colors: [
        {
          name: 'Red 100',
          color_var: '--color-red-100',
        },
        {
          name: 'Red 200',
          color_var: '--color-red-200',
        },
        {
          name: 'Red 300',
          color_var: '--color-red-300',
        },
        {
          name: 'Red 400',
          color_var: '--color-red-400',
        },
        {
          name: 'Red 500',
          color_var: '--color-red-500',
        },
        {
          name: 'Red 600',
          color_var: '--color-red-600',
        },
        {
          name: 'Red 700',
          color_var: '--color-red-700',
        },
        {
          name: 'Red 800',
          color_var: '--color-red-800',
        },
        {
          name: 'Red 900',
          color_var: '--color-red-900',
        },
      ],
    },
    {
      name: 'Green',
      colors: [
        {
          name: 'Green 100',
          color_var: '--color-green-100',
        },
        {
          name: 'Green 200',
          color_var: '--color-green-200',
        },
        {
          name: 'Green 300',
          color_var: '--color-green-300',
        },
        {
          name: 'Green 400',
          color_var: '--color-green-400',
        },
        {
          name: 'Green 500',
          color_var: '--color-green-500',
        },
        {
          name: 'Green 600',
          color_var: '--color-green-600',
        },
        {
          name: 'Green 700',
          color_var: '--color-green-700',
        },
        {
          name: 'Green 800',
          color_var: '--color-green-800',
        },
        {
          name: 'Green 900',
          color_var: '--color-green-900',
        },
      ],
    },
    {
      name: 'Blue',
      colors: [
        {
          name: 'Blue 100',
          color_var: '--color-blue-100',
        },
        {
          name: 'Blue 200',
          color_var: '--color-blue-200',
        },
        {
          name: 'Blue 300',
          color_var: '--color-blue-300',
        },
        {
          name: 'Blue 400',
          color_var: '--color-blue-400',
        },
        {
          name: 'Blue 500',
          color_var: '--color-blue-500',
        },
        {
          name: 'Blue 600',
          color_var: '--color-blue-600',
        },
        {
          name: 'Blue 700',
          color_var: '--color-blue-700',
        },
        {
          name: 'Blue 800',
          color_var: '--color-blue-800',
        },
        {
          name: 'Blue 900',
          color_var: '--color-blue-900',
        },
      ],
    },
    {
      name: 'Purple',
      colors: [
        {
          name: 'Purple 100',
          color_var: '--color-purple-100',
        },
        {
          name: 'Purple 200',
          color_var: '--color-purple-200',
        },
        {
          name: 'Purple 300',
          color_var: '--color-purple-300',
        },
        {
          name: 'Purple 400',
          color_var: '--color-purple-400',
        },
        {
          name: 'Purple 500',
          color_var: '--color-purple-500',
        },
        {
          name: 'Purple 600',
          color_var: '--color-purple-600',
        },
        {
          name: 'Purple 700',
          color_var: '--color-purple-700',
        },
        {
          name: 'Purple 800',
          color_var: '--color-purple-800',
        },
        {
          name: 'Purple 900',
          color_var: '--color-purple-900',
        },
      ],
    },
    {
      name: 'Orange',
      colors: [
        {
          name: 'Orange 100',
          color_var: '--color-orange-100',
        },
        {
          name: 'Orange 200',
          color_var: '--color-orange-200',
        },
        {
          name: 'Orange 300',
          color_var: '--color-orange-300',
        },
        {
          name: 'Orange 400',
          color_var: '--color-orange-400',
        },
        {
          name: 'Orange 500',
          color_var: '--color-orange-500',
        },
        {
          name: 'Orange 600',
          color_var: '--color-orange-600',
        },
        {
          name: 'Orange 700',
          color_var: '--color-orange-700',
        },
        {
          name: 'Orange 800',
          color_var: '--color-orange-800',
        },
        {
          name: 'Orange 900',
          color_var: '--color-orange-900',
        },
      ],
    },
    {
      name: 'Pink',
      colors: [
        {
          name: 'Pink 100',
          color_var: '--color-pink-100',
        },
        {
          name: 'Pink 200',
          color_var: '--color-pink-200',
        },
        {
          name: 'Pink 300',
          color_var: '--color-pink-300',
        },
        {
          name: 'Pink 400',
          color_var: '--color-pink-400',
        },
        {
          name: 'Pink 500',
          color_var: '--color-pink-500',
        },
        {
          name: 'Pink 600',
          color_var: '--color-pink-600',
        },
        {
          name: 'Pink 700',
          color_var: '--color-pink-700',
        },
        {
          name: 'Pink 800',
          color_var: '--color-pink-800',
        },
        {
          name: 'Pink 900',
          color_var: '--color-pink-900',
        },
      ],
    },
    {
      name: 'Yellow',
      colors: [
        {
          name: 'Yellow 100',
          color_var: '--color-yellow-100',
        },
        {
          name: 'Yellow 200',
          color_var: '--color-yellow-200',
        },
        {
          name: 'Yellow 300',
          color_var: '--color-yellow-300',
        },
        {
          name: 'Yellow 400',
          color_var: '--color-yellow-400',
        },
        {
          name: 'Yellow 500',
          color_var: '--color-yellow-500',
        },
        {
          name: 'Yellow 600',
          color_var: '--color-yellow-600',
        },
        {
          name: 'Yellow 700',
          color_var: '--color-yellow-700',
        },
        {
          name: 'Yellow 800',
          color_var: '--color-yellow-800',
        },
        {
          name: 'Yellow 900',
          color_var: '--color-yellow-900',
        },
      ],
    },
  ]

  return (
    <PageContainer className={styles.palette} maxWidth="max-content">
      <h1>{t('title')}</h1>
      <div className={styles.palette_container}>
        {palette.map((item) => (
          <div className={styles.palette_item} key={item.name}>
            <p className={styles.palette_item_name}>{item.name}</p>
            <div className={styles.palette_colors}>
              {item.colors.map((color) => (
                <ColorDisplay
                  key={color.name}
                  name={color.name}
                  colorVar={color.color_var}
                  className={styles.palette_color}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

export default PalettePage
