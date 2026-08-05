'use client'

import { useTranslations } from 'next-intl'
import CategorySelector from '@/app/components/admin/Selector/CategorySelector'
import TagSelector from '@/app/components/admin/Selector/TagSelector'
import SeriesSelector from '@/app/components/admin/Selector/SeriesSelector'
import Button from '@/app/components/admin/Button/Button'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import LocaleToggle from '../LocaleToggle/LocaleToggle'
import SlugField from './SlugField'
import CoverImageField from './CoverImageField'
import SeoFields from './SeoFields'
import shellStyle from '../editorShell.module.scss'
import style from './SettingsStep.module.scss'

/**
 * 第二步：文章資訊。單欄置中，機器欄位優先，主要動作留在頂欄。
 */
export default function SettingsStep() {
  const t = useTranslations('AdminPage.postEditor.settingsStep')
  const { draft, currentLocale } = usePostEditorState()
  const { setField, discardDraft, unpublish } = usePostEditorActions()

  return (
    <div className={shellStyle.scroll}>
      <div className={style.column}>
        <section className={style.section}>
          <h2 className={style.sectionTitle}>{t('urlStatus')}</h2>
          <SlugField />
        </section>

        <section className={style.section}>
          <h2 className={style.sectionTitle}>{t('categoryTag')}</h2>
          <CategorySelector
            value={draft.categoryId}
            onChange={(value) => setField('categoryId', value)}
            locale={currentLocale}
            required={false}
          />
          <TagSelector
            value={draft.tagIds}
            onChange={(value) => setField('tagIds', value)}
            locale={currentLocale}
          />
          <SeriesSelector
            seriesId={draft.seriesId}
            seriesOrder={draft.seriesOrder}
            onSeriesChange={(value) => setField('seriesId', value)}
            onOrderChange={(value) => setField('seriesOrder', value)}
            locale={currentLocale}
          />
        </section>

        <section className={style.section}>
          <h2 className={style.sectionTitle}>{t('coverImage')}</h2>
          <CoverImageField />
        </section>

        <section className={style.section}>
          <div className={style.sectionHeader}>
            <h2 className={style.sectionTitle}>{t('seo')}</h2>
            <LocaleToggle />
          </div>
          <SeoFields />
        </section>

        <section className={`${style.section} ${style.dangerSection}`}>
          <h2 className={style.sectionTitle}>{t('dangerZone')}</h2>
          {draft.status === 'draft' ? (
            <div className={style.dangerRow}>
              <p className={style.dangerText}>{t('discardText')}</p>
              <Button variant="danger" onClick={() => void discardDraft()}>
                {t('discardButton')}
              </Button>
            </div>
          ) : (
            <div className={style.dangerRow}>
              <p className={style.dangerText}>
                {t('unpublishText')}
              </p>
              <Button variant="danger" onClick={() => void unpublish()}>
                {t('unpublishButton')}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
