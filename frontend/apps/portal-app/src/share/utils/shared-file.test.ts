import type { ModelsAttachmentContentType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { photo } from '../components/examples'
import {
  afterPassword,
  factsOf,
  isImage,
  loadMessageOf,
  readPassword,
  sizeNameOf,
} from './shared-file'

/** What is said at the password when the API did not take it */
const PASSWORD_REFUSED = {
  en: 'The password is wrong, or it cannot be used for 15 minutes after 5 wrong attempts in a row. Check it and enter it again.',
  ja: 'パスワードが違うか、5 回続けて間違えたために、15 分のあいだ使えなくなっています。確かめて、もう一度入力してください。',
}
const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

describe('isImage', () => {
  it.each<[ModelsAttachmentContentType, boolean]>([
    ['image/jpeg', true],
    ['image/png', true],
    ['image/webp', true],
    ['application/pdf', false],
  ])('should say whether %s is shown: %s', (contentType, image) => {
    expect(isImage(contentType)).toBe(image)
  })
})

describe('sizeNameOf', () => {
  it.each<[number, string, string]>([
    [1, '1 byte', '1 バイト'],
    [1023, '1,023 bytes', '1,023 バイト'],
    [1024, '1 kB (1,024 bytes)', '1 KB（1,024 バイト）'],
    [348_160, '340 kB (348,160 bytes)', '340 KB（348,160 バイト）'],
    [
      1024 * 1024 - 1,
      '1,024 kB (1,048,575 bytes)',
      '1,024 KB（1,048,575 バイト）',
    ],
    [1024 * 1024, '1.0 MB (1,048,576 bytes)', '1.0 MB（1,048,576 バイト）'],
    [1_258_291, '1.2 MB (1,258,291 bytes)', '1.2 MB（1,258,291 バイト）'],
    [
      10 * 1024 * 1024,
      '10.0 MB (10,485,760 bytes)',
      '10.0 MB（10,485,760 バイト）',
    ],
  ])('should name %i bytes 「%s」', (size, en, ja) => {
    expect(sizeNameOf(size)).toEqual({ en, ja })
  })
})

describe('factsOf', () => {
  it('should say the kind and the size of the file, and not its name, which is the heading', () => {
    expect(factsOf(photo)).toEqual([
      {
        term: { en: 'Type', ja: '種類' },
        description: { en: 'PNG image', ja: 'PNG 画像' },
      },
      {
        term: { en: 'Size', ja: 'サイズ' },
        description: {
          en: '340 kB (348,160 bytes)',
          ja: '340 KB（348,160 バイト）',
        },
      },
    ])
  })
})

describe('readPassword', () => {
  it.each<[string, string]>([
    ['as it was typed', 'umi no mieru heya'],
    ['with the spaces at its ends, which may be of it', '  umi  '],
    ['of one character, which the API takes to look at', 'x'],
  ])('should send a password %s', (_, password) => {
    expect(readPassword(formOfEntries([['password', password]]))).toEqual({
      type: 'valid',
      value: password,
    })
  })

  it.each<[string, [string, string][]]>([
    ['that is empty', [['password', '']]],
    ['that is not there', []],
  ])(
    'should say at the control that a password %s is missing',
    (_, entries) => {
      expect(readPassword(formOfEntries(entries))).toEqual({
        type: 'invalid',
        errors: {
          password: {
            en: 'Enter the password.',
            ja: 'パスワードを入力してください。',
          },
        },
      })
    },
  )
})

describe('afterPassword', () => {
  it('should say at the password that it is not the one, or that the link is locked, as the API does not say which', () => {
    expect(afterPassword({ type: 'passwordRefused' })).toEqual({
      message: undefined,
      errors: { password: PASSWORD_REFUSED },
    })
  })

  it.each<['tooManyRequests' | 'failed', LocalizedText]>([
    ['tooManyRequests', TOO_MANY_REQUESTS],
    [
      'failed',
      {
        en: 'It could not be sent. Check your connection and try again.',
        ja: '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form what %s means', (type, message) => {
    expect(afterPassword({ type })).toEqual({ message, errors: {} })
  })
})

describe('loadMessageOf', () => {
  it.each<['tooManyRequests' | 'failed' | 'notFetched', LocalizedText]>([
    ['tooManyRequests', TOO_MANY_REQUESTS],
    [
      'failed',
      {
        en: 'The file could not be loaded. Check your connection and try again.',
        ja: 'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
    [
      'notFetched',
      {
        en: 'The file could not be loaded. The download was counted. Loading it again counts as another.',
        ja: 'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
      },
    ],
  ])('should say what %s means for the file', (type, message) => {
    expect(loadMessageOf({ type })).toEqual(message)
  })
})
