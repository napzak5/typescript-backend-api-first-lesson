import { Button, ButtonLink, TextField } from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { LONGEST_KEYWORD } from '../../keyword'
import styles from './keyword-search.module.css'

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
  const [shown, setShown] = useState({ searched, value: searched })
  if (shown.searched !== searched) {
    setShown({ searched, value: searched })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label={label}>
      <form className={styles['form']} onSubmit={submit}>
        <TextField
          label='キーワード'
          name='keyword'
          type='search'
          value={shown.value}
          onChange={(event) =>
            setShown({ searched, value: event.target.value })
          }
          maxLength={LONGEST_KEYWORD}
          description={description}
        />
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            検索する
          </Button>
          {keyword !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件をなくす
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
