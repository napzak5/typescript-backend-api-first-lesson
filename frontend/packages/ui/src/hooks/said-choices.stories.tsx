import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { NamedChoice } from '../components/field/choice'
import { Select } from '../components/select/select'
import { useSaidChoices } from './language'

type SaidChoicesProps = {
  /** The options, under their names */
  choices: readonly NamedChoice[]
}

/**
 * A choice of a package whose texts are messages: the options are named by
 * messages, and said in the language of the page.
 */
const SaidChoices = ({ choices }: SaidChoicesProps) => {
  const options = useSaidChoices()

  return (
    <Select
      label='メニューの区分'
      name='category'
      placeholder='選ばない'
      options={options(choices)}
    />
  )
}

const meta: Meta<typeof SaidChoices> = {
  title: 'Language/SaidChoices',
  component: SaidChoices,
}

export default meta

type Story = StoryObj<typeof meta>

export const Kinds: Story = {
  args: {
    choices: [
      { value: 'cut', label: termMessages.serviceCategory.cut },
      { value: 'color', label: termMessages.serviceCategory.color },
    ],
  },
}
