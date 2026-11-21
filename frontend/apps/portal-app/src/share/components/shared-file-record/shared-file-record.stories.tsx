import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { loadMessageOf } from '../../shared-file'
import { consent, PIXEL, photo } from '../examples'
import { SharedFileRecord } from './shared-file-record'

const meta: Meta<typeof SharedFileRecord> = {
  title: 'Portal/Share/SharedFileRecord',
  component: SharedFileRecord,
  args: {
    file: photo,
    content: { type: 'notLoaded', pending: false, message: undefined },
    onLoad: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What is known of the file, before it is loaded */
export const NotLoaded: Story = {}

/** The file is being loaded */
export const Loading: Story = {
  args: {
    content: { type: 'notLoaded', pending: true, message: undefined },
  },
}

/** The storage did not answer with the file: the link counted the download all the same */
export const NotFetched: Story = {
  args: {
    content: {
      type: 'notLoaded',
      pending: false,
      message: loadMessageOf({ type: 'notFetched' }),
    },
  },
}

/** An image the page holds */
export const LoadedImage: Story = {
  args: { content: { type: 'loaded', url: PIXEL } },
}

/** A PDF the page holds: it is opened or saved, not shown */
export const LoadedPdf: Story = {
  args: {
    file: consent,
    content: { type: 'loaded', url: PIXEL },
  },
}
