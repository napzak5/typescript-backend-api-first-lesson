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
  type FormErrors,
  FormPart,
  type FormProps,
  LoadingIndicator,
  NO_ERRORS,
  NONE,
  Note,
  Select,
  Table,
  TextArea,
  UnreadNotice,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminMenuMessages,
  adminSaleMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { useId, useRef } from 'react'
import { match } from 'ts-pattern'
import { memberNameOf } from '../../../bookings/utils/day-bookings'
import { type Bill, type BillLine, NO_CASHIER } from '../../utils/checkout'
import styles from './checkout-form.module.css'

const { loading, words } = adminSaleMessages
const { form: texts } = adminSaleMessages.checkout

export type CheckoutFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
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
  /** What the last addition or removal did, in a sentence; `undefined` before either */
  changed: LocalizedText | undefined
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
  message,
  errors = NO_ERRORS,
  ...form
}: CheckoutFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const bookedName = useId()
  const addedName = useId()
  const amountsName = useId()
  const toAdd = useRef<HTMLSelectElement>(null)
  const nameOf = (line: BillLine): string =>
    line.name ?? say(adminMenuMessages.removedService)
  const columns = [
    {
      key: 'name',
      header: say(texts.service),
      cell: ({ line }: { line: BillLine }) => nameOf(line),
    },
    {
      key: 'staff',
      header: say(words.staff),
      cell: ({ line }: { line: BillLine }) =>
        say(memberNameOf(line.staffId, staff)),
    },
    {
      key: 'unitPrice',
      header: say(texts.price),
      cell: ({ line }: { line: BillLine }) =>
        say(amountOf(line.unitPrice, currency)),
    },
    {
      key: 'discountAmount',
      header: say(words.discount),
      cell: ({ line }: { line: BillLine }) =>
        say(amountOf(line.discountAmount, currency)),
    },
  ]

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(texts.submit)}
    >
      <section className={styles['part']} aria-labelledby={bookedName}>
        <h2 className={styles['name']} id={bookedName}>
          {say(texts.booked)}
        </h2>
        <Table
          caption={say(texts.booked)}
          captionHidden
          columns={columns}
          rows={booked.map((line, index) => ({ line, index }))}
          rowKey={({ index }) => `booked-${index}`}
          emptyMessage={say(texts.noBooked)}
        />
      </section>
      <section className={styles['part']} aria-labelledby={addedName}>
        <h2 className={styles['name']} id={addedName}>
          {say(texts.added)}
        </h2>
        <div className={styles['controls']}>
          <Table
            caption={say(texts.added)}
            captionHidden
            columns={[
              ...columns,
              {
                key: 'remove',
                header: say(texts.remove),
                cell: ({ line, index }) => (
                  <Button
                    size='small'
                    aria-label={say(texts.removeLine(nameOf(line), index + 1))}
                    onClick={() => {
                      onRemove(index)
                      toAdd.current?.focus()
                    }}
                  >
                    {say(texts.remove)}
                  </Button>
                ),
              },
            ]}
            rows={added.map((line, index) => ({ line, index }))}
            rowKey={({ index }) => `added-${index}`}
            emptyMessage={say(texts.noAdded)}
          />
          <div className={styles['addition']}>
            <Select
              ref={toAdd}
              label={say(texts.toAdd)}
              name={TO_ADD}
              options={offered.map(({ id, name, price }) => ({
                value: id,
                label: say(texts.offered(name, amountOf(price, currency))),
              }))}
              description={say(texts.toAddDescription)}
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
              {say(texts.add)}
            </Button>
          </div>
          <Note className={styles['changed']} role='status'>
            {changed === undefined ? '' : say(changed)}
          </Note>
        </div>
      </section>
      <section className={styles['part']} aria-labelledby={amountsName}>
        <h2 className={styles['name']} id={amountsName}>
          {say(words.amounts)}
        </h2>
        {match(bill)
          .with({ type: 'calculating' }, () => (
            <LoadingIndicator label={say(loading.amounts)} />
          ))
          .with({ type: 'calculated' }, ({ calculation }) => {
            const { breakdown, recommendedMethods } = calculation

            return (
              <DescriptionList
                items={[
                  {
                    term: say(words.subtotal),
                    description: say(amountOf(breakdown.subtotal, currency)),
                  },
                  {
                    term: say(words.discount),
                    description: say(
                      amountOf(breakdown.discountAmount, currency),
                    ),
                  },
                  {
                    term: say(words.tax),
                    description: say(amountOf(breakdown.taxAmount, currency)),
                  },
                  {
                    term: say(words.total),
                    description: say(amountOf(breakdown.totalAmount, currency)),
                  },
                  {
                    term: say(texts.recommended),
                    description: say(
                      recommendedMethods.length === 0
                        ? NONE
                        : texts.kinds(recommendedMethods.map(methodKindNameOf)),
                    ),
                  },
                ]}
              />
            )
          })
          .with({ type: 'uncalculated' }, ({ message: why }) => (
            <div className={styles['controls']}>
              <Alert tone='warning'>{say(why)}</Alert>
              <Button onClick={onRecalculate} pending={recalculating}>
                {say(texts.recalculate)}
              </Button>
            </div>
          ))
          .with({ type: 'unread' }, ({ message: why }) => (
            <UnreadNotice
              message={say(why)}
              onRetry={onRecalculate}
              pending={recalculating}
            />
          ))
          .exhaustive()}
      </section>
      <FormPart label={say(texts.record)}>
        <Select
          label={say(words.cashier)}
          name='staffId'
          options={[
            ...staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            })),
            { value: NO_CASHIER, label: say(words.noCashier) },
          ]}
          defaultValue={cashier}
          description={say(texts.cashierDescription)}
          error={said.errors['staffId']}
        />
        <TextArea
          label={say(words.notes)}
          name='notes'
          description={say(words.notesDescription)}
          error={said.errors['notes']}
        />
      </FormPart>
    </Form>
  )
}
