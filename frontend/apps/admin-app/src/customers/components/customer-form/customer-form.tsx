import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  CATEGORY_CHOICES,
  EARLIEST_DAY,
  GENDER_CHOICES,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
} from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  CheckboxGroup,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages as record } from '@beauty-salon-shared/i18n/messages/ui'
import { type ReactNode, useState } from 'react'
import { REFERRER, type Referrer } from '../../utils/customer-form'
import {
  HAIR_THICKNESS_CHOICES,
  HAIR_TYPE_CHOICES,
  SCALP_CONDITION_CHOICES,
  STATUS_CHOICES,
  TIER_CHOICES,
} from '../../utils/customer-format'
import { tagsTextOf } from '../../utils/customer-ledger'
import { ReferrerField } from '../referrer-field/referrer-field'

const { form: words } = adminCustomerMessages
const { parts } = words

/** What the choice of a referrer is given by the form */
export type ReferrerChoiceProps = {
  open: boolean
  /** Called when the choice closed without a customer */
  onClose: () => void
  /** Called with the customer that was chosen */
  onChoose: (referrer: Referrer) => void
}

export type CustomerFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names. A new object is a new
   * attempt: the focus goes to the first control with an error
   */
  errors?: FormErrors<LocalizedText> | undefined
  /**
   * The customer the form opens with. `null` for a new one: the form then
   * opens with what the ledger gives a customer nobody said more of
   */
  customer: ModelsCustomerResponse | null
  /** The last day somebody can have been born on, at the salon: `2026-11-20` */
  today: string
  /** The customer who referred this one, as the form opens with them */
  referrer: Referrer
  /**
   * The choice of a referrer from the ledger, open while it is asked for.
   * It stands outside the form, so that its own search is no part of it
   */
  chooseReferrer: (choice: ReferrerChoiceProps) => ReactNode
}

/**
 * Everything the ledger keeps of a customer that the staff write, in the
 * parts a person thinks of them in: the name, how to reach them, where they
 * live, who they are, their hair, what they like, how the salon treats
 * them, who referred them, what they may be sent, and the notes. A control
 * is named as the property of the request is; the browser keeps the
 * values, and the form hands them over when it is sent. The referrer is
 * chosen, not typed: the form keeps the one chosen.
 *
 * The values are those of a person the staff enter for somebody else, so
 * the browser is asked not to fill them in from what it knows of the user.
 */
