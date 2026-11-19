import { Button, ButtonLink, TextField } from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { LONGEST_KEYWORD } from '../../salon-choice'
import styles from './salon-choice-form.module.css'

export type SalonChoiceFormProps = {
  /** The keyword that is searched for: that of the address */
  keyword: string | undefined
  /** The address of the choice without a keyword */
  clearHref: string
  /** Called with the values of the form when it is sent */
  onSubmit: (values: FormData) => void
}

/**
 * The search for a salon to choose. The field mirrors the address: it
 * shows the keyword that is searched for, and another one when the address
 * changes under it (the user went back).
 */
export const SalonChoiceForm = ({
  keyword,
  clearHref,
  onSubmit,
}: SalonChoiceFormProps) => {
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
    <search aria-label='サロンを探す'>
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
          description='サロンの名前か紹介文にある言葉。空欄のときは、すべてのサロンを並べます。'
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
