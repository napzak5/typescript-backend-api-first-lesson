import { describe, expect, it } from 'vitest'
import {
  afterCategoryRemoval,
  afterCategoryWrite,
  readCategoryChange,
  readCategoryEntry,
  refusesParent,
} from './category-form'
import { aCategory, colouring, highlights } from './components/examples'
import type { CategoryRemoval } from './menu-api'

/** The values of a form, as a browser hands them over */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.append(name, value)
  }
  return values
}

/** The form as it opens with a category: a checkbox that is not checked is not handed over */
const formWith = (
  changes: Record<string, string | undefined> = {},
): FormData => {
  const shown: Record<string, string | undefined> = {
    name: 'カット',
    description: 'シャンプーとブローが付きます。',
    parentId: '',
    category: 'cut',
    displayOrder: '1',
    iconUrl: 'https://icons.example.com/cut.svg',
    color: '#C8A2C8',
    isActive: 'on',
    ...changes,
  }

  return formOf(
    Object.fromEntries(
      Object.entries(shown).flatMap(([name, value]) =>
        value === undefined ? [] : [[name, value]],
      ),
    ),
  )
}

/** A web address of a length */
const addressOf = (length: number): string => {
  const start = 'https://icons.example.com/'

  return `${start}${'a'.repeat(length - start.length)}`
}

describe('readCategoryEntry', () => {
  it('should read a whole category, without the spaces around its texts, and its colour in capitals', () => {
    // Act
    const read = readCategoryEntry(
      formWith({
        name: '  ネイル  ',
        description: '  ハンドとフット  ',
        parentId: colouring().id,
        category: 'other',
        displayOrder: '１２',
        iconUrl: ' https://icons.example.com/nail.svg ',
        color: '#ff6b6b',
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        name: 'ネイル',
        description: 'ハンドとフット',
        parentId: colouring().id,
        category: 'other',
        displayOrder: 12,
        iconUrl: 'https://icons.example.com/nail.svg',
        color: '#FF6B6B',
        isActive: true,
      },
    })
  })

  it('should read what was left blank as nothing, and a box that was not checked as off', () => {
    // Act
    const read = readCategoryEntry(
      formWith({
        description: ' ',
        iconUrl: '',
        color: '',
        isActive: undefined,
      }),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        description: null,
        parentId: null,
        iconUrl: null,
        color: null,
        isActive: false,
      },
    })
  })

  it('should take a name of 100 letters, counted as the API counts them, and an address of 500', () => {
    // Act
    const read = readCategoryEntry(
      formWith({ name: '𠮷'.repeat(100), iconUrl: addressOf(500) }),
    )

    // Assert
    expect(read).toMatchObject({ type: 'valid' })
  })

  it.each<[string, Record<string, string | undefined>, string]>([
    ['no name', { name: '  ' }, 'name'],
    ['a name of 101 letters', { name: 'あ'.repeat(101) }, 'name'],
    ['no kind', { category: '' }, 'category'],
    ['a kind the contract does not name', { category: 'nail' }, 'category'],
    ['no place in the order', { displayOrder: '' }, 'displayOrder'],
    ['a place below 0', { displayOrder: '-1' }, 'displayOrder'],
    ['a place that is not whole', { displayOrder: '1.5' }, 'displayOrder'],
    [
      'an address without its scheme',
      { iconUrl: 'icons.example.com/a.svg' },
      'iconUrl',
    ],
    [
      'an address of another scheme',
      { iconUrl: 'ftp://icons.example.com/a.svg' },
      'iconUrl',
    ],
    ['an address of 501 letters', { iconUrl: addressOf(501) }, 'iconUrl'],
    ['a colour without its sign', { color: 'C8A2C8' }, 'color'],
    ['a colour of three digits', { color: '#FFF' }, 'color'],
    ['a colour that is no number', { color: '#GGGGGG' }, 'color'],
  ])('should refuse %s at its control', (_, changes, control) => {
    // Act
    const read = readCategoryEntry(formWith(changes))

    // Assert
    expect(read.type).toBe('invalid')
    expect(read.type === 'invalid' && Object.keys(read.errors)).toEqual([
      control,
    ])
  })

  it('should say every value that is wrong at once', () => {
    // Act
    const read = readCategoryEntry(
      formWith({ name: '', category: '', displayOrder: 'x', color: 'red' }),
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        name: 'カテゴリーの名前を、100 文字以内で入力してください。',
        category: '種類を選んでください。',
        displayOrder: '表示順は、0 以上の整数で入力してください。',
        color: '色は、#C8A2C8 のように、# と 16 進数 6 桁で入力してください。',
      },
    })
  })
})

