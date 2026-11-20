import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  Checkbox,
  CheckboxGroup,
  Form,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { EARLIEST_DAY } from '../../../salon-time'
import { PREFERENCE_NOTES, PREFERRED_SERVICES } from '../../customer-form'
import {
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_TYPE_OPTIONS,
  SCALP_CONDITION_OPTIONS,
  STATUS_OPTIONS,
  TIER_OPTIONS,
} from '../../customer-format'
import { tagsTextOf } from '../../customer-ledger'
import styles from './customer-form.module.css'

export type CustomerFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The customer the form opens with. `null` for a new one: the form then
   * opens with what the ledger gives a customer nobody said more of
   */
  customer: ModelsCustomerResponse | null
  /** The last day somebody can have been born on, at the salon: `2026-11-20` */
  today: string
}

/**
 * Everything the ledger keeps of a customer that the staff write, in the
 * parts a person thinks of them in: the name, how to reach them, where they
 * live, who they are, their hair, what they like, how the salon treats
 * them, what they may be sent, and the notes. A control is named as the
 * property of the request is; the browser keeps the values, and the form
 * hands them over when it is sent.
 *
 * The values are those of a person the staff enter for somebody else, so
 * the browser is asked not to fill them in from what it knows of the user.
 */
export const CustomerForm = ({
  customer,
  today,
  errors = {},
  ...form
}: CustomerFormProps) => (
  <Form {...form} errors={errors}>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>お名前</legend>
      <div className={styles['controls']}>
        <div className={styles['pair']}>
          <TextField
            label='姓'
            name='lastName'
            autoComplete='off'
            required
            defaultValue={customer?.lastName}
            error={errors['lastName']}
          />
          <TextField
            label='名'
            name='firstName'
            autoComplete='off'
            required
            defaultValue={customer?.firstName}
            error={errors['firstName']}
          />
        </div>
        <div className={styles['pair']}>
          <TextField
            label='姓（フリガナ）'
            name='lastNameKana'
            autoComplete='off'
            defaultValue={customer?.lastNameKana ?? undefined}
            error={errors['lastNameKana']}
          />
          <TextField
            label='名（フリガナ）'
            name='firstNameKana'
            autoComplete='off'
            defaultValue={customer?.firstNameKana ?? undefined}
            error={errors['firstNameKana']}
          />
        </div>
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>連絡先</legend>
      <div className={styles['controls']}>
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='off'
          required
          description='台帳のお客様の間で、同じアドレスは使えません。'
          defaultValue={customer?.email}
          error={errors['email']}
        />
        <div className={styles['pair']}>
          <TextField
            label='電話番号'
            name='phoneNumber'
            type='tel'
            autoComplete='off'
            required
            defaultValue={customer?.phoneNumber}
            error={errors['phoneNumber']}
          />
          <TextField
            label='予備の電話番号'
            name='alternativePhone'
            type='tel'
            autoComplete='off'
            defaultValue={customer?.alternativePhone ?? undefined}
            error={errors['alternativePhone']}
          />
        </div>
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>住所</legend>
      <div className={styles['controls']}>
        <TextField
          label='郵便番号'
          name='postalCode'
          autoComplete='off'
          defaultValue={customer?.postalCode ?? undefined}
          error={errors['postalCode']}
        />
        <div className={styles['pair']}>
          <TextField
            label='都道府県'
            name='prefecture'
            autoComplete='off'
            defaultValue={customer?.prefecture ?? undefined}
            error={errors['prefecture']}
          />
          <TextField
            label='市区町村'
            name='city'
            autoComplete='off'
            defaultValue={customer?.city ?? undefined}
            error={errors['city']}
          />
        </div>
        <TextField
          label='番地'
          name='address'
          autoComplete='off'
          defaultValue={customer?.address ?? undefined}
          error={errors['address']}
        />
        <TextField
          label='建物名・部屋番号'
          name='building'
          autoComplete='off'
          defaultValue={customer?.building ?? undefined}
          error={errors['building']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>お客様について</legend>
      <div className={styles['controls']}>
        <div className={styles['pair']}>
          <TextField
            label='生年月日'
            name='birthDate'
            type='date'
            autoComplete='off'
            min={EARLIEST_DAY}
            max={today}
            defaultValue={customer?.birthDate ?? undefined}
            error={errors['birthDate']}
          />
          <Select
            label='性別'
            name='gender'
            placeholder='記録しない'
            options={GENDER_OPTIONS}
            defaultValue={customer?.gender ?? ''}
            error={errors['gender']}
          />
        </div>
        <TextField
          label='職業'
          name='occupation'
          autoComplete='off'
          defaultValue={customer?.occupation ?? undefined}
          error={errors['occupation']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>髪と頭皮</legend>
      <div className={styles['triple']}>
        <Select
          label='髪質'
          name='hairType'
          placeholder='記録しない'
          options={HAIR_TYPE_OPTIONS}
          defaultValue={customer?.hairType ?? ''}
          error={errors['hairType']}
        />
        <Select
          label='髪の太さ'
          name='hairThickness'
          placeholder='記録しない'
          options={HAIR_THICKNESS_OPTIONS}
          defaultValue={customer?.hairThickness ?? ''}
          error={errors['hairThickness']}
        />
        <Select
          label='頭皮の状態'
          name='scalpCondition'
          placeholder='記録しない'
          options={SCALP_CONDITION_OPTIONS}
          defaultValue={customer?.scalpCondition ?? ''}
          error={errors['scalpCondition']}
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
          defaultValue={customer?.preferences?.preferredServices}
          error={errors[PREFERRED_SERVICES]}
        />
        <TextArea
          label='好みについてのメモ'
          name={PREFERENCE_NOTES}
          rows={3}
          description='使ってほしい製品や、苦手なことなどです。お客様もプロフィールで書き換えられます。'
          defaultValue={customer?.preferences?.notes ?? undefined}
          error={errors[PREFERENCE_NOTES]}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>サロンでの扱い</legend>
      <div className={styles['controls']}>
        <div className={styles['pair']}>
          <Select
            label='会員ランク'
            name='membershipTier'
            required
            options={TIER_OPTIONS}
            defaultValue={customer?.membershipTier ?? 'regular'}
            error={errors['membershipTier']}
          />
          <Select
            label='ステータス'
            name='customerStatus'
            required
            options={STATUS_OPTIONS}
            description='休眠と利用停止のお客様は、ご自分では予約を入れられません。'
            defaultValue={customer?.customerStatus ?? 'active'}
            error={errors['customerStatus']}
          />
        </div>
        <Checkbox
          label='有効なお客様'
          name='isActive'
          description='外すと、お客様はご自分では予約を入れたり、日時を変えたりできなくなります。サロンが入れる予約は、どちらでも入れられます。'
          defaultChecked={customer?.isActive ?? true}
          error={errors['isActive']}
        />
        <TextField
          label='タグ'
          name='tags'
          autoComplete='off'
          description='「、」か「,」で区切って、いくつでも付けられます。'
          defaultValue={tagsTextOf(customer?.tags ?? [])}
          error={errors['tags']}
        />
        <TextField
          label='紹介コード'
          name='referralCode'
          autoComplete='off'
          description='このお客様が、ほかの方を紹介するときのコードです。台帳から削除したお客様のものも含めて、同じコードは使えません。'
          defaultValue={customer?.referralCode ?? undefined}
          error={errors['referralCode']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>送ってよい連絡</legend>
      <div className={styles['controls']}>
        <Checkbox
          label='メールでの連絡'
          name='allowEmail'
          defaultChecked={customer?.allowEmail ?? false}
          error={errors['allowEmail']}
        />
        <Checkbox
          label='SMS での連絡'
          name='allowSms'
          defaultChecked={customer?.allowSms ?? false}
          error={errors['allowSms']}
        />
        <Checkbox
          label='キャンペーンなどのお知らせ'
          name='allowMarketing'
          defaultChecked={customer?.allowMarketing ?? false}
          error={errors['allowMarketing']}
        />
      </div>
    </fieldset>
    <fieldset className={styles['part']}>
      <legend className={styles['name']}>メモ</legend>
      <div className={styles['controls']}>
        <TextArea
          label='備考'
          name='notes'
          rows={3}
          description='お客様には見えません。'
          defaultValue={customer?.notes ?? undefined}
          error={errors['notes']}
        />
        <TextArea
          label='スタッフ間の申し送り'
          name='internalNotes'
          rows={3}
          description='お客様には見えません。'
          defaultValue={customer?.internalNotes ?? undefined}
          error={errors['internalNotes']}
        />
      </div>
    </fieldset>
  </Form>
)
