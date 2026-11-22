import type { Meta, StoryObj } from '@storybook/react-vite'
import { COLUMN_GUIDES } from '../../utils/customer-file'
import { FileColumns } from './file-columns'

const meta: Meta<typeof FileColumns> = {
  title: 'Admin/Customers/FileColumns',
  component: FileColumns,
  args: { columns: COLUMN_GUIDES },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every column a file of customers may have */
export const Columns: Story = {}
