import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import {
  LONGEST_WEB_ADDRESS,
  upTo,
  WEB_ADDRESS_DESCRIPTION,
} from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  LONGEST_CODE,
  LONGEST_LABEL,
  LONGEST_NAME,
  LONGEST_SUPPLIER,
  LONGEST_UNIT,
} from '../../utils/product-form'

const { form: WORDS, words } = adminProductMessages

export type ProductFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The product the form opens with. `null` for a new one: the form then
   * opens as a new row of the table is stored, with a product the salon
   * uses in its treatments and carries, of a minimum stock of 0
   */
  product: ModelsProductResponse | null
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/** A text as the form opens with it: nothing for none. */
const textOrNothing = (text: string | null | undefined): string | undefined =>
  text ?? undefined

/** A number as the form opens with it: nothing for none. */
const numberText = (value: number | null | undefined): string | undefined =>
  value === null || value === undefined ? undefined : String(value)

/**
 * Everything a product keeps, in the parts a person fills it in by: what
 * it is and what it is for, its prices, the levels its stock is kept at,
 * where it comes from, and how it is managed. A control is named as the
 * property of the request is; the browser keeps the values, and the form
 * hands them over when it is sent.
 */
export const ProductForm = ({
  product,
  message,
  errors = NO_ERRORS,
  ...form
}: ProductFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(words.product)}>
        <FieldRow>
          <TextField
            label={say(words.productCode)}
            name='productCode'
            autoComplete='off'
            required
            description={say(WORDS.productCodeDescription(LONGEST_CODE))}
            defaultValue={product?.productCode}
            error={said.errors['productCode']}
          />
          <TextField
            label={say(words.unit)}
            name='unit'
            autoComplete='off'
            required
            description={say(WORDS.unitDescription(LONGEST_UNIT))}
            defaultValue={product?.unit}
            error={said.errors['unit']}
          />
        </FieldRow>
        <TextField
          label={say(words.name)}
          name='name'
          autoComplete='off'
          required
          description={say(upTo(LONGEST_NAME))}
          defaultValue={product?.name}
          error={said.errors['name']}
        />
        <TextArea
          label={say(words.description)}
          name='description'
          defaultValue={textOrNothing(product?.description)}
          error={said.errors['description']}
        />
        <FieldRow>
          <TextField
            label={say(words.category)}
            name='category'
            autoComplete='off'
            description={say(WORDS.categoryDescription(LONGEST_LABEL))}
            defaultValue={textOrNothing(product?.category)}
            error={said.errors['category']}
          />
          <TextField
            label={say(words.brand)}
            name='brand'
            autoComplete='off'
            description={say(upTo(LONGEST_LABEL))}
            defaultValue={textOrNothing(product?.brand)}
            error={said.errors['brand']}
          />
        </FieldRow>
        <Checkbox
          label={say(WORDS.forSale)}
          name='isForSale'
          defaultChecked={product?.isForSale ?? false}
          error={said.errors['isForSale']}
        />
        <Checkbox
          label={say(WORDS.forTreatment)}
          name='isForTreatment'
          description={say(WORDS.forTreatmentDescription)}
          defaultChecked={product?.isForTreatment ?? true}
          error={said.errors['isForTreatment']}
        />
        <Checkbox
          label={say(WORDS.carried)}
          name='isActive'
          description={say(WORDS.carriedDescription)}
          defaultChecked={product?.isActive ?? true}
          error={said.errors['isActive']}
        />
      </FormPart>
      <FormPart
        label={say(words.prices)}
        description={say(WORDS.pricesDescription)}
      >
        <FieldRow columns={3}>
          <TextField
            label={say(words.purchasePrice)}
            name='purchasePrice'
            inputMode='numeric'
            autoComplete='off'
            defaultValue={numberText(product?.purchasePrice)}
            error={said.errors['purchasePrice']}
          />
          <TextField
            label={say(words.retailPrice)}
            name='retailPrice'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.retailPriceDescription)}
            defaultValue={numberText(product?.retailPrice)}
            error={said.errors['retailPrice']}
          />
          <TextField
            label={say(words.salonPrice)}
            name='salonPrice'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.salonPriceDescription)}
            defaultValue={numberText(product?.salonPrice)}
            error={said.errors['salonPrice']}
          />
        </FieldRow>
      </FormPart>
      <FormPart
        label={say(words.levels)}
        description={say(WORDS.levelsDescription)}
      >
        <FieldRow columns={3}>
          <TextField
            label={say(words.minimumStock)}
            name='minimumStock'
            inputMode='decimal'
            autoComplete='off'
            required
            description={say(WORDS.minimumStockDescription)}
            defaultValue={numberText(product?.minimumStock ?? 0)}
            error={said.errors['minimumStock']}
          />
          <TextField
            label={say(words.reorderPoint)}
            name='reorderPoint'
            inputMode='decimal'
            autoComplete='off'
            description={say(WORDS.reorderPointDescription)}
            defaultValue={numberText(product?.reorderPoint)}
            error={said.errors['reorderPoint']}
          />
          <TextField
            label={say(words.maximumStock)}
            name='maximumStock'
            inputMode='decimal'
            autoComplete='off'
            description={say(WORDS.maximumStockDescription)}
            defaultValue={numberText(product?.maximumStock)}
            error={said.errors['maximumStock']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(words.purchasing)}>
        <FieldRow>
          <TextField
            label={say(words.supplier)}
            name='supplier'
            autoComplete='off'
            description={say(upTo(LONGEST_SUPPLIER))}
            defaultValue={textOrNothing(product?.supplier)}
            error={said.errors['supplier']}
          />
          <TextField
            label={say(words.supplierProductCode)}
            name='supplierProductCode'
            autoComplete='off'
            description={say(
              WORDS.supplierProductCodeDescription(LONGEST_LABEL),
            )}
            defaultValue={textOrNothing(product?.supplierProductCode)}
            error={said.errors['supplierProductCode']}
          />
        </FieldRow>
        <TextField
          label={say(words.leadTimeDays)}
          name='leadTimeDays'
          inputMode='numeric'
          autoComplete='off'
          width='short'
          description={say(WORDS.leadTimeDaysDescription)}
          defaultValue={numberText(product?.leadTimeDays)}
          error={said.errors['leadTimeDays']}
        />
      </FormPart>
      <FormPart label={say(words.management)}>
        <FieldRow>
          <TextField
            label={say(words.barcode)}
            name='barcode'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.barcodeDescription(LONGEST_LABEL))}
            defaultValue={textOrNothing(product?.barcode)}
            error={said.errors['barcode']}
          />
          <TextField
            label={say(WORDS.expiryMonths)}
            name='expiryMonths'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.expiryMonthsDescription)}
            defaultValue={numberText(product?.expiryMonths)}
            error={said.errors['expiryMonths']}
          />
        </FieldRow>
        <Checkbox
          label={say(WORDS.lots)}
          name='requiresLotTracking'
          description={say(WORDS.lotsDescription)}
          defaultChecked={product?.requiresLotTracking ?? false}
          error={said.errors['requiresLotTracking']}
        />
        <TextArea
          label={say(words.storageConditions)}
          name='storageConditions'
          rows={2}
          defaultValue={textOrNothing(product?.storageConditions)}
          error={said.errors['storageConditions']}
        />
        <TextField
          label={say(words.imageUrl)}
          name='imageUrl'
          type='url'
          inputMode='url'
          autoComplete='off'
          description={say(WEB_ADDRESS_DESCRIPTION)}
          defaultValue={textOrNothing(product?.imageUrl)}
          error={said.errors['imageUrl']}
        />
        <TextField
          label={say(words.safetyDataSheet)}
          name='safetyDataSheet'
          type='url'
          inputMode='url'
          autoComplete='off'
          description={say(
            WORDS.safetyDataSheetDescription(LONGEST_WEB_ADDRESS),
          )}
          defaultValue={textOrNothing(product?.safetyDataSheet)}
          error={said.errors['safetyDataSheet']}
        />
      </FormPart>
    </Form>
  )
}
