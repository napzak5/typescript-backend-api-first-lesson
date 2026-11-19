import {
  Button,
  ButtonLink,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import {
  LONGEST,
  MIN_RATINGS,
  narrows,
  queryOf,
  type SalonConditions,
} from '../../salon-search'
import styles from './salon-search-form.module.css'

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
  label: `${rating.toFixed(1)} 以上`,
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

/**
 * The conditions of a search for salons. The names of its controls are the
 * names of the conditions.
 *
 * The form mirrors the address. Its controls show the conditions that are
 * searched for; when those change under it (the visitor went back, or
 * followed a link), the controls show the other conditions, and what was
 * typed and not sent is gone. So the form holds the values itself, unlike a
 * form that is filled in once and sent to the API.
 */
export const SalonSearchForm = ({
  conditions,
  clearHref,
  onSubmit,
}: SalonSearchFormProps) => {
  const searched = queryOf(conditions).toString()
  const [shown, setShown] = useState({
    searched,
    values: valuesOf(conditions),
  })
  if (shown.searched !== searched) {
    setShown({ searched, values: valuesOf(conditions) })
  }

  const hold = (name: keyof Values, value: string): void => {
    setShown({ searched, values: { ...shown.values, [name]: value } })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label='サロンを探す'>
      <form className={styles['form']} onSubmit={submit}>
        <div className={styles['conditions']}>
          <TextField
            label='キーワード'
            name='keyword'
            type='search'
            value={shown.values.keyword}
            onChange={(event) => hold('keyword', event.target.value)}
            maxLength={LONGEST.keyword}
            description='サロンの名前か紹介文にある言葉'
          />
          <TextField
            label='都道府県'
            name='prefecture'
            value={shown.values.prefecture}
            onChange={(event) => hold('prefecture', event.target.value)}
            maxLength={LONGEST.prefecture}
            autoComplete='address-level1'
            description='サロンが登録した表記と同じもの（例: 東京都）'
          />
          <TextField
            label='市区町村'
            name='city'
            value={shown.values.city}
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
            value={shown.values.minRating}
            onChange={(event) => hold('minRating', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            検索する
          </Button>
          {narrows(conditions) && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件をなくす
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
