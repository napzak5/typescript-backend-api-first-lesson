import type { Meta, StoryObj } from '@storybook/react-vite'
import { aStaffMember } from '../examples'
import { IntroductionFields } from './introduction-fields'

const meta: Meta<typeof IntroductionFields> = {
  title: 'Admin/Staff/IntroductionFields',
  component: IntroductionFields,
  args: { shown: null, errors: {} },
}

export default meta

type Story = StoryObj<typeof meta>

/** A member of whom nothing is said to the customers yet */
export const Empty: Story = {}

/** A member who is introduced with everything */
export const Filled: Story = {
  args: { shown: aStaffMember() },
}

/** What was refused, at the controls */
export const WithErrors: Story = {
  args: {
    ...Filled.args,
    errors: {
      yearsOfExperience:
        '経験年数は、0 から 100 までの整数で入力してください。',
      imageUrl:
        'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    },
  },
}
