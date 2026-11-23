import { Actions, Button, TextField, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useRef } from 'react'
import {
  REFERRER,
  type Referrer,
  referrerIdOf,
  referrerNameOf,
} from '../../utils/customer-form'
import styles from './referrer-field.module.css'

const { referrer: words } = adminCustomerMessages

export type ReferrerFieldProps = {
  /** The customer who referred this one, as the form holds them now */
  referrer: Referrer
  /** What the API said of the referrer that was sent */
  error?: LocalizedText | undefined
  /** Opens the choice of a customer of the ledger */
  onChoose: () => void
  /** Takes the referrer away */
  onRemove: () => void
}

/**
 * The customer who referred this one: a customer of the ledger, chosen,
 * never typed. The name is shown in a field that cannot be written in,
 * which says what is wrong with the choice as every control does; the ID
 * is what the form sends. When the referrer is taken away, the focus stays
 * with the choice, whose button is still there.
 */
export const ReferrerField = ({
  referrer,
  error,
  onChoose,
  onRemove,
}: ReferrerFieldProps) => {
  const say = useSay()
  const choose = useRef<HTMLButtonElement>(null)

  const remove = (): void => {
    onRemove()
    choose.current?.focus()
  }

  return (
    <div className={styles['referrer']}>
      <input type='hidden' name={REFERRER} value={referrerIdOf(referrer)} />
      <TextField
        label={say(words.label)}
        autoComplete='off'
        readOnly
        value={say(referrerNameOf(referrer))}
        description={say(words.description)}
        error={error === undefined ? undefined : say(error)}
      />
      <Actions>
        <Button ref={choose} onClick={onChoose}>
          {say(words.choose)}
        </Button>
        {referrer.type !== 'none' && (
          <Button variant='quiet' onClick={remove}>
            {say(words.remove)}
          </Button>
        )}
      </Actions>
    </div>
  )
}
