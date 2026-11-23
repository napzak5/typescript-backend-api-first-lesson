import type { ModelsCustomerCreateRequest } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  afterRegistration,
  type CustomerFileRead,
  type FileCustomer,
  type FileProblem,
  problemTextOf,
  type RegistrationAttempt,
  type RegistrationSays,
  readCustomerFile,
  rowsOfCsv,
  textOfFile,
} from './customer-file'

const TODAY = '2026-11-20'

/** The labels of the columns the problems name */
const EMAIL = { en: 'Email address', ja: 'メールアドレス' }
const REFERRAL_CODE = { en: 'Referral code', ja: '紹介コード' }

const EMAIL_TAKEN = {
  en: 'A customer with this email address is already in the ledger. Find them in the ledger, and take the row of this customer out of the file.',
  ja: 'このメールアドレスのお客様が、もう台帳にいます。台帳で探して、このお客様の行を外してください。',
}
const REFERRAL_CODE_TAKEN = {
  en: 'Another customer uses this referral code (customers removed from the ledger included). Write another code.',
  ja: 'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを書いてください。',
}
const OVERLAP = {
  en: 'An email address or a referral code of the file is one of a customer of the ledger. Check the file.',
  ja: '台帳のお客様と、メールアドレスか紹介コードが重なっています。ファイルを確かめてください。',
}

/** A customer as the form of a registration makes one with nothing but the needed values */
const BARE: ModelsCustomerCreateRequest = {
  lastName: '山田',
  firstName: '花子',
  lastNameKana: null,
  firstNameKana: null,
  email: 'hanako@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
}

const NEEDED = 'lastName,firstName,email,phoneNumber'

const lines = (...rows: string[]): string =>
  rows.map((row) => `${row}\r\n`).join('')

const problemsOf = (read: CustomerFileRead): FileProblem[] =>
  read.type === 'invalid' ? read.problems : []

describe('rowsOfCsv', () => {
  it.each<[string, string, string[][]]>([
    [
      'values separated by commas, lines by CRLF',
      'a,b\r\nc,d\r\n',
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
    ],
    [
      'lines ended by LF, and the last by nothing',
      'a,b\nc,d',
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
    ],
    ['lines ended by CR', 'a\rb\r', [['a'], ['b']]],
    [
      'a quoted value with a comma, a line end and a doubled double quote',
      '"山田, 花子","1行目\r\n2行目","say ""hi"""\r\n',
      [['山田, 花子', '1行目\r\n2行目', 'say "hi"']],
    ],
    ['empty values, and an empty quoted one', ',"",\r\n', [['', '', '']]],
    ['an empty line, kept as a row', 'a\r\n\r\nb\r\n', [['a'], [''], ['b']]],
    [
      'a double quote inside an unquoted value, taken as it is',
      'a"b,c\r\n',
      [['a"b', 'c']],
    ],
    ['nothing', '', []],
  ])('should read %s', (_, text, rows) => {
    // Act
    const read = rowsOfCsv(text)

    // Assert
    expect(read).toEqual({ type: 'rows', rows })
  })

  it('should name the row where a quoted value begins and never ends', () => {
    // Act
    const read = rowsOfCsv('a,b\r\nc,"d\r\ne\r\n')

    // Assert
    expect(read).toEqual({ type: 'unclosed', row: 2 })
  })
})

describe('textOfFile', () => {
  it('should read UTF-8 and leave out the mark of the byte order', () => {
    // Arrange
    const bytes = new TextEncoder().encode(
      '﻿lastName,firstName\r\n山田,花子\r\n',
    )

    // Act
    const text = textOfFile(bytes.buffer)

    // Assert
    expect(text).toBe('lastName,firstName\r\n山田,花子\r\n')
  })

  it('should read Shift_JIS, as spreadsheets in Japan save CSV', () => {
    // Arrange: 「山田,花子」 in Shift_JIS
    const bytes = new Uint8Array([
      0x8e, 0x52, 0x93, 0x63, 0x2c, 0x89, 0xd4, 0x8e, 0x71,
    ])

    // Act
    const text = textOfFile(bytes.buffer)

    // Assert
    expect(text).toBe('山田,花子')
  })
})

