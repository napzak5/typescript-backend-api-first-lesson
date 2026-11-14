import { describe, expect, it } from 'vitest'
import { qsParse, qsStringify } from './queryParamUtil'

describe('qsStringify', () => {
  it('should serialise values in insertion order', () => {
    // Arrange
    const params = { q: 'cut', page: 2, active: true }

    // Act
    const result = qsStringify(params)

    // Assert
    expect(result).toBe('q=cut&page=2&active=true')
  })

  it('should serialise an array as one bracketed, comma separated value', () => {
    // Arrange
    const params = { tags: ['cut', 'color'] }

    // Act
    const result = qsStringify(params)

    // Assert
    expect(result).toBe('tags[]=cut,color')
  })

  it('should skip empty strings, null and undefined', () => {
    // Arrange
    const params = { q: '', staffId: null, salonId: undefined, page: 1 }

    // Act
    const result = qsStringify(params)

    // Assert
    expect(result).toBe('page=1')
  })

  it('should keep falsy values that carry meaning', () => {
    // Arrange
    const params = { offset: 0, active: false }

    // Act
    const result = qsStringify(params)

    // Assert
    expect(result).toBe('offset=0&active=false')
  })

  it('should percent-encode reserved and non-ASCII characters', () => {
    // Arrange
    const params = { q: 'ヘア カット', redirect: '/salons?id=1&tab=menu' }

    // Act
    const result = qsStringify(params)

    // Assert
    expect(result).toBe(
      'q=%E3%83%98%E3%82%A2%20%E3%82%AB%E3%83%83%E3%83%88&redirect=%2Fsalons%3Fid%3D1%26tab%3Dmenu',
    )
  })

  it('should return an empty string for an empty object', () => {
    // Act
    const result = qsStringify({})

    // Assert
    expect(result).toBe('')
  })

  it('should let the caller override the defaults', () => {
    // Arrange
    const params = { q: '', tags: ['cut', 'color'] }

    // Act
    const result = qsStringify(params, {
      skipEmptyString: false,
      arrayFormat: 'comma',
    })

    // Assert
    expect(result).toBe('q=&tags=cut,color')
  })
})

describe('qsParse', () => {
  it('should parse numbers and booleans into their own types', () => {
    // Act
    const result = qsParse('page=2&ratio=1.5&active=true&archived=false')

    // Assert
    expect(result).toEqual({
      page: 2,
      ratio: 1.5,
      active: true,
      archived: false,
    })
  })

  it('should parse a bracketed value as an array', () => {
    // Act
    const result = qsParse('tags[]=cut,color&ids[]=7')

    // Assert
    expect(result).toEqual({ tags: ['cut', 'color'], ids: [7] })
  })

  it('should ignore a leading question mark', () => {
    // Act
    const result = qsParse('?q=cut')

    // Assert
    expect(result).toEqual({ q: 'cut' })
  })

  it('should decode percent-encoded values', () => {
    // Act
    const result = qsParse('q=%E3%83%98%E3%82%A2%20%E3%82%AB%E3%83%83%E3%83%88')

    // Assert
    expect(result).toEqual({ q: 'ヘア カット' })
  })

  it('should return an empty object for an empty query', () => {
    // Act
    const result = qsParse('')

    // Assert
    expect(result).toEqual({})
  })

  it('should let the caller override the defaults', () => {
    // Act
    const result = qsParse('page=2&active=true', {
      parseNumbers: false,
      parseBooleans: false,
    })

    // Assert
    expect(result).toEqual({ page: '2', active: 'true' })
  })

  it('should restore what qsStringify produced', () => {
    // Arrange
    const params = {
      q: 'ヘア カット',
      page: 2,
      tags: ['cut', 'color'],
      active: true,
    }

    // Act
    const result = qsParse(qsStringify(params))

    // Assert
    expect(result).toEqual(params)
  })
})
