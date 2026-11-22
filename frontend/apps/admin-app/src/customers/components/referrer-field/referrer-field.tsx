import { Actions, Button, TextField } from '@beauty-salon-frontend/ui'
import { useRef } from 'react'
import {
  REFERRER,
  type Referrer,
  referrerIdOf,
  referrerNameOf,
} from '../../utils/customer-form'
import styles from './referrer-field.module.css'

export type ReferrerFieldProps = {
  /** The customer who referred this one, as the form holds them now */
  referrer: Referrer
  /** What the API said of the referrer that was sent */
  error?: string | undefined
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
  const choose = useRef<HTMLButtonElement>(null)

  const remove = (): void => {
    onRemove()
    choose.current?.focus()
  }

  return (
    <div className={styles['referrer']}>
      <input type='hidden' name={REFERRER} value={referrerIdOf(referrer)} />
      <TextField
        label='紹介元'
        autoComplete='off'
        readOnly
        value={referrerNameOf(referrer)}
        description='このお客様を紹介したお客様です。台帳から探して選びます。'
        error={error}
      />
      <Actions>
        <Button ref={choose} onClick={onChoose}>
          紹介元を選ぶ
        </Button>
        {referrer.type !== 'none' && (
          <Button variant='quiet' onClick={remove}>
            紹介元を外す
          </Button>
        )}
      </Actions>
    </div>
  )
}
