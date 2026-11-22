import { afterEach } from 'vitest'

/**
 * jsdom has `Blob`, but no `URL.createObjectURL`, and a link that names a
 * file to save (`download`) saves nothing. These give a page what saving a
 * file it made relies on, and keep the files it saved: `savedFiles()`.
 *
 * What a browser does beyond that (the folder of the downloads, a dialog
 * that asks where) is seen in a real browser.
 */

/** A file a page saved: the name it was saved under, its type and its text */
export type SavedFile = {
  name: string
  type: string
  /** The text of the file, with the mark of its byte order when it has one (`﻿`) */
  text: string
}

/** What the object URLs that are not let go of yet stand for */
const objects = new Map<string, Blob>()

/** The files saved in this test, oldest first */
const saved: { name: string; blob: Blob }[] = []

let made = 0

/** A press of a link that saves a file: the file is kept, and nothing is navigated to */
const keepSavedFile = (event: MouseEvent): void => {
  const link = event.target
  if (!(link instanceof HTMLAnchorElement) || link.download === '') {
    return
  }
  event.preventDefault()
  const blob = objects.get(link.href)
  if (blob !== undefined) {
    saved.push({ name: link.download, blob })
  }
}

export const installFileSaving = (): void => {
  Object.defineProperties(URL, {
    createObjectURL: {
      configurable: true,
      writable: true,
      value(blob: Blob): string {
        made += 1
        const url = `blob:saved/${made}`
        objects.set(url, blob)
        return url
      },
    },
    revokeObjectURL: {
      configurable: true,
      writable: true,
      value(url: string): void {
        objects.delete(url)
      },
    },
  })
  document.addEventListener('click', keepSavedFile, { capture: true })
  // A test starts with no file saved
  afterEach(() => {
    saved.length = 0
  })
}

/**
 * The files the page saved in this test, oldest first. The text is read
 * as the bytes are, so a file that starts with the mark of its byte order
 * shows it.
 */
export const savedFiles = (): Promise<SavedFile[]> =>
  Promise.all(
    saved.map(async ({ name, blob }) => ({
      name,
      type: blob.type,
      text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(
        await blob.arrayBuffer(),
      ),
    })),
  )
