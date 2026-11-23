import { WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
import {
  type FormErrors,
  inJapanese,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import type { Introduced } from '../../utils/introduction'

export type IntroductionFieldsProps = {
  /** The introduction the controls open with; `null` for a new member, whose controls are empty */
  shown: Introduced | null
  /** What is said at a control, under its name */
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
}: IntroductionFieldsProps) => (
  <>
    <TextField
      label='専門'
      name='specialties'
      autoComplete='off'
      description='得意なメニューや技術を、「、」か「,」で区切って書きます。'
      defaultValue={tagsTextOf(shown?.specialties ?? [])}
      error={errors['specialties']}
    />
    <TextField
      label='資格'
      name='certifications'
      autoComplete='off'
      description='「、」か「,」で区切って書きます。'
      defaultValue={tagsTextOf(shown?.certifications ?? [])}
      error={errors['certifications']}
    />
    <TextField
      label='経験年数（年）'
      name='yearsOfExperience'
      inputMode='numeric'
      autoComplete='off'
      width='short'
      description='0 から 100 までの整数。'
      defaultValue={
        shown === null || shown.yearsOfExperience === null
          ? undefined
          : String(shown.yearsOfExperience)
      }
      error={errors['yearsOfExperience']}
    />
    <TextArea
      label='紹介文'
      name='bio'
      rows={4}
      defaultValue={shown?.bio ?? undefined}
      error={errors['bio']}
    />
    <TextField
      label='写真の URL'
      name='imageUrl'
      type='url'
      autoComplete='off'
      description={inJapanese(WEB_ADDRESS_DESCRIPTION)}
      defaultValue={shown?.imageUrl ?? undefined}
      error={errors['imageUrl']}
    />
  </>
)
