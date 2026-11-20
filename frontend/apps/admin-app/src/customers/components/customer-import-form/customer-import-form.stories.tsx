import type { ModelsCustomerCreateRequest } from '@beauty-salon-frontend/api-client'
import { Button } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CustomerImportForm } from './customer-import-form'

const ENTRY: ModelsCustomerCreateRequest = {
  lastName: '山田',
  firstName: '花子',
  lastNameKana: 'ヤマダ',
  firstNameKana: 'ハナコ',
  email: 'hanako@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
}

const meta: Meta<typeof CustomerImportForm> = {
  title: 'Admin/Customers/CustomerImportForm',
  component: CustomerImportForm,
  args: {
    chosen: undefined,
    refused: [],
    onChoose: fn(),
    onSubmit: fn(),
    actions: <Button>やめる</Button>,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Before a file is chosen */
export const Empty: Story = {}

/** The chosen file is being read */
export const Reading: Story = {
  args: { chosen: { type: 'reading' } },
}

/** The file holds three customers, who can be registered */
export const Read: Story = {
  args: {
    chosen: {
      type: 'read',
      read: {
        type: 'read',
        customers: [
          { row: 2, request: ENTRY },
          {
            row: 3,
            request: {
              ...ENTRY,
              lastName: '鈴木',
              firstName: '一郎',
              lastNameKana: null,
              firstNameKana: null,
              email: 'ichiro@example.com',
              membershipTier: 'gold',
            },
          },
          {
            row: 5,
            request: {
              ...ENTRY,
              lastName: '佐藤',
              firstName: '健',
              lastNameKana: 'サトウ',
              firstNameKana: 'ケン',
              email: 'ken@example.com',
              phoneNumber: '+81-80-2345-6789',
            },
          },
        ],
      },
    },
  },
}

/** The file has values that are wrong */
export const Invalid: Story = {
  args: {
    chosen: {
      type: 'read',
      read: {
        type: 'invalid',
        problems: [
          {
            row: 3,
            column: 'メールアドレス',
            message:
              'メールアドレスは、hanako@example.com のような形で入力してください。',
          },
          {
            row: 4,
            column: '会員ランク',
            message:
              '会員ランクは、regular、silver、gold、platinum、vip のどれかで書いてください。',
          },
          {
            row: 1,
            column: null,
            message:
              '列「emial」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。',
          },
        ],
      },
    },
  },
}

/** The button was pressed before a file was chosen */
export const NoFile: Story = {
  args: { errors: { file: 'ファイルを選んでください。' } },
}

/** The API refused a customer of the file: their address of mail is in the ledger */
export const Refused: Story = {
  args: {
    chosen: Read.args?.chosen,
    refused: [
      {
        row: 5,
        column: 'メールアドレス',
        message:
          'このメールアドレスのお客様が、もう台帳にいます。台帳で探して、このお客様の行を外してください。',
      },
    ],
  },
}

/** The registration is on its way */
export const Pending: Story = {
  args: { chosen: Read.args?.chosen, pending: true },
}
