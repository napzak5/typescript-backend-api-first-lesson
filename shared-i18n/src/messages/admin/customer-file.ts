import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { customerMessages as record } from '../ui/customers'
import { countedIn, followed } from '../written'
import { customersOf } from './customer-words'

/*
 * The customers of a CSV file, registered at once: how the columns are
 * written, what is wrong with a file, and what follows the registration.
 * The names of the columns (the properties of a registration, as the
 * ledger exports them) and the values of the enums (`male`, `gold`) are
 * those of the file, and stand as they are in every language.
 */

const AS_THE_FORM = text({
  en: 'As on the screen of a registration. Empty for none',
  ja: '登録の画面と同じ。空なら、なし',
})
const REQUIRED = text({ en: 'Required', ja: '必ず書く' })
const EXAMPLE_PREFERENCES = '{"preferredServices":["cut"],"notes":null}'

/** The values a column takes: 「male、female、other のどれか」, "One of male, female, other" */
const oneOf = (values: readonly string[]): LocalizedText =>
  text({
    en: `One of ${values.join(', ')}`,
    ja: `${values.join('、')} のどれか`,
  })

/** A row of the file, as a spreadsheet numbers it: 「3 行目」, "Row 3" */
const rowOf = (row: number): LocalizedText =>
  text({ en: `Row ${numberOf(row).en}`, ja: `${numberOf(row).ja} 行目` })

