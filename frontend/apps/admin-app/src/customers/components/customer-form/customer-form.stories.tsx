import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, customers } from '../../../bookings/components/examples'
import { NO_REFERRER, referrerOf } from '../../utils/customer-form'
import { CustomerChoices } from '../customer-choices/customer-choices'
import { ReferrerDialog } from '../referrer-dialog/referrer-dialog'
import { CustomerForm, type ReferrerChoiceProps } from './customer-form'

/** The customer who referred the one of `RECORDED` */
const ICHIRO = customers.find(({ firstName }) => firstName === '一郎')

/**
 * The choice of a referrer as the screens make it, with a search that found
 * the customers of the examples
 */
const chooseReferrer = ({ open, onClose, onChoose }: ReferrerChoiceProps) => (
  <ReferrerDialog open={open} onClose={onClose} keyword='山田' onSearch={fn()}>
    <CustomerChoices
      customers={customers}
      total={customers.length}
      more='none'
      onMore={fn()}
      choose={{
        type: 'button',
        onChoose: (customer) => onChoose(referrerOf(customer)),
        excluded: undefined,
      }}
    />
  </ReferrerDialog>
)

/** A customer of whom everything is recorded */
export const RECORDED = aCustomer({
  lastNameKana: 'ヤマダ',
  firstNameKana: 'ハナコ',
  alternativePhone: '03-1234-5678',
  postalCode: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前 4-1-1',
  building: 'ハイツ 101',
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: '会社員',
  membershipTier: 'gold',
  customerStatus: 'vip',
  preferences: { preferredServices: ['cut', 'spa'], notes: '炭酸泉が好き' },
  tags: ['VIP', '常連'],
  referralCode: 'HANAKO-2026',
  referredBy: ICHIRO?.id ?? null,
  allowEmail: true,
  allowSms: true,
  allowMarketing: false,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'thin',
  scalpCondition: 'sensitive',
  notes: '駐車場を使う',
  internalNotes: '前回、カラーで頭皮がしみた',
})

const meta: Meta<typeof CustomerForm> = {
  title: 'Admin/Customers/CustomerForm',
  component: CustomerForm,
  args: {
    customer: null,
    today: '2026-11-20',
    referrer: NO_REFERRER,
    chooseReferrer,
    submitLabel: '登録する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new customer: what the ledger gives one nobody said more of */
export const Entry: Story = {}

/** A customer of whom everything is recorded, to change */
export const Change: Story = {
  args: {
    customer: RECORDED,
    referrer: ICHIRO === undefined ? NO_REFERRER : referrerOf(ICHIRO),
    submitLabel: '変更を保存する',
  },
}

/** What the API refused, at the controls */
export const WithErrors: Story = {
  args: {
    ...Change.args,
    errors: {
      email:
        'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
      'preferences.preferredServices':
        'この値は受け付けられませんでした。入力を確かめてください。',
    },
  },
}

/** The API did not take the referrer that was chosen: removed meanwhile */
export const ReferrerRefused: Story = {
  args: {
    ...Change.args,
    errors: {
      referredBy:
        '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
    },
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
