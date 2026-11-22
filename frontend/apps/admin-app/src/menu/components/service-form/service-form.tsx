import type {
  ModelsServiceCategoryResponse,
  ModelsServiceOption,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { upTo, WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
import {
  Button,
  Checkbox,
  CheckboxGroup,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  FormRow,
  NO_ERRORS,
  Note,
  Select,
  TextArea,
  TextField,
  useRepeatedRows,
} from '@beauty-salon-frontend/ui'
import { useState } from 'react'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import { LEVELS, levelNameOf } from '../../../staff/utils/staff-format'
import {
  AVAILABILITY_OPTIONS,
  categoriesById,
  categoryPathOf,
  OPTION_TYPE_OPTIONS,
  PRICING_OPTIONS,
  packagedChoicesOf,
  packagesOf,
  REQUIREMENT_OPTIONS,
  SERVICE_STATUS_OPTIONS,
} from '../../utils/menu-format'
import {
  FEWEST_PACKAGED,
  LONGEST_NAME,
  LONGEST_SHORT_DESCRIPTION,
  MOST_PACKAGED,
  optionControlOf,
  packagedControlOf,
} from '../../utils/service-form'

export type ServiceFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The service the form opens with. `null` for a new one: the form then
   * opens with a service of no category that is switched on, given every
   * day, booked online, and last in the menu
   */
  service: ModelsServiceResponse | null
  /** The categories of the salon, in the order of the menu */
  categories: readonly ModelsServiceCategoryResponse[]
  /** The services of the salon, in the order of the menu: what a package is made of */
  services: readonly ModelsServiceResponse[]
  /** Where a new service goes in the order of the menu */
  sortOrder: number
  /**
   * What is wrong with the values, under the names of the controls; a
   * row's under `options.<n>.<name>` or `packageServiceIds.<n>`. A new
   * object is the answer to another attempt
   */
  errors?: FormErrors | undefined
}

const LEVEL_CHOICES = LEVELS.map((level) => ({
  value: level,
  label: `${levelNameOf(level)}以上`,
}))

/**
 * Everything the menu keeps of a service, in parts: the service, its time
 * and price, when it is given, how it is booked, its pictures, the
 * services of a package, and its options. The options and the services of
 * a package are rows that are added at the end, where the first control of
 * a new row takes the focus, and taken away, when the button that adds one
 * takes it. The browser keeps the values of a row, so the rows that stay
 * keep what was written in them.
 *
 * The services of a package are offered once the box that makes it is
 * checked, with two rows to choose in; a service that is one of the
 * services of a package is offered no box, for the API makes no package of
 * it. An error names a row by its number, and taking a row away renumbers
 * the rows after it: the errors of the rows of a list are shown until a row
 * of it is taken away, and again after the next attempt.
 */
export const ServiceForm = ({
  service,
  categories,
  services,
  sortOrder,
  errors = NO_ERRORS,
  ...form
}: ServiceFormProps) => {
  const byId = categoriesById(categories)
  const choices = packagedChoicesOf(services, service?.id ?? null).map(
    (choice) => ({ value: choice.id, label: choice.name }),
  )
  const containers =
    service === null || service.isPackage
      ? []
      : packagesOf(services, service.id)
  // A row of an option and of a service of the package holds what it
  // opened with, if anything
  const options = useRepeatedRows<ModelsServiceOption | undefined>(
    () => service?.options ?? [],
    errors,
  )
  const packaged = useRepeatedRows<string | undefined>(
    () => service?.packageServiceIds ?? [],
    errors,
  )
  const [isPackage, setIsPackage] = useState(service?.isPackage ?? false)

  const makePackage = (checked: boolean): void => {
    setIsPackage(checked)
    if (checked && packaged.rows.length === 0) {
      packaged.addAlong(
        Array.from({ length: FEWEST_PACKAGED }, () => undefined),
      )
    }
  }

  return (
    <Form {...form} errors={errors}>
      <FormPart label='サービス'>
        <TextField
          label='名前'
          name='name'
          autoComplete='off'
          required
          description={`${upTo(LONGEST_NAME)}お客様のメニューに出ます。`}
          defaultValue={service?.name}
          error={errors['name']}
        />
        <Select
          label='カテゴリー'
          name='categoryId'
          placeholder='未分類'
          options={categories.map((category) => ({
            value: category.id,
            label: categoryPathOf(category, byId),
          }))}
          defaultValue={service?.categoryId ?? ''}
          error={errors['categoryId']}
        />
        <TextArea
          label='短い紹介'
          name='shortDescription'
          rows={2}
          description={`${upTo(LONGEST_SHORT_DESCRIPTION)}メニューの一覧に出ます。`}
          defaultValue={service?.shortDescription ?? undefined}
          error={errors['shortDescription']}
        />
        <TextArea
          label='説明'
          name='description'
          rows={4}
          defaultValue={service?.description ?? undefined}
          error={errors['description']}
        />
        <FieldRow>
          <TextField
            label='タグ'
            name='tags'
            autoComplete='off'
            description='「、」か「,」で区切って書きます。'
            defaultValue={tagsTextOf(service?.tags ?? [])}
            error={errors['tags']}
          />
          <TextField
            label='表示順'
            name='sortOrder'
            inputMode='numeric'
            autoComplete='off'
            required
            description='0 以上の整数。小さいものから並びます。'
            defaultValue={String(service?.sortOrder ?? sortOrder)}
            error={errors['sortOrder']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label='時間と料金'>
        <FieldRow>
          <TextField
            label='所要時間（分）'
            name='duration'
            inputMode='numeric'
            autoComplete='off'
            required
            description='1 から 1440 までの整数。'
            defaultValue={service === null ? '' : String(service.duration)}
            error={errors['duration']}
          />
          <Select
            label='価格の決め方'
            name='pricingStrategy'
            required
            options={PRICING_OPTIONS}
            defaultValue={service?.pricingStrategy ?? 'fixed'}
            error={errors['pricingStrategy']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label='料金'
            name='price'
            inputMode='numeric'
            autoComplete='off'
            required
            description='0 以上の整数。'
            defaultValue={service === null ? '' : String(service.price)}
            error={errors['price']}
          />
          <TextField
            label='割引後の料金'
            name='discountPrice'
            inputMode='numeric'
            autoComplete='off'
            description='料金以下の整数。割引がなければ、空のままにします。'
            defaultValue={
              service?.discountPrice === null ||
              service?.discountPrice === undefined
                ? ''
                : String(service.discountPrice)
            }
            error={errors['discountPrice']}
          />
        </FieldRow>
        <Checkbox
          label='税込'
          name='taxIncluded'
          description='外すと、料金は税別です。'
          defaultChecked={service?.taxIncluded ?? true}
        />
      </FormPart>
      <FormPart label='提供'>
        <Checkbox
          label='有効'
          name='isActive'
          description='外すと、お客様のメニューに出なくなり、予約できなくなります。'
          defaultChecked={service?.isActive ?? true}
        />
        <FieldRow>
          <Select
            label='提供の状態'
            name='serviceStatus'
            required
            options={SERVICE_STATUS_OPTIONS}
            description='お客様が予約できるのは、「有効」のサービスです。'
            defaultValue={service?.serviceStatus ?? 'active'}
            error={errors['serviceStatus']}
          />
          <Select
            label='提供日'
            name='availability'
            required
            options={AVAILABILITY_OPTIONS}
            defaultValue={service?.availability ?? 'always'}
            error={errors['availability']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label='予約'>
        <Checkbox
          label='オンライン予約を受ける'
          name='allowOnlineBooking'
          description='外すと、お客様が自分で予約できなくなります。サロンが入れる予約には使えます。'
          defaultChecked={service?.allowOnlineBooking ?? true}
        />
        <Checkbox
          label='カウンセリングが要る'
          name='requiresConsultation'
          defaultChecked={service?.requiresConsultation ?? false}
        />
        <FieldRow>
          <Select
            label='担当できるスタッフ'
            name='requiredStaffLevel'
            placeholder='すべてのスタッフ'
            options={LEVEL_CHOICES}
            defaultValue={service?.requiredStaffLevel ?? ''}
            error={errors['requiredStaffLevel']}
          />
          <TextField
            label='1 日の予約の上限'
            name='maxBookingsPerDay'
            inputMode='numeric'
            autoComplete='off'
            description='1 以上の整数。上限がなければ、空のままにします。'
            defaultValue={
              service?.maxBookingsPerDay === null ||
              service?.maxBookingsPerDay === undefined
                ? ''
                : String(service.maxBookingsPerDay)
            }
            error={errors['maxBookingsPerDay']}
          />
        </FieldRow>
        <CheckboxGroup
          label='予約の条件'
          name='bookingRequirements'
          layout='columns'
          options={REQUIREMENT_OPTIONS}
          defaultValue={service?.bookingRequirements ?? []}
          error={errors['bookingRequirements']}
        />
      </FormPart>
      <FormPart label='写真'>
        <TextField
          label='写真の URL'
          name='imageUrl'
          type='url'
          autoComplete='off'
          description={WEB_ADDRESS_DESCRIPTION}
          defaultValue={service?.imageUrl ?? undefined}
          error={errors['imageUrl']}
        />
        <TextArea
          label='ほかの写真の URL'
          name='imageUrls'
          description='1 行に 1 つ。http:// か https:// で始まる URL。'
          defaultValue={(service?.imageUrls ?? []).join('\n')}
          error={errors['imageUrls']}
        />
      </FormPart>
      <FormPart label='パッケージ'>
        {containers.length > 0 ? (
          <Note size='small'>
            {`このサービスは、パッケージ${containers.map(({ name }) => `「${name}」`).join('')}に入っているので、パッケージにできません。`}
          </Note>
        ) : (
          <Checkbox
            label='パッケージにする'
            name='isPackage'
            description={`ほかのサービスを ${FEWEST_PACKAGED} 件から ${MOST_PACKAGED} 件まとめて、1 つのサービスにします。パッケージに入れられるのは、パッケージでないサービスです。`}
            checked={isPackage}
            onChange={(event) => makePackage(event.currentTarget.checked)}
            error={errors['isPackage']}
          />
        )}
        {isPackage &&
          packaged.rows.map((row, index) => (
            <FormRow
              key={row.key}
              ref={packaged.rowRef(row.key)}
              label={`構成サービス ${index + 1}`}
            >
              <Select
                label='サービス'
                name={packagedControlOf(index)}
                placeholder='選んでください'
                required
                options={choices}
                defaultValue={row.value ?? ''}
                error={packaged.errors[packagedControlOf(index)]}
              />
              <Button
                size='small'
                aria-label={`構成サービス ${index + 1} を外す`}
                onClick={() => packaged.remove(row.key)}
              >
                外す
              </Button>
            </FormRow>
          ))}
        {isPackage && packaged.rows.length < MOST_PACKAGED && (
          <Button ref={packaged.addRef} onClick={() => packaged.add(undefined)}>
            構成サービスを足す
          </Button>
        )}
      </FormPart>
      <FormPart
        label='オプション'
        description='お客様が予約のときに足せるものです。並びの順に、お客様に出ます。'
      >
        {options.rows.map((row, index) => (
          <FormRow
            key={row.key}
            ref={options.rowRef(row.key)}
            label={`オプション ${index + 1}`}
          >
            <TextField
              label='名前'
              name={optionControlOf(index, 'name')}
              autoComplete='off'
              required
              defaultValue={row.value?.name}
              error={options.errors[optionControlOf(index, 'name')]}
            />
            <FieldRow>
              <Select
                label='種類'
                name={optionControlOf(index, 'optionType')}
                required
                options={OPTION_TYPE_OPTIONS}
                defaultValue={row.value?.optionType ?? 'addon'}
                error={options.errors[optionControlOf(index, 'optionType')]}
              />
              <TextField
                label='選べる数'
                name={optionControlOf(index, 'maxQuantity')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.maxQuantity ?? 1)}
                error={options.errors[optionControlOf(index, 'maxQuantity')]}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                label='追加の時間（分）'
                name={optionControlOf(index, 'additionalTime')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.additionalTime ?? 0)}
                error={options.errors[optionControlOf(index, 'additionalTime')]}
              />
              <TextField
                label='追加の料金'
                name={optionControlOf(index, 'additionalPrice')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.additionalPrice ?? 0)}
                error={
                  options.errors[optionControlOf(index, 'additionalPrice')]
                }
              />
            </FieldRow>
            <TextArea
              label='説明'
              name={optionControlOf(index, 'description')}
              rows={2}
              defaultValue={row.value?.description ?? undefined}
            />
            <Checkbox
              label='必須'
              name={optionControlOf(index, 'isRequired')}
              description='予約のときに、かならず付きます。'
              defaultChecked={row.value?.isRequired ?? false}
            />
            <Checkbox
              label='有効'
              name={optionControlOf(index, 'isActive')}
              defaultChecked={row.value?.isActive ?? true}
            />
            <Button
              size='small'
              aria-label={`オプション ${index + 1} を外す`}
              onClick={() => options.remove(row.key)}
            >
              外す
            </Button>
          </FormRow>
        ))}
        <Button ref={options.addRef} onClick={() => options.add(undefined)}>
          オプションを足す
        </Button>
      </FormPart>
    </Form>
  )
}
