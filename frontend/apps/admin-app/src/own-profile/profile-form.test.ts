import { describe, expect, it } from 'vitest'
import { aProfile } from './components/examples'
import { afterProfileSave, readProfileChange } from './profile-form'

/** A form sent with the values of the introduction, the others as the profile has them. */
const formWith = (values: Record<string, string>): FormData => {
  const form = new FormData()
  const all: Record<string, string> = {
    specialties: 'カット、カラー',
    certifications: '美容師免許',
    yearsOfExperience: '8',
    bio: 'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
    imageUrl: 'https://photos.example.com/staff/misaki.jpg',
    ...values,
  }
  for (const [name, value] of Object.entries(all)) {
    form.set(name, value)
  }

  return form
}

describe('readProfileChange', () => {
  it('should ask for nothing when the form is sent as it was opened', () => {
    // Act
    const read = readProfileChange(formWith({}), aProfile())

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should take the spaces around a value and the separators of a list as they were', () => {
    // Arrange: another client stored the introduction with a line break after it
    const bio = '指名のお客様が多いです。\n'

    // Act
    const read = readProfileChange(
      formWith({ specialties: ' カット , カラー ', bio }),
      aProfile({ bio }),
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should take a control of spaces alone as nothing written', () => {
    // Act
    const read = readProfileChange(
      formWith({ bio: '  ' }),
      aProfile({ bio: null }),
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should send only what was changed, an emptied text as null and an emptied list as none', () => {
    // Act
    const read = readProfileChange(
      formWith({
        certifications: '',
        yearsOfExperience: '',
        bio: '指名のお客様が多いです。',
      }),
      aProfile(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        certifications: [],
        yearsOfExperience: null,
        bio: '指名のお客様が多いです。',
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'more than 100 years',
      { yearsOfExperience: '101' },
      {
        yearsOfExperience:
          '経験年数は、0 から 100 までの整数で入力してください。',
      },
    ],
    [
      'a part of a year',
      { yearsOfExperience: '2.5' },
      {
        yearsOfExperience:
          '経験年数は、0 から 100 までの整数で入力してください。',
      },
    ],
    [
      'an address that is no web address',
      { imageUrl: 'ftp://photos.example.com/misaki.jpg' },
      {
        imageUrl:
          'http:// か https:// で始まる URL を、500 文字までで入力してください。',
      },
    ],
    [
      'an address of more than 500 letters',
      { imageUrl: `https://photos.example.com/${'a'.repeat(474)}` },
      {
        imageUrl:
          'http:// か https:// で始まる URL を、500 文字までで入力してください。',
      },
    ],
  ])('should say at the control what is wrong with %s', (_, values, errors) => {
    // Act
    const read = readProfileChange(formWith(values), aProfile())

    // Assert
    expect(read).toEqual({ type: 'invalid', errors })
  })

  it('should take an address of 500 letters', () => {
    // Arrange
    const imageUrl = `https://photos.example.com/${'a'.repeat(473)}`

    // Act
    const read = readProfileChange(formWith({ imageUrl }), aProfile())

    // Assert
    expect(imageUrl).toHaveLength(500)
    expect(read).toEqual({ type: 'valid', value: { imageUrl } })
  })
})

describe('afterProfileSave', () => {
  it('should say a refusal of an entry of a list at the control of the list', () => {
    // Act
    const said = afterProfileSave({
      type: 'invalid',
      values: [
        { field: 'specialties.1', rule: 'too_big' },
        { field: 'imageUrl', rule: 'invalid_format' },
      ],
    })

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: {
        specialties:
          'この値は受け付けられませんでした。入力を確かめてください。',
        imageUrl:
          'http:// か https:// で始まる URL を、500 文字までで入力してください。',
      },
    })
  })

  it.each<[string, Parameters<typeof afterProfileSave>[0], string]>([
    [
      'a refusal of a value the form does not have',
      {
        type: 'invalid',
        values: [{ field: 'displayName', rule: 'unrecognized_keys' }],
      },
      '入力した内容を確かめて、もう一度お試しください。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。',
    ],
    ['no answer', { type: 'failed' }, 'プロフィールを保存できませんでした。'],
  ])(
    'should say above the form what went wrong after %s',
    (_, outcome, message) => {
      // Act
      const said = afterProfileSave(outcome)

      // Assert
      expect(said).toEqual({
        message: expect.stringContaining(message),
        errors: {},
      })
    },
  )
})
