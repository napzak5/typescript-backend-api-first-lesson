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
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useState } from 'react'
import { match } from 'ts-pattern'
import {
  movementTypeIn,
  movementTypeNameOf,
  needsReason,
  wayOf,
} from '../../utils/movement-format'
import { quantityNameOf, stockRowNameOf } from '../../utils/stock-format'

const { form: words } = adminInventoryMessages.movements

export type MovementFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The row whose stock moves, as it was read */
  row: ModelsInventoryResponse
  /** The product of the row; `undefined` when it was removed */
  product: ModelsProductResponse | undefined
  /** The kinds the account records, in the order they are offered */
  offered: readonly ModelsInventoryTransactionType[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/** What is said of the way a kind that moves either way goes */
const wayDescriptionOf = (
  type: ModelsInventoryTransactionType,
): LocalizedText =>
  match(type)
    .with('return', () => words.ways.return)
    .with('transfer', () => words.ways.transfer)
    .otherwise(() => words.ways.adjustment)

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
  message,
  errors = NO_ERRORS,
  ...form
}: MovementFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const [chosen, setChosen] = useState('')
  const type = movementTypeIn(chosen)
  const available = Math.max(row.currentStock - row.reservedStock, 0)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart
        label={say(words.part)}
        description={say(
          words.about(
            stockRowNameOf(row, product),
            quantityNameOf(row.currentStock, product),
            quantityNameOf(available, product),
          ),
        )}
      >
        <RadioGroup
          label={say(words.kind)}
          name='transactionType'
          required
          options={offered.map((kind) => ({
            value: kind,
            label: say(movementTypeNameOf(kind)),
          }))}
          description={
            offered.includes('adjustment') ? undefined : say(words.keepersKinds)
          }
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          error={said.errors['transactionType']}
        />
        {type !== undefined && wayOf(type) === 'either' && (
          <RadioGroup
            label={say(words.direction)}
            name='direction'
            required
            options={[
              { value: 'in', label: say(words.in) },
              { value: 'out', label: say(words.out) },
            ]}
            description={say(wayDescriptionOf(type))}
            error={said.errors['direction']}
          />
        )}
        <FieldRow>
          <TextField
            label={say(words.quantity)}
            name='quantity'
            required
            inputMode='decimal'
            autoComplete='off'
            description={say(
              product === undefined
                ? words.decimals
                : words.countedIn(product.unit),
            )}
            error={said.errors['quantity']}
          />
          <TextField
            label={say(words.unitCost)}
            name='unitCost'
            inputMode='numeric'
            autoComplete='off'
            description={say(words.unitCostDescription)}
            error={said.errors['unitCost']}
          />
        </FieldRow>
        <TextArea
          label={say(words.reason)}
          name='reason'
          required={type !== undefined && needsReason(type)}
          description={say(
            type !== undefined && needsReason(type)
              ? words.reasonNeeded
              : words.optional,
          )}
          error={said.errors['reason']}
        />
      </FormPart>
    </Form>
  )
}
