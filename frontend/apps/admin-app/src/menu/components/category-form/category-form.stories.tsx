import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCategory, CATEGORIES_OF_THE_MENU, highlights } from '../examples'
import { CategoryForm } from './category-form'

const meta: Meta<typeof CategoryForm> = {
  title: 'Admin/Menu/CategoryForm',
  component: CategoryForm,
  args: {
    category: null,
    parents: CATEGORIES_OF_THE_MENU,
    categories: CATEGORIES_OF_THE_MENU,
    displayOrder: 4,
    submitLabel: '足す',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new category: of the top, switched on, last in the order */
export const New: Story = {}

/** The highlights, below the colour and switched off */
export const Child: Story = {
  args: {
    category: highlights(),
    parents: CATEGORIES_OF_THE_MENU.filter(({ id }) => id !== highlights().id),
    submitLabel: '変更を保存する',
  },
}

/** What was refused, at the controls */
export const WithErrors: Story = {
  args: {
    category: aCategory(),
    submitLabel: '変更を保存する',
    errors: {
      color: '色は、#C8A2C8 のように、# と 16 進数 6 桁で入力してください。',
      parentId:
        'この親カテゴリーは、その間に削除されていました。親を選び直してください。',
    },
  },
}

/** What went wrong with the attempt, above the controls */
export const Failed: Story = {
  args: {
    message:
      'カテゴリーを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
