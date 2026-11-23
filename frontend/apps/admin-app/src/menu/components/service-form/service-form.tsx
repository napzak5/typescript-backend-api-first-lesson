import type {
  ModelsServiceCategoryResponse,
  ModelsServiceOption,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
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
  type NamedChoice,
  NO_ERRORS,
  Note,
  Select,
  TextArea,
  TextField,
  useRepeatedRows,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useState } from 'react'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import { LEVELS } from '../../../staff/utils/staff-format'
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
  LONGEST_DURATION,
  LONGEST_NAME,
  LONGEST_SHORT_DESCRIPTION,
  MOST_PACKAGED,
  optionControlOf,
  packagedControlOf,
} from '../../utils/service-form'

const {
  serviceForm: WORDS,
  words: { levelOrAbove },
} = adminMenuMessages

export type ServiceFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
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
  errors?: FormErrors<LocalizedText> | undefined
}

const LEVEL_CHOICES: readonly NamedChoice[] = LEVELS.map((level) => ({
  value: level,
  label: levelOrAbove(termMessages.staffLevel[level]),
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
  message,
  errors = NO_ERRORS,
  ...form
}: ServiceFormProps) => {
  const say = useSay()
  const choicesOf = useSaidChoices()
  const said = useSaidForm(message, errors)
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
  const options = useRepeatedRows<
    ModelsServiceOption | undefined,
    LocalizedText
  >(() => service?.options ?? [], errors)
  const packaged = useRepeatedRows<string | undefined, LocalizedText>(
    () => service?.packageServiceIds ?? [],
    errors,
  )
  /** What is wrong with a control of a row, in the language of the page */
  const sayAt = (error: LocalizedText | undefined): string | undefined =>
    error === undefined ? undefined : say(error)
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
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(WORDS.parts.service)}>
        <TextField
          label={say(WORDS.name)}
          name='name'
          autoComplete='off'
          required
          description={say(WORDS.nameDescription(LONGEST_NAME))}
          defaultValue={service?.name}
          error={said.errors['name']}
        />
        <Select
          label={say(WORDS.category)}
          name='categoryId'
          placeholder={say(WORDS.uncategorized)}
          options={categories.map((category) => ({
            value: category.id,
            label: categoryPathOf(category, byId),
          }))}
          defaultValue={service?.categoryId ?? ''}
          error={said.errors['categoryId']}
        />
        <TextArea
          label={say(WORDS.shortDescription)}
          name='shortDescription'
          rows={2}
          description={say(
            WORDS.shortDescriptionDescription(LONGEST_SHORT_DESCRIPTION),
          )}
          defaultValue={service?.shortDescription ?? undefined}
          error={said.errors['shortDescription']}
        />
        <TextArea
          label={say(WORDS.description)}
          name='description'
          rows={4}
          defaultValue={service?.description ?? undefined}
          error={said.errors['description']}
        />
        <FieldRow>
          <TextField
            label={say(WORDS.tags)}
            name='tags'
            autoComplete='off'
            description={say(WORDS.tagsDescription)}
            defaultValue={say(tagsTextOf(service?.tags ?? []))}
            error={said.errors['tags']}
          />
          <TextField
            label={say(WORDS.displayOrder)}
            name='sortOrder'
            inputMode='numeric'
            autoComplete='off'
            required
            description={say(WORDS.displayOrderDescription)}
            defaultValue={String(service?.sortOrder ?? sortOrder)}
            error={said.errors['sortOrder']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(WORDS.parts.timeAndPrice)}>
        <FieldRow>
          <TextField
            label={say(WORDS.duration)}
            name='duration'
            inputMode='numeric'
            autoComplete='off'
            required
            description={say(WORDS.durationDescription(LONGEST_DURATION))}
            defaultValue={service === null ? '' : String(service.duration)}
            error={said.errors['duration']}
          />
          <Select
            label={say(WORDS.pricing)}
            name='pricingStrategy'
            required
            options={choicesOf(PRICING_OPTIONS)}
            defaultValue={service?.pricingStrategy ?? 'fixed'}
            error={said.errors['pricingStrategy']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={say(WORDS.price)}
            name='price'
            inputMode='numeric'
            autoComplete='off'
            required
            description={say(WORDS.priceDescription)}
            defaultValue={service === null ? '' : String(service.price)}
            error={said.errors['price']}
          />
          <TextField
            label={say(WORDS.discountPrice)}
            name='discountPrice'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.discountPriceDescription)}
            defaultValue={
              service?.discountPrice === null ||
              service?.discountPrice === undefined
                ? ''
                : String(service.discountPrice)
            }
            error={said.errors['discountPrice']}
          />
        </FieldRow>
        <Checkbox
          label={say(WORDS.taxIncluded)}
          name='taxIncluded'
          description={say(WORDS.taxIncludedDescription)}
          defaultChecked={service?.taxIncluded ?? true}
        />
      </FormPart>
      <FormPart label={say(WORDS.parts.offering)}>
        <Checkbox
          label={say(WORDS.active)}
          name='isActive'
          description={say(WORDS.activeDescription)}
          defaultChecked={service?.isActive ?? true}
        />
        <FieldRow>
          <Select
            label={say(WORDS.status)}
            name='serviceStatus'
            required
            options={choicesOf(SERVICE_STATUS_OPTIONS)}
            description={say(WORDS.statusDescription)}
            defaultValue={service?.serviceStatus ?? 'active'}
            error={said.errors['serviceStatus']}
          />
          <Select
            label={say(WORDS.availability)}
            name='availability'
            required
            options={choicesOf(AVAILABILITY_OPTIONS)}
            defaultValue={service?.availability ?? 'always'}
            error={said.errors['availability']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(WORDS.parts.booking)}>
        <Checkbox
          label={say(WORDS.onlineBooking)}
          name='allowOnlineBooking'
          description={say(WORDS.onlineBookingDescription)}
          defaultChecked={service?.allowOnlineBooking ?? true}
        />
        <Checkbox
          label={say(WORDS.consultation)}
          name='requiresConsultation'
          defaultChecked={service?.requiresConsultation ?? false}
        />
        <FieldRow>
          <Select
            label={say(WORDS.staffLevel)}
            name='requiredStaffLevel'
            placeholder={say(WORDS.everyMember)}
            options={choicesOf(LEVEL_CHOICES)}
            defaultValue={service?.requiredStaffLevel ?? ''}
            error={said.errors['requiredStaffLevel']}
          />
          <TextField
            label={say(WORDS.mostBookings)}
            name='maxBookingsPerDay'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.mostBookingsDescription)}
            defaultValue={
              service?.maxBookingsPerDay === null ||
              service?.maxBookingsPerDay === undefined
                ? ''
                : String(service.maxBookingsPerDay)
            }
            error={said.errors['maxBookingsPerDay']}
          />
        </FieldRow>
        <CheckboxGroup
          label={say(WORDS.requirements)}
          name='bookingRequirements'
          layout='columns'
          options={choicesOf(REQUIREMENT_OPTIONS)}
          defaultValue={service?.bookingRequirements ?? []}
          error={said.errors['bookingRequirements']}
        />
      </FormPart>
      <FormPart label={say(WORDS.parts.photos)}>
        <TextField
          label={say(WORDS.photo)}
          name='imageUrl'
          type='url'
          autoComplete='off'
          description={say(WEB_ADDRESS_DESCRIPTION)}
          defaultValue={service?.imageUrl ?? undefined}
          error={said.errors['imageUrl']}
        />
        <TextArea
          label={say(WORDS.otherPhotos)}
          name='imageUrls'
          description={say(WORDS.otherPhotosDescription)}
          defaultValue={(service?.imageUrls ?? []).join('\n')}
          error={said.errors['imageUrls']}
        />
      </FormPart>
      <FormPart label={say(WORDS.parts.package)}>
        {containers.length > 0 ? (
          <Note size='small'>
            {say(WORDS.inPackages(containers.map(({ name }) => name)))}
          </Note>
        ) : (
          <Checkbox
            label={say(WORDS.makePackage)}
            name='isPackage'
            description={say(
              WORDS.makePackageDescription(FEWEST_PACKAGED, MOST_PACKAGED),
            )}
            checked={isPackage}
            onChange={(event) => makePackage(event.currentTarget.checked)}
            error={said.errors['isPackage']}
          />
        )}
        {isPackage &&
          packaged.rows.map((row, index) => (
            <FormRow
              key={row.key}
              ref={packaged.rowRef(row.key)}
              label={say(WORDS.packaged(index + 1))}
            >
              <Select
                label={say(WORDS.packagedService)}
                name={packagedControlOf(index)}
                placeholder={say(WORDS.choose)}
                required
                options={choices}
                defaultValue={row.value ?? ''}
                error={sayAt(packaged.errors[packagedControlOf(index)])}
              />
              <Button
                size='small'
                aria-label={say(WORDS.removePackaged(index + 1))}
                onClick={() => packaged.remove(row.key)}
              >
                {say(WORDS.removeRow)}
              </Button>
            </FormRow>
          ))}
        {isPackage && packaged.rows.length < MOST_PACKAGED && (
          <Button ref={packaged.addRef} onClick={() => packaged.add(undefined)}>
            {say(WORDS.addPackaged)}
          </Button>
        )}
      </FormPart>
      <FormPart
        label={say(WORDS.parts.options)}
        description={say(WORDS.parts.optionsDescription)}
      >
        {options.rows.map((row, index) => (
          <FormRow
            key={row.key}
            ref={options.rowRef(row.key)}
            label={say(WORDS.option(index + 1))}
          >
            <TextField
              label={say(WORDS.name)}
              name={optionControlOf(index, 'name')}
              autoComplete='off'
              required
              defaultValue={row.value?.name}
              error={sayAt(options.errors[optionControlOf(index, 'name')])}
            />
            <FieldRow>
              <Select
                label={say(WORDS.optionType)}
                name={optionControlOf(index, 'optionType')}
                required
                options={choicesOf(OPTION_TYPE_OPTIONS)}
                defaultValue={row.value?.optionType ?? 'addon'}
                error={sayAt(
                  options.errors[optionControlOf(index, 'optionType')],
                )}
              />
              <TextField
                label={say(WORDS.maxQuantity)}
                name={optionControlOf(index, 'maxQuantity')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.maxQuantity ?? 1)}
                error={sayAt(
                  options.errors[optionControlOf(index, 'maxQuantity')],
                )}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                label={say(WORDS.additionalTime)}
                name={optionControlOf(index, 'additionalTime')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.additionalTime ?? 0)}
                error={sayAt(
                  options.errors[optionControlOf(index, 'additionalTime')],
                )}
              />
              <TextField
                label={say(WORDS.additionalPrice)}
                name={optionControlOf(index, 'additionalPrice')}
                inputMode='numeric'
                autoComplete='off'
                required
                defaultValue={String(row.value?.additionalPrice ?? 0)}
                error={sayAt(
                  options.errors[optionControlOf(index, 'additionalPrice')],
                )}
              />
            </FieldRow>
            <TextArea
              label={say(WORDS.description)}
              name={optionControlOf(index, 'description')}
              rows={2}
              defaultValue={row.value?.description ?? undefined}
            />
            <Checkbox
              label={say(WORDS.required)}
              name={optionControlOf(index, 'isRequired')}
              description={say(WORDS.requiredDescription)}
              defaultChecked={row.value?.isRequired ?? false}
            />
            <Checkbox
              label={say(WORDS.active)}
              name={optionControlOf(index, 'isActive')}
              defaultChecked={row.value?.isActive ?? true}
            />
            <Button
              size='small'
              aria-label={say(WORDS.removeOption(index + 1))}
              onClick={() => options.remove(row.key)}
            >
              {say(WORDS.removeRow)}
            </Button>
          </FormRow>
        ))}
        <Button ref={options.addRef} onClick={() => options.add(undefined)}>
          {say(WORDS.addOption)}
        </Button>
      </FormPart>
    </Form>
  )
}