export const customerFileMessages = {
  title: text({ en: 'Register from a CSV file', ja: 'CSV から登録する' }),
  /** How each column of a file is written */
  how: {
    required: REQUIRED,
    asTheForm: AS_THE_FORM,
    email: text({
      en: 'Required. Not used by another customer, in the file or in the ledger',
      ja: '必ず書く。ファイルの中でも台帳でも、ほかのお客様と重ならないもの',
    }),
    phoneNumber: text({
      en: 'Required. With the area code',
      ja: '必ず書く。市外局番から',
    }),
    birthDate: text({
      en: 'In the form 2001-04-01. Empty for none',
      ja: '2001-04-01 の形。空なら、なし',
    }),
    /** A column of an enum that may be empty */
    oneOrNone: (values: readonly string[]) => {
      const one = oneOf(values)

      return text({
        en: `${one.en}. Empty for none`,
        ja: `${one.ja}。空なら、なし`,
      })
    },
    /** A column of an enum whose value is `fallback` when the file has no such column */
    oneOrElse: (values: readonly string[], fallback: string) => {
      const one = oneOf(values)

      return text({
        en: `${one.en}. Without the column: ${fallback}`,
        ja: `${one.ja}。列がなければ ${fallback}`,
      })
    },
    preferences: text({
      en: `JSON as the ledger exports it (${EXAMPLE_PREFERENCES}). Empty for none`,
      ja: `台帳の出力と同じ JSON（${EXAMPLE_PREFERENCES}）。空なら、なし`,
    }),
    tags: text({
      en: 'Separated by commas, or a JSON array as the ledger exports it. Empty for none',
      ja: '「、」かカンマで区切るか、台帳の出力と同じ JSON の配列。空なら、なし',
    }),
    referredBy: text({
      en: 'The ID of a customer of the ledger (the id of the ledger export). Empty for none',
      ja: '台帳のお客様の ID（台帳の出力の id）。空なら、なし',
    }),
    referralCode: text({
      en: `${AS_THE_FORM.en}. Not used by another customer`,
      ja: `${AS_THE_FORM.ja}。ほかのお客様と重ならないもの`,
    }),
    /** A column that is so or not so, and is `fallback` when the file has no such column */
    switched: (fallback: 'true' | 'false') =>
      text({
        en: `Either true or false. Without the column: ${fallback}`,
        ja: `true か false。列がなければ ${fallback}`,
      }),
  },
  /** The table of the columns */
  columns: {
    caption: text({ en: 'Columns of the file', ja: 'ファイルの列' }),
    name: text({ en: 'Column', ja: '列名' }),
    item: text({ en: 'Item', ja: '項目' }),
    how: text({ en: 'How to write it', ja: '書き方' }),
    empty: text({ en: 'No columns', ja: '列はありません' }),
  },
  /** What is wrong with a file, at its row and its column: 「3 行目 メールアドレス: …」 */
  problemOf: (
    row: number | null,
    column: LocalizedText | null,
    message: LocalizedText,
  ): LocalizedText => {
    if (row === null) {
      return message
    }
    const at = rowOf(row)

    return column === null
      ? text({ en: `${at.en}: ${message.en}`, ja: `${at.ja}: ${message.ja}` })
      : text({
          en: `${at.en}, ${column.en}: ${message.en}`,
          ja: `${at.ja} ${column.ja}: ${message.ja}`,
        })
  },
  /** What is wrong with the file as a whole, or with its first row */
  problems: {
    unclosed: text({
      en: 'A value that begins with a double quote is not closed before the end of the file.',
      ja: 'ダブルクォートで始まった値が、ファイルの終わりまで閉じられていません。',
    }),
    empty: text({
      en: 'The file is empty. Write the names of the columns in row 1, then one customer a row from row 2.',
      ja: 'ファイルが空です。1 行目に列名を、2 行目から 1 行に 1 人ずつ、お客様を書いてください。',
    }),
    noCustomers: text({
      en: 'The file has no customers to register. Write one customer a row from row 2.',
      ja: 'ファイルに、登録するお客様がいません。2 行目から、1 行に 1 人ずつ書いてください。',
    }),
    tooMany: (count: number, most: number) =>
      text({
        en: `The file has ${customersOf(count).en}. Up to ${customersOf(most).en} can be registered at once. Split the file.`,
        ja: `ファイルには ${customersOf(count).ja}います。一度に登録できるのは ${customersOf(most).ja}までです。ファイルを分けてください。`,
      }),
    unreadable: text({
      en: 'The file could not be read. Choose the file again.',
      ja: 'ファイルを読み込めませんでした。もう一度、ファイルを選んでください。',
    }),
    /** A column the first row names twice */
    twice: (name: string) =>
      text({
        en: `There are two columns “${name}”.`,
        ja: `列「${name}」が 2 つあります。`,
      }),
    /** A column the first row gives no name: the first is 1 */
    unnamed: (column: number) =>
      text({
        en: `Column ${numberOf(column).en} has no name.`,
        ja: `${numberOf(column).ja} 列目に、列名がありません。`,
      }),
    unknown: (name: string) =>
      text({
        en: `“${name}” is not an item of the ledger. Name the columns as in the table below.`,
        ja: `列「${name}」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。`,
      }),
    missing: (name: string, label: LocalizedText) =>
      text({
        en: `The column “${name}” (${label.en}) is missing.`,
        ja: `列「${name}」（${label.ja}）がありません。`,
      }),
    /** A row that has more or fewer values than the first */
    cells: (values: number, columns: number) =>
      text({
        en: `The row has ${countedIn(values, 'value', 'values')}, which does not match the number of columns (${numberOf(columns).en}).`,
        ja: `値が ${numberOf(values).ja} 個あり、列の数（${numberOf(columns).ja}）と合いません。`,
      }),
    /** A value of a column that is so or not so; the problem names the column, which English does not say again */
    switched: (label: LocalizedText) =>
      text({
        en: 'Write true or false.',
        ja: `${label.ja}は、true か false で書いてください。`,
      }),
    /** A value of a column of an enum, said as `switched` is */
    choice: (label: LocalizedText, values: readonly string[]) =>
      text({
        en: `Write one of ${values.join(', ')}.`,
        ja: `${label.ja}は、${oneOf(values).ja}で書いてください。`,
      }),
    preferences: (services: readonly string[]) =>
      text({
        en: `Write the preferences as JSON, as the ledger exports them (${EXAMPLE_PREFERENCES}), or leave them empty. preferredServices are each one of ${services.join(', ')}.`,
        ja: `好みは、台帳の出力と同じ JSON（${EXAMPLE_PREFERENCES}）で書くか、空にしてください。preferredServices は、${oneOf(services).ja}です。`,
      }),
    tags: text({
      en: 'Separate the tags with commas, or write them as a JSON array of strings, as the ledger exports them.',
      ja: 'タグは、「、」かカンマで区切るか、台帳の出力と同じ JSON の文字列の配列で書いてください。',
    }),
    sameEmailAs: (row: number) =>
      text({
        en: `The same email address as row ${numberOf(row).en}.`,
        ja: `${rowOf(row).ja}と同じメールアドレスです。`,
      }),
    sameCodeAs: (row: number) =>
      text({
        en: `The same referral code as row ${numberOf(row).en}.`,
        ja: `${rowOf(row).ja}と同じ紹介コードです。`,
      }),
  },
  /** The form of the file */
  form: {
    file: text({ en: 'CSV file', ja: 'CSV ファイル' }),
    fileDescription: (most: number) =>
      text({
        en: `A file of values separated by commas, in UTF-8 or Shift_JIS. The names of the columns in row 1, then one customer a row from row 2, up to ${customersOf(most).en}.`,
        ja: `UTF-8 か Shift_JIS の、カンマで区切ったファイル。1 行目に列名を、2 行目から 1 行に 1 人ずつ、${customersOf(most).ja}まで書きます。`,
      }),
    reading: text({ en: 'Reading the file', ja: 'ファイルを読んでいます' }),
    problemsTitle: text({ en: 'Errors in the file', ja: 'ファイルの誤り' }),
    problemsAbout: text({
      en: 'Choose the corrected file. No customer has been registered yet.',
      ja: '直したファイルを選び直してください。どのお客様も、まだ登録していません。',
    }),
    customers: text({ en: 'Customers to register', ja: '登録するお客様' }),
    row: text({ en: 'Row', ja: '行' }),
    name: record.parts.name,
    kana: record.kana,
    email: record.email,
    phoneNumber: record.phoneNumber,
    membershipTier: record.membershipTier,
    noCustomers: text({
      en: 'No customers to register',
      ja: '登録するお客様はいません',
    }),
    /** The button, with how many it registers once the file is read */
    register: (count: number) =>
      count === 0
        ? text({ en: 'Register', ja: '登録する' })
        : text({
            en: `Register ${customersOf(count).en}`,
            ja: `${customersOf(count).ja}を登録する`,
          }),
    cancel: text({ en: 'Cancel', ja: 'やめる' }),
    /** What the form says of the file before it is sent */
    chooseFile: text({
      en: 'Choose a file.',
      ja: 'ファイルを選んでください。',
    }),
    fileWrong: text({
      en: 'The file has errors. Check the list below, then choose the corrected file.',
      ja: 'ファイルに誤りがあります。下の一覧を確かめて、直したファイルを選び直してください。',
    }),
  },
  /** How a file is written, beside the form */
  guide: {
    title: text({ en: 'How to write the file', ja: 'ファイルの書き方' }),
    about: text({
      en: 'The file has the form of the CSV export of the ledger. Name the columns in row 1 as in the table below. Columns of the export that are not in the table (id, visitCount, createdAt and others) are skipped. No two customers can have the same email address, in the file or in the ledger.',
      ja: '台帳の CSV 出力と同じ形です。1 行目の列名は、下の表の名前で書きます。表にない台帳の出力の列（id、visitCount、createdAt など）は、読み飛ばします。メールアドレスは、ファイルの中でも台帳でも、ほかのお客様と重ならないものにします。',
    }),
  },
  /** What follows the registration of the customers of a file */
  registration: {
    registered: (count: number) =>
      text({
        en: `Registered ${customersOf(count).en} in the ledger.`,
        ja: `${customersOf(count).ja}を台帳に登録しました。`,
      }),
    referrerNotFound: text({
      en: 'No customer of the ledger has this ID. Write the id of the ledger export, or leave it empty.',
      ja: '台帳にいないお客様の ID です。台帳の出力の id を書くか、空にしてください。',
    }),
    birthDate: (earliest: string) =>
      text({
        en: `Write a date of birth from ${earliest} to today.`,
        ja: `生年月日は、${earliest} から今日までの日付を書いてください。`,
      }),
    refusedValue: text({
      en: 'This value was not accepted. Check how it is written.',
      ja: 'この値は受け付けられませんでした。書き方を確かめてください。',
    }),
    checkTheFile: text({
      en: 'Check the contents of the file and try again.',
      ja: 'ファイルの内容を確かめて、もう一度お試しください。',
    }),
    emailTaken: followed(
      text({
        en: 'A customer with this email address is already in the ledger.',
        ja: 'このメールアドレスのお客様が、もう台帳にいます。',
      }),
      text({
        en: 'Find them in the ledger, and take the row of this customer out of the file.',
        ja: '台帳で探して、このお客様の行を外してください。',
      }),
    ),
    referralCodeTaken: text({
      en: 'Another customer uses this referral code (customers removed from the ledger included). Write another code.',
      ja: 'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを書いてください。',
    }),
    overlap: text({
      en: 'An email address or a referral code of the file is one of a customer of the ledger. Check the file.',
      ja: '台帳のお客様と、メールアドレスか紹介コードが重なっています。ファイルを確かめてください。',
    }),
    tooLarge: text({
      en: 'The file is too large to send at once. Split the file, then register each part.',
      ja: 'ファイルが大きすぎて、一度に送れません。ファイルを分けて、登録してください。',
    }),
    failed: text({
      en: 'The customers could not be registered. Check your connection and try again.',
      ja: 'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