describe('problemTextOf', () => {
  const WRONG = { en: 'Wrong.', ja: '誤り。' }

  it.each<[string, FileProblem, LocalizedText]>([
    [
      'a value',
      { row: 3, column: EMAIL, message: WRONG },
      {
        en: 'Row 3, Email address: Wrong.',
        ja: '3 行目 メールアドレス: 誤り。',
      },
    ],
    [
      'a row',
      { row: 4, column: null, message: WRONG },
      { en: 'Row 4: Wrong.', ja: '4 行目: 誤り。' },
    ],
    ['the file', { row: null, column: null, message: WRONG }, WRONG],
  ])('should say where a problem of %s is', (_, problem, text) => {
    // Act
    const said = problemTextOf(problem)

    // Assert
    expect(said).toEqual(text)
  })
})

describe('readCustomerFile', () => {
  it('should read a file as the ledger exports it: every column, quoted JSON, and the quote before a formula', async () => {
    // Arrange
    const header =
      'id,userId,firstName,lastName,firstNameKana,lastNameKana,email,phoneNumber,alternativePhone,postalCode,prefecture,city,address,building,birthDate,gender,occupation,membershipTier,loyaltyPoints,preferences,notes,internalNotes,tags,referredBy,referralCode,allowMarketing,allowSms,allowEmail,firstVisitDate,lastVisitDate,visitCount,noShowCount,cancellationCount,isActive,hairType,hairThickness,scalpCondition,customerStatus,createdAt,updatedAt'
    const row = [
      'd2a05e8b-7f9d-4be0-9ecf-bd8f4a7b9cd7',
      '',
      '花子',
      '山田',
      'ハナコ',
      'ヤマダ',
      'Hanako@Example.com',
      "'+81-90-1234-5678",
      '03-1234-5678',
      '150-0001',
      '東京都',
      '渋谷区',
      '神宮前 1-2-3',
      '"サロンビル 4F, 401"',
      '1990-04-01',
      'female',
      '会社員',
      'gold',
      '2500',
      '"{""preferredServices"":[""cut"",""color""],""notes"":""静かな席""}"',
      '"1行目\r\n2行目"',
      "'=SUM(A1)",
      '"[""VIP"",""常連""]"',
      '',
      'HANAKO2026',
      'true',
      'false',
      'true',
      '2026-01-15',
      '2026-11-18',
      '14',
      '0',
      '1',
      'true',
      'straight',
      'medium',
      'normal',
      'vip',
      '2026-01-15T01:00:00.000Z',
      '2026-11-18T02:00:00.000Z',
    ].join(',')

    // Act
    const read = await readCustomerFile(lines(header, row), TODAY)

    // Assert
    expect(read).toEqual({
      type: 'read',
      customers: [
        {
          row: 2,
          request: {
            lastName: '山田',
            firstName: '花子',
            lastNameKana: 'ヤマダ',
            firstNameKana: 'ハナコ',
            email: 'Hanako@Example.com',
            phoneNumber: '+81-90-1234-5678',
            alternativePhone: '03-1234-5678',
            postalCode: '150-0001',
            prefecture: '東京都',
            city: '渋谷区',
            address: '神宮前 1-2-3',
            building: 'サロンビル 4F, 401',
            birthDate: '1990-04-01',
            gender: 'female',
            occupation: '会社員',
            membershipTier: 'gold',
            preferences: {
              preferredServices: ['cut', 'color'],
              notes: '静かな席',
            },
            notes: '1行目\r\n2行目',
            internalNotes: '=SUM(A1)',
            tags: ['VIP', '常連'],
            referredBy: null,
            referralCode: 'HANAKO2026',
            allowMarketing: true,
            allowSms: false,
            allowEmail: true,
            isActive: true,
            hairType: 'straight',
            hairThickness: 'medium',
            scalpCondition: 'normal',
            customerStatus: 'vip',
          },
        },
      ],
    })
  })

  it('should give the columns a file leaves out what the form of a registration starts with', async () => {
    // Act
    const read = await readCustomerFile(
      lines(NEEDED, '山田,花子,hanako@example.com,090-1234-5678'),
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'read',
      customers: [{ row: 2, request: BARE }],
    })
  })

  it('should read tags separated as a person writes them, and pass over empty lines with the numbers of the rows kept', async () => {
    // Act
    const read = await readCustomerFile(
      lines(
        `${NEEDED},tags`,
        '',
        '山田,花子,hanako@example.com,090-1234-5678,"VIP、常連,紹介"',
        ',,,,',
        '鈴木,一郎,ichiro@example.com,090-2345-6789,',
      ),
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'read',
      customers: [
        { row: 3, request: { ...BARE, tags: ['VIP', '常連', '紹介'] } },
        {
          row: 5,
          request: {
            ...BARE,
            lastName: '鈴木',
            firstName: '一郎',
            email: 'ichiro@example.com',
            phoneNumber: '090-2345-6789',
          },
        },
      ],
    })
  })

  it.each<[string, string, FileProblem[]]>([
    [
      'a column the ledger does not have',
      `${NEEDED},emial`,
      [
        {
          row: 1,
          column: null,
          message: {
            en: '“emial” is not an item of the ledger. Name the columns as in the table below.',
            ja: '列「emial」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。',
          },
        },
      ],
    ],
    [
      'a column written twice',
      `${NEEDED},email`,
      [
        {
          row: 1,
          column: null,
          message: {
            en: 'There are two columns “email”.',
            ja: '列「email」が 2 つあります。',
          },
        },
      ],
    ],
    [
      'a column without a name',
      `${NEEDED},`,
      [
        {
          row: 1,
          column: null,
          message: {
            en: 'Column 5 has no name.',
            ja: '5 列目に、列名がありません。',
          },
        },
      ],
    ],
    [
      'the columns every file has, left out',
      'lastName,firstName',
      [
        {
          row: 1,
          column: null,
          message: {
            en: 'The column “email” (Email address) is missing.',
            ja: '列「email」（メールアドレス）がありません。',
          },
        },
        {
          row: 1,
          column: null,
          message: {
            en: 'The column “phoneNumber” (Phone number) is missing.',
            ja: '列「phoneNumber」（電話番号）がありません。',
          },
        },
      ],
    ],
  ])(
    'should refuse a file with %s, before its rows are read',
    async (_, names, problems) => {
      // Act
      const read = await readCustomerFile(
        lines(names, '山田,花子,hanako@example.com,090-1234-5678,x'),
        TODAY,
      )

      // Assert
      expect(read).toEqual({ type: 'invalid', problems })
    },
  )

  it.each<[string, string, LocalizedText]>([
    [
      'an empty file',
      '',
      {
        en: 'The file is empty. Write the names of the columns in row 1, then one customer a row from row 2.',
        ja: 'ファイルが空です。1 行目に列名を、2 行目から 1 行に 1 人ずつ、お客様を書いてください。',
      },
    ],
    [
      'the names of the columns alone',
      lines(NEEDED),
      {
        en: 'The file has no customers to register. Write one customer a row from row 2.',
        ja: 'ファイルに、登録するお客様がいません。2 行目から、1 行に 1 人ずつ書いてください。',
      },
    ],
    [
      '101 customers',
      lines(
        NEEDED,
        ...Array.from(
          { length: 101 },
          (_, index) => `山田,花子,hanako${index}@example.com,090-1234-5678`,
        ),
      ),
      {
        en: 'The file has 101 customers. Up to 100 customers can be registered at once. Split the file.',
        ja: 'ファイルには 101 人います。一度に登録できるのは 100 人までです。ファイルを分けてください。',
      },
    ],
    [
      'a quoted value that is not closed',
      lines(NEEDED, '"山田,花子'),
      {
        en: 'A value that begins with a double quote is not closed before the end of the file.',
        ja: 'ダブルクォートで始まった値が、ファイルの終わりまで閉じられていません。',
      },
    ],
  ])('should refuse %s', async (_, text, message) => {
    // Act
    const read = await readCustomerFile(text, TODAY)

    // Assert
    expect(problemsOf(read).map((problem) => problem.message)).toEqual([
      message,
    ])
  })

  it('should read 100 customers', async () => {
    // Act
    const read = await readCustomerFile(
      lines(
        NEEDED,
        ...Array.from(
          { length: 100 },
          (_, index) => `山田,花子,hanako${index}@example.com,090-1234-5678`,
        ),
      ),
      TODAY,
    )

    // Assert
    expect(read.type === 'read' && read.customers).toHaveLength(100)
  })

  it('should say every value that is wrong, by row and column, as the form of a registration does', async () => {
    // Arrange
    const text = lines(
      `${NEEDED},membershipTier,allowSms,birthDate,preferences,tags`,
      '山田,花子,hanako@,090-1234-5678,regular,true,,,',
      ',一郎,ichiro@example.com,0120,diamond,yes,2099-01-01,,',
      '佐藤,健,ken@example.com,090-1234-5678,regular,false,,"{""preferredServices"":[""massage""],""notes"":null}","[1]"',
      '高橋,彩,aya@example.com,090-1234-5678',
    )

    // Act
    const read = await readCustomerFile(text, TODAY)

    // Assert
    expect(problemsOf(read).map(problemTextOf)).toEqual<LocalizedText[]>([
      {
        en: 'Row 2, Email address: Enter an email address in a form such as hanako@example.com.',
        ja: '2 行目 メールアドレス: メールアドレスは、hanako@example.com のような形で入力してください。',
      },
      {
        en: 'Row 3, Messages by SMS: Write true or false.',
        ja: '3 行目 SMS での連絡: SMS での連絡は、true か false で書いてください。',
      },
      {
        en: 'Row 3, Last name: Enter the last name.',
        ja: '3 行目 姓: 姓を入力してください。',
      },
      {
        en: 'Row 3, Phone number: Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
        ja: '3 行目 電話番号: 電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
      {
        en: 'Row 3, Date of birth: Enter a date of birth from January 1, 1900 to today.',
        ja: '3 行目 生年月日: 生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      },
      {
        en: 'Row 3, Membership rank: Write one of regular, silver, gold, platinum, vip.',
        ja: '3 行目 会員ランク: 会員ランクは、regular、silver、gold、platinum、vip のどれかで書いてください。',
      },
      {
        en: 'Row 4, Preferences: Write the preferences as JSON, as the ledger exports them ({"preferredServices":["cut"],"notes":null}), or leave them empty. preferredServices are each one of cut, color, perm, treatment, spa, styling, extension, other.',
        ja: '4 行目 好み: 好みは、台帳の出力と同じ JSON（{"preferredServices":["cut"],"notes":null}）で書くか、空にしてください。preferredServices は、cut、color、perm、treatment、spa、styling、extension、other のどれかです。',
      },
      {
        en: 'Row 4, Tags: Separate the tags with commas, or write them as a JSON array of strings, as the ledger exports them.',
        ja: '4 行目 タグ: タグは、「、」かカンマで区切るか、台帳の出力と同じ JSON の文字列の配列で書いてください。',
      },
      {
        en: 'Row 5: The row has 4 values, which does not match the number of columns (9).',
        ja: '5 行目: 値が 4 個あり、列の数（9）と合いません。',
      },
    ])
  })

  it('should say that an address of mail or a referral code is that of an earlier row, at the later row', async () => {
    // Act
    const read = await readCustomerFile(
      lines(
        `${NEEDED},referralCode`,
        '山田,花子,hanako@example.com,090-1234-5678,HANAKO',
        '鈴木,一郎,ichiro@example.com,090-1234-5678,HANAKO',
        '佐藤,健,HANAKO@example.com,090-1234-5678,',
      ),
      TODAY,
    )

    // Assert
    expect(problemsOf(read).map(problemTextOf)).toEqual<LocalizedText[]>([
      {
        en: 'Row 3, Referral code: The same referral code as row 2.',
        ja: '3 行目 紹介コード: 2 行目と同じ紹介コードです。',
      },
      {
        en: 'Row 4, Email address: The same email address as row 2.',
        ja: '4 行目 メールアドレス: 2 行目と同じメールアドレスです。',
      },
    ])
  })
})

