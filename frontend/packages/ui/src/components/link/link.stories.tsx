import type { Meta, StoryObj } from '@storybook/react-vite'
import { Link, type LinkComponent, LinkProvider } from './link'

const meta: Meta<typeof Link> = {
  title: 'Components/Link',
  component: Link,
  args: {
    href: '/bookings',
    children: '予約の一覧',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Without a provider: a plain `a` element. */
export const Plain: Story = {}

export const Current: Story = {
  args: { 'aria-current': 'page' },
}

/** One of several links with the same text: its name says which one it is */
export const WithName: Story = {
  args: {
    href: '/services/ladies-cut/booking',
    children: '予約する',
    'aria-label': 'レディースカットを予約する',
  },
}

/** Stands for the link of a router that serves the application below `/admin`. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <a {...rest} href={`/admin${href}`}>
    {children}
  </a>
)

/** With the link of an application: the application draws the link. */
export const WithProvider: Story = {
  decorators: [
    (Story) => (
      <LinkProvider component={RouterLink}>
        <Story />
      </LinkProvider>
    ),
  ],
}
