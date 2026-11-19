import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { Button } from '../button/button'
import { Card, type CardProps } from './card'

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

/**
 * A card whose button goes with what it did: the card moves the focus to
 * its heading, as a screen does for a part that is read anew.
 */
const Emptying = (props: CardProps) => {
  const heading = useRef<HTMLHeadingElement>(null)
  const [emptied, setEmptied] = useState(false)

  return (
    <Card {...props} headingRef={heading}>
      {emptied ? (
        <p>来店の履歴は、ありません。</p>
      ) : (
        <p>
          <Button
            onClick={() => {
              setEmptied(true)
              heading.current?.focus()
            }}
          >
            履歴を消す
          </Button>
        </p>
      )}
    </Card>
  )
}

/** The heading takes the focus when the card takes away what had it */
export const WithHeadingThatTakesTheFocus: Story = {
  args: { title: '来店の履歴' },
  render: (args) => <Emptying {...args} />,
}

export const WithHeadingOfLevelThreeThatTakesTheFocus: Story = {
  args: { title: '来店の履歴', headingLevel: 3 },
  render: (args) => <Emptying {...args} />,
}
