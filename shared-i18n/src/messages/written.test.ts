import { describe, expect, it } from 'vitest'
import { countedIn, followed, joined, listed, postalCodeOf } from './written'

describe('the ways the catalogues write', () => {
  it.each<[number, string]>([
    [0, '0 reviews'],
    [1, '1 review'],
    [2, '2 reviews'],
    [1234, '1,234 reviews'],
  ])('should name %d as English names one and many: %s', (count, expected) => {
    // Act
    const written = countedIn(count, 'review', 'reviews')

    // Assert
    expect(written).toBe(expected)
  })

  it('should join the parts of a line as each language writes them, and what somebody wrote as it is', () => {
    // Act
    const line = joined(['Beauty Salon Tokyo', { en: 'Cut', ja: 'カット' }], {
      en: ' / ',
      ja: '・',
    })

    // Assert
    expect(line).toEqual({
      en: 'Beauty Salon Tokyo / Cut',
      ja: 'Beauty Salon Tokyo・カット',
    })
  })

  it('should list the entries with a comma in English and 「、」 in Japanese', () => {
    // Act
    const list = listed([
      { en: 'Cut', ja: 'カット' },
      { en: 'Color', ja: 'カラー' },
      'アッシュ',
    ])

    // Assert
    expect(list).toEqual({
      en: 'Cut, Color, アッシュ',
      ja: 'カット、カラー、アッシュ',
    })
  })

  it('should say the sentences one after the other, with a space in English and none in Japanese', () => {
    // Act
    const sentences = followed(
      { en: 'It could not be removed.', ja: '削除できませんでした。' },
      { en: 'Try again.', ja: 'もう一度お試しください。' },
    )

    // Assert
    expect(sentences).toEqual({
      en: 'It could not be removed. Try again.',
      ja: '削除できませんでした。もう一度お試しください。',
    })
  })

  it('should write a postal code with its mark in Japanese and as it is in English', () => {
    // Act
    const code = postalCodeOf('150-0001')

    // Assert
    expect(code).toEqual({ en: '150-0001', ja: '〒150-0001' })
  })
})
