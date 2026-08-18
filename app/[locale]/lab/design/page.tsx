import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import ColorDisplay from '@/app/components/ColorDisplay/ColorDisplay'
import { useTranslations } from 'next-intl'
import styles from './design.module.scss'

const colorGroups = [
  {
    name: 'Surface',
    colors: [
      '--surface',
      '--surface-2',
      '--surface-3',
      '--surface-raised',
      '--surface-sunken',
    ],
  },
  {
    name: 'Text',
    colors: ['--text', '--text-secondary', '--text-muted', '--text-on-accent'],
  },
  {
    name: 'Border',
    colors: ['--border', '--border-strong', '--border-focus'],
  },
  {
    name: 'Accent',
    colors: ['--accent', '--accent-hover', '--accent-soft', '--accent-contrast'],
  },
  {
    name: 'Feedback',
    colors: [
      '--danger',
      '--danger-soft',
      '--success',
      '--success-soft',
      '--warning',
      '--warning-soft',
      '--info',
      '--info-soft',
    ],
  },
]

const spaceScale = [
  ['--space-1', '4px'],
  ['--space-2', '8px'],
  ['--space-3', '12px'],
  ['--space-4', '16px'],
  ['--space-5', '20px'],
  ['--space-6', '24px'],
  ['--space-8', '32px'],
  ['--space-10', '40px'],
  ['--space-12', '48px'],
  ['--space-16', '64px'],
  ['--space-20', '80px'],
  ['--space-24', '96px'],
  ['--space-32', '128px'],
] as const

const typeScale = [
  ['--text-3xs', '0.75rem'],
  ['--text-2xs', '0.8rem'],
  ['--text-xs', '0.85rem'],
  ['--text-sm', '0.9rem'],
  ['--text-md', '1rem'],
  ['--text-lg', '1.125rem'],
  ['--text-xl', '1.25rem'],
  ['--text-2xl', '1.5rem'],
  ['--text-3xl', '2rem'],
  ['--text-display-sm', 'clamp(1.5rem, 3.4vw, 2.2rem)'],
  ['--text-display', 'clamp(1.9rem, 4.5vw, 2.6rem)'],
  ['--text-display-lg', 'clamp(2rem, 5vw, 2.8rem)'],
] as const

const radiusScale = [
  ['--radius-xs', '4px'],
  ['--radius-sm', '8px'],
  ['--radius-md', '12px'],
  ['--radius-lg', '16px'],
  ['--radius-xl', '24px'],
  ['--radius-pill', '999px'],
] as const

const shadowScale = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'] as const

const motionScale = [
  ['fast', '--duration-fast', '0.2s'],
  ['normal', '--duration', '0.3s'],
  ['slow', '--duration-slow', '0.35s'],
] as const

const zScale = [
  ['--z-base', '0', 'base'],
  ['--z-raised', '10', 'raised'],
  ['--z-sticky', '100', 'sticky'],
  ['--z-header', '500', 'header'],
  ['--z-drawer', '900', 'drawer'],
  ['--z-modal', '1000', 'modal'],
  ['--z-toast', '1100', 'toast'],
] as const

import { getTranslations } from 'next-intl/server'
import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage.DesignPage' })
  return metadata({
    title: t('title'),
    description:
      locale === 'zh-tw'
        ? '這個網站所用的顏色、間距、字級、圓角、陰影與元件。'
        : 'The colors, spacing, type scale, radius, shadow, and components used on this site.',
    url: '/lab/design',
    noIndex: true,
  })
}

function DesignSystemPage() {
  const t = useTranslations('LabPage.DesignPage')

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        size="md"
        eyebrow="Lab"
        title={t('title')}
        lead={t('description')}
      />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.colors')}</h2>
        <p className={styles.sectionDesc}>{t('sections.colorsDesc')}</p>
        {colorGroups.map((group) => (
          <div key={group.name}>
            <h3 className={styles.groupTitle}>{group.name}</h3>
            <div className={styles.colorGrid}>
              {group.colors.map((colorVar) => (
                <ColorDisplay
                  key={colorVar}
                  name={colorVar}
                  colorVar={colorVar}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.spacing')}</h2>
        <p className={styles.sectionDesc}>{t('sections.spacingDesc')}</p>
        <div className={styles.spaceList}>
          {spaceScale.map(([name, px]) => (
            <div key={name} className={styles.spaceRow}>
              <span className={styles.spaceLabel}>
                {name} · {px}
              </span>
              <div
                className={styles.spaceBar}
                style={{ width: `var(${name})` }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.typography')}</h2>
        <p className={styles.sectionDesc}>{t('sections.typographyDesc')}</p>
        <div className={styles.typeList}>
          {typeScale.map(([name, size]) => (
            <div key={name} className={styles.typeRow}>
              <span className={styles.typeLabel}>
                {name} · {size}
              </span>
              <span
                className={styles.typeSample}
                style={{ fontSize: `var(${name})` }}
              >
                林昌龍 Aa
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.radius')}</h2>
        <div className={styles.swatchGrid}>
          {radiusScale.map(([name, px]) => (
            <div
              key={name}
              className={styles.swatchBox}
              style={{ borderRadius: `var(${name})` }}
            >
              <span>{name}</span>
              <span>{px}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.shadow')}</h2>
        <div className={styles.swatchGrid}>
          {shadowScale.map((name) => (
            <div
              key={name}
              className={styles.shadowBox}
              style={{ boxShadow: `var(${name})` }}
            >
              {name}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.motion')}</h2>
        <p className={styles.sectionDesc}>{t('sections.motionDesc')}</p>
        <div className={styles.motionGrid}>
          {motionScale.map(([speed, name, value]) => (
            <div key={name} className={styles.motionCard} data-speed={speed}>
              <div className={styles.motionSwatch} />
              <div className={styles.motionLabel}>
                {name} · {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.zIndex')}</h2>
        <div className={styles.zList}>
          {zScale.map(([name, value, key]) => (
            <div key={name} className={styles.zRow}>
              <span>
                {name} ({value})
              </span>
              <span>{t(`zIndexDesc.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('sections.components')}</h2>
        <div className={styles.componentGrid}>
          <div className={styles.demoCard}>
            <span className={styles.demoEyebrow}>Eyebrow</span>
            <p className={styles.demoTitle}>card()</p>
            <span className={styles.demoMeta}>surface-2 · border · radius-md</span>
          </div>
          <div className={styles.demoButton}>Button</div>
          <div className={styles.demoTagRow}>
            <span className={styles.demoTag}>accent</span>
            <span className={`${styles.demoTag} ${styles.demoTagDanger}`}>
              danger
            </span>
            <span className={`${styles.demoTag} ${styles.demoTagSuccess}`}>
              success
            </span>
          </div>
        </div>
      </section>
    </PageContainer>
  )
}

export default DesignSystemPage
