import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { termMessages } from '../ui/terms'
import { adminMenuMessages } from './index'

const { bulk, categories, inALine, serviceForm, services, words } =
  adminMenuMessages

/** Amounts, as the formats write them */
const DISCOUNT = { en: '¥7,200', ja: '￥7,200' }
const PRICE = { en: '¥8,000', ja: '￥8,000' }

/** A category, by the name the salon gave it */
const HAIR_CUT = { en: 'Hair Cut', ja: 'Hair Cut' }

/** Two packages, by the names the salon gave them */
const PACKAGES = ['Cut & Color', 'Cut & Perm']

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminMenuMessages.words.levelOrAbove',
    words.levelOrAbove(termMessages.staffLevel.senior),
    { en: 'Senior or above', ja: 'シニア以上' },
  ],
  [
    'adminMenuMessages.words.upTo',
    words.upTo(1000),
    { en: 'Up to 1,000', ja: '1,000 まで' },
  ],
  [
    'adminMenuMessages.inALine',
    inALine([words.inactive, adminMenuMessages.serviceStatus.coming_soon]),
    { en: 'Inactive · Coming soon', ja: '無効・近日公開' },
  ],
  [
    'adminMenuMessages.categories.form.nameDescription',
    categories.form.nameDescription(100),
    {
      en: 'Up to 100 characters. It heads its part of the menu the customers see.',
      ja: '100 文字まで。お客様のメニューの見出しになります。',
    },
  ],
  [
    'adminMenuMessages.categories.added',
    categories.added('Bob Cut'),
    {
      en: 'Added the category “Bob Cut” to the menu.',
      ja: 'カテゴリー「Bob Cut」を、メニューに足しました。',
    },
  ],
  [
    'adminMenuMessages.categories.changed',
    categories.changed('Bob Cut'),
    {
      en: 'Saved the category “Bob Cut”.',
      ja: 'カテゴリー「Bob Cut」を直しました。',
    },
  ],
  [
    'adminMenuMessages.categories.removal.confirm',
    categories.removal.confirm('Bob Cut'),
    {
      en: 'Remove the category “Bob Cut”?',
      ja: 'カテゴリー「Bob Cut」を削除しますか？',
    },
  ],
  [
    'adminMenuMessages.categories.removal.done',
    categories.removal.done('Bob Cut'),
    {
      en: 'Removed the category “Bob Cut” from the menu.',
      ja: 'カテゴリー「Bob Cut」を、メニューから削除しました。',
    },
  ],
  [
    'adminMenuMessages.services.price.discounted',
    services.price.discounted(DISCOUNT, PRICE),
    {
      en: '¥7,200 (discounted from ¥8,000)',
      ja: '￥7,200（￥8,000 から割引）',
    },
  ],
  [
    'adminMenuMessages.services.choiceOf',
    services.choiceOf('Ladies Cut', HAIR_CUT),
    { en: 'Ladies Cut (Hair Cut)', ja: 'Ladies Cut（Hair Cut）' },
  ],
  [
    'adminMenuMessages.services.record.bookingsOf',
    services.record.bookingsOf(1),
    { en: '1 booking', ja: '1 件' },
  ],
  [
    'adminMenuMessages.services.added',
    services.added('Bangs Trim'),
    {
      en: 'Added the service “Bangs Trim” to the menu.',
      ja: 'サービス「Bangs Trim」を、メニューに足しました。',
    },
  ],
  [
    'adminMenuMessages.services.changed',
    services.changed('Bangs Trim'),
    {
      en: 'Saved the service “Bangs Trim”.',
      ja: 'サービス「Bangs Trim」を直しました。',
    },
  ],
  [
    'adminMenuMessages.services.removal.confirm',
    services.removal.confirm('Bangs Trim'),
    {
      en: 'Remove the service “Bangs Trim”?',
      ja: 'サービス「Bangs Trim」を削除しますか？',
    },
  ],
  [
    'adminMenuMessages.services.removal.done',
    services.removal.done('Bangs Trim'),
    {
      en: 'Removed the service “Bangs Trim” from the menu.',
      ja: 'サービス「Bangs Trim」を、メニューから削除しました。',
    },
  ],
  [
    'adminMenuMessages.services.removal.inUse',
    services.removal.inUse('Ladies Cut', PACKAGES),
    {
      en: 'The service “Ladies Cut” is in the packages “Cut & Color”, “Cut & Perm”, so it cannot be removed. Take it out of the packaged services first.',
      ja: 'サービス「Ladies Cut」は、パッケージ「Cut & Color」「Cut & Perm」に入っているので、削除できません。先に、パッケージの構成サービスから外してください。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.nameDescription',
    serviceForm.nameDescription(255),
    {
      en: 'Up to 255 characters. It appears on the menu the customers see.',
      ja: '255 文字まで。お客様のメニューに出ます。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.shortDescriptionDescription',
    serviceForm.shortDescriptionDescription(500),
    {
      en: 'Up to 500 characters. It appears in the list of the menu.',
      ja: '500 文字まで。メニューの一覧に出ます。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.durationDescription',
    serviceForm.durationDescription(1440),
    {
      en: 'A whole number from 1 to 1,440.',
      ja: '1 から 1,440 までの整数。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.inPackages',
    serviceForm.inPackages(PACKAGES),
    {
      en: 'This service is in the packages “Cut & Color”, “Cut & Perm”, so it cannot be a package.',
      ja: 'このサービスは、パッケージ「Cut & Color」「Cut & Perm」に入っているので、パッケージにできません。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.makePackageDescription',
    serviceForm.makePackageDescription(2, 20),
    {
      en: 'Puts 2 to 20 other services together as one service. Only services that are not packages can be put in a package.',
      ja: 'ほかのサービスを 2 件から 20 件まとめて、1 つのサービスにします。パッケージに入れられるのは、パッケージでないサービスです。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.packaged',
    serviceForm.packaged(1),
    { en: 'Packaged service 1', ja: '構成サービス 1' },
  ],
  [
    'adminMenuMessages.serviceForm.removePackaged',
    serviceForm.removePackaged(1),
    { en: 'Remove packaged service 1', ja: '構成サービス 1 を外す' },
  ],
  [
    'adminMenuMessages.serviceForm.option',
    serviceForm.option(2),
    { en: 'Option 2', ja: 'オプション 2' },
  ],
  [
    'adminMenuMessages.serviceForm.removeOption',
    serviceForm.removeOption(2),
    { en: 'Remove option 2', ja: 'オプション 2 を外す' },
  ],
  [
    'adminMenuMessages.serviceForm.errors.duration',
    serviceForm.errors.duration(1440),
    {
      en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
      ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
    },
  ],
  [
    'adminMenuMessages.serviceForm.errors.packagedCount',
    serviceForm.errors.packagedCount(2, 20),
    {
      en: 'Choose 2 to 20 packaged services for a package.',
      ja: 'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
    },
  ],
  [
    'adminMenuMessages.bulk.chosenDescription',
    bulk.chosenDescription(100),
    {
      en: 'In the order of the menu, each with its category. 1 to 100.',
      ja: 'メニューの順。名前のあとは、カテゴリーです。1 件から 100 件まで。',
    },
  ],
  [
    'adminMenuMessages.bulk.errors.tooManyServices',
    bulk.errors.tooManyServices(100),
    {
      en: 'Up to 100 services can be changed at once.',
      ja: '一度に変えられるサービスは、100 件までです。',
    },
  ],
  [
    'adminMenuMessages.bulk.changed',
    bulk.changed(1),
    { en: 'Changed 1 service.', ja: '1 件のサービスを変えました。' },
  ],
]

describe('the messages of the menu of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminMenuMessages }, '').made.toSorted(),
    )
  })

  it('should name one package of a service in the singular', () => {
    // Assert
    expect(services.removal.inUse('Head Spa', ['Spa & Cut Package']).en).toBe(
      'The service “Head Spa” is in the package “Spa & Cut Package”, so it cannot be removed. Take it out of the packaged services first.',
    )
    expect(serviceForm.inPackages(['Spa & Cut Package']).en).toBe(
      'This service is in the package “Spa & Cut Package”, so it cannot be a package.',
    )
  })

  it('should say that a service no package has is in bookings that are not finished', () => {
    // Assert
    expect(services.removal.inUse('Ladies Cut', [])).toEqual({
      en: 'The service “Ladies Cut” is on the lines of bookings that are not finished, so it cannot be removed. Finish or cancel those bookings, or take the lines off them, then remove it.',
      ja: 'サービス「Ladies Cut」は、終わっていない予約の施術明細にあるので、削除できません。その予約を終えるか、キャンセルするか、明細を外してから削除してください。',
    })
  })

  it('should count several services and bookings in the plural', () => {
    // Assert
    expect([bulk.changed(3), services.record.bookingsOf(4)]).toEqual([
      { en: 'Changed 3 services.', ja: '3 件のサービスを変えました。' },
      { en: '4 bookings', ja: '4 件' },
    ])
  })
})
