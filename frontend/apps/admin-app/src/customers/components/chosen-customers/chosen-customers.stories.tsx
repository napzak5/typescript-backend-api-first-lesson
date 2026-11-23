import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ChosenCustomers } from './chosen-customers'

const { bulk: words } = adminCustomerMessages

const CHOSEN = [
  { id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', name: '山田 花子' },
  { id: '7a2d3b4c-5e6f-4a71-9b8c-0d1e2f3a4b5c', name: '鈴木 一郎' },
  { id: '8b3e4c5d-6f7a-4b82-8c9d-1e2f3a4b5c6d', name: '山田 花子' },
]

const meta: Meta<typeof ChosenCustomers> = {
  title: 'Admin/Customers/ChosenCustomers',
  component: ChosenCustomers,
  args: {
    customers: CHOSEN,
    mayRemove: true,
    open: 'none',
    onOpen: fn(),
    onClose: fn(),
    onClear: fn(),
    onRetag: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nobody is chosen yet */
export const NoneChosen: Story = {
  args: { customers: [] },
}

/** Nobody is chosen yet, by a member of the staff */
export const NoneChosenByStaff: Story = {
  args: { customers: [], mayRemove: false },
}

/** Three customers are chosen, by an owner: two of them have one name */
export const Chosen: Story = {}

/** A member of the staff, who may not remove customers from the ledger */
export const ByStaff: Story = {
  args: { mayRemove: false },
}

/** More customers are chosen than are written at once */
export const TooMany: Story = {
  args: {
    customers: Array.from({ length: 101 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `お客様 ${index + 1}`,
    })),
  },
}

/** The dialog that gives a tag or takes it away */
export const Tagging: Story = {
  args: { open: 'tag' },
}

/** The tag was left out */
export const TagMissing: Story = {
  args: { open: 'tag', errors: { tag: words.tag.missing } },
}

/** The change of the tag is on its way */
export const TagPending: Story = {
  args: { open: 'tag', pending: true },
}

/** The dialog that asks before the customers are removed */
export const Removing: Story = {
  args: { open: 'removal' },
}

/** The removal was refused */
export const RemovalRefused: Story = {
  args: {
    open: 'removal',
    message: words.removing.unfinished('鈴木 一郎'),
  },
}
