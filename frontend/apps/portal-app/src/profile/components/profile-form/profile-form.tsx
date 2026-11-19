import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Checkbox,
  CheckboxGroup,
  Form,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import {
  EARLIEST_BIRTH_DATE,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
} from '../../profile-flow'
import { CATEGORY_OPTIONS, GENDER_OPTIONS } from '../../profile-format'
import styles from './profile-form.module.css'

export type ProfileFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The profile the form opens with. `null` for an account that has none:
   * the form is then empty, and what it is sent with makes the profile
   */
  profile: ModelsCustomerProfileResponse | null
  /** The last day somebody can have been born on: `2026-11-19` */
  today: string
}

/**
 * Everything a customer says about themselves, in the parts a person
 * thinks of them in: the name, how to reach them, where they live, who
 * they are, what they like, and what a salon may send them. A control is
 * named as the property of the request is; the browser keeps the values,
 * and the form hands them over when it is sent.
 */
export const ProfileForm = ({
  profile,
  today,
  errors = {},
  ...form
}: ProfileFormProps) => (
  <Form {...form} errors={errors}>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>お名前</legend>
      <div className={styles['controls']}>
        <div className={styles['pair']}>
          <TextField
            label='姓'
            name='lastName'
            autoComplete='family-name'
            required
            defaultValue={profile?.lastName}
            error={errors['lastName']}
          />
          <TextField
            label='名'
            name='firstName'
            autoComplete='given-name'
            required
            defaultValue={profile?.firstName}
            error={errors['firstName']}
          />
        </div>
        <div className={styles['pair']}>
          <TextField
            label='姓（フリガナ）'
            name='lastNameKana'
            defaultValue={profile?.lastNameKana ?? undefined}
            error={errors['lastNameKana']}
          />
          <TextField
            label='名（フリガナ）'
            name='firstNameKana'
            defaultValue={profile?.firstNameKana ?? undefined}
            error={errors['firstNameKana']}
          />
        </div>
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>連絡先</legend>
      <div className={styles['controls']}>
        <TextField
          label='電話番号'
          name='phoneNumber'
          type='tel'
          autoComplete='tel'
          required
          description='ご予約について、サロンから連絡することがあります。'
          defaultValue={profile?.phoneNumber}
          error={errors['phoneNumber']}
        />
        <TextField
          label='予備の電話番号'
          name='alternativePhone'
          type='tel'
          description='上の番号につながらないときに、連絡する番号です。'
          defaultValue={profile?.alternativePhone ?? undefined}
          error={errors['alternativePhone']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>住所</legend>
      <div className={styles['controls']}>
        <TextField
          label='郵便番号'
          name='postalCode'
          autoComplete='postal-code'
          defaultValue={profile?.postalCode ?? undefined}
          error={errors['postalCode']}
        />
        <div className={styles['pair']}>
          <TextField
            label='都道府県'
            name='prefecture'
            autoComplete='address-level1'
            defaultValue={profile?.prefecture ?? undefined}
            error={errors['prefecture']}
          />
          <TextField
            label='市区町村'
            name='city'
            autoComplete='address-level2'
            defaultValue={profile?.city ?? undefined}
            error={errors['city']}
          />
        </div>
        <TextField
          label='番地'
          name='address'
          autoComplete='address-line1'
          defaultValue={profile?.address ?? undefined}
          error={errors['address']}
        />
        <TextField
          label='建物名・部屋番号'
          name='building'
          autoComplete='address-line2'
          defaultValue={profile?.building ?? undefined}
          error={errors['building']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>ご本人について</legend>
      <div className={styles['controls']}>
        <div className={styles['pair']}>
          <TextField
            label='生年月日'
            name='birthDate'
            type='date'
            autoComplete='bday'
            min={EARLIEST_BIRTH_DATE}
            max={today}
            defaultValue={profile?.birthDate ?? undefined}
            error={errors['birthDate']}
          />
          <Select
            label='性別'
            name='gender'
            autoComplete='sex'
            placeholder='選択しない'
            options={GENDER_OPTIONS}
            defaultValue={profile?.gender ?? ''}
            error={errors['gender']}
          />
        </div>
        <TextField
          label='職業'
          name='occupation'
          autoComplete='organization-title'
          defaultValue={profile?.occupation ?? undefined}
          error={errors['occupation']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>好み</legend>
      <div className={styles['controls']}>
        <CheckboxGroup
          label='好みのメニュー'
          name={PREFERRED_SERVICES}
          layout='columns'
          options={CATEGORY_OPTIONS}
          defaultValue={profile?.preferences?.preferredServices}
          error={errors[PREFERRED_SERVICES]}
        />
        <TextArea
          label='サロンに伝えておきたいこと'
          name={PREFERENCE_NOTES}
          description='使ってほしい製品や、苦手なことなどを書いてください。'
          defaultValue={profile?.preferences?.notes ?? undefined}
          error={errors[PREFERENCE_NOTES]}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>受け取る連絡</legend>
      <div className={styles['controls']}>
        <Checkbox
          label='メールでの連絡を受け取る'
          name='allowEmail'
          defaultChecked={profile?.allowEmail}
        />
        <Checkbox
          label='SMS での連絡を受け取る'
          name='allowSms'
          defaultChecked={profile?.allowSms}
        />
        <Checkbox
          label='キャンペーンなどのお知らせを受け取る'
          name='allowMarketing'
          defaultChecked={profile?.allowMarketing}
        />
      </div>
    </fieldset>
  </Form>
)
