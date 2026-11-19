import type { Meta, StoryObj } from '@storybook/react-vite'
import { Rating } from './rating'

const meta: Meta<typeof Rating> = {
  title: 'Components/Rating',
  component: Rating,
  args: { value: 4.5 },
}

export default meta

type Story = StoryObj<typeof meta>

/** One rating: a review */
export const One: Story = {
  args: { value: 4 },
}

/** The mean of many, with how many they are */
export const MeanOfMany: Story = {
  args: { value: 4.33, count: 128 },
}

export const Highest: Story = {
  args: { value: 5, count: 3 },
}

export const Lowest: Story = {
  args: { value: 1, count: 1 },
}

/** Nothing was rated yet */
export const NotRated: Story = {
  args: { value: null },
}
