import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '../badge/badge'
import { Link } from '../link/link'
import { CardList, type CardListProps } from './card-list'

type Salon = { id: string; name: string; area: string; open: boolean }

const salons: Salon[] = [
  { id: 'aoyama', name: 'Hair Studio Aoyama', area: '東京都港区', open: true },
  { id: 'shibuya', name: 'Salon Shibuya', area: '東京都渋谷区', open: true },
  { id: 'meguro', name: 'Meguro Hair', area: '東京都目黒区', open: false },
]

const SalonList = (props: CardListProps<Salon>) => <CardList {...props} />

const meta: Meta<typeof SalonList> = {
  title: 'Components/CardList',
  component: SalonList,
  args: {
    items: salons,
    itemKey: ({ id }) => id,
    label: 'サロン',
    children: (salon) => (
      <>
        <h3>
          <Link href={`/salons/${salon.id}`}>{salon.name}</Link>
        </h3>
        <p>{salon.area}</p>
        <p>
          <Badge tone={salon.open ? 'success' : 'neutral'}>
            {salon.open ? '営業中' : '休業日'}
          </Badge>
        </p>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** As many side by side as the width holds */
export const Tiles: Story = {
  args: { layout: 'tiles' },
}
