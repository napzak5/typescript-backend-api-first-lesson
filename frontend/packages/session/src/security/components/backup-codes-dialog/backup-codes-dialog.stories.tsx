import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { twoFactorSetup } from '../examples'
import { BackupCodesDialog } from './backup-codes-dialog'

const meta: Meta<typeof BackupCodesDialog> = {
  title: 'Session/Security/BackupCodesDialog',
  component: BackupCodesDialog,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '36rem' } },
  },
  args: {
    open: true,
    onClose: fn(),
    onIssue: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The dialog asks for a code before it issues new ones */
export const Asking: Story = {}

/** The API did not take the code */
export const CodeWrong: Story = {
  args: {
    errors: {
      code: securityMessages.twoFactorFlow.codeWrong,
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The code did not reach the API */
export const Unsent: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}

/** The new codes, in the place of the form */
export const Issued: Story = {
  args: { issued: twoFactorSetup.backupCodes },
}

/** A code is sent and the new codes take the place of the form: how a screen uses it. */
export const IssuedByCode: Story = {
  render: (args) => {
    const [issued, setIssued] = useState<string[]>()

    return (
      <BackupCodesDialog
        {...args}
        issued={issued}
        onIssue={(values) => {
          setIssued(twoFactorSetup.backupCodes)
          args.onIssue(values)
        }}
      />
    )
  },
}
