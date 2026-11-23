import {
  countNarrowing,
  FilterForm,
  Select,
  TextField,
  useFilterValues,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
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

const { searchForm: words } = portalSalonMessages

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
  const say = useSay()
  const [values, hold] = useFilterValues(queryOf(conditions).toString(), () =>
    valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(portalSalonMessages.search.title)}
      clearHref={narrows(conditions) ? clearHref : undefined}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <TextField
            label={say(words.prefecture)}
            name='prefecture'
            value={values.prefecture}
            onChange={(event) => hold('prefecture', event.target.value)}
            maxLength={LONGEST.prefecture}
            autoComplete='address-level1'
            description={say(words.prefectureDescription)}
          />
          <TextField
            label={say(words.city)}
            name='city'
            value={values.city}
            onChange={(event) => hold('city', event.target.value)}
            maxLength={LONGEST.city}
            autoComplete='address-level2'
            description={say(words.cityDescription)}
          />
          <Select
            label={say(words.rating)}
            name='minRating'
            options={MIN_RATINGS.map((rating) => ({
              value: String(rating),
              label: say(words.atLeast(rating)),
            }))}
            placeholder={say(words.anyRating)}
            value={values.minRating}
            onChange={(event) => hold('minRating', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label={say(words.keyword)}
        name='keyword'
        autoComplete='off'
        type='search'
        value={values.keyword}
        onChange={(event) => hold('keyword', event.target.value)}
        maxLength={LONGEST.keyword}
        description={say(words.keywordDescription)}
      />
    </FilterForm>
  )
}
