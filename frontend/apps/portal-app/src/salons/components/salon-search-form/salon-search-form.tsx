import {
  countNarrowing,
  FilterForm,
  inJapanese,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  LONGEST,
  MIN_RATINGS,
  narrows,
  queryOf,
  type SalonConditions,
} from '../../utils/salon-search'

export type SalonSearchFormProps = {
  /** The conditions that are searched for: those of the address */
  conditions: SalonConditions
  /** The address of the search without a condition */
  clearHref: string
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

const RATINGS = MIN_RATINGS.map((rating) => ({
  value: String(rating),
  label: `${inJapanese(formats.numberOf(rating, { most: 1, least: 1 }))} 以上`,
}))

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof SalonConditions, string>

const valuesOf = (conditions: SalonConditions): Values => ({
  keyword: conditions.keyword ?? '',
  prefecture: conditions.prefecture ?? '',
  city: conditions.city ?? '',
  minRating:
    conditions.minRating === undefined ? '' : String(conditions.minRating),
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['prefecture', 'city', 'minRating']

/**
 * The conditions of a search for salons. The names of its controls are the
 * names of the conditions.
 *
 * The form mirrors the address. Its controls show the conditions that are
 * searched for; when those change under it (the visitor went back, or
 * followed a link), the controls show the other conditions, and what was
 * typed and not sent is gone (`useFilterValues`). So the form holds the
 * values itself, unlike a form that is filled in once and sent to the API.
 */
export const SalonSearchForm = ({
  conditions,
  clearHref,
  onSubmit,
}: SalonSearchFormProps) => {
  const [values, hold] = useFilterValues(queryOf(conditions).toString(), () =>
    valuesOf(conditions),
  )

  return (
    <FilterForm
      label='サロンを探す'
      clearHref={narrows(conditions) ? clearHref : undefined}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <TextField
            label='都道府県'
            name='prefecture'
            value={values.prefecture}
            onChange={(event) => hold('prefecture', event.target.value)}
            maxLength={LONGEST.prefecture}
            autoComplete='address-level1'
            description='サロンが登録した表記と同じもの（例: 東京都）'
          />
          <TextField
            label='市区町村'
            name='city'
            value={values.city}
            onChange={(event) => hold('city', event.target.value)}
            maxLength={LONGEST.city}
            autoComplete='address-level2'
            description='サロンが登録した表記と同じもの（例: 渋谷区）'
          />
          <Select
            label='評価'
            name='minRating'
            options={RATINGS}
            placeholder='指定なし'
            value={values.minRating}
            onChange={(event) => hold('minRating', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label='キーワード'
        name='keyword'
        autoComplete='off'
        type='search'
        value={values.keyword}
        onChange={(event) => hold('keyword', event.target.value)}
        maxLength={LONGEST.keyword}
        description='サロンの名前か紹介文にある言葉'
      />
    </FilterForm>
  )
}
