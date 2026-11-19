import { Button } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TimeSlotFields, type TimeSlotFieldsProps } from './time-slot-fields'

const meta: Meta<typeof TimeSlotFields> = {
  title: 'Portal/Preferences/TimeSlotFields',
  component: TimeSlotFields,
  args: {
    name: 'preferredTimeSlots',
    defaultValue: [
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '18:00', endTime: '20:30' },
    ],
    errors: {},
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A row for each time slot there is */
export const WithSlots: Story = {}

/** No time slot yet: the button that adds one, and nothing else */
export const Empty: Story = {
  args: { defaultValue: [] },
}

/** Two time slots that cannot be: one that ends before it begins, and one that overlaps it */
const MISTAKEN: Pick<TimeSlotFieldsProps, 'defaultValue' | 'errors'> = {
  defaultValue: [
    { startTime: '12:00', endTime: '10:00' },
    { startTime: '09:00', endTime: '11:00' },
  ],
  errors: {
    'preferredTimeSlots.0.endTime': '終了は、開始より後の時刻にしてください。',
    'preferredTimeSlots.1.startTime':
      'ほかの時間帯と重なっています。重ならない時刻にしてください。',
  },
}

/** What is wrong with a time is said at its control */
export const WithErrors: Story = {
  args: MISTAKEN,
}

/**
 * The rows in a form that is sent again with the same mistakes: every
 * attempt hands the rows a new object of errors.
 */
const SentAgain = (props: TimeSlotFieldsProps) => {
  const [errors, setErrors] = useState(props.errors)

  return (
    <>
      <TimeSlotFields {...props} errors={errors} />
      <Button onClick={() => setErrors({ ...props.errors })}>
        もう一度送信する
      </Button>
    </>
  )
}

/** The same mistakes, and a button that stands for the next attempt */
export const Attempted: Story = {
  args: MISTAKEN,
  render: (args) => <SentAgain {...args} />,
}
