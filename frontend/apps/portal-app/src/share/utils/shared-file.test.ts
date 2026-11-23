import type { ModelsAttachmentContentType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { photo } from '../components/examples'
import {
  afterPassword,
  contentTypeNameOf,
  factsOf,
  isImage,
  loadMessageOf,
  readPassword,
  sizeNameOf,
} from './shared-file'

describe('contentTypeNameOf and isImage', () => {
  it.each<[ModelsAttachmentContentType, string, boolean]>([
    ['image/jpeg', 'JPEG 画像', true],
    ['image/png', 'PNG 画像', true],
    ['image/webp', 'WebP 画像', true],
    ['application/pdf', 'PDF', false],
  ])('should name %s 「%s」', (contentType, name, image) => {
    expect(contentTypeNameOf(contentType)).toBe(name)
    expect(isImage(contentType)).toBe(image)
  })
})

describe('sizeNameOf', () => {
  it.each<[number, string]>([
    [1, '1 バイト'],
    [1023, '1,023 バイト'],
    [1024, '1 KB（1,024 バイト）'],
    [348_160, '340 KB（348,160 バイト）'],
    [1024 * 1024 - 1, '1,024 KB（1,048,575 バイト）'],
    [1024 * 1024, '1.0 MB（1,048,576 バイト）'],
    [1_258_291, '1.2 MB（1,258,291 バイト）'],
    [10 * 1024 * 1024, '10.0 MB（10,485,760 バイト）'],
  ])('should name %i bytes 「%s」', (size, name) => {
    expect(sizeNameOf(size)).toBe(name)
  })
})

describe('factsOf', () => {
  it('should say the kind and the size of the file, and not its name, which is the heading', () => {
    expect(factsOf(photo)).toEqual([
      { term: '種類', description: 'PNG 画像' },
      { term: 'サイズ', description: '340 KB（348,160 バイト）' },
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
        errors: { password: 'パスワードを入力してください。' },
      })
    },
  )
})

describe('afterPassword', () => {
  it('should say at the password that it is not the one, or that the link is locked, as the API does not say which', () => {
    expect(afterPassword({ type: 'passwordRefused' })).toEqual({
      message: undefined,
      errors: {
        password:
          'パスワードが違うか、5 回続けて間違えたために、15 分のあいだ使えなくなっています。確かめて、もう一度入力してください。',
      },
    })
  })

  it.each<['tooManyRequests' | 'failed', string]>([
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what %s means', (type, message) => {
    expect(afterPassword({ type })).toEqual({ message, errors: {} })
  })
})

describe('loadMessageOf', () => {
  it.each<['tooManyRequests' | 'failed' | 'notFetched', string]>([
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'notFetched',
      'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
    ],
  ])('should say what %s means for the file', (type, message) => {
    expect(loadMessageOf({ type })).toBe(message)
  })
})
