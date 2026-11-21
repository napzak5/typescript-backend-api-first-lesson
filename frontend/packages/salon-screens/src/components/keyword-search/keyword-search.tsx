import {
  FilterForm,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { LONGEST_KEYWORD } from '../../keyword'

export type KeywordSearchProps = {
  /** What is searched for, as the landmark of the search names it: 「サロンを探す」 */
  label: string
  /** What the keyword is looked for in, and what an empty one does */
  description: string
  /** The keyword that is searched for: that of the address */
  keyword: string | undefined
  /** The address of the screen without a keyword */
  clearHref: string
  /** Called with the values of the form when it is sent: the keyword is `keyword` */
  onSubmit: (values: FormData) => void
}

/**
 * The search of a screen, by one keyword. The field mirrors the address:
 * it shows the keyword that is searched for, and another one when the
 * address changes under it (the user went back).
 */
export const KeywordSearch = ({
  label,
  description,
  keyword,
  clearHref,
  onSubmit,
}: KeywordSearchProps) => {
  const searched = keyword ?? ''
  const [values, hold] = useFilterValues(searched, () => ({
    keyword: searched,
  }))

  return (
    <FilterForm
      label={label}
      clearHref={keyword === undefined ? undefined : clearHref}
      onSubmit={onSubmit}
    >
      <TextField
        label='キーワード'
        name='keyword'
        autoComplete='off'
        type='search'
        value={values.keyword}
        onChange={(event) => hold('keyword', event.target.value)}
        maxLength={LONGEST_KEYWORD}
        description={description}
      />
    </FilterForm>
  )
}
