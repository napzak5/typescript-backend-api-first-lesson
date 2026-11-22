import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aChart } from '../examples'
import { ChartForm } from './chart-form'

const meta: Meta<typeof ChartForm> = {
  title: 'Admin/Charts/ChartForm',
  component: ChartForm,
  args: {
    today: '2026-11-20',
    submitLabel: 'カルテを作る',
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

/** A chart that is made: nothing written yet */
export const New: Story = {}

/** A chart that is changed: the form opens with what is stored */
export const Opened: Story = {
  args: { chart: aChart(), submitLabel: '変更を保存する' },
}

/** What is wrong, under the controls of a treatment and of the products */
export const WithErrors: Story = {
  args: {
    chart: aChart(),
    submitLabel: '変更を保存する',
    errors: {
      'previousTreatments.1.date': '施術日は、今日までにしてください。',
      avoidProducts: '商材の名前は、1 つ 100 文字以内で入力してください。',
    },
  },
}

/** As many treatments as a chart holds: none more is offered */
export const Full: Story = {
  args: {
    chart: aChart({
      previousTreatments: Array.from({ length: 50 }, (_, index) => ({
        treatment: 'cut',
        date: `2025-${String((index % 12) + 1).padStart(2, '0')}-01`,
        salonName: null,
        notes: null,
      })),
    }),
    submitLabel: '変更を保存する',
  },
}

/** The chart is on its way */
export const Sending: Story = {
  args: { chart: aChart(), submitLabel: '変更を保存する', pending: true },
}

/** The chart could not be sent */
export const NotSent: Story = {
  args: {
    message:
      'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
