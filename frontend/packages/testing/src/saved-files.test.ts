import { afterEach, describe, expect, it } from 'vitest'
import { savedFiles } from './saved-files'

// `setup.ts`, which this package names in its own `setupFiles`, has installed the saving

const pressLink = (url: string, download: string): void => {
  const link = document.createElement('a')
  link.href = url
  link.download = download
  document.body.append(link)
  link.click()
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('the saving of files given to jsdom', () => {
  it('should keep the file a link that saves it was pressed for', async () => {
    // Arrange
    const url = URL.createObjectURL(
      new Blob(['﻿id,email\r\n'], { type: 'text/csv;charset=utf-8' }),
    )

    // Act
    pressLink(url, 'customers.csv')

    // Assert
    expect(await savedFiles()).toEqual([
      {
        name: 'customers.csv',
        type: 'text/csv;charset=utf-8',
        text: '﻿id,email\r\n',
      },
    ])
  })

  it('should keep the files in the order they were saved', async () => {
    // Arrange
    const first = URL.createObjectURL(new Blob(['1']))
    const second = URL.createObjectURL(new Blob(['2']))

    // Act
    pressLink(second, 'second.txt')
    pressLink(first, 'first.txt')

    // Assert
    expect((await savedFiles()).map(({ name }) => name)).toEqual([
      'second.txt',
      'first.txt',
    ])
  })

  it('should give every file a URL of its own', () => {
    // Act
    const urls = [
      URL.createObjectURL(new Blob(['1'])),
      URL.createObjectURL(new Blob(['1'])),
    ]

    // Assert
    expect(new Set(urls).size).toBe(2)
  })

  it('should not keep a file whose URL was let go of', async () => {
    // Arrange
    const url = URL.createObjectURL(new Blob(['1']))
    URL.revokeObjectURL(url)

    // Act
    pressLink(url, 'gone.txt')

    // Assert
    expect(await savedFiles()).toEqual([])
  })

  it('should not keep what a link without a name to save under leads to', async () => {
    // Arrange
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['1']))
    document.body.append(link)
    link.addEventListener('click', (event) => event.preventDefault())

    // Act
    link.click()

    // Assert
    expect(await savedFiles()).toEqual([])
  })

  it('should start a test with no file saved', async () => {
    // Assert: the tests above saved files
    expect(await savedFiles()).toEqual([])
  })
})
