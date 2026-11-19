import { afterEach, describe, expect, it } from 'vitest'
import { findAccessibilityViolations } from './accessibility'
import { itShouldBeAccessibleInEveryStory } from './story-accessibility'

const show = (html: string): void => {
  document.body.innerHTML = `<main>${html}</main>`
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('findAccessibilityViolations', () => {
  it('should find nothing in markup that names its controls', async () => {
    // Arrange
    show(
      '<h1>予約</h1><label for="name">お名前</label><input id="name" /><button type="button">予約する</button>',
    )

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })

  it('should report the rule and the element of a button without a name', async () => {
    // Arrange
    show('<button type="button"></button>')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([
      {
        rule: 'button-name',
        impact: 'critical',
        help: 'Buttons must have discernible text',
        elements: ['<button type="button"></button>'],
      },
    ])
  })

  it('should report an input without a label', async () => {
    // Arrange
    show('<input type="text" />')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations.map(({ rule }) => rule)).toEqual(['label'])
  })

  it('should check only the element it is given', async () => {
    // Arrange
    show(
      '<section id="good"><button type="button">閉じる</button></section><button type="button"></button>',
    )
    const section = document.querySelector('#good') ?? undefined

    // Act
    const violations = await findAccessibilityViolations(section)

    // Assert
    expect(violations).toEqual([])
  })

  it('should not judge colour contrast, which jsdom cannot paint', async () => {
    // Arrange
    show('<p style="color: #fff; background-color: #fff">見えない文字</p>')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})

describe('itShouldBeAccessibleInEveryStory', () => {
  itShouldBeAccessibleInEveryStory({
    Labelled: {
      run: async () => {
        show('<button type="button">保存する</button>')
      },
    },
  })
})
