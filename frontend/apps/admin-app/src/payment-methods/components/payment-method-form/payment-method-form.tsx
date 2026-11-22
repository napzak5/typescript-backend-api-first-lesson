import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { upTo } from '@beauty-salon-frontend/fields'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { LONGEST_NAME } from '../../utils/payment-method-form'
import { KIND_OPTIONS } from '../../utils/payment-method-format'

export type PaymentMethodFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
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
  errors = {},
  ...form
}: PaymentMethodFormProps) => (
  <Form {...form} errors={errors}>
    {method === null ? (
      <Select
        label='種類'
        name='method'
        required
        placeholder='選んでください'
        options={KIND_OPTIONS}
        description='足したあとは変えられません。カードの下 4 桁とブランドを記録できるのは、クレジットカードとデビットカードです。'
        defaultValue=''
        error={errors['method']}
      />
    ) : (
      <p>
        {`種類: ${methodKindNameOf(method.method)}。種類は変えられません。間違えたときは、この支払い方法で受け取った支払いがなければ削除して足し直し、あれば使うのをやめて、新しく足してください。`}
      </p>
    )}
    <TextField
      label='表示名'
      name='displayName'
      autoComplete='off'
      required
      description={`${upTo(LONGEST_NAME)}売上の画面とレシートに出る名前です。`}
      defaultValue={method?.displayName}
      error={errors['displayName']}
    />
    <TextArea
      label='説明'
      name='description'
      defaultValue={method?.description ?? undefined}
      error={errors['description']}
    />
    <FieldRow>
      <TextField
        label='1 回の金額の下限（円）'
        name='minimumAmount'
        inputMode='numeric'
        autoComplete='off'
        description='1 以上の整数。空にすると、下限はありません。'
        defaultValue={amountText(method?.minimumAmount)}
        error={errors['minimumAmount']}
      />
      <TextField
        label='1 回の金額の上限（円）'
        name='maximumAmount'
        inputMode='numeric'
        autoComplete='off'
        description='下限と同じか、それより大きい整数。空にすると、上限はありません。'
        defaultValue={amountText(method?.maximumAmount)}
        error={errors['maximumAmount']}
      />
    </FieldRow>
    <FieldRow>
      <TextField
        label='手数料率（%）'
        name='fee'
        inputMode='decimal'
        autoComplete='off'
        description='0 から 100 まで、小数は 2 桁まで。手数料がなければ 0、記録しないときは空にします。'
        defaultValue={amountText(method?.fee)}
        error={errors['fee']}
      />
      <TextField
        label='決済代行会社'
        name='processorName'
        autoComplete='off'
        description={`${upTo(LONGEST_NAME)}決済代行会社を介さないときは空にします。`}
        defaultValue={method?.processorName ?? undefined}
        error={errors['processorName']}
      />
    </FieldRow>
    <Checkbox
      label='店頭の会計で使う'
      name='isOfflineEnabled'
      defaultChecked={method?.isOfflineEnabled ?? true}
      error={errors['isOfflineEnabled']}
    />
    <Checkbox
      label='オンラインの決済で使う'
      name='isOnlineEnabled'
      description='使う場所は記録として残ります。いまの売上の画面は、使っている支払い方法を、使う場所にかかわらず選べるようにします。'
      defaultChecked={method?.isOnlineEnabled ?? false}
      error={errors['isOnlineEnabled']}
    />
    <TextField
      label='並び順'
      name='sortOrder'
      inputMode='numeric'
      autoComplete='off'
      required
      width='short'
      description='0 以上の整数。小さいものから並びます。同じ数でもかまいません。'
      defaultValue={String(method?.sortOrder ?? sortOrder)}
      error={errors['sortOrder']}
    />
    <Checkbox
      label='この支払い方法を使う'
      name='isActive'
      description='外すと、新しい支払いに使えなくなります。この支払い方法で受け取った支払いの記録は、そのまま残ります。'
      defaultChecked={method?.isActive ?? true}
      error={errors['isActive']}
    />
  </Form>
)
