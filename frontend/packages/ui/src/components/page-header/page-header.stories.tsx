import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, userEvent } from 'storybook/test'
import { saidOnThePage } from '../../__stories__/said'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import { PageHeader } from './page-header'

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  args: {
    title: '予約台帳',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithDescription: Story = {
  args: { description: '今日の予約は 12 件です。' },
}

export const WithActions: Story = {
  args: {
    description: '今日の予約は 12 件です。',
    actions: (
      <ButtonLink href='/bookings/new' variant='primary'>
        新しい予約
      </ButtonLink>
    ),
  },
}

/** Two actions: both in sight, side by side on a narrow screen too */
export const WithTwoActions: Story = {
  args: {
    title: '設定',
    description: 'Beauty Studio Tokyo',
    actions: (
      <>
        <ButtonLink href='/settings/salon' variant='primary'>
          サロンの情報を直す
        </ButtonLink>
        <ButtonLink href='/settings/hours'>営業時間を直す</ButtonLink>
      </>
    ),
  },
}

/** The main action, and the other actions in the same row */
export const WithOtherActions: Story = {
  args: {
    title: '顧客台帳',
    description: 'Beauty Studio Tokyo',
    actions: (
      <ButtonLink href='/customers/new' variant='primary'>
        お客様を登録する
      </ButtonLink>
    ),
    otherActions: (
      <>
        <ButtonLink href='/customers/import'>CSV から登録する</ButtonLink>
        <ButtonLink href='/customers/charts'>カルテを探す</ButtonLink>
        <Button onClick={fn()}>CSV に出力する</Button>
      </>
    ),
  },
}

const PHONE = { viewport: { value: 'mobile1', isRotated: false } }

/** On a screen as narrow as a phone, the other actions are behind a button */
export const OtherActionsOnANarrowScreen: Story = {
  ...WithOtherActions,
  globals: PHONE,
}

/** The sheet of the other actions, opened: on the bottom edge of the screen */
export const OtherActionsInTheSheet: Story = {
  ...WithOtherActions,
  globals: PHONE,
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', {
        name: saidOnThePage(uiMessages.pageHeader.otherActions),
      }),
    )
  },
}

export const TwoActionsOnANarrowScreen: Story = {
  ...WithTwoActions,
  globals: PHONE,
}