describe('afterRegistration', () => {
  const customers: FileCustomer[] = [
    { row: 2, request: { ...BARE, referralCode: 'HANAKO' } },
    { row: 4, request: { ...BARE, email: 'Ichiro@Example.com' } },
  ]

  it.each<[string, RegistrationAttempt, RegistrationSays]>([
    [
      'customers registered',
      { type: 'registered', count: 2 },
      {
        type: 'done',
        message: {
          en: 'Registered 2 customers in the ledger.',
          ja: '2 人を台帳に登録しました。',
        },
      },
    ],
    [
      'values refused, by the place of the customer in the request',
      {
        type: 'invalid',
        values: [
          { field: 'items.1.referredBy', rule: 'not_found' },
          { field: 'items.0.birthDate', rule: 'too_big' },
          { field: 'items.0.tags.1', rule: 'custom' },
        ],
      },
      {
        type: 'again',
        message: undefined,
        problems: [
          {
            row: 4,
            column: { en: 'Referred by', ja: '紹介元' },
            message: {
              en: 'No customer of the ledger has this ID. Write the id of the ledger export, or leave it empty.',
              ja: '台帳にいないお客様の ID です。台帳の出力の id を書くか、空にしてください。',
            },
          },
          {
            row: 2,
            column: { en: 'Date of birth', ja: '生年月日' },
            message: {
              en: 'Write a date of birth from 1900-01-01 to today.',
              ja: '生年月日は、1900-01-01 から今日までの日付を書いてください。',
            },
          },
          {
            row: 2,
            column: { en: 'Tags', ja: 'タグ' },
            message: {
              en: 'This value was not accepted. Check how it is written.',
              ja: 'この値は受け付けられませんでした。書き方を確かめてください。',
            },
          },
        ],
      },
    ],
    [
      'values refused that are no customer of the file',
      { type: 'invalid', values: [{ field: 'items', rule: 'too_big' }] },
      {
        type: 'again',
        message: {
          en: 'Check the contents of the file and try again.',
          ja: 'ファイルの内容を確かめて、もう一度お試しください。',
        },
        problems: [],
      },
    ],
    [
      'an address of mail of the ledger, written in other letters',
      {
        type: 'conflict',
        detail: 'Customer with email ichiro@example.com already exists',
      },
      {
        type: 'again',
        message: undefined,
        problems: [
          {
            row: 4,
            column: EMAIL,
            message: EMAIL_TAKEN,
          },
        ],
      },
    ],
    [
      'an address of mail of the ledger that holds one of the file',
      {
        type: 'conflict',
        detail: 'Customer with email aichiro@example.com already exists',
      },
      {
        type: 'again',
        message: OVERLAP,
        problems: [],
      },
    ],
    [
      'a referral code of the ledger',
      {
        type: 'conflict',
        detail: 'Customer with referralCode HANAKO already exists',
      },
      {
        type: 'again',
        message: undefined,
        problems: [
          {
            row: 2,
            column: REFERRAL_CODE,
            message: REFERRAL_CODE_TAKEN,
          },
        ],
      },
    ],
    [
      'an address of mail of the ledger, told in Japanese',
      {
        type: 'conflict',
        detail: 'email が ichiro@example.com の顧客は、すでにあります',
      },
      {
        type: 'again',
        message: undefined,
        problems: [
          {
            row: 4,
            column: EMAIL,
            message: EMAIL_TAKEN,
          },
        ],
      },
    ],
    [
      'an address of mail of the ledger that holds one of the file, told in Japanese',
      {
        type: 'conflict',
        detail: 'email が aichiro@example.com の顧客は、すでにあります',
      },
      {
        type: 'again',
        message: OVERLAP,
        problems: [],
      },
    ],
    [
      'a referral code of the ledger, told in Japanese',
      {
        type: 'conflict',
        detail: 'referralCode が HANAKO の顧客は、すでにあります',
      },
      {
        type: 'again',
        message: undefined,
        problems: [
          {
            row: 2,
            column: REFERRAL_CODE,
            message: REFERRAL_CODE_TAKEN,
          },
        ],
      },
    ],
    [
      'a conflict that names nothing of the file',
      { type: 'conflict', detail: '' },
      {
        type: 'again',
        message: OVERLAP,
        problems: [],
      },
    ],
    [
      'a file too large to send',
      { type: 'tooLarge' },
      {
        type: 'again',
        message: {
          en: 'The file is too large to send at once. Split the file, then register each part.',
          ja: 'ファイルが大きすぎて、一度に送れません。ファイルを分けて、登録してください。',
        },
        problems: [],
      },
    ],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message: {
          en: 'This account cannot work with the customer ledger.',
          ja: 'このアカウントでは、顧客台帳を扱えません。',
        },
        problems: [],
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
        problems: [],
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'The customers could not be registered. Check your connection and try again.',
          ja: 'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
        problems: [],
      },
    ],
  ])('should say what follows %s', (_, attempt, says) => {
    // Act
    const said = afterRegistration(attempt, customers)

    // Assert
    expect(said).toEqual(says)
  })
})
