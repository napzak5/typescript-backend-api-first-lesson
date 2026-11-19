import type { Meta, StoryObj } from '@storybook/react-vite'
import { QrCode } from './qr-code'

const meta: Meta<typeof QrCode> = {
  title: 'Components/QrCode',
  component: QrCode,
  args: {
    value:
      'otpauth://totp/Beauty%20Salon:customer1%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30',
    label: '認証アプリで読み取る QR コード',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The address an authenticator app reads: a long text, and a large code */
export const ForAnAuthenticatorApp: Story = {}

/** A short text: the smallest code there is */
export const Short: Story = {
  args: { value: 'beauty-salon', label: 'サロンのページの QR コード' },
}
