import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../languages/localized-text'
import {
  amountOf,
  bytesOf,
  currencyNameOf,
  type Decimals,
  fileSizeOf,
  numberOf,
  percentOf,
  shortAmountOf,
} from './numbers'

describe('numberOf', () => {
  it.each<[number, Decimals | undefined, LocalizedText]>([
    [1234567, undefined, { en: '1,234,567', ja: '1,234,567' }],
    [-1234, undefined, { en: '-1,234', ja: '-1,234' }],
    [0, undefined, { en: '0', ja: '0' }],
    [12.34567, undefined, { en: '12.346', ja: '12.346' }],
    [12.345, { most: 2 }, { en: '12.35', ja: '12.35' }],
    [12, { most: 2 }, { en: '12', ja: '12' }],
    [72.25, { most: 1 }, { en: '72.3', ja: '72.3' }],
    [40, { most: 1, least: 1 }, { en: '40.0', ja: '40.0' }],
    [1234.5, { most: 1, least: 1 }, { en: '1,234.5', ja: '1,234.5' }],
  ])(
    'should write %d with %o decimals in each language',
    (value, decimals, expected) => {
      // Act
      const written = numberOf(value, decimals)

      // Assert
      expect(written).toEqual(expected)
    },
  )

  it('should write a big integer to its last digit', () => {
    // Act
    const written = numberOf(214_748_364_749n)

    // Assert
    expect(written).toEqual({ en: '214,748,364,749', ja: '214,748,364,749' })
  })
})

describe('percentOf', () => {
  it.each<[number, Decimals | undefined, LocalizedText]>([
    [12.5, undefined, { en: '12.5%', ja: '12.5%' }],
    [12.345, { most: 2 }, { en: '12.35%', ja: '12.35%' }],
    [40, { most: 1, least: 1 }, { en: '40.0%', ja: '40.0%' }],
    [1250, { most: 1 }, { en: '1,250%', ja: '1,250%' }],
  ])(
    'should write %d percent with %o decimals in each language',
    (percentage, decimals, expected) => {
      // Act
      const written = percentOf(percentage, decimals)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})

describe('amountOf', () => {
  it.each<[number, string, LocalizedText]>([
    [5500, 'JPY', { en: '¥5,500', ja: '￥5,500' }],
    [0, 'JPY', { en: '¥0', ja: '￥0' }],
    [-1200, 'JPY', { en: '-¥1,200', ja: '-￥1,200' }],
    [55, 'USD', { en: '$55.00', ja: '$55.00' }],
    [12.5, 'EUR', { en: '€12.50', ja: '€12.50' }],
  ])(
    'should write %d in %s with the sign and the decimals of the currency',
    (amount, currency, expected) => {
      // Act
      const written = amountOf(amount, currency)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})

describe('shortAmountOf', () => {
  it.each<[number, LocalizedText]>([
    [25000, { en: '¥25K', ja: '￥2.5万' }],
    [1200000, { en: '¥1.2M', ja: '￥120万' }],
    [300000000, { en: '¥300M', ja: '￥3億' }],
  ])('should write %d in a few characters', (amount, expected) => {
    // Act
    const written = shortAmountOf(amount, 'JPY')

    // Assert
    expect(written).toEqual(expected)
  })
})

describe('currencyNameOf', () => {
  it.each<[string, LocalizedText]>([
    ['JPY', { en: 'Japanese Yen', ja: '日本円' }],
    ['USD', { en: 'US Dollar', ja: '米ドル' }],
  ])('should name %s in each language', (currency, expected) => {
    // Act
    const name = currencyNameOf(currency)

    // Assert
    expect(name).toEqual(expected)
  })

  it('should name a currency that no language has a name for by its code', () => {
    // Act
    const name = currencyNameOf('XYZ')

    // Assert
    expect(name).toEqual({ en: 'XYZ', ja: 'XYZ' })
  })
})

describe('the sizes of files', () => {
  it.each<[number, LocalizedText]>([
    [0, { en: '0 bytes', ja: '0 バイト' }],
    [1, { en: '1 byte', ja: '1 バイト' }],
    [1023, { en: '1,023 bytes', ja: '1,023 バイト' }],
    [1_258_291, { en: '1,258,291 bytes', ja: '1,258,291 バイト' }],
  ])('should write %d bytes to the last byte', (size, expected) => {
    // Act
    const written = bytesOf(size)

    // Assert
    expect(written).toEqual(expected)
  })

  it.each<[number, LocalizedText]>([
    [512, { en: '512 bytes', ja: '512 バイト' }],
    [1023, { en: '1,023 bytes', ja: '1,023 バイト' }],
    [1024, { en: '1 kB', ja: '1 KB' }],
    [348_160, { en: '340 kB', ja: '340 KB' }],
    [1_048_064, { en: '1,024 kB', ja: '1,024 KB' }],
    [1_048_575, { en: '1,024 kB', ja: '1,024 KB' }],
    [1_048_576, { en: '1.0 MB', ja: '1.0 MB' }],
    [1_258_291, { en: '1.2 MB', ja: '1.2 MB' }],
    [1_310_720, { en: '1.3 MB', ja: '1.3 MB' }],
    [10_485_760, { en: '10.0 MB', ja: '10.0 MB' }],
    [2_147_483_648, { en: '2,048.0 MB', ja: '2,048.0 MB' }],
  ])('should write %d bytes as they are read at a glance', (size, expected) => {
    // Act
    const written = fileSizeOf(size)

    // Assert
    expect(written).toEqual(expected)
  })
})
