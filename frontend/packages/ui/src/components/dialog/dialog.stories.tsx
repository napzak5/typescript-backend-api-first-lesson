import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { Dialog } from './dialog'

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '22rem' } },
  },
  args: {
    open: true,
    onClose: fn(),
    title: '予約を取り消しますか？',
    description:
      '12 月 3 日（木）10:00 のカットの予約を取り消します。この操作は元に戻せません。',
    actions: (
      <>
        <Button>戻る</Button>
        <Button variant='danger'>予約を取り消す</Button>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Confirmation: Story = {}

export const TitleOnly: Story = {
  args: {
    title: 'サインアウトしますか？',
    description: undefined,
    actions: (
      <>
        <Button>戻る</Button>
        <Button variant='primary'>サインアウト</Button>
      </>
    ),
  },
}

export const WithContent: Story = {
  args: {
    title: '予約の内容',
    description: undefined,
    children: <p>カット、カラー（2 時間）／担当: 佐藤 美咲</p>,
    actions: <Button variant='primary'>閉じる</Button>,
  },
}

export const Closed: Story = {
  args: { open: false },
}

/** Opened by a button and closed by its own: how a screen uses it. */
export const OpenedByButton: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)}>予約を取り消す…</Button>
        <Dialog
          {...args}
          open={open}
          onClose={() => {
            setOpen(false)
            args.onClose()
          }}
          actions={<Button onClick={() => setOpen(false)}>戻る</Button>}
        />
      </>
    )
  },
}
