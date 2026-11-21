import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: '予約する',
    onClick: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Secondary: Story = {}

export const Primary: Story = {
  args: { variant: 'primary' },
}

export const Quiet: Story = {
  args: { variant: 'quiet', children: 'キャンセル' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: '削除する' },
}

export const Small: Story = {
  args: { size: 'small' },
}

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
}

export const Pending: Story = {
  args: { variant: 'primary', pending: true, children: '予約しています' },
}

/** A button that switched something on says so: `aria-pressed` */
export const Pressed: Story = {
  args: { 'aria-pressed': true, children: '参考になった' },
}

export const NotPressed: Story = {
  args: { 'aria-pressed': false, children: '参考になった' },
}

/**
 * A label that is longer than the line the button stands in, on a screen as
 * narrow as a phone: it goes on in a second line, between its words, and
 * the button is no wider than the screen.
 */
export const LongLabel: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  args: {
    variant: 'primary',
    children: 'ビューティーサプライ 関東営業所 への発注を作る',
  },
}
