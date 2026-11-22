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
} from '@beauty-salon-frontend/ui'
import {
  LONGEST_CODE,
  LONGEST_LABEL,
  LONGEST_NAME,
  LONGEST_SUPPLIER,
  LONGEST_UNIT,
} from '../../utils/product-form'

export type ProductFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The product the form opens with. `null` for a new one: the form then
   * opens as a new row of the table is stored, with a product the salon
   * uses in its treatments and carries, of a minimum stock of 0
   */
  product: ModelsProductResponse | null
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
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
  errors = NO_ERRORS,
  ...form
}: ProductFormProps) => (
  <Form {...form} errors={errors}>
    <FormPart label='商品'>
      <FieldRow>
        <TextField
          label='商品コード'
          name='productCode'
          autoComplete='off'
          required
          description={`${upTo(LONGEST_CODE)}このサロンの、削除していないほかの商品と同じコードは使えません。取り扱いをやめた商品のコードも使えません。`}
          defaultValue={product?.productCode}
          error={errors['productCode']}
        />
        <TextField
          label='単位'
          name='unit'
          autoComplete='off'
          required
          description={`本、個、ml など。${upTo(LONGEST_UNIT)}在庫の数を数える単位です。`}
          defaultValue={product?.unit}
          error={errors['unit']}
        />
      </FieldRow>
      <TextField
        label='商品名'
        name='name'
        autoComplete='off'
        required
        description={upTo(LONGEST_NAME)}
        defaultValue={product?.name}
        error={errors['name']}
      />
      <TextArea
        label='説明'
        name='description'
        defaultValue={textOrNothing(product?.description)}
        error={errors['description']}
      />
      <FieldRow>
        <TextField
          label='カテゴリー'
          name='category'
          autoComplete='off'
          description={`${upTo(LONGEST_LABEL)}商品台帳で、カテゴリーで探せます。在庫の評価額をカテゴリーごとに集計します。`}
          defaultValue={textOrNothing(product?.category)}
          error={errors['category']}
        />
        <TextField
          label='ブランド'
          name='brand'
          autoComplete='off'
          description={upTo(LONGEST_LABEL)}
          defaultValue={textOrNothing(product?.brand)}
          error={errors['brand']}
        />
      </FieldRow>
      <Checkbox
        label='店頭で販売する'
        name='isForSale'
        defaultChecked={product?.isForSale ?? false}
        error={errors['isForSale']}
      />
      <Checkbox
        label='施術で使う'
        name='isForTreatment'
        description='施術記録の材料に出ます。どちらにも使わない備品は、両方の印を外します。'
        defaultChecked={product?.isForTreatment ?? true}
        error={errors['isForTreatment']}
      />
      <Checkbox
        label='取り扱い中'
        name='isActive'
        description='外すと、取り扱いをやめた商品になり、施術記録の材料に出なくなります。在庫の記録と施術記録は、そのまま残ります。'
        defaultChecked={product?.isActive ?? true}
        error={errors['isActive']}
      />
    </FormPart>
    <FormPart
      label='価格'
      description='円の整数で入力します。空にすると、記録しません（0 は 0 円です）。'
    >
      <FieldRow columns={3}>
        <TextField
          label='仕入価格'
          name='purchasePrice'
          inputMode='numeric'
          autoComplete='off'
          defaultValue={numberText(product?.purchasePrice)}
          error={errors['purchasePrice']}
        />
        <TextField
          label='定価'
          name='retailPrice'
          inputMode='numeric'
          autoComplete='off'
          description='メーカーの希望小売価格。'
          defaultValue={numberText(product?.retailPrice)}
          error={errors['retailPrice']}
        />
        <TextField
          label='販売価格'
          name='salonPrice'
          inputMode='numeric'
          autoComplete='off'
          description='このサロンの店頭で売る価格。'
          defaultValue={numberText(product?.salonPrice)}
          error={errors['salonPrice']}
        />
      </FieldRow>
    </FormPart>
    <FormPart
      label='在庫の水準'
      description='単位の数で、小数は 2 桁まで。最低在庫数、発注点、最大在庫数の順に、同じか大きくします。発注点と最大在庫数は、空にすると決めません。'
    >
      <FieldRow columns={3}>
        <TextField
          label='最低在庫数'
          name='minimumStock'
          inputMode='decimal'
          autoComplete='off'
          required
          description='在庫がこれを下回らないように発注します。'
          defaultValue={numberText(product?.minimumStock ?? 0)}
          error={errors['minimumStock']}
        />
        <TextField
          label='発注点'
          name='reorderPoint'
          inputMode='decimal'
          autoComplete='off'
          description='在庫がこれ以下になったら発注します。'
          defaultValue={numberText(product?.reorderPoint)}
          error={errors['reorderPoint']}
        />
        <TextField
          label='最大在庫数'
          name='maximumStock'
          inputMode='decimal'
          autoComplete='off'
          description='これより多くは置きません。'
          defaultValue={numberText(product?.maximumStock)}
          error={errors['maximumStock']}
        />
      </FieldRow>
    </FormPart>
    <FormPart label='仕入れ'>
      <FieldRow>
        <TextField
          label='仕入先'
          name='supplier'
          autoComplete='off'
          description={upTo(LONGEST_SUPPLIER)}
          defaultValue={textOrNothing(product?.supplier)}
          error={errors['supplier']}
        />
        <TextField
          label='仕入先の商品コード'
          name='supplierProductCode'
          autoComplete='off'
          description={`${upTo(LONGEST_LABEL)}発注するときに使います。`}
          defaultValue={textOrNothing(product?.supplierProductCode)}
          error={errors['supplierProductCode']}
        />
      </FieldRow>
      <TextField
        label='納品までの日数'
        name='leadTimeDays'
        inputMode='numeric'
        autoComplete='off'
        width='short'
        description='0 以上の整数。発注してから届くまでの日数です。'
        defaultValue={numberText(product?.leadTimeDays)}
        error={errors['leadTimeDays']}
      />
    </FormPart>
    <FormPart label='管理'>
      <FieldRow>
        <TextField
          label='バーコード'
          name='barcode'
          inputMode='numeric'
          autoComplete='off'
          description={`${upTo(LONGEST_LABEL)}商品台帳で、バーコードで探せます。`}
          defaultValue={textOrNothing(product?.barcode)}
          error={errors['barcode']}
        />
        <TextField
          label='使用期限までの月数'
          name='expiryMonths'
          inputMode='numeric'
          autoComplete='off'
          description='1 以上の整数。開封前の使用期限の目安です。'
          defaultValue={numberText(product?.expiryMonths)}
          error={errors['expiryMonths']}
        />
      </FieldRow>
      <Checkbox
        label='在庫をロット番号で分ける'
        name='requiresLotTracking'
        description='カラー剤など、ロットごとに使用期限があるもの。変えても、在庫の記録のロット番号はそのままです。'
        defaultChecked={product?.requiresLotTracking ?? false}
        error={errors['requiresLotTracking']}
      />
      <TextArea
        label='保管条件'
        name='storageConditions'
        rows={2}
        defaultValue={textOrNothing(product?.storageConditions)}
        error={errors['storageConditions']}
      />
      <TextField
        label='商品画像の URL'
        name='imageUrl'
        type='url'
        inputMode='url'
        autoComplete='off'
        description={WEB_ADDRESS_DESCRIPTION}
        defaultValue={textOrNothing(product?.imageUrl)}
        error={errors['imageUrl']}
      />
      <TextField
        label='安全データシートの URL'
        name='safetyDataSheet'
        type='url'
        inputMode='url'
        autoComplete='off'
        description={`メーカーの安全データシート（SDS）の URL。${upTo(LONGEST_WEB_ADDRESS)}`}
        defaultValue={textOrNothing(product?.safetyDataSheet)}
        error={errors['safetyDataSheet']}
      />
    </FormPart>
  </Form>
)
