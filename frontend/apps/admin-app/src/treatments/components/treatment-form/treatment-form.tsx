import type {
  ModelsBookingResponse,
  ModelsProductResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import { LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Button,
  CheckboxGroup,
  type ChoiceOption,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  FormRow,
  type NamedChoice,
  NO_ERRORS,
  Note,
  type RepeatedRow,
  Select,
  TextArea,
  TextField,
  useRepeatedRows,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminMenuMessages,
  adminStaffMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import { productNameOf } from '../../../inventory/utils/stock-format'
import {
  LONGEST_TREATMENT,
  MOST_IN_A_LIST,
  MOST_MATERIALS,
  materialControlOf,
} from '../../utils/treatment-form'
import { SATISFACTION_CHOICES } from '../../utils/treatment-format'
import styles from './treatment-form.module.css'

const { form: WORDS } = adminTreatmentMessages

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
  /** The label of the button that sends the form, in the language of the page */
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /**
   * What is wrong with the values, under the names of the controls; a
   * material's under `materials.<n>.<name>`. A new object is the answer to
   * another attempt
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** A row of a material: what it opened with, if anything, and the product and the unit chosen in it */
type Material = {
  shown: ModelsTreatmentMaterial | undefined
  productId: string
  unit: string
}

/** The IDs, each once, in their order. */
const distinct = (ids: readonly string[]): string[] => [...new Set(ids)]

/** The services offered: those of the salon, then those of the record that the salon removed. */
const serviceOptionsOf = (
  services: readonly ModelsServiceResponse[],
  held: readonly string[],
  removed: string,
): ChoiceOption[] => [
  ...services.map(({ id, name }) => ({ value: id, label: name })),
  ...held
    .filter((id) => !services.some((service) => service.id === id))
    .map((id) => ({ value: id, label: removed })),
]

/**
 * The products a row offers: those the salon uses in treatments and still
 * carries, and the one the row holds whatever it is now.
 */
const productChoicesOf = (
  products: readonly ModelsProductResponse[],
  held: string | undefined,
): NamedChoice[] => {
  const offered = products.filter(
    ({ id, isForTreatment, isActive }) =>
      (isForTreatment && isActive) || id === held,
  )
  const gone =
    held !== undefined && !products.some(({ id }) => id === held)
      ? [{ value: held, label: productNameOf(undefined) }]
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
  const say = useSay()
  const choicesOf = useSaidChoices()
  const said = useSaidForm(message, errors)
  const materials = useRepeatedRows<Material, LocalizedText>(
    () =>
      (record?.materials ?? []).map((shown) => ({
        shown,
        productId: shown.productId,
        unit: shown.unit,
      })),
    errors,
  )
  const materialErrors = useSaidForm(undefined, materials.errors).errors
  const removedService = say(adminMenuMessages.removedService)
  const chosenServices =
    record?.services ??
    distinct(booking.services.map(({ serviceId }) => serviceId))
  const member = staff.find(
    ({ id }) => id === (record?.staffId ?? booking.staffId),
  )

  const choose = (row: RepeatedRow<Material>, productId: string): void => {
    const unit = products.find(({ id }) => id === productId)?.unit
    materials.change(row.key, {
      ...row.value,
      productId,
      unit: unit ?? row.value.unit,
    })
  }

  /** Whether a row asks for a lot number: of a product kept by lots, or of one the salon removed that had one */
  const takesLot = ({ productId, shown }: Material): boolean => {
    const product = products.find(({ id }) => id === productId)

    return product === undefined
      ? productId !== '' && (shown?.lotNumber ?? null) !== null
      : product.requiresLotTracking
  }

  return (
    <Form
      submitLabel={submitLabel}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart label={say(WORDS.treatment)}>
        {record === undefined ? (
          <Select
            label={say(WORDS.staff)}
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder={say(WORDS.choose)}
            required
            description={say(WORDS.staffDescription)}
            defaultValue={member?.id ?? ''}
            error={said.errors['staffId']}
          />
        ) : (
          <p className={styles['fixed']}>
            <span className={styles['fixedName']}>{say(WORDS.staff)}</span>
            <span>
              {member?.displayName ?? say(adminStaffMessages.unlisted)}
            </span>
          </p>
        )}
        <CheckboxGroup
          label={say(WORDS.services)}
          name='services'
          layout='columns'
          options={serviceOptionsOf(services, chosenServices, removedService)}
          defaultValue={chosenServices}
          description={say(WORDS.servicesDescription(MOST_IN_A_LIST))}
          error={said.errors['services']}
        />
        <TextField
          label={say(WORDS.techniques)}
          name='techniques'
          autoComplete='off'
          description={say(WORDS.techniquesDescription(MOST_IN_A_LIST))}
          defaultValue={say(tagsTextOf(record?.techniques ?? []))}
          error={said.errors['techniques']}
        />
        <TextField
          label={say(WORDS.processingTime)}
          name='processingTime'
          inputMode='numeric'
          autoComplete='off'
          width='short'
          description={say(WORDS.processingTimeDescription(LONGEST_TREATMENT))}
          defaultValue={
            record?.processingTime === null ||
            record?.processingTime === undefined
              ? undefined
              : String(record.processingTime)
          }
          error={said.errors['processingTime']}
        />
      </FormPart>
      <FormPart label={say(WORDS.consultation)}>
        <TextArea
          label={say(WORDS.consultationNotes)}
          name='consultationNotes'
          defaultValue={record?.consultationNotes ?? undefined}
          error={said.errors['consultationNotes']}
        />
        <FieldRow>
          <TextField
            label={say(WORDS.scalpCondition)}
            name='scalpCondition'
            autoComplete='off'
            defaultValue={record?.scalpCondition ?? undefined}
            error={said.errors['scalpCondition']}
          />
          <TextField
            label={say(WORDS.hairCondition)}
            name='hairCondition'
            autoComplete='off'
            defaultValue={record?.hairCondition ?? undefined}
            error={said.errors['hairCondition']}
          />
        </FieldRow>
        <TextArea
          label={say(WORDS.colorFormula)}
          name='colorFormula'
          rows={2}
          description={say(WORDS.colorFormulaDescription)}
          defaultValue={record?.colorFormula ?? undefined}
          error={said.errors['colorFormula']}
        />
      </FormPart>
      <FormPart
        label={say(WORDS.materials)}
        description={say(WORDS.materialsDescription)}
      >
        {materials.rows.map((row, index) => (
          <FormRow
            key={row.key}
            ref={materials.rowRef(row.key)}
            label={say(WORDS.materialOf(index + 1))}
          >
            <Select
              label={say(WORDS.product)}
              name={materialControlOf(index, 'productId')}
              options={choicesOf(
                productChoicesOf(products, row.value.shown?.productId),
              )}
              placeholder={say(WORDS.choose)}
              required
              value={row.value.productId}
              onChange={(event) => choose(row, event.target.value)}
              error={materialErrors[materialControlOf(index, 'productId')]}
            />
            <FieldRow>
              <TextField
                label={say(WORDS.quantity)}
                name={materialControlOf(index, 'quantity')}
                inputMode='decimal'
                autoComplete='off'
                required
                description={say(WORDS.quantityDescription)}
                defaultValue={
                  row.value.shown === undefined
                    ? undefined
                    : String(row.value.shown.quantity)
                }
                error={materialErrors[materialControlOf(index, 'quantity')]}
              />
              <TextField
                label={say(WORDS.unit)}
                name={materialControlOf(index, 'unit')}
                autoComplete='off'
                required
                description={say(WORDS.unitDescription)}
                value={row.value.unit}
                onChange={(event) =>
                  materials.change(row.key, {
                    ...row.value,
                    unit: event.target.value,
                  })
                }
                error={materialErrors[materialControlOf(index, 'unit')]}
              />
            </FieldRow>
            {takesLot(row.value) ? (
              <TextField
                label={say(WORDS.lotNumber)}
                name={materialControlOf(index, 'lotNumber')}
                autoComplete='off'
                required
                description={say(WORDS.lotNumberDescription)}
                defaultValue={row.value.shown?.lotNumber ?? undefined}
                error={materialErrors[materialControlOf(index, 'lotNumber')]}
              />
            ) : null}
            <TextField
              label={say(WORDS.materialNotes)}
              name={materialControlOf(index, 'notes')}
              autoComplete='off'
              defaultValue={row.value.shown?.notes ?? undefined}
            />
            <Button
              size='small'
              aria-label={say(WORDS.removeMaterial(index + 1))}
              onClick={() => materials.remove(row.key)}
            >
              {say(WORDS.remove)}
            </Button>
          </FormRow>
        ))}
        {materials.rows.length < MOST_MATERIALS ? (
          <Button
            ref={materials.addRef}
            onClick={() =>
              materials.add({ shown: undefined, productId: '', unit: '' })
            }
          >
            {say(WORDS.addMaterial)}
          </Button>
        ) : (
          <Note size='small'>{say(WORDS.mostMaterials(MOST_MATERIALS))}</Note>
        )}
      </FormPart>
      <FormPart label={say(WORDS.result)}>
        <TextArea
          label={say(WORDS.resultNotes)}
          name='resultNotes'
          description={say(WORDS.resultNotesDescription)}
          defaultValue={record?.resultNotes ?? undefined}
          error={said.errors['resultNotes']}
        />
        <Select
          label={say(WORDS.satisfaction)}
          name='customerSatisfaction'
          width='short'
          options={choicesOf(SATISFACTION_CHOICES)}
          placeholder={say(WORDS.notRecorded)}
          defaultValue={
            record?.customerSatisfaction === null ||
            record?.customerSatisfaction === undefined
              ? ''
              : String(record.customerSatisfaction)
          }
          error={said.errors['customerSatisfaction']}
        />
        <TextField
          label={say(WORDS.nextRecommendedDate)}
          name='nextRecommendedDate'
          autoComplete='off'
          type='date'
          width='short'
          min={booking.bookingDate}
          max={LATEST_DAY}
          description={say(WORDS.nextRecommendedDateDescription)}
          defaultValue={record?.nextRecommendedDate ?? undefined}
          error={said.errors['nextRecommendedDate']}
        />
        <CheckboxGroup
          label={say(WORDS.nextRecommendedServices)}
          name='nextRecommendedServices'
          layout='columns'
          options={serviceOptionsOf(
            services,
            record?.nextRecommendedServices ?? [],
            removedService,
          )}
          defaultValue={record?.nextRecommendedServices ?? []}
          description={say(
            WORDS.nextRecommendedServicesDescription(MOST_IN_A_LIST),
          )}
          error={said.errors['nextRecommendedServices']}
        />
        <TextArea
          label={say(WORDS.homeCareSuggestions)}
          name='homeCareSuggestions'
          rows={2}
          defaultValue={record?.homeCareSuggestions ?? undefined}
          error={said.errors['homeCareSuggestions']}
        />
        <TextArea
          label={say(WORDS.staffEvaluation)}
          name='staffEvaluation'
          description={say(WORDS.staffEvaluationDescription)}
          defaultValue={record?.staffEvaluation ?? undefined}
          error={said.errors['staffEvaluation']}
        />
      </FormPart>
    </Form>
  )
}
