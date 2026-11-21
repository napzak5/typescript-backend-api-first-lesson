/** A file a page saves: the name it is saved under, its type and what it holds */
export type FileToSave = {
  name: string
  /** The media type of the file, as the API gave it: `text/csv; charset=utf-8` */
  type: string
  content: string
}

/** How long the browser is given to read a saved file before its URL is let go of */
const KEPT_FOR_MS = 60_000

/**
 * The name in `Content-Disposition`: a token
 * (`attachment; filename=customers-2026-11-20.csv`, as the API writes a
 * name of letters, digits and signs), or in double quotes.
 */
const FILE_NAME = /filename=(?:"([^"]+)"|([^";\s]+))/

/**
 * The name the API says a file it answers with is saved under, or
 * `undefined` when the answer names none. A page of another origin reads
 * the header because the API exposes it (CORS).
 */
export const fileNameOf = (headers: Headers): string | undefined => {
  const found = FILE_NAME.exec(headers.get('content-disposition') ?? '')

  return found?.[1] ?? found?.[2]
}

/**
 * The file an answer of the API holds, under the name and of the type the
 * answer gives; `undefined` when it names none.
 */
export const fileOfAnswer = (
  headers: Headers,
  content: string,
): FileToSave | undefined => {
  const name = fileNameOf(headers)

  return name === undefined
    ? undefined
    : { name, type: headers.get('content-type') ?? '', content }
}

/**
 * Saves a file the page holds, as the browser saves a file it downloads:
 * a link to the file in memory, with the name to save it under, is
 * pressed. The browser asks where, or puts it among the downloads, as it
 * is set to.
 */
export const saveFile = ({ name, type, content }: FileToSave): void => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // The browser reads the file after the press has returned
  window.setTimeout(() => URL.revokeObjectURL(url), KEPT_FOR_MS)
}
