import { savedFiles } from '@beauty-salon-frontend/testing'
import { describe, expect, it } from 'vitest'
import { fileNameOf, fileOfAnswer, saveFile } from './save-file'

describe('fileNameOf', () => {
  it.each<[string, string]>([
    [
      'attachment; filename=customers-2026-11-20.csv',
      'customers-2026-11-20.csv',
    ],
    [
      'attachment; filename="customers 2026-11-20.csv"',
      'customers 2026-11-20.csv',
    ],
    [
      'attachment; filename="customer-0b1c.json"; size=12',
      'customer-0b1c.json',
    ],
  ])('should read the name of %s', (header, name) => {
    // Act
    const read = fileNameOf(new Headers({ 'Content-Disposition': header }))

    // Assert
    expect(read).toBe(name)
  })

  it.each<[string, Headers]>([
    ['no header', new Headers()],
    [
      'a header without a name',
      new Headers({ 'Content-Disposition': 'attachment' }),
    ],
    [
      'a name of other characters alone',
      new Headers({
        'Content-Disposition':
          "attachment; filename*=UTF-8''%E9%A1%A7%E5%AE%A2.csv",
      }),
    ],
  ])('should read no name from %s', (_, headers) => {
    // Act
    const read = fileNameOf(headers)

    // Assert
    expect(read).toBeUndefined()
  })
})

describe('fileOfAnswer', () => {
  it('should hold the content under the name and of the type of the answer', () => {
    // Arrange
    const headers = new Headers({
      'Content-Disposition':
        'attachment; filename=sales-report-2026-11-01-2026-11-21.csv',
      'Content-Type': 'text/csv; charset=utf-8',
    })

    // Act
    const file = fileOfAnswer(headers, 'date,sales\r\n')

    // Assert
    expect(file).toEqual({
      name: 'sales-report-2026-11-01-2026-11-21.csv',
      type: 'text/csv; charset=utf-8',
      content: 'date,sales\r\n',
    })
  })

  it('should hold nothing when the answer names no file', () => {
    // Act, Assert
    expect(fileOfAnswer(new Headers(), 'date,sales\r\n')).toBeUndefined()
  })
})

describe('saveFile', () => {
  it('should save the content under the name, with its type', async () => {
    // Act
    saveFile({
      name: 'customers-2026-11-20.csv',
      type: 'text/csv; charset=utf-8',
      content: '﻿id,email\r\n1,a@example.com\r\n',
    })

    // Assert
    expect(await savedFiles()).toEqual([
      {
        name: 'customers-2026-11-20.csv',
        type: 'text/csv; charset=utf-8',
        text: '﻿id,email\r\n1,a@example.com\r\n',
      },
    ])
  })

  it('should leave nothing in the page', () => {
    // Act
    saveFile({ name: 'a.json', type: 'application/json', content: '{}' })

    // Assert
    expect(document.body).toBeEmptyDOMElement()
  })
})
