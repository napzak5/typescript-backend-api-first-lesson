import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { Table } from '../table/table'
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

/** A table to choose from, as wide as its columns on a wide screen. */
export const Wide: Story = {
  args: {
    title: '紹介元を選ぶ',
    description: 'このお客様を紹介したお客様を、台帳から探して選びます。',
    size: 'wide',
    children: (
      <Table
        caption='見つかったお客様'
        columns={[
          { key: 'name', header: 'お名前', cell: ({ name }) => name },
          { key: 'kana', header: 'フリガナ', cell: ({ kana }) => kana },
          { key: 'phone', header: '電話番号', cell: ({ phone }) => phone },
          {
            key: 'email',
            header: 'メールアドレス',
            cell: ({ email }) => email,
          },
        ]}
        rows={[
          {
            name: '山田 花子',
            kana: 'ヤマダ ハナコ',
            phone: '090-1234-5678',
            email: 'hanako.yamada@example.com',
          },
          {
            name: '山田 花子',
            kana: 'ヤマダ ハナコ',
            phone: '080-8765-4321',
            email: 'h.yamada@example.jp',
          },
        ]}
        rowKey={({ phone }) => phone}
        emptyMessage='お客様はいません'
      />
    ),
    actions: <Button>やめる</Button>,
  },
}

/**
 * On a screen as narrow as a phone: a sheet on the bottom edge, as wide as
 * the screen, its actions one below the other.
 */
export const OnANarrowScreen: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
}

const CHOSEN_BOOKINGS = [
  '12 月 3 日（木）10:00 カット（山田 花子 様）',
  '12 月 3 日（木）11:30 カラー（佐藤 美咲 様）',
  '12 月 3 日（木）13:00 パーマ（鈴木 一郎 様）',
  '12 月 3 日（木）14:30 カット（高橋 直子 様）',
  '12 月 3 日（木）16:00 トリートメント（田中 恵 様）',
  '12 月 4 日（金）10:00 カット（伊藤 健 様）',
  '12 月 4 日（金）11:00 ヘッドスパ（渡辺 彩 様）',
  '12 月 4 日（金）13:30 カラー（中村 翔 様）',
  '12 月 4 日（金）15:00 カット（小林 優子 様）',
  '12 月 4 日（金）16:30 縮毛矯正（加藤 真理 様）',
  '12 月 5 日（土）10:00 カット（吉田 大輔 様）',
  '12 月 5 日（土）11:30 カラー（山本 由美 様）',
]

/**
 * Content that is longer than the screen: the dialog is no higher than the
 * screen and scrolls inside, and its actions stay in sight.
 */
export const LongContent: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  args: {
    title: '選んだ 12 件の予約を取り消しますか？',
    description: 'お客様には、取り消したことをメールで知らせます。',
    children: (
      <ul>
        {CHOSEN_BOOKINGS.map((booking) => (
          <li key={booking}>{booking}</li>
        ))}
      </ul>
    ),
    actions: (
      <>
        <Button>戻る</Button>
        <Button variant='danger'>12 件の予約を取り消す</Button>
      </>
    ),
  },
}

export const Closed: Story = {
  args: { open: false },
}

/**
 * A menu, which asks nothing: a press on the overlay closes it, and so does
 * a press on one of its links or buttons.
 */
export const Menu: Story = {
  args: {
    kind: 'menu',
    title: '予約台帳を開く',
    description: undefined,
    children: (
      <ul>
        <li>
          <a href='#today'>今日の予約</a>
        </li>
        <li>
          <a href='#tomorrow'>明日の予約</a>
        </li>
      </ul>
    ),
    actions: <Button>閉じる</Button>,
  },
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

/**
 * Closed by its answer, which changed what it asked about: the screen closes
 * it and moves the focus to the heading of what changed, in one commit. The
 * button that opened it went with the change, and the page behind the
 * dialog is inert until the dialog is closed.
 */
export const ClosedByItsAnswer: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true)
    const heading = useRef<HTMLHeadingElement>(null)

    useLayoutEffect(() => {
      if (!open) {
        heading.current?.focus()
      }
    }, [open])

    return (
      <>
        <h2 ref={heading} tabIndex={-1}>
          予約の状態
        </h2>
        <Dialog
          {...args}
          open={open}
          onClose={() => {
            setOpen(false)
            args.onClose()
          }}
          actions={
            <Button onClick={() => setOpen(false)}>予約を取り消す</Button>
          }
        />
      </>
    )
  },
}
