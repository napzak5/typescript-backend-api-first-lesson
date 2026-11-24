import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { upTo, WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Note,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import {
  CURRENCY_CHOICES,
  coordinateTextOf,
  LONGEST_NAME,
  LONGEST_POSTAL_CODE,
  NEW_SALON,
  type SalonShown,
  TIME_ZONE_CHOICES,
} from '../../utils/salon-form'

const { form: WORDS, words } = adminSettingsMessages

/** What the form is opened for. */
type SalonFormSubject =
  /** A salon to be added: the form opens with `NEW_SALON`, and the time zone and the currency are chosen */
  | { type: 'new' }
  /** A salon to be changed, as it was read */
  | { type: 'existing'; salon: ModelsSalonResponse }

export type SalonFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  subject: SalonFormSubject
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

const textOrEmpty = (text: string | null): string => text ?? ''

/**
 * The information of a salon: what the customers are shown of it, how it
 * is reached, its photos, what it is known for, the tax it charges and
 * whether it takes bookings online. The time zone and the currency are
 * chosen for a salon to be added, and shown, not changed, for one that is
 * there: the times of its bookings and its prices are read at them.
 */
export const SalonForm = ({
  subject,
  message,
  errors = NO_ERRORS,
  ...form
}: SalonFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)
  const salon: SalonShown =
    subject.type === 'existing' ? subject.salon : NEW_SALON

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(words.salon)}>
        <TextField
          label={say(words.name)}
          name='name'
          autoComplete='organization'
          required
          description={say(WORDS.nameDescription(LONGEST_NAME))}
          defaultValue={salon.name}
          error={said.errors['name']}
        />
        <TextField
          label={say(words.nameKana)}
          name='nameKana'
          autoComplete='off'
          description={say(upTo(LONGEST_NAME))}
          defaultValue={textOrEmpty(salon.nameKana)}
          error={said.errors['nameKana']}
        />
        <TextArea
          label={say(words.description)}
          name='description'
          rows={4}
          description={say(WORDS.descriptionDescription)}
          defaultValue={textOrEmpty(salon.description)}
          error={said.errors['description']}
        />
        <Checkbox
          label={say(WORDS.accepting)}
          name='isActive'
          description={say(WORDS.acceptingDescription)}
          defaultChecked={salon.isActive}
        />
      </FormPart>
      <FormPart label={say(words.location)}>
        <FieldRow>
          <TextField
            label={say(words.postalCode)}
            name='postalCode'
            autoComplete='postal-code'
            description={say(upTo(LONGEST_POSTAL_CODE))}
            defaultValue={textOrEmpty(salon.postalCode)}
            error={said.errors['postalCode']}
          />
          <TextField
            label={say(words.prefecture)}
            name='prefecture'
            autoComplete='address-level1'
            required
            defaultValue={salon.prefecture}
            error={said.errors['prefecture']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={say(words.city)}
            name='city'
            autoComplete='address-level2'
            required
            defaultValue={salon.city}
            error={said.errors['city']}
          />
          <TextField
            label={say(words.address)}
            name='address'
            autoComplete='address-line1'
            required
            defaultValue={salon.address}
            error={said.errors['address']}
          />
        </FieldRow>
        <TextField
          label={say(words.building)}
          name='building'
          autoComplete='address-line2'
          description={say(WORDS.buildingDescription)}
          defaultValue={textOrEmpty(salon.building)}
          error={said.errors['building']}
        />
        <FieldRow>
          <TextField
            label={say(words.latitude)}
            name='latitude'
            inputMode='decimal'
            autoComplete='off'
            description={say(WORDS.latitudeDescription)}
            defaultValue={coordinateTextOf(salon.latitude)}
            error={said.errors['latitude']}
          />
          <TextField
            label={say(words.longitude)}
            name='longitude'
            inputMode='decimal'
            autoComplete='off'
            description={say(WORDS.longitudeDescription)}
            defaultValue={coordinateTextOf(salon.longitude)}
            error={said.errors['longitude']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(words.contact)}>
        <FieldRow>
          <TextField
            label={say(words.phoneNumber)}
            name='phoneNumber'
            type='tel'
            autoComplete='tel'
            required
            description={say(WORDS.phoneNumberDescription)}
            defaultValue={salon.phoneNumber}
            error={said.errors['phoneNumber']}
          />
          <TextField
            label={say(words.alternativePhone)}
            name='alternativePhone'
            type='tel'
            autoComplete='off'
            defaultValue={textOrEmpty(salon.alternativePhone)}
            error={said.errors['alternativePhone']}
          />
        </FieldRow>
        <TextField
          label={say(words.email)}
          name='email'
          type='email'
          autoComplete='email'
          required
          description={say(WORDS.emailDescription)}
          defaultValue={salon.email}
          error={said.errors['email']}
        />
        <TextField
          label={say(words.websiteUrl)}
          name='websiteUrl'
          type='url'
          autoComplete='url'
          description={say(WEB_ADDRESS_DESCRIPTION)}
          defaultValue={textOrEmpty(salon.websiteUrl)}
          error={said.errors['websiteUrl']}
        />
      </FormPart>
      <FormPart label={say(words.photos)}>
        <TextField
          label={say(words.logoUrl)}
          name='logoUrl'
          type='url'
          autoComplete='off'
          description={say(WEB_ADDRESS_DESCRIPTION)}
          defaultValue={textOrEmpty(salon.logoUrl)}
          error={said.errors['logoUrl']}
        />
        <TextArea
          label={say(words.imageUrls)}
          name='imageUrls'
          description={say(WORDS.imageUrlsDescription)}
          defaultValue={salon.imageUrls.join('\n')}
          error={said.errors['imageUrls']}
        />
      </FormPart>
      <FormPart label={say(words.featuresAndAmenities)}>
        <TextField
          label={say(words.features)}
          name='features'
          autoComplete='off'
          description={say(WORDS.featuresDescription)}
          defaultValue={say(tagsTextOf(salon.features))}
          error={said.errors['features']}
        />
        <TextField
          label={say(words.amenities)}
          name='amenities'
          autoComplete='off'
          description={say(WORDS.amenitiesDescription)}
          defaultValue={say(tagsTextOf(salon.amenities))}
          error={said.errors['amenities']}
        />
      </FormPart>
      <FormPart label={say(words.accounting)}>
        <TextField
          width='short'
          label={say(WORDS.taxRate)}
          name='taxRate'
          inputMode='decimal'
          autoComplete='off'
          required
          description={say(WORDS.taxRateDescription)}
          defaultValue={String(salon.taxRate)}
          error={said.errors['taxRate']}
        />
        {match(subject)
          .with({ type: 'existing' }, () => (
            <Note size='small'>
              {say(WORDS.kept(salon.timezone, salon.currency))}
            </Note>
          ))
          .with({ type: 'new' }, () => (
            <FieldRow>
              <Select
                label={say(words.timezone)}
                name='timezone'
                required
                options={TIME_ZONE_CHOICES}
                description={say(WORDS.timezoneDescription)}
                defaultValue={salon.timezone}
                error={said.errors['timezone']}
              />
              <Select
                label={say(words.currency)}
                name='currency'
                required
                options={options(CURRENCY_CHOICES)}
                description={say(WORDS.currencyDescription)}
                defaultValue={salon.currency}
                error={said.errors['currency']}
              />
            </FieldRow>
          ))
          .exhaustive()}
      </FormPart>
    </Form>
  )
}
