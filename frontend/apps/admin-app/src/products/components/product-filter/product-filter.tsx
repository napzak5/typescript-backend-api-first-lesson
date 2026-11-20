import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { CARRIED_OPTIONS, USE_OPTIONS } from '../../product-format'
import { type ProductConditions, productQueryOf } from '../../product-ledger'
import styles from './product-filter.module.css'

export type ProductFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ProductConditions
  /** The categories of the products of the salon, to choose from, in their order */
  categories: readonly string[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of the whole ledger, when the conditions narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof ProductConditions, string>

const valuesOf = (conditions: ProductConditions): Values => ({
  keyword: conditions.keyword ?? '',
  barcode: conditions.barcode ?? '',
  category: conditions.category ?? '',
  carried: conditions.carried ?? '',
  use: conditions.use ?? '',
})

const NO_ERRORS: FormErrors = {}

/**
 * Which products the ledger shows: a keyword, a barcode, a category,
 * whether the salon still carries them and what they are for. The names
 * of its controls are the names of the conditions. Like the filter of the
 * customers, it mirrors the address: when that changes under it, the
 * controls show the other conditions.
 */
export const ProductFilter = ({
  conditions,
  categories,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: ProductFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = productQueryOf(conditions).toString()
  const [shown, setShown] = useState({
    shownQuery,
    values: valuesOf(conditions),
  })
  if (shown.shownQuery !== shownQuery) {
    setShown({ shownQuery, values: valuesOf(conditions) })
  }

  const hold = (name: keyof Values, value: string): void => {
    setShown({ shownQuery, values: { ...shown.values, [name]: value } })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label='商品を探す'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['keywords']}>
          <TextField
            label='キーワード'
            name='keyword'
            type='search'
            description='商品名、商品コード、ブランドの一部。'
            value={shown.values.keyword}
            error={errors['keyword']}
            onChange={(event) => hold('keyword', event.target.value)}
          />
          <TextField
            label='バーコード'
            name='barcode'
            inputMode='numeric'
            autoComplete='off'
            description='バーコードのすべて。読み取り機で入力できます。'
            value={shown.values.barcode}
            error={errors['barcode']}
            onChange={(event) => hold('barcode', event.target.value)}
          />
        </div>
        <div className={styles['conditions']}>
          <Select
            label='カテゴリー'
            name='category'
            options={categories.map((category) => ({
              value: category,
              label: category,
            }))}
            placeholder='すべて'
            value={shown.values.category}
            onChange={(event) => hold('category', event.target.value)}
          />
          <Select
            label='取り扱い'
            name='carried'
            options={CARRIED_OPTIONS}
            placeholder='すべて'
            value={shown.values.carried}
            onChange={(event) => hold('carried', event.target.value)}
          />
          <Select
            label='用途'
            name='use'
            options={USE_OPTIONS}
            placeholder='すべて'
            value={shown.values.use}
            onChange={(event) => hold('use', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            探す
          </Button>
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件を外す
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
