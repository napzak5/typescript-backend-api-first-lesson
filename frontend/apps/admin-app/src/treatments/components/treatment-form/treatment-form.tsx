import type {
  ModelsBookingResponse,
  ModelsProductResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import { LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  CheckboxGroup,
  type ChoiceOption,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  Note,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { GONE_SERVICE, UNLISTED_STAFF } from '../../../bookings/booking-format'
import { tagsTextOf } from '../../../customers/customer-ledger'
import { MOST_MATERIALS, materialControlOf } from '../../treatment-form'
import {
  productNameOf,
  REMOVED_PRODUCT,
  SATISFACTION_OPTIONS,
} from '../../treatment-format'
import styles from './treatment-form.module.css'

export type TreatmentFormProps = {
  /** The booking whose treatment is written */
  booking: ModelsBookingResponse
  /** The record the form opens with; none for one that is written */
  record?: ModelsTreatmentRecordResponse | undefined
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon */
  services: readonly ModelsServiceResponse[]
  /** The products of the salon */
  products: readonly ModelsProductResponse[]
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * What is wrong with the values, under the names of the controls; a
   * material's under `materials.<n>.<name>`. A new object is the answer to
   * another attempt
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** A row of a material: what it opened with, if anything, and the product and the unit chosen in it */
type Row = {
  key: number
  shown: ModelsTreatmentMaterial | undefined
  productId: string
  unit: string
}

/** Where the focus goes after a row was added or taken away */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

const NO_ERRORS: FormErrors = {}

/** The IDs, each once, in their order. */
const distinct = (ids: readonly string[]): string[] => [...new Set(ids)]

/** The services offered: those of the salon, then those of the record that the salon removed. */
const serviceOptionsOf = (
  services: readonly ModelsServiceResponse[],
  held: readonly string[],
): ChoiceOption[] => [
  ...services.map(({ id, name }) => ({ value: id, label: name })),
  ...held
    .filter((id) => !services.some((service) => service.id === id))
    .map((id) => ({ value: id, label: GONE_SERVICE })),
]

/**
 * The products a row offers: those the salon uses in treatments and still
 * carries, and the one the row holds whatever it is now.
 */
const productOptionsOf = (
  products: readonly ModelsProductResponse[],
  held: string | undefined,
): ChoiceOption[] => {
  const offered = products.filter(
    ({ id, isForTreatment, isActive }) =>
      (isForTreatment && isActive) || id === held,
  )
  const gone =
    held !== undefined && !products.some(({ id }) => id === held)
      ? [{ value: held, label: REMOVED_PRODUCT }]
      : []

  return [
    ...offered.map((product) => ({
      value: product.id,
      label: productNameOf(product),
    })),
    ...gone,
  ]
}

/**
 * The record of the treatment of a booking: what was done (the member of
 * the staff, the services, the techniques, the time), the counselling and
 * the state of the scalp and of the hair, the materials used, and what
 * came of it with what to recommend next, each a part of its own.
 *
 * A new record opens with the member and the services of the booking; the
 * member of a record is not changed, and is only named. A material is a
 * group of its own: one is added at the end and its product takes the
 * focus, one that is taken away gives the focus to the button that adds
 * one. Choosing a product writes its unit, and asks for a lot number only
 * of a product kept by lots. An error names a row by its number, and
 * taking a row away renumbers the rows after it: the errors of the rows
 * are shown until a row is taken away, and again after the next attempt.
 */
export const TreatmentForm = ({
  booking,
  record,
  staff,
  services,
  products,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: TreatmentFormProps) => {
  const [rows, setRows] = useState<Row[]>(() =>
    (record?.materials ?? []).map((shown, key) => ({
      key,
      shown,
      productId: shown.productId,
      unit: shown.unit,
    })),
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [focus, setFocus] = useState<Focus>()
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const said = errors === outdated ? NO_ERRORS : errors
  const groups = useRef(new Map<number, HTMLFieldSetElement>())
  const add = useRef<HTMLButtonElement>(null)
  const chosenServices =
    record?.services ??
    distinct(booking.services.map(({ serviceId }) => serviceId))
  const member = staff.find(
    ({ id }) => id === (record?.staffId ?? booking.staffId),
  )

  useLayoutEffect(() => {
    if (focus?.type === 'row') {
      groups.current.get(focus.key)?.querySelector('select')?.focus()
    }
    if (focus?.type === 'add') {
      add.current?.focus()
    }
  }, [focus])

  const addRow = (): void => {
    setRows([
      ...rows,
      { key: nextKey, shown: undefined, productId: '', unit: '' },
    ])
    setNextKey(nextKey + 1)
    setFocus({ type: 'row', key: nextKey })
  }

  const removeRow = (key: number): void => {
    setRows(rows.filter((row) => row.key !== key))
    setOutdated(errors)
    setFocus({ type: 'add' })
  }

  /** The product of a row was chosen: its unit is the unit of the product. */
  const choose = (key: number, productId: string): void => {
    const unit = products.find(({ id }) => id === productId)?.unit
    setRows(
      rows.map((row) =>
        row.key === key ? { ...row, productId, unit: unit ?? row.unit } : row,
      ),
    )
  }

  const write = (key: number, unit: string): void => {
    setRows(rows.map((row) => (row.key === key ? { ...row, unit } : row)))
  }

  /** Whether a row asks for a lot number: of a product kept by lots, or of one the salon removed that had one */
  const takesLot = (row: Row): boolean => {
    const product = products.find(({ id }) => id === row.productId)

    return product === undefined
      ? row.productId !== '' && (row.shown?.lotNumber ?? null) !== null
      : product.requiresLotTracking
  }

  return (
    <Form
      submitLabel={submitLabel}
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart label='施術'>
        {record === undefined ? (
          <Select
            label='担当'
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='選んでください'
            required
            description='施術をしたスタッフ。予約の担当でなくても選べます。'
            defaultValue={member?.id ?? ''}
            error={errors['staffId']}
          />
        ) : (
          <p className={styles['fixed']}>
            <span className={styles['fixedName']}>担当</span>
            <span>{member?.displayName ?? UNLISTED_STAFF}</span>
          </p>
        )}
        <CheckboxGroup
          label='提供したサービス'
          name='services'
          layout='columns'
          options={serviceOptionsOf(services, chosenServices)}
          defaultValue={chosenServices}
          description='1 件から 20 件まで選びます。'
          error={errors['services']}
        />
        <TextField
          label='技法'
          name='techniques'
          autoComplete='off'
          description='技法の名前を、「、」か「,」で区切って書きます。20 件までです。'
          defaultValue={tagsTextOf(record?.techniques ?? [])}
          error={errors['techniques']}
        />
        <TextField
          label='施術時間（分）'
          name='processingTime'
          inputMode='numeric'
          autoComplete='off'
          width='short'
          description='0 から 1440 までの分。'
          defaultValue={
            record?.processingTime === null ||
            record?.processingTime === undefined
              ? undefined
              : String(record.processingTime)
          }
          error={errors['processingTime']}
        />
      </FormPart>
      <FormPart label='カウンセリングと状態'>
        <TextArea
          label='カウンセリングのメモ'
          name='consultationNotes'
          defaultValue={record?.consultationNotes ?? undefined}
          error={errors['consultationNotes']}
        />
        <FieldRow>
          <TextField
            label='頭皮の状態'
            name='scalpCondition'
            autoComplete='off'
            defaultValue={record?.scalpCondition ?? undefined}
            error={errors['scalpCondition']}
          />
          <TextField
            label='毛髪の状態'
            name='hairCondition'
            autoComplete='off'
            defaultValue={record?.hairCondition ?? undefined}
            error={errors['hairCondition']}
          />
        </FieldRow>
        <TextArea
          label='カラー剤の配合'
          name='colorFormula'
          rows={2}
          description='カラーをしない施術では、空のままにします。'
          defaultValue={record?.colorFormula ?? undefined}
          error={errors['colorFormula']}
        />
      </FormPart>
      <FormPart
        label='使った商材'
        description='記録しても在庫は減りません。在庫から出した分は、在庫の画面で記録します。'
      >
        {rows.map((row, index) => (
          <fieldset
            key={row.key}
            className={styles['row']}
            ref={(group) => {
              if (group === null) {
                groups.current.delete(row.key)
              } else {
                groups.current.set(row.key, group)
              }
            }}
          >
            <legend className={styles['rowName']}>
              {`${index + 1} 件目の商材`}
            </legend>
            <div className={styles['rowControls']}>
              <Select
                label='商品'
                name={materialControlOf(index, 'productId')}
                options={productOptionsOf(products, row.shown?.productId)}
                placeholder='選んでください'
                required
                value={row.productId}
                onChange={(event) => choose(row.key, event.target.value)}
                error={said[materialControlOf(index, 'productId')]}
              />
              <FieldRow>
                <TextField
                  label='量'
                  name={materialControlOf(index, 'quantity')}
                  inputMode='decimal'
                  autoComplete='off'
                  required
                  description='小数第 2 位まで。'
                  defaultValue={
                    row.shown === undefined
                      ? undefined
                      : String(row.shown.quantity)
                  }
                  error={said[materialControlOf(index, 'quantity')]}
                />
                <TextField
                  label='単位'
                  name={materialControlOf(index, 'unit')}
                  autoComplete='off'
                  required
                  description='商品を選ぶと、商品の単位が入ります。'
                  value={row.unit}
                  onChange={(event) => write(row.key, event.target.value)}
                  error={said[materialControlOf(index, 'unit')]}
                />
              </FieldRow>
              {takesLot(row) ? (
                <TextField
                  label='ロット番号'
                  name={materialControlOf(index, 'lotNumber')}
                  autoComplete='off'
                  required
                  description='ロットで管理している商品です。使った商品のロット番号を書きます。'
                  defaultValue={row.shown?.lotNumber ?? undefined}
                  error={said[materialControlOf(index, 'lotNumber')]}
                />
              ) : null}
              <TextField
                label='商材のメモ'
                name={materialControlOf(index, 'notes')}
                autoComplete='off'
                defaultValue={row.shown?.notes ?? undefined}
              />
              <Button
                size='small'
                aria-label={`${index + 1} 件目の商材を外す`}
                onClick={() => removeRow(row.key)}
              >
                外す
              </Button>
            </div>
          </fieldset>
        ))}
        {rows.length < MOST_MATERIALS ? (
          <Button ref={add} onClick={addRow}>
            商材を足す
          </Button>
        ) : (
          <Note size='small'>
            {`使った商材は、${MOST_MATERIALS} 件まで書けます。`}
          </Note>
        )}
      </FormPart>
      <FormPart label='結果と次回'>
        <TextArea
          label='結果のメモ'
          name='resultNotes'
          description='いつもと違うことがなければ、空のままにします。'
          defaultValue={record?.resultNotes ?? undefined}
          error={errors['resultNotes']}
        />
        <Select
          label='お客様の満足度'
          name='customerSatisfaction'
          width='short'
          options={SATISFACTION_OPTIONS}
          placeholder='記録しない'
          defaultValue={
            record?.customerSatisfaction === null ||
            record?.customerSatisfaction === undefined
              ? ''
              : String(record.customerSatisfaction)
          }
          error={errors['customerSatisfaction']}
        />
        <TextField
          label='次に勧める日'
          name='nextRecommendedDate'
          autoComplete='off'
          type='date'
          width='short'
          min={booking.bookingDate}
          max={LATEST_DAY}
          description='予約の日から後の日。勧めることがなければ、空のままにします。'
          defaultValue={record?.nextRecommendedDate ?? undefined}
          error={errors['nextRecommendedDate']}
        />
        <CheckboxGroup
          label='次に勧めるサービス'
          name='nextRecommendedServices'
          layout='columns'
          options={serviceOptionsOf(
            services,
            record?.nextRecommendedServices ?? [],
          )}
          defaultValue={record?.nextRecommendedServices ?? []}
          description='20 件まで選べます。'
          error={errors['nextRecommendedServices']}
        />
        <TextArea
          label='ホームケアの提案'
          name='homeCareSuggestions'
          rows={2}
          defaultValue={record?.homeCareSuggestions ?? undefined}
          error={errors['homeCareSuggestions']}
        />
        <TextArea
          label='申し送り'
          name='staffEvaluation'
          description='施術の振り返りや、次に担当するスタッフへ伝えること。'
          defaultValue={record?.staffEvaluation ?? undefined}
          error={errors['staffEvaluation']}
        />
      </FormPart>
    </Form>
  )
}
