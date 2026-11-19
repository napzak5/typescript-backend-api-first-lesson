import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import { Navigation } from '../navigation/navigation'
import { PageHeader } from '../page-header/page-header'
import { AppShell } from './app-shell'

const items = [
  { href: '/bookings', label: '予約台帳', current: true },
  { href: '/sales', label: '会計' },
  { href: '/customers', label: '顧客台帳' },
  { href: '/staff', label: 'スタッフ' },
]

const meta: Meta<typeof AppShell> = {
  title: 'Components/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Beauty Salon Admin',
    navigation: <Navigation label='メインメニュー' items={items} />,
    account: (
      <>
        <span>佐藤 美咲</span>
        <Button variant='quiet' size='small'>
          サインアウト
        </Button>
      </>
    ),
    children: (
      <>
        <PageHeader
          title='予約台帳'
          description='今日の予約は 12 件です。'
          actions={
            <ButtonLink href='/bookings/new' variant='primary'>
              新しい予約
            </ButtonLink>
          }
        />
        <p>ここに画面の内容が入ります。</p>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const NavigationInHeader: Story = {}

export const NavigationAtSide: Story = {
  args: {
    navigationPlacement: 'side',
    navigation: (
      <Navigation label='メインメニュー' items={items} orientation='vertical' />
    ),
  },
}

/** Before signing in: no navigation and nothing of an account. */
export const SignedOut: Story = {
  args: {
    title: 'Beauty Salon Portal',
    navigation: undefined,
    account: undefined,
    children: <PageHeader title='サインイン' />,
  },
}

/** The screen whose heading is the name of the application: the document is named once. */
export const HomeScreen: Story = {
  args: {
    children: <PageHeader title='Beauty Salon Admin' />,
  },
}

const TwoScreens = () => {
  const [screen, setScreen] = useState('予約台帳')

  return (
    <>
      <PageHeader title={screen} />
      <p>
        <Button onClick={() => setScreen('顧客台帳')}>顧客台帳を開く</Button>
      </p>
    </>
  )
}

/** One screen takes the place of another: the focus goes to the new heading. */
export const ScreenChange: Story = {
  args: {
    children: <TwoScreens />,
  },
}
