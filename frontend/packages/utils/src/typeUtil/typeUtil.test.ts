import { describe, expect, it } from 'vitest'
import {
  isArray,
  isEmpty,
  isEmptyArray,
  isEmptyMap,
  isEmptyObject,
  isEmptySet,
  isEmptyString,
  isJSONData,
  isMap,
  isMinusNumber,
  isNanValue,
  isNull,
  isNullOrUndefined,
  isNumber,
  isObject,
  isPlainObject,
  isSet,
  isUndefined,
  JsonSchema,
} from './typeUtil'

class Customer {
  name = 'Hanako'
}

const objectWithoutPrototype: object = Object.create(null)

describe('isArray', () => {
  it.each([
    { label: 'an empty array', data: [] },
    { label: 'an array with items', data: [1, 'two'] },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isArray(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'an array-like object', data: { length: 0 } },
    { label: 'a string', data: 'abc' },
    { label: 'a Set', data: new Set([1]) },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isArray(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isObject', () => {
  it.each([
    { label: 'an empty object', data: {} },
    { label: 'an object with keys', data: { id: 1 } },
    { label: 'an object without a prototype', data: objectWithoutPrototype },
    { label: 'a class instance', data: new Customer() },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isObject(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
    { label: 'an array', data: [] },
    { label: 'a Map', data: new Map() },
    { label: 'a Set', data: new Set() },
    { label: 'a string', data: 'abc' },
    { label: 'a number', data: 1 },
    { label: 'a function', data: () => undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isObject(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isPlainObject', () => {
  it.each([
    { label: 'an empty object', data: {} },
    { label: 'an object with keys', data: { id: 1 } },
    { label: 'an object without a prototype', data: objectWithoutPrototype },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isPlainObject(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
    { label: 'an array', data: [] },
    { label: 'a Map', data: new Map() },
    { label: 'a Set', data: new Set() },
    { label: 'a Date', data: new Date(0) },
    { label: 'a class instance', data: new Customer() },
    { label: 'a string', data: 'abc' },
    { label: 'a function', data: () => undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isPlainObject(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isNullOrUndefined', () => {
  it.each([
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
    { label: "the string 'null'", data: 'null' },
    { label: "the string 'undefined'", data: 'undefined' },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isNullOrUndefined(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'zero', data: 0 },
    { label: 'an empty string', data: '' },
    { label: 'false', data: false },
    { label: 'NaN', data: Number.NaN },
    { label: 'an empty object', data: {} },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isNullOrUndefined(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isUndefined', () => {
  it('should return true for undefined', () => {
    // Act
    const result = isUndefined(undefined)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'null', data: null },
    { label: "the string 'undefined'", data: 'undefined' },
    { label: 'zero', data: 0 },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isUndefined(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isNull', () => {
  it('should return true for null', () => {
    // Act
    const result = isNull(null)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'undefined', data: undefined },
    { label: "the string 'null'", data: 'null' },
    { label: 'zero', data: 0 },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isNull(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isMap', () => {
  it('should return true for a Map', () => {
    // Act
    const result = isMap(new Map([['id', 1]]))

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a Set', data: new Set() },
    { label: 'an object', data: {} },
    { label: 'an array of entries', data: [['id', 1]] },
    { label: 'null', data: null },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isMap(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isSet', () => {
  it('should return true for a Set', () => {
    // Act
    const result = isSet(new Set([1]))

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a Map', data: new Map() },
    { label: 'an array', data: [1] },
    { label: 'an object', data: {} },
    { label: 'null', data: null },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isSet(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmptyString', () => {
  it('should return true for an empty string', () => {
    // Act
    const result = isEmptyString('')

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a whitespace string', data: ' ' },
    { label: 'a non-empty string', data: 'abc' },
    { label: 'an empty array', data: [] },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmptyString(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmptyArray', () => {
  it('should return true for an empty array', () => {
    // Act
    const result = isEmptyArray([])

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'an array that holds undefined', data: [undefined] },
    { label: 'an empty string', data: '' },
    { label: 'an empty object', data: {} },
    { label: 'null', data: null },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmptyArray(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmptyObject', () => {
  it('should return true for an object without keys', () => {
    // Act
    const result = isEmptyObject({})

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    {
      label: 'an object whose only value is undefined',
      data: { id: undefined },
    },
    { label: 'an empty array', data: [] },
    { label: 'an empty Map', data: new Map() },
    { label: 'an empty Set', data: new Set() },
    { label: 'null', data: null },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmptyObject(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmptyMap', () => {
  it('should return true for a Map without entries', () => {
    // Act
    const result = isEmptyMap(new Map())

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a Map with an entry', data: new Map([['id', 1]]) },
    { label: 'an empty Set', data: new Set() },
    { label: 'an empty object', data: {} },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmptyMap(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmptySet', () => {
  it('should return true for a Set without values', () => {
    // Act
    const result = isEmptySet(new Set())

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a Set with a value', data: new Set([1]) },
    { label: 'an empty Map', data: new Map() },
    { label: 'an empty array', data: [] },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmptySet(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isNanValue', () => {
  it.each([
    { label: 'NaN', data: Number.NaN },
    { label: "the string 'NaN'", data: 'NaN' },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isNanValue(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'zero', data: 0 },
    { label: 'a non-numeric string', data: 'abc' },
    { label: 'undefined', data: undefined },
    { label: 'an object', data: {} },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isNanValue(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isNumber', () => {
  it.each([
    { label: 'zero', data: 0 },
    { label: 'a negative integer', data: -1 },
    { label: 'a decimal', data: 1.5 },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isNumber(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'NaN', data: Number.NaN },
    { label: 'a numeric string', data: '1' },
    { label: 'a bigint', data: 1n },
    { label: 'null', data: null },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isNumber(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isMinusNumber', () => {
  it.each([
    { label: 'a negative integer', data: -1 },
    { label: 'a negative decimal', data: -0.5 },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isMinusNumber(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'zero', data: 0 },
    { label: 'negative zero', data: -0 },
    { label: 'a positive number', data: 1 },
    { label: 'NaN', data: Number.NaN },
    { label: 'a negative numeric string', data: '-1' },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isMinusNumber(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isEmpty', () => {
  it.each([
    { label: 'an empty string', data: '' },
    { label: 'an empty array', data: [] },
    { label: 'an empty object', data: {} },
    { label: 'an empty Map', data: new Map() },
    { label: 'an empty Set', data: new Set() },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isEmpty(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a whitespace string', data: ' ' },
    { label: 'an array with an item', data: [0] },
    { label: 'an object with a key', data: { id: 1 } },
    { label: 'a Map with an entry', data: new Map([['id', 1]]) },
    { label: 'a Set with a value', data: new Set([1]) },
    { label: 'zero', data: 0 },
    { label: 'false', data: false },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isEmpty(data)

    // Assert
    expect(result).toBe(false)
  })
})

describe('JsonSchema', () => {
  it('should accept nested JSON values', () => {
    // Arrange
    const data = { id: 1, tags: ['cut', null], owner: { active: true } }

    // Act
    const result = JsonSchema.safeParse(data)

    // Assert
    expect(result.success).toBe(true)
  })

  it.each([
    { label: 'undefined', data: undefined },
    { label: 'a function', data: () => undefined },
    { label: 'an object that holds undefined', data: { id: undefined } },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = JsonSchema.safeParse(data)

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('isJSONData', () => {
  it.each([
    { label: 'null', data: null },
    { label: 'a string', data: 'abc' },
    { label: 'a number', data: 1.5 },
    { label: 'a boolean', data: false },
    { label: 'an empty array', data: [] },
    { label: 'an empty object', data: {} },
    {
      label: 'a nested structure of JSON values',
      data: { id: 1, tags: ['cut', null], owner: { active: true } },
    },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = isJSONData(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'undefined', data: undefined },
    { label: 'a function', data: () => undefined },
    { label: 'a symbol', data: Symbol('id') },
    { label: 'a bigint', data: 1n },
    { label: 'NaN', data: Number.NaN },
    { label: 'Infinity', data: Number.POSITIVE_INFINITY },
    { label: 'a Date', data: new Date(0) },
    { label: 'a RegExp', data: /abc/ },
    { label: 'a Map', data: new Map() },
    { label: 'a Set', data: new Set() },
    { label: 'a Promise', data: Promise.resolve(1) },
    { label: 'a class instance', data: new Customer() },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = isJSONData(data)

    // Assert
    expect(result).toBe(false)
  })

  it.each([
    { label: 'undefined', data: { id: undefined } },
    { label: 'a function', data: { run: () => undefined } },
    { label: 'a Date', data: { createdAt: new Date(0) } },
    { label: 'NaN', data: { total: Number.NaN } },
    { label: 'a Map inside an array', data: [new Map()] },
  ])('should return false for a structure that holds $label', ({ data }) => {
    // Act
    const result = isJSONData(data)

    // Assert
    expect(result).toBe(false)
  })
})
