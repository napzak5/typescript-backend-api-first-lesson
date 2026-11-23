import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import {
  CheckboxGroup,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  type NamedChoice,
  NO_ERRORS,
  Select,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { LEVELS } from '../../../staff/utils/staff-format'
import {
  AVAILABILITY_OPTIONS,
  categoriesById,
  categoryPathOf,
  SERVICE_STATUS_OPTIONS,
} from '../../utils/menu-format'
import {
  MOST_SERVICES,
  NONE,
  SWITCH_OFF,
  SWITCH_ON,
  serviceChoicesOf,
} from '../../utils/services-change'

const {
  bulk: WORDS,
  words: { levelOrAbove },
} = adminMenuMessages

export type ServicesChangeFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The categories of the salon, in the order of the menu */
  categories: readonly ModelsServiceCategoryResponse[]
  /** The services of the salon: what may be chosen */
  services: readonly ModelsServiceResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

const LEVEL_CHOICES: readonly NamedChoice[] = [
  { value: NONE, label: WORDS.everyMember },
  ...LEVELS.map((level) => ({
    value: level,
    label: levelOrAbove(termMessages.staffLevel[level]),
  })),
]

const SWITCH_CHOICES: readonly NamedChoice[] = [
  { value: SWITCH_ON, label: WORDS.switchOn },
  { value: SWITCH_OFF, label: WORDS.switchOff },
]

const ONLINE_BOOKING_CHOICES: readonly NamedChoice[] = [
  { value: SWITCH_ON, label: WORDS.accepted },
  { value: SWITCH_OFF, label: WORDS.notAccepted },
]

/**
 * The services of the menu to change, and the values to give all of them:
 * the category, whether it is switched on, its state, the days it is
 * given, whether it is booked online and the level of the staff. Every
 * value opens at 「変えない」, and only those that were chosen are sent.
 * What differs from service to service (the price, the time, the options)
 * is changed one service at a time.
 */
export const ServicesChangeForm = ({
  categories,
  services,
  message,
  errors = NO_ERRORS,
  ...form
}: ServicesChangeFormProps) => {
  const say = useSay()
  const choicesOf = useSaidChoices()
  const said = useSaidForm(message, errors)
  const byId = categoriesById(categories)
  const keep = say(WORDS.keep)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(WORDS.services)}>
        <CheckboxGroup
          label={say(WORDS.chosen)}
          name='serviceIds'
          description={say(WORDS.chosenDescription(MOST_SERVICES))}
          options={choicesOf(serviceChoicesOf(categories, services))}
          error={said.errors['serviceIds']}
        />
      </FormPart>
      <FormPart
        label={say(WORDS.values)}
        description={say(WORDS.valuesDescription)}
      >
        <Select
          label={say(WORDS.category)}
          name='categoryId'
          placeholder={keep}
          options={[
            { value: NONE, label: say(WORDS.uncategorize) },
            ...categories.map((category) => ({
              value: category.id,
              label: categoryPathOf(category, byId),
            })),
          ]}
          defaultValue=''
          error={said.errors['categoryId']}
        />
        <FieldRow>
          <Select
            label={say(WORDS.active)}
            name='isActive'
            placeholder={keep}
            options={choicesOf(SWITCH_CHOICES)}
            defaultValue=''
            error={said.errors['isActive']}
          />
          <Select
            label={say(WORDS.onlineBooking)}
            name='allowOnlineBooking'
            placeholder={keep}
            options={choicesOf(ONLINE_BOOKING_CHOICES)}
            defaultValue=''
            error={said.errors['allowOnlineBooking']}
          />
        </FieldRow>
        <FieldRow>
          <Select
            label={say(WORDS.status)}
            name='serviceStatus'
            placeholder={keep}
            options={choicesOf(SERVICE_STATUS_OPTIONS)}
            defaultValue=''
            error={said.errors['serviceStatus']}
          />
          <Select
            label={say(WORDS.availability)}
            name='availability'
            placeholder={keep}
            options={choicesOf(AVAILABILITY_OPTIONS)}
            defaultValue=''
            error={said.errors['availability']}
          />
        </FieldRow>
        <Select
          label={say(WORDS.staffLevel)}
          name='requiredStaffLevel'
          placeholder={keep}
          options={choicesOf(LEVEL_CHOICES)}
          defaultValue=''
          error={said.errors['requiredStaffLevel']}
        />
      </FormPart>
    </Form>
  )
}
