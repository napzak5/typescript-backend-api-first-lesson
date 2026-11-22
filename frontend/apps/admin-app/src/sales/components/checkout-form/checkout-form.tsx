import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  methodKindNameOf,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  DescriptionList,
  Form,
  FormPart,
  type FormProps,
  LoadingIndicator,
  NONE,
  Note,
  Select,
  Table,
  TextArea,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useId, useRef } from 'react'
import { match } from 'ts-pattern'
import { memberNameOf } from '../../../bookings/utils/day-bookings'
import { type Bill, type BillLine, NO_CASHIER } from '../../utils/checkout'
import styles from './checkout-form.module.css'

export type CheckoutFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The lines of the booking, at the amounts they took when it was booked */
  booked: readonly BillLine[]
  /** The services added at the counter, at the prices of the menu */
  added: readonly BillLine[]
  /** The services that can be added: those of the menu that are offered */
  offered: readonly Pick<ModelsServiceResponse, 'id' | 'name' | 'price'>[]
  /** The members of the staff the payment can be taken by */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** Who is chosen at first to have taken the payment: an ID, or `NO_CASHIER` */
  cashier: string
  /** The currency of the salon */
  currency: string
  /** The amounts the API calculated for the lines */
  bill: Bill
  /** What the last addition or removal did, in a sentence */
  changed: string
  /** Adds a service of the menu to the bill */
  onAdd: (serviceId: string) => void
  /** Takes the added service at this place off the bill */
  onRemove: (index: number) => void
  /** Asks for the amounts again */
  onRecalculate: () => void
  recalculating: boolean
}

/** The control that holds the service to add: what is sent is not read for it */
const TO_ADD = 'serviceToAdd'

/**
 * The checkout of a booking. What the booking was booked for is billed as
 * it was booked; what was done beyond it is added from the menu, and can
 * be taken off again. The amounts are those the API calculates for the
 * lines, with the kinds of payment that take the total at once.
 *
 * Who took the payment is the member of the booking at first, and may be
 * nobody. A removal moves the focus to the choice of a service to add,
 * because the button that was pressed is gone.
 */
export const CheckoutForm = ({
  booked,
  added,
  offered,
  staff,
  cashier,
  currency,
  bill,
  changed,
  onAdd,
  onRemove,
  onRecalculate,
  recalculating,
  errors = {},
  ...form
}: CheckoutFormProps) => {
  const bookedName = useId()
  const addedName = useId()
  const amountsName = useId()
  const toAdd = useRef<HTMLSelectElement>(null)
  const columns = [
    {
      key: 'name',
      header: 'メニュー',
      cell: ({ line }: { line: BillLine }) => line.name,
    },
    {
      key: 'staff',
      header: '担当',
      cell: ({ line }: { line: BillLine }) => memberNameOf(line.staffId, staff),
    },
    {
      key: 'unitPrice',
      header: '料金',
      cell: ({ line }: { line: BillLine }) =>
        amountOf(line.unitPrice, currency),
    },
    {
      key: 'discountAmount',
      header: '割引',
      cell: ({ line }: { line: BillLine }) =>
        amountOf(line.discountAmount, currency),
    },
  ]

  return (
    <Form {...form} errors={errors} submitLabel='会計を入れる'>
      <section className={styles['part']} aria-labelledby={bookedName}>
        <h2 className={styles['name']} id={bookedName}>
          予約の施術
        </h2>
        <Table
          caption='予約の施術'
          captionHidden
          columns={columns}
          rows={booked.map((line, index) => ({ line, index }))}
          rowKey={({ index }) => `booked-${index}`}
          emptyMessage='予約の施術はありません'
        />
      </section>
      <section className={styles['part']} aria-labelledby={addedName}>
        <h2 className={styles['name']} id={addedName}>
          足した施術
        </h2>
        <div className={styles['controls']}>
          <Table
            caption='足した施術'
            captionHidden
            columns={[
              ...columns,
              {
                key: 'remove',
                header: '外す',
                cell: ({ line, index }) => (
                  <Button
                    size='small'
                    aria-label={`${line.name}（${index + 1} 件目）を外す`}
                    onClick={() => {
                      onRemove(index)
                      toAdd.current?.focus()
                    }}
                  >
                    外す
                  </Button>
                ),
              },
            ]}
            rows={added.map((line, index) => ({ line, index }))}
            rowKey={({ index }) => `added-${index}`}
            emptyMessage='予約にない施術をしたときは、メニューから足してください'
          />
          <div className={styles['addition']}>
            <Select
              ref={toAdd}
              label='足す施術'
              name={TO_ADD}
              options={offered.map(({ id, name, price }) => ({
                value: id,
                label: `${name}（${amountOf(price, currency)}）`,
              }))}
              description='いまのメニューの料金で数えます。担当は、予約の担当です。'
            />
            <Button
              onClick={(event) => {
                const { form: values } = event.currentTarget
                const id =
                  values === null ? null : new FormData(values).get(TO_ADD)
                if (typeof id === 'string' && id !== '') {
                  onAdd(id)
                }
              }}
            >
              施術を足す
            </Button>
          </div>
          <Note className={styles['changed']} role='status'>
            {changed}
          </Note>
        </div>
      </section>
      <section className={styles['part']} aria-labelledby={amountsName}>
        <h2 className={styles['name']} id={amountsName}>
          金額
        </h2>
        {match(bill)
          .with({ type: 'calculating' }, () => (
            <LoadingIndicator label='金額を計算しています' />
          ))
          .with({ type: 'calculated' }, ({ calculation }) => {
            const { breakdown, recommendedMethods } = calculation

            return (
              <DescriptionList
                items={[
                  {
                    term: '小計',
                    description: amountOf(breakdown.subtotal, currency),
                  },
                  {
                    term: '割引',
                    description: amountOf(breakdown.discountAmount, currency),
                  },
                  {
                    term: '消費税',
                    description: amountOf(breakdown.taxAmount, currency),
                  },
                  {
                    term: '合計',
                    description: amountOf(breakdown.totalAmount, currency),
                  },
                  {
                    term: '1 回で受け取れる支払い方法',
                    description:
                      recommendedMethods.length === 0
                        ? NONE
                        : recommendedMethods.map(methodKindNameOf).join('、'),
                  },
                ]}
              />
            )
          })
          .with({ type: 'uncalculated' }, ({ message }) => (
            <div className={styles['controls']}>
              <Alert tone='warning'>{message}</Alert>
              <Button onClick={onRecalculate} pending={recalculating}>
                計算し直す
              </Button>
            </div>
          ))
          .with({ type: 'unread' }, ({ message }) => (
            <UnreadNotice
              message={message}
              onRetry={onRecalculate}
              pending={recalculating}
            />
          ))
          .exhaustive()}
      </section>
      <FormPart label='会計の記録'>
        <Select
          label='会計の担当'
          name='staffId'
          options={[
            ...staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            })),
            { value: NO_CASHIER, label: '記録しない' },
          ]}
          defaultValue={cashier}
          description='支払いを受けたスタッフです。売上の担当として記録します。'
          error={errors['staffId']}
        />
        <TextArea
          label='メモ'
          name='notes'
          description='サロンの中で見る、この会計のメモです。お客様には見えません。'
          error={errors['notes']}
        />
      </FormPart>
    </Form>
  )
}
