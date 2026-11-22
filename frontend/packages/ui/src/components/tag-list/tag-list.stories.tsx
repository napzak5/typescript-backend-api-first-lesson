import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagList } from './tag-list'

const meta: Meta<typeof TagList> = {
  title: 'Components/TagList',
  component: TagList,
  args: {
    label: '特徴',
    items: ['個室あり', 'キッズスペース', '駐車場'],
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** More words than one line holds: they go on in the next line */
export const Many: Story = {
  args: {
    label: '得意な施術',
    items: [
      'カット',
      'カラー',
      'ハイライト',
      'バレイヤージュ',
      'パーマ',
      'デジタルパーマ',
      '縮毛矯正',
      'トリートメント',
      'ヘッドスパ',
      'ヘアセット',
      '着付け',
      'メイク',
    ],
  },
}

/** No words: there are none, and that is what was recorded */
export const Empty: Story = {
  args: { label: '資格', items: [] },
}

export const Repeated: Story = {
  args: { items: ['Wi-Fi', 'ドリンクサービス', 'Wi-Fi'] },
}

/** A word longer than the line, as an address somebody pasted: it breaks where the line ends */
export const LongWord: Story = {
  args: {
    label: 'タグ',
    items: ['常連', `https://example.com/${'a'.repeat(120)}`],
  },
}
