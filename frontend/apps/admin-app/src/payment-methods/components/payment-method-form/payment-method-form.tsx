import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { LONGEST_NAME } from '../../utils/payment-method-form'
import { KIND_CHOICES } from '../../utils/payment-method-format'

const { form: WORDS, words } = adminPaymentMethodMessages

export type PaymentMethodFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /**
   * The payment method the form opens with, whose kind it shows and does
   * not change. `null` for a new one: the form then asks for the kind, and
   * opens with a method used at the counter and last in the order
   */
  method: ModelsPaymentMethodResponse | null
  /** Where a new method goes in the order */
  sortOrder: number
}

/** A whole number as the form opens with it: nothing for none. */
const amountText = (amount: number | null | undefined): string | undefined =>
  amount === null || amount === undefined ? undefined : String(amount)

/**
 * Everything a payment method keeps: its kind and name, what it takes at
 * once, its fee and the company it goes through, where and whether it is
 * used, and its place in the order. A control is named as the property of
 * the request is; the browser keeps the values, and the form hands them
 * over when it is sent.
 */
export const PaymentMethodForm = ({
  method,
  sortOrder,
  message,
  errors = NO_ERRORS,
  ...form
}: PaymentMethodFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      {method === null ? (
        <Select
          label={say(words.kind)}
          name='method'
          required
          placeholder={say(WORDS.choose)}
          options={options(KIND_CHOICES)}
          description={say(WORDS.kindDescription)}
          defaultValue=''
          error={said.errors['method']}
        />
      ) : (
        <p>{say(WORDS.kindKept(methodKindNameOf(method.method)))}</p>
      )}
      <TextField
        label={say(words.displayName)}
        name='displayName'
        autoComplete='off'
        required
        description={say(WORDS.displayNameDescription(LONGEST_NAME))}
        defaultValue={method?.displayName}
        error={said.errors['displayName']}
      />
      <TextArea
        label={say(words.description)}
        name='description'
        defaultValue={method?.description ?? undefined}
        error={said.errors['description']}
      />
      <FieldRow>
        <TextField
          label={say(WORDS.minimum)}
          name='minimumAmount'
          inputMode='numeric'
          autoComplete='off'
          description={say(WORDS.minimumDescription)}
          defaultValue={amountText(method?.minimumAmount)}
          error={said.errors['minimumAmount']}
        />
        <TextField
          label={say(WORDS.maximum)}
          name='maximumAmount'
          inputMode='numeric'
          autoComplete='off'
          description={say(WORDS.maximumDescription)}
          defaultValue={amountText(method?.maximumAmount)}
          error={said.errors['maximumAmount']}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          label={say(WORDS.fee)}
          name='fee'
          inputMode='decimal'
          autoComplete='off'
          description={say(WORDS.feeDescription)}
          defaultValue={amountText(method?.fee)}
          error={said.errors['fee']}
        />
        <TextField
          label={say(words.processor)}
          name='processorName'
          autoComplete='off'
          description={say(WORDS.processorDescription(LONGEST_NAME))}
          defaultValue={method?.processorName ?? undefined}
          error={said.errors['processorName']}
        />
      </FieldRow>
      <Checkbox
        label={say(WORDS.offline)}
        name='isOfflineEnabled'
        defaultChecked={method?.isOfflineEnabled ?? true}
        error={said.errors['isOfflineEnabled']}
      />
      <Checkbox
        label={say(WORDS.online)}
        name='isOnlineEnabled'
        description={say(WORDS.onlineDescription)}
        defaultChecked={method?.isOnlineEnabled ?? false}
        error={said.errors['isOnlineEnabled']}
      />
      <TextField
        label={say(words.sortOrder)}
        name='sortOrder'
        inputMode='numeric'
        autoComplete='off'
        required
        width='short'
        description={say(WORDS.sortOrderDescription)}
        defaultValue={String(method?.sortOrder ?? sortOrder)}
        error={said.errors['sortOrder']}
      />
      <Checkbox
        label={say(WORDS.inUse)}
        name='isActive'
        description={say(WORDS.inUseDescription)}
        defaultChecked={method?.isActive ?? true}
        error={said.errors['isActive']}
      />
    </Form>
  )
}
