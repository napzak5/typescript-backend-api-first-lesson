import type {
  ModelsInventoryResponse,
  ModelsInventoryTransactionType,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  RadioGroup,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useState } from 'react'
import { match } from 'ts-pattern'
import {
  movementTypeIn,
  movementTypeNameOf,
  needsReason,
  wayOf,
} from '../../movement-format'
import { quantityNameOf, stockRowNameOf } from '../../stock-format'

export type MovementFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The row whose stock moves, as it was read */
  row: ModelsInventoryResponse
  /** The product of the row; `undefined` when it was removed */
  product: ModelsProductResponse | undefined
  /** The kinds the account records, in the order they are offered */
  offered: readonly ModelsInventoryTransactionType[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

/** What is said of the way a kind that moves either way goes */
const wayDescriptionOf = (type: ModelsInventoryTransactionType): string =>
  match(type)
    .with('return', () => '仕入先に返すと減り、お客様から戻ると増えます。')
    .with(
      'transfer',
      () =>
        'ほかのサロンへ送ると減り、ほかのサロンから受け取ると増えます。受け取ったサロンでも、記録します。',
    )
    .otherwise(() => '帳簿の在庫数を、実際の数に合わせます。')

/**
 * A movement of the stock of a row: its kind, and for a kind that moves
 * either way, which way; the quantity, as it is counted, in the unit of
 * the product; what one unit cost; and why. The stock the row has, and
 * what of it may be taken out, are said above.
 */
export const MovementForm = ({
  row,
  product,
  offered,
  errors = NO_ERRORS,
  ...form
}: MovementFormProps) => {
  const [chosen, setChosen] = useState('')
  const type = movementTypeIn(chosen)
  const available = Math.max(row.currentStock - row.reservedStock, 0)

  return (
    <Form {...form} errors={errors}>
      <FormPart
        label='在庫の移動'
        description={`${stockRowNameOf(row, product)}。いまの在庫数は ${quantityNameOf(row.currentStock, product)}、そのうち使える数は ${quantityNameOf(available, product)} です。`}
      >
        <RadioGroup
          label='区分'
          name='transactionType'
          required
          options={offered.map((kind) => ({
            value: kind,
            label: movementTypeNameOf(kind),
          }))}
          description={
            offered.includes('adjustment')
              ? undefined
              : '在庫の調整、廃棄、サロン間の移動は、オーナーとマネージャーが記録します。'
          }
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          error={errors['transactionType']}
        />
        {type !== undefined && wayOf(type) === 'either' && (
          <RadioGroup
            label='向き'
            name='direction'
            required
            options={[
              { value: 'in', label: '在庫が増える' },
              { value: 'out', label: '在庫が減る' },
            ]}
            description={wayDescriptionOf(type)}
            error={errors['direction']}
          />
        )}
        <FieldRow>
          <TextField
            label='数量'
            name='quantity'
            required
            inputMode='decimal'
            autoComplete='off'
            description={
              product === undefined
                ? '小数は 2 桁まで。'
                : `${product.unit} で数えます。小数は 2 桁まで。`
            }
            error={errors['quantity']}
          />
          <TextField
            label='単価（円）'
            name='unitCost'
            inputMode='numeric'
            autoComplete='off'
            description='任意。金額は、単価 × 数量を四捨五入した円です。'
            error={errors['unitCost']}
          />
        </FieldRow>
        <TextArea
          label='理由'
          name='reason'
          required={type !== undefined && needsReason(type)}
          description={
            type !== undefined && needsReason(type)
              ? '在庫数を変える理由を、次に数える人のために書きます。'
              : '任意。'
          }
          error={errors['reason']}
        />
      </FormPart>
    </Form>
  )
}
