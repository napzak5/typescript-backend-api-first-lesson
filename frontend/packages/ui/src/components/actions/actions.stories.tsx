import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import { Actions } from './actions'

const meta: Meta<typeof Actions> = {
  title: 'Components/Actions',
  component: Actions,
  args: {
    children: [
      <Button key='confirm' variant='primary'>
        予約を確定する
      </Button>,
      <ButtonLink key='change' href='/bookings/1/edit'>
        予約を変える
      </ButtonLink>,
      <Button key='cancel' variant='danger'>
        予約を取り消す
      </Button>,
    ],
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Side by side, and on in the next line where the room ends */
export const Default: Story = {}

const PHONE = { viewport: { value: 'mobile1', isRotated: false } }

/** On a screen as narrow as a phone, the buttons that do not fit go on in the next line */
export const FlowOnANarrowScreen: Story = {
  globals: PHONE,
}

/** The buttons of a form: in a row from 40rem */
export const Row: Story = {
  args: { layout: 'row' },
}

/** On a screen as narrow as a phone, the buttons of a form are one below the other, as wide as the room */
export const RowOnANarrowScreen: Story = {
  args: { layout: 'row' },
  globals: PHONE,
}

/** One below the other on every screen */
export const Stack: Story = {
  args: { layout: 'stack' },
}
