import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../button/button'
import { Card } from './card'

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: '基本情報',
    children: <p>山田 花子（ヤマダ ハナコ）</p>,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant='quiet' size='small'>
        編集
      </Button>
    ),
  },
}

/** Inside another card, or below a heading of level 2. */
export const HeadingOfLevelThree: Story = {
  args: { title: '来店の履歴', headingLevel: 3 },
}
