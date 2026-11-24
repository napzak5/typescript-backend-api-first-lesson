import { WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
import {
  type FormErrors,
  TextArea,
  TextField,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import { type Introduced, MOST_YEARS } from '../../utils/introduction'

const { introduction: WORDS } = adminStaffMessages

export type IntroductionFieldsProps = {
  /** The introduction the controls open with; `null` for a new member, whose controls are empty */
  shown: Introduced | null
  /** What is said at a control, under its name, in the language of the page */
  errors: FormErrors
}

/**
 * The controls of how a member is introduced to the customers, in a form
 * of the staff ledger and in the form of the member's own profile. A
 * control is named as the property of the request is, and the values are
 * read by `readIntroduction`.
 */
export const IntroductionFields = ({
  shown,
  errors,
}: IntroductionFieldsProps) => {
  const say = useSay()

  return (
    <>
      <TextField
        label={say(WORDS.specialties)}
        name='specialties'
        autoComplete='off'
        description={say(WORDS.specialtiesDescription)}
        defaultValue={say(tagsTextOf(shown?.specialties ?? []))}
        error={errors['specialties']}
      />
      <TextField
        label={say(WORDS.certifications)}
        name='certifications'
        autoComplete='off'
        description={say(WORDS.certificationsDescription)}
        defaultValue={say(tagsTextOf(shown?.certifications ?? []))}
        error={errors['certifications']}
      />
      <TextField
        label={say(WORDS.yearsOfExperience)}
        name='yearsOfExperience'
        inputMode='numeric'
        autoComplete='off'
        width='short'
        description={say(WORDS.yearsOfExperienceDescription(MOST_YEARS))}
        defaultValue={
          shown === null || shown.yearsOfExperience === null
            ? undefined
            : String(shown.yearsOfExperience)
        }
        error={errors['yearsOfExperience']}
      />
      <TextArea
        label={say(WORDS.bio)}
        name='bio'
        rows={4}
        defaultValue={shown?.bio ?? undefined}
        error={errors['bio']}
      />
      <TextField
        label={say(WORDS.imageUrl)}
        name='imageUrl'
        type='url'
        autoComplete='off'
        description={say(WEB_ADDRESS_DESCRIPTION)}
        defaultValue={shown?.imageUrl ?? undefined}
        error={errors['imageUrl']}
      />
    </>
  )
}
