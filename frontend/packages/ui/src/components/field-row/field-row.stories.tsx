import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextField } from '../text-field/text-field'
import { FieldRow } from './field-row'

const meta: Meta<typeof FieldRow> = {
  title: 'Components/FieldRow',
  component: FieldRow,
  args: {
    children: (
      <>
        <TextField
          label='セイ'
          name='lastNameKana'
          autoComplete='off'
          description='カタカナで入力してください。'
        />
        <TextField label='メイ' name='firstNameKana' autoComplete='off' />
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Two controls, the upper edges in line although one has a description */
export const Two: Story = {}

/** Three amounts that are compared */
export const Three: Story = {
  args: {
    columns: 3,
    children: (
      <>
        <TextField
          label='仕入れ値'
          name='purchasePrice'
          autoComplete='off'
          inputMode='numeric'
        />
        <TextField
          label='サロン価格'
          name='salonPrice'
          autoComplete='off'
          inputMode='numeric'
        />
        <TextField
          label='販売価格'
          name='retailPrice'
          autoComplete='off'
          inputMode='numeric'
        />
      </>
    ),
  },
}
