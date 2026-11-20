import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer } from '../../../bookings/components/examples'
import { CustomerForm } from './customer-form'

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
  args: { customer: RECORDED, submitLabel: '変更を保存する' },
}

/** What the API refused, at the controls */
export const WithErrors: Story = {
  args: {
    customer: RECORDED,
    submitLabel: '変更を保存する',
    errors: {
      email:
        'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
      'preferences.preferredServices':
        'この値は受け付けられませんでした。入力を確かめてください。',
    },
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