export const CustomerForm = ({
  customer,
  today,
  referrer: opened,
  chooseReferrer,
  message,
  errors = NO_ERRORS,
  ...form
}: CustomerFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const options = useSaidChoices()
  const [referrer, setReferrer] = useState(opened)
  const [choosing, setChoosing] = useState(false)

  return (
    <>
      <Form {...form} message={said.message} errors={errors}>
        <FormPart label={say(parts.name)}>
          <FieldRow>
            <TextField
              label={say(record.lastName)}
              name='lastName'
              autoComplete='off'
              required
              defaultValue={customer?.lastName}
              error={said.errors['lastName']}
            />
            <TextField
              label={say(record.firstName)}
              name='firstName'
              autoComplete='off'
              required
              defaultValue={customer?.firstName}
              error={said.errors['firstName']}
            />
          </FieldRow>
          <FieldRow>
            <TextField
              label={say(record.lastNameKana)}
              name='lastNameKana'
              autoComplete='off'
              defaultValue={customer?.lastNameKana ?? undefined}
              error={said.errors['lastNameKana']}
            />
            <TextField
              label={say(record.firstNameKana)}
              name='firstNameKana'
              autoComplete='off'
              defaultValue={customer?.firstNameKana ?? undefined}
              error={said.errors['firstNameKana']}
            />
          </FieldRow>
        </FormPart>
        <FormPart label={say(parts.contact)}>
          <TextField
            label={say(record.email)}
            name='email'
            type='email'
            autoComplete='off'
            required
            description={say(words.emailDescription)}
            defaultValue={customer?.email}
            error={said.errors['email']}
          />
          <FieldRow>
            <TextField
              label={say(record.phoneNumber)}
              name='phoneNumber'
              type='tel'
              autoComplete='off'
              required
              defaultValue={customer?.phoneNumber}
              error={said.errors['phoneNumber']}
            />
            <TextField
              label={say(record.alternativePhone)}
              name='alternativePhone'
              type='tel'
              autoComplete='off'
              defaultValue={customer?.alternativePhone ?? undefined}
              error={said.errors['alternativePhone']}
            />
          </FieldRow>
        </FormPart>
        <FormPart label={say(parts.address)}>
          <TextField
            label={say(record.postalCode)}
            name='postalCode'
            autoComplete='off'
            defaultValue={customer?.postalCode ?? undefined}
            error={said.errors['postalCode']}
          />
          <FieldRow>
            <TextField
              label={say(record.prefecture)}
              name='prefecture'
              autoComplete='off'
              defaultValue={customer?.prefecture ?? undefined}
              error={said.errors['prefecture']}
            />
            <TextField
              label={say(record.city)}
              name='city'
              autoComplete='off'
              defaultValue={customer?.city ?? undefined}
              error={said.errors['city']}
            />
          </FieldRow>
          <TextField
            label={say(record.address)}
            name='address'
            autoComplete='off'
            defaultValue={customer?.address ?? undefined}
            error={said.errors['address']}
          />
          <TextField
            label={say(record.building)}
            name='building'
            autoComplete='off'
            defaultValue={customer?.building ?? undefined}
            error={said.errors['building']}
          />
        </FormPart>
        <FormPart label={say(parts.about)}>
          <FieldRow>
            <TextField
              label={say(record.birthDate)}
              name='birthDate'
              type='date'
              autoComplete='off'
              min={EARLIEST_DAY}
              max={today}
              defaultValue={customer?.birthDate ?? undefined}
              error={said.errors['birthDate']}
            />
            <Select
              label={say(record.gender)}
              name='gender'
              placeholder={say(words.unrecorded)}
              options={options(GENDER_CHOICES)}
              defaultValue={customer?.gender ?? ''}
              error={said.errors['gender']}
            />
          </FieldRow>
          <TextField
            label={say(record.occupation)}
            name='occupation'
            autoComplete='off'
            defaultValue={customer?.occupation ?? undefined}
            error={said.errors['occupation']}
          />
        </FormPart>
        <FormPart label={say(parts.hair)}>
          <FieldRow columns={3}>
            <Select
              label={say(record.hairType)}
              name='hairType'
              placeholder={say(words.unrecorded)}
              options={options(HAIR_TYPE_CHOICES)}
              defaultValue={customer?.hairType ?? ''}
              error={said.errors['hairType']}
            />
            <Select
              label={say(record.hairThickness)}
              name='hairThickness'
              placeholder={say(words.unrecorded)}
              options={options(HAIR_THICKNESS_CHOICES)}
              defaultValue={customer?.hairThickness ?? ''}
              error={said.errors['hairThickness']}
            />
            <Select
              label={say(record.scalpCondition)}
              name='scalpCondition'
              placeholder={say(words.unrecorded)}
              options={options(SCALP_CONDITION_CHOICES)}
              defaultValue={customer?.scalpCondition ?? ''}
              error={said.errors['scalpCondition']}
            />
          </FieldRow>
        </FormPart>
        <FormPart label={say(parts.likes)}>
          <CheckboxGroup
            label={say(record.preferredServices)}
            name={PREFERRED_SERVICES}
            layout='columns'
            options={options(CATEGORY_CHOICES)}
            defaultValue={customer?.preferences?.preferredServices}
            error={said.errors[PREFERRED_SERVICES]}
          />
          <TextArea
            label={say(words.preferenceNotes)}
            name={PREFERENCE_NOTES}
            description={say(words.preferenceNotesDescription)}
            defaultValue={customer?.preferences?.notes ?? undefined}
            error={said.errors[PREFERENCE_NOTES]}
          />
        </FormPart>
        <FormPart label={say(parts.treatment)}>
          <FieldRow>
            <Select
              label={say(record.membershipTier)}
              name='membershipTier'
              required
              options={options(TIER_CHOICES)}
              defaultValue={customer?.membershipTier ?? 'regular'}
              error={said.errors['membershipTier']}
            />
            <Select
              label={say(words.status)}
              name='customerStatus'
              required
              options={options(STATUS_CHOICES)}
              description={say(words.statusDescription)}
              defaultValue={customer?.customerStatus ?? 'active'}
              error={said.errors['customerStatus']}
            />
          </FieldRow>
          <Checkbox
            label={say(words.active)}
            name='isActive'
            description={say(words.activeDescription)}
            defaultChecked={customer?.isActive ?? true}
            error={said.errors['isActive']}
          />
          <TextField
            label={say(words.tags)}
            name='tags'
            autoComplete='off'
            description={say(words.tagsDescription)}
            defaultValue={say(tagsTextOf(customer?.tags ?? []))}
            error={said.errors['tags']}
          />
        </FormPart>
        <FormPart label={say(parts.referral)}>
          <ReferrerField
            referrer={referrer}
            error={errors[REFERRER]}
            onChoose={() => setChoosing(true)}
            onRemove={() => setReferrer({ type: 'none' })}
          />
          <TextField
            label={say(record.referralCode)}
            name='referralCode'
            autoComplete='off'
            description={say(words.referralCodeDescription)}
            defaultValue={customer?.referralCode ?? undefined}
            error={said.errors['referralCode']}
          />
        </FormPart>
        <FormPart label={say(parts.contacts)}>
          <Checkbox
            label={say(record.byEmail)}
            name='allowEmail'
            defaultChecked={customer?.allowEmail ?? false}
            error={said.errors['allowEmail']}
          />
          <Checkbox
            label={say(record.bySms)}
            name='allowSms'
            defaultChecked={customer?.allowSms ?? false}
            error={said.errors['allowSms']}
          />
          <Checkbox
            label={say(record.marketing)}
            name='allowMarketing'
            defaultChecked={customer?.allowMarketing ?? false}
            error={said.errors['allowMarketing']}
          />
        </FormPart>
        <FormPart label={say(parts.notes)}>
          <TextArea
            label={say(words.notes)}
            name='notes'
            description={say(words.hidden)}
            defaultValue={customer?.notes ?? undefined}
            error={said.errors['notes']}
          />
          <TextArea
            label={say(words.internalNotes)}
            name='internalNotes'
            description={say(words.hidden)}
            defaultValue={customer?.internalNotes ?? undefined}
            error={said.errors['internalNotes']}
          />
        </FormPart>
      </Form>
      {chooseReferrer({
        open: choosing,
        onClose: () => setChoosing(false),
        onChoose: (chosen) => {
          setReferrer(chosen)
          setChoosing(false)
        },
      })}
    </>
  )
}
