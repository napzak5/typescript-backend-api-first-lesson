import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { Link } from '../link/link'
import type { More } from '../load-more/load-more'
import { PagedList, type PagedListProps } from './paged-list'

type Review = { id: string; title: string }

const reviewsFrom = (first: number, count: number): Review[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `review-${first + index}`,
    title: `レビュー ${first + index}`,
  }))

const ReviewList = (props: PagedListProps<Review>) => <PagedList {...props} />

/** A list whose button adds two reviews at a time, up to six */
const GrowingList = (props: PagedListProps<Review>) => {
  const [reviews, setReviews] = useState(props.items)
  const [more, setMore] = useState<More>(props.more)

  return (
    <PagedList
      {...props}
      items={reviews}
      count={`6 件（${reviews.length} 件を表示しています）`}
      more={more}
      onMore={() => {
        props.onMore()
        const next = [...reviews, ...reviewsFrom(reviews.length + 1, 2)]
        setReviews(next)
        setMore(next.length < 6 ? 'available' : 'none')
      }}
    />
  )
}

const meta: Meta<typeof ReviewList> = {
  title: 'Components/PagedList',
  component: ReviewList,
  args: {
    items: reviewsFrom(1, 2),
    itemKey: ({ id }) => id,
    label: 'レビュー',
    count: '6 件（2 件を表示しています）',
    more: 'available',
    onMore: fn(),
    children: (review) => (
      <h3>
        <Link href={`/reviews/${review.id}`}>{review.title}</Link>
      </h3>
    ),
  },
  render: (args) => <GrowingList {...args} />,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The item takes the focus: what it begins with is no link */
export const ItemFocus: Story = {
  args: {
    focus: 'item',
    children: (review) => (
      <>
        <h3>{review.title}</h3>
        <Button size='small' onClick={fn()}>
          参考になった
        </Button>
      </>
    ),
  },
}

/** Items without a link take the focus themselves */
export const WithoutLinks: Story = {
  args: { children: (review) => <h3>{review.title}</h3> },
}

/** The page that was asked for did not come */
export const Failed: Story = {
  args: { more: 'failed' },
  render: (args) => <PagedList {...args} />,
}
