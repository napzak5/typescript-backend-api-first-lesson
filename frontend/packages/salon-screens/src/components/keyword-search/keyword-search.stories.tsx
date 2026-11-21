import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { KeywordSearch } from './keyword-search'

const meta: Meta<typeof KeywordSearch> = {
  title: 'Admin/KeywordSearch',
  component: KeywordSearch,
  args: {
    label: 'サロンを探す',
    description:
      'サロンの名前か紹介文にある言葉。空欄のときは、すべてのサロンを並べます。',
    keyword: undefined,
    clearHref: '/',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nothing is searched for yet */
export const Empty: Story = {}

/** A keyword is searched for */
export const WithKeyword: Story = {
  args: { keyword: '表参道' },
}
