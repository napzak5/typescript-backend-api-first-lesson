import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PhotoForm } from './photo-form'

const meta: Meta<typeof PhotoForm> = {
  title: 'Admin/Treatments/PhotoForm',
  component: PhotoForm,
  args: {
    room: 20,
    onSubmit: fn(),
    actions: (
      <ButtonLink href='/' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A record without photos: the form opens with one */
export const New: Story = {}

/** A record with room for one more photo: no other row is offered */
export const LastOne: Story = {
  args: { room: 1 },
}

/** What the API refused, under the controls of the photo it belongs to */
export const WithErrors: Story = {
  args: {
    errors: {
      'photos.0.photoUrl':
        'この施術記録には、同じ URL の写真があります。ほかの写真の URL を入力するか、この写真の欄を外してください。',
      'photos.0.isPublic':
        'お客様の同意がない写真は、サロンの外に見せられません。お客様の同意を確かめるか、このチェックを外してください。',
    },
  },
}

/** What went wrong with the attempt as a whole */
export const Refused: Story = {
  args: {
    message:
      'この施術記録には、あと 1 枚まで足せます。写真の欄を減らしてください。',
  },
}

/** The photos are on their way */
export const Sending: Story = {
  args: { pending: true },
}
