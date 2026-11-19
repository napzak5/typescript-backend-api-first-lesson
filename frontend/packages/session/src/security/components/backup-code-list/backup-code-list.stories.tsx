import type { Meta, StoryObj } from '@storybook/react-vite'
import { twoFactorSetup } from '../examples'
import { BackupCodeList } from './backup-code-list'

const meta: Meta<typeof BackupCodeList> = {
  title: 'Session/Security/BackupCodeList',
  component: BackupCodeList,
  args: {
    codes: twoFactorSetup.backupCodes,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The ten codes the API issues */
export const Issued: Story = {}
