import { describe, expect, it } from 'vitest'
import { formOf, formOfEntries } from './forms'

describe('formOf', () => {
  it('should hold each value under its name, in the order they were written', () => {
    // Act
    const values = formOf({ name: 'Tanaka Yuki', email: '', phone: '090' })

    // Assert
    expect([...values.entries()]).toEqual([
      ['name', 'Tanaka Yuki'],
      ['email', ''],
      ['phone', '090'],
    ])
  })

  it('should hold nothing for a form without values', () => {
    // Act, Assert
    expect([...formOf({}).entries()]).toEqual([])
  })

  it('should hold a file under its name, as the control of a file hands it over', () => {
    // Act
    const values = formOf({ note: 'text', photo: new Blob(['bytes']) })

    // Assert
    expect(values.get('note')).toBe('text')
    expect(values.get('photo')).toBeInstanceOf(File)
    expect(values.get('photo')).toHaveProperty('size', 5)
  })

  it('should make values of their own for every call', () => {
    // Arrange
    const first = formOf({ name: 'first' })

    // Act
    const second = formOf({ other: 'second' })

    // Assert
    expect([...first.keys()]).toEqual(['name'])
    expect([...second.keys()]).toEqual(['other'])
  })
})

describe('formOfEntries', () => {
  it('should hold every value of a name that is written several times, in their order', () => {
    // Act
    const values = formOfEntries([
      ['tags', 'vip'],
      ['name', 'Tanaka Yuki'],
      ['tags', 'colour'],
      ['tags', 'vip'],
    ])

    // Assert
    expect(values.getAll('tags')).toEqual(['vip', 'colour', 'vip'])
    expect([...values.entries()]).toEqual([
      ['tags', 'vip'],
      ['name', 'Tanaka Yuki'],
      ['tags', 'colour'],
      ['tags', 'vip'],
    ])
  })

  it('should hold nothing for no entries', () => {
    // Act, Assert
    expect([...formOfEntries([]).entries()]).toEqual([])
  })

  it('should leave the entries it was given as they are', () => {
    // Arrange
    const entries: [string, string][] = [['name', 'Tanaka Yuki']]

    // Act
    formOfEntries(entries).append('name', 'another')

    // Assert
    expect(entries).toEqual([['name', 'Tanaka Yuki']])
  })
})