describe('readCategoryChange', () => {
  it('should ask for nothing when the form is sent as it was opened', () => {
    expect(readCategoryChange(formWith(), aCategory())).toEqual({
      type: 'unchanged',
    })
  })

  it('should take a colour written in other letters as the same colour', () => {
    expect(
      readCategoryChange(
        formWith({ color: '#c8a2c8' }),
        aCategory({ color: '#c8a2c8' }),
      ),
    ).toEqual({ type: 'unchanged' })
  })

  it('should ask for the values that were changed and nothing else', () => {
    // Act
    const read = readCategoryChange(
      formWith({
        name: 'カット・シェービング',
        parentId: colouring().id,
        displayOrder: '0',
        isActive: undefined,
      }),
      aCategory(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        name: 'カット・シェービング',
        parentId: colouring().id,
        displayOrder: 0,
        isActive: false,
      },
    })
  })

  it('should clear what was emptied, and put a category back at the top', () => {
    // Act
    const read = readCategoryChange(
      formWith({
        name: highlights().name,
        description: '',
        category: 'color',
        displayOrder: '3',
        iconUrl: '',
        color: '',
        isActive: undefined,
      }),
      {
        ...highlights(),
        description: 'ブリーチを含みます。',
        iconUrl: 'https://icons.example.com/h.svg',
      },
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        description: null,
        parentId: null,
        iconUrl: null,
        color: null,
      },
    })
  })

  it('should pass on what is wrong with the form', () => {
    expect(
      readCategoryChange(formWith({ name: '' }), aCategory()),
    ).toMatchObject({ type: 'invalid', errors: { name: expect.any(String) } })
  })
})

describe('afterCategoryWrite', () => {
  it.each<[string, string, string]>([
    [
      'a parent removed meanwhile',
      'not_found',
      'この親カテゴリーは、その間に削除されていました。親を選び直してください。',
    ],
    [
      'a parent that is below the category now',
      'circular',
      'このカテゴリーの下にあるカテゴリーは、親にできません。その間に、親が変わっていました。選び直してください。',
    ],
  ])('should say %s at the parent', (_, rule, error) => {
    // Act
    const said = afterCategoryWrite({
      type: 'invalid',
      values: [{ field: 'parentId', rule }],
    })

    // Assert
    expect(said).toEqual({ message: undefined, errors: { parentId: error } })
  })

  it('should say the values refused at their controls, and say the rest above the form', () => {
    // Act
    const at = afterCategoryWrite({
      type: 'invalid',
      values: [
        { field: 'iconUrl', rule: 'invalid_format' },
        { field: 'description', rule: 'custom' },
      ],
    })
    const above = afterCategoryWrite({
      type: 'invalid',
      values: [{ field: 'salonId', rule: 'invalid_format' }],
    })

    // Assert
    expect(at).toEqual({
      message: undefined,
      errors: {
        iconUrl:
          'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        description:
          'この値は受け付けられませんでした。入力を確かめてください。',
      },
    })
    expect(above).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[string, 'forbidden' | 'tooManyRequests' | 'failed', string]>([
    [
      'an account that may not change the menu',
      'forbidden',
      'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'no answer',
      'failed',
      'カテゴリーを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what came of %s', (_, type, message) => {
    expect(afterCategoryWrite({ type })).toEqual({ message, errors: {} })
  })
})

describe('refusesParent', () => {
  it('should tell a refusal of the parent from others', () => {
    expect([
      refusesParent({
        type: 'invalid',
        values: [
          { field: 'name', rule: 'too_big' },
          { field: 'parentId', rule: 'not_found' },
        ],
      }),
      refusesParent({
        type: 'invalid',
        values: [{ field: 'name', rule: 'too_big' }],
      }),
    ]).toEqual([true, false])
  })
})

describe('afterCategoryRemoval', () => {
  it.each<[string, CategoryRemoval, ReturnType<typeof afterCategoryRemoval>]>([
    [
      'the removal',
      { type: 'removed' },
      {
        type: 'done',
        message: 'カテゴリー「カラー」を、メニューから削除しました。',
      },
    ],
    ['a category removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'an account that may not change the menu',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'カテゴリーを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %s', (_, outcome, said) => {
    expect(afterCategoryRemoval(outcome, 'カラー')).toEqual(said)
  })
})
