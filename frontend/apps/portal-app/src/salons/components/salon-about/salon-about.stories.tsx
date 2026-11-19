import type { Meta, StoryObj } from '@storybook/react-vite'
import { plainSalon, salon } from '../examples'
import { SalonAbout } from './salon-about'

const meta: Meta<typeof SalonAbout> = {
  title: 'Portal/Salons/SalonAbout',
  component: SalonAbout,
  args: { salon },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A salon that wrote only what it has to */
export const OnlyWhatIsRequired: Story = {
  args: { salon: plainSalon },
}

export const WithSecondTelephone: Story = {
  args: { salon: { ...salon, alternativePhone: '+81 90-5550-0103' } },
}

/** What stands in the place of the website is no address of the web: it is no link */
export const WebsiteThatIsNoAddress: Story = {
  args: { salon: { ...salon, websiteUrl: 'javascript:alert(1)' } },
}
