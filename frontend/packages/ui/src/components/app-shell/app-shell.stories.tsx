import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef, useState } from 'react'
import { fn, userEvent } from 'storybook/test'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import { PageHeader } from '../page-header/page-header'
import { AppShell } from './app-shell'
import { useScreenHeadingFocus } from './screens'

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
    title: 'Kushi Admin',
    navigation: items,
    account: (
      <>
        <span>佐藤 美咲</span>
        <Button variant='quiet' size='small' onClick={fn()}>
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

/** One row: the name, and the button of the menu that holds the links and the account. */
export const NarrowScreen: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
}

const openTheMenu: NonNullable<Story['play']> = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'メインメニュー' }))
}

/** The menu, opened on a narrow screen: a sheet on the bottom edge. */
export const MenuOnNarrowScreen: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: openTheMenu,
}

/** As many links as the admin application has: they share the width of the menu. */
export const ManyLinksOnNarrowScreen: Story = {
  args: {
    navigation: [
      { href: '/bookings', label: '予約', current: true },
      { href: '/sales', label: '売上' },
      { href: '/customers', label: '顧客' },
      { href: '/reviews', label: 'レビュー' },
      { href: '/attachments', label: 'ファイル' },
      { href: '/treatments', label: '施術記録' },
      { href: '/shifts', label: 'シフト' },
      { href: '/menu', label: 'メニュー' },
      { href: '/products', label: '商品' },
      { href: '/inventory', label: '在庫' },
      { href: '/purchase-orders', label: '発注' },
      { href: '/staff', label: 'スタッフ' },
      { href: '/settings', label: '設定' },
    ],
  },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: openTheMenu,
}

/** Without links on a narrow screen: the account stays beside the name, the way in. */
export const SignedOutOnNarrowScreen: Story = {
  args: {
    title: 'Kushi',
    navigation: [],
    account: (
      <ButtonLink href='/sign-in' size='small'>
        サインイン
      </ButtonLink>
    ),
    children: <PageHeader title='サロンを探す' />,
  },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
}

/** Before signing in: no navigation and nothing of an account. */
export const SignedOut: Story = {
  args: {
    title: 'Kushi',
    navigation: undefined,
    account: undefined,
    children: <PageHeader title='サインイン' />,
  },
}

/** The screen whose heading is the name of the application: the document is named once. */
export const HomeScreen: Story = {
  args: {
    children: <PageHeader title='Kushi Admin' />,
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

const TwoSteps = () => {
  const [registered, setRegistered] = useState(false)
  const focusHeading = useScreenHeadingFocus()
  const before = useRef(registered)

  // In the commit that shows the next step, where the button was
  useLayoutEffect(() => {
    if (registered && !before.current) {
      focusHeading()
    }
    before.current = registered
  }, [registered, focusHeading])

  return (
    <>
      <PageHeader title='予約する' />
      {registered ? (
        <p>日時を選んでください。</p>
      ) : (
        <p>
          <Button onClick={() => setRegistered(true)}>
            お客様の情報を登録する
          </Button>
        </p>
      )}
    </>
  )
}

/**
 * A step of a screen takes the place of the one that had the focus: the
 * screen asks for the focus to go to its heading.
 */
export const StepChange: Story = {
  args: {
    children: <TwoSteps />,
  },
}
