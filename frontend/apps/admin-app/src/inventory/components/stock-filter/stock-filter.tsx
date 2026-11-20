import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { EXPIRY_OPTIONS, productOptionsOf } from '../../stock-format'
import { type StockView, stockQueryOf } from '../../stock-view'
import styles from './stock-filter.module.css'

export type StockFilterProps = {
  /** The view that is shown, from the address: every row, or the rows that expire soon */
  view: Exclude<StockView, { type: 'lowStock' }>
  /** The products of the salon, to narrow every row to one of them */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every row, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under their names */
type Values = { productId: string; lotNumber: string; days: string }

const valuesOf = (view: StockFilterProps['view']): Values =>
  view.type === 'all'
    ? {
        productId: view.productId ?? '',
        lotNumber: view.lotNumber ?? '',
        days: '30',
      }
    : { productId: '', lotNumber: '', days: String(view.days) }

const NO_ERRORS: FormErrors = {}

/**
 * Which rows the view shows: every row may be narrowed to a product and a
 * lot, and the rows that expire soon are those of a window of days. Like
 * the filter of the products, it mirrors the address: when that changes
 * under it, the controls show the other view.
 */
export const StockFilter = ({
  view,
  products,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: StockFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = stockQueryOf(view).toString()
  const [shown, setShown] = useState({ shownQuery, values: valuesOf(view) })
  if (shown.shownQuery !== shownQuery) {
    setShown({ shownQuery, values: valuesOf(view) })
  }

  const hold = (name: keyof Values, value: string): void => {
    setShown({ shownQuery, values: { ...shown.values, [name]: value } })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label={view.type === 'all' ? '在庫を探す' : '使用期限で絞る'}>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        {view.type === 'all' ? (
          <div className={styles['conditions']}>
            <Select
              label='商品'
              name='productId'
              options={productOptionsOf(products, view.productId)}
              placeholder='すべて'
              value={shown.values.productId}
              onChange={(event) => hold('productId', event.target.value)}
            />
            <TextField
              label='ロット番号'
              name='lotNumber'
              autoComplete='off'
              description='ロット番号のすべて。大文字と小文字を区別します。'
              value={shown.values.lotNumber}
              error={errors['lotNumber']}
              onChange={(event) => hold('lotNumber', event.target.value)}
            />
          </div>
        ) : (
          <div className={styles['conditions']}>
            <Select
              label='使用期限'
              name='days'
              options={EXPIRY_OPTIONS}
              description='今日から、選んだ日までに使用期限が来る在庫です。期限が過ぎたものも出ます。'
              value={shown.values.days}
              onChange={(event) => hold('days', event.target.value)}
            />
          </div>
        )}
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            {view.type === 'all' ? '探す' : '表示する'}
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
