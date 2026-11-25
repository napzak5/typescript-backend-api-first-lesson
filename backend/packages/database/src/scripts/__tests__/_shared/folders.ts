import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach } from 'vitest'

/**
 * Folders of the tests' own, with the files they are given by their paths in
 * the folder; each is removed after its test.
 */
export const useTemporaryFolders = (): ((
  files: Record<string, string>,
) => string) => {
  const folders: string[] = []

  afterEach(() => {
    for (const folder of folders.splice(0)) {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  return (files) => {
    const folder = mkdtempSync(join(tmpdir(), 'scripts-test-'))
    folders.push(folder)
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(folder, name)), { recursive: true })
      writeFileSync(join(folder, name), text)
    }
    return folder
  }
}
