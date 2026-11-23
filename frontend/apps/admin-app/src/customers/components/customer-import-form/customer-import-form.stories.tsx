import type { ModelsCustomerCreateRequest } from '@beauty-salon-frontend/api-client'
import { EMAIL_MALFORMED } from '@beauty-salon-frontend/fields'
import { Button, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages as record } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TIERS } from '../../utils/customer-format'
import { CustomerImportForm } from './customer-import-form'

const { file: words } = adminCustomerMessages

/** The way back that the screen puts beside the button that registers */
const Cancel = () => {
  const say = useSay()

  return <Button>{say(words.form.cancel)}</Button>
}

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
    actions: <Cancel />,
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
          { row: 3, column: record.email, message: EMAIL_MALFORMED },
          {
            row: 4,
            column: record.membershipTier,
            message: words.problems.choice(record.membershipTier, TIERS),
          },
          { row: 1, column: null, message: words.problems.unknown('emial') },
        ],
      },
    },
  },
}

/** The button was pressed before a file was chosen */
export const NoFile: Story = {
  args: { errors: { file: words.form.chooseFile } },
}

/** The API refused a customer of the file: their address of mail is in the ledger */
export const Refused: Story = {
  args: {
    chosen: Read.args?.chosen,
    refused: [
      {
        row: 5,
        column: record.email,
        message: words.registration.emailTaken,
      },
    ],
  },
}

/** The registration is on its way */
export const Pending: Story = {
  args: { chosen: Read.args?.chosen, pending: true },
}
