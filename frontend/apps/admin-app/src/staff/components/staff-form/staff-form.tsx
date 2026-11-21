import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Checkbox,
  FieldRow,
  Form,
  FormPart,
  type FormProps,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { LEVEL_OPTIONS } from '../../staff-format'
import { IntroductionFields } from '../introduction-fields/introduction-fields'
import styles from './staff-form.module.css'

export type StaffFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The member the form opens with. `null` for a new one: the form then
   * opens with what the ledger gives a member nobody said more of, who is
   * active and takes one booking at a time
   */
  member: ModelsStaffResponse | null
}

/** A number of the ledger as a control shows it: nothing for none. */
const numberText = (number: number | null | undefined): string | undefined =>
  number === null || number === undefined ? undefined : String(number)

/**
 * Everything the staff ledger keeps of a member, in the parts an employer
 * thinks of them in: the name, how to reach them, how they are employed and
 * paid, how the customers are told of them, how they take bookings, and
 * whether they work at the salon. A control is named as the property of the
 * request is; the browser keeps the values, and the form hands them over
 * when it is sent.
 *
 * The values are those of a person the owner enters for somebody else, so
 * the browser is asked not to fill them in from what it knows of the user.
 */
export const StaffForm = ({ member, errors = {}, ...form }: StaffFormProps) => (
  <Form {...form} errors={errors}>
    <FormPart name='名前'>
      <FieldRow>
        <TextField
          label='姓'
          name='lastName'
          autoComplete='off'
          required
          defaultValue={member?.lastName}
          error={errors['lastName']}
        />
        <TextField
          label='名'
          name='firstName'
          autoComplete='off'
          required
          defaultValue={member?.firstName}
          error={errors['firstName']}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          label='姓（フリガナ）'
          name='lastNameKana'
          autoComplete='off'
          defaultValue={member?.lastNameKana ?? undefined}
          error={errors['lastNameKana']}
        />
        <TextField
          label='名（フリガナ）'
          name='firstNameKana'
          autoComplete='off'
          defaultValue={member?.firstNameKana ?? undefined}
          error={errors['firstNameKana']}
        />
      </FieldRow>
      <TextField
        label='表示名'
        name='displayName'
        autoComplete='off'
        required
        description='お客様が予約するときに見る名前です。'
        defaultValue={member?.displayName}
        error={errors['displayName']}
      />
    </FormPart>
    <FormPart name='連絡先'>
      <TextField
        label='メールアドレス'
        name='email'
        type='email'
        autoComplete='off'
        required
        description='サロンのスタッフの間で、同じアドレスは使えません。'
        defaultValue={member?.email}
        error={errors['email']}
      />
      <FieldRow>
        <TextField
          label='電話番号'
          name='phoneNumber'
          type='tel'
          autoComplete='off'
          required
          defaultValue={member?.phoneNumber}
          error={errors['phoneNumber']}
        />
        <TextField
          label='予備の電話番号'
          name='alternativePhone'
          type='tel'
          autoComplete='off'
          defaultValue={member?.alternativePhone ?? undefined}
          error={errors['alternativePhone']}
        />
      </FieldRow>
    </FormPart>
    <FormPart name='雇用'>
      <FieldRow>
        <TextField
          label='スタッフコード'
          name='staffCode'
          autoComplete='off'
          description='社員番号など。台帳から削除したスタッフのものも含めて、同じコードは使えません。'
          defaultValue={member?.staffCode ?? undefined}
          error={errors['staffCode']}
        />
        <Select
          label='レベル'
          name='level'
          required
          placeholder='選んでください'
          options={LEVEL_OPTIONS}
          defaultValue={member?.level ?? ''}
          error={errors['level']}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          label='役職'
          name='position'
          autoComplete='off'
          defaultValue={member?.position ?? undefined}
          error={errors['position']}
        />
        <TextField
          label='雇用形態'
          name='employmentType'
          autoComplete='off'
          description='正社員、パート、業務委託など。'
          defaultValue={member?.employmentType ?? undefined}
          error={errors['employmentType']}
        />
      </FieldRow>
      <TextField
        label='入社日'
        name='hireDate'
        type='date'
        autoComplete='off'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        className={styles['short']}
        description='これから入社するスタッフも、先に登録できます。'
        defaultValue={member?.hireDate ?? undefined}
        error={errors['hireDate']}
      />
      <FieldRow>
        <TextField
          label='基本給（円）'
          name='baseSalary'
          inputMode='numeric'
          autoComplete='off'
          description='0 以上の整数。'
          defaultValue={numberText(member?.baseSalary)}
          error={errors['baseSalary']}
        />
        <TextField
          label='歩合率（%）'
          name='commissionRate'
          inputMode='decimal'
          autoComplete='off'
          description='0 から 100 まで。小数第 2 位まで。'
          defaultValue={numberText(member?.commissionRate)}
          error={errors['commissionRate']}
        />
      </FieldRow>
    </FormPart>
    <FormPart
      name='紹介'
      note='表示名、レベル、役職と一緒に、お客様に見せるスタッフの紹介です。'
    >
      <IntroductionFields shown={member} errors={errors} />
    </FormPart>
    <FormPart name='予約の受け方'>
      <Checkbox
        label='予約を受ける'
        name='canReceiveBookings'
        description='外すと、お客様が予約するときの空き枠に出なくなります。サロンが入れる予約の担当には、どちらでも選べます。'
        defaultChecked={member?.canReceiveBookings ?? true}
        error={errors['canReceiveBookings']}
      />
      <TextField
        label='同時に担当できる予約の数'
        name='maxConcurrentBookings'
        inputMode='numeric'
        autoComplete='off'
        required
        className={styles['short']}
        description='1 から 10 まで。'
        defaultValue={numberText(member?.maxConcurrentBookings ?? 1)}
        error={errors['maxConcurrentBookings']}
      />
      <FieldRow>
        <TextField
          label='予約の前に確保する時間（分）'
          name='bufferTimeBefore'
          inputMode='numeric'
          autoComplete='off'
          required
          description='準備の時間。0 から 120 まで。'
          defaultValue={numberText(member?.bufferTimeBefore ?? 0)}
          error={errors['bufferTimeBefore']}
        />
        <TextField
          label='予約の後に確保する時間（分）'
          name='bufferTimeAfter'
          inputMode='numeric'
          autoComplete='off'
          required
          description='片付けの時間。0 から 120 まで。'
          defaultValue={numberText(member?.bufferTimeAfter ?? 0)}
          error={errors['bufferTimeAfter']}
        />
      </FieldRow>
    </FormPart>
    <FormPart name='在籍'>
      <Checkbox
        label='有効なスタッフ'
        name='isActive'
        description='休職や退職の手続きの間は外します。外すと、このスタッフのログインアカウントはサロンの画面を使えなくなり、お客様が予約するときにも出なくなります。付け直すと、元に戻ります。'
        defaultChecked={member?.isActive ?? true}
        error={errors['isActive']}
      />
    </FormPart>
  </Form>
)
