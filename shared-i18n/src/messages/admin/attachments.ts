import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { adminFrameMessages } from './frame'

/*
 * What the admin application says of the files a salon keeps: the list
 * and the upload, what is wrong with a file before it is sent and after,
 * a file with the way to open it, its removal, and who uploaded it. The
 * names of the files and of the members of the staff stand as they were
 * written.
 */

/** The largest file the API takes, as the screens write it */
const MOST = '10 MB'

const FILE_NAME = text({ en: 'File name', ja: 'ファイル名' })
const TYPE = text({ en: 'Type', ja: '種類' })
const SIZE = text({ en: 'Size', ja: 'サイズ' })
const UPLOADER = text({ en: 'Uploaded by', ja: 'アップロードした人' })
const UPLOADED_AT = text({ en: 'Uploaded', ja: 'アップロード日時' })

export const adminAttachmentMessages = {
  titles: {
    files: adminFrameMessages.navigation.files,
    file: text({ en: 'File', ja: 'ファイル' }),
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    file: text({ en: 'the file', ja: 'ファイル' }),
    files: text({ en: 'the files', ja: 'ファイル' }),
    filesOfTheSalon: text({ en: 'files', ja: 'ファイル' }),
    openingAddress: text({
      en: 'the address that opens the file',
      ja: 'ファイルを開くアドレス',
    }),
  },
  loading: {
    files: text({ en: 'Loading the files', ja: 'ファイルを読み込んでいます' }),
    file: text({ en: 'Loading the file', ja: 'ファイルを読み込んでいます' }),
    opening: text({
      en: 'Getting the file ready to open',
      ja: 'ファイルを開く準備をしています',
    }),
  },
  none: text({ en: 'No files', ja: 'ファイルはありません' }),
  noneDescription: text({
    en: 'Upload the files the salon keeps, such as photos before and after a treatment or the consent forms of customers, with the form above.',
    ja: '施術の前と後の写真や、お客様の同意書など、サロンで残しておくファイルを、上のフォームからアップロードできます。',
  }),
  /** The files of a salon */
  table: {
    caption: text({ en: 'Files', ja: 'ファイル' }),
    filename: FILE_NAME,
    type: TYPE,
    size: SIZE,
    uploader: UPLOADER,
    uploadedAt: UPLOADED_AT,
  },
  /** Who uploaded a file: the account itself, or another the screen does not name */
  uploaders: {
    you: text({ en: 'You', ja: 'あなた' }),
    other: text({ en: 'Another account', ja: 'ほかのアカウント' }),
  },
  /** The upload of a file */
  upload: {
    title: text({ en: 'Upload a file', ja: 'ファイルをアップロードする' }),
    submit: text({ en: 'Upload', ja: 'アップロードする' }),
    label: text({ en: 'File', ja: 'ファイル' }),
    description: text({
      en: `An image in JPEG, PNG or WebP, or a PDF file, one at a time, up to ${MOST}. Every member of the staff of this salon can see the files uploaded.`,
      ja: `JPEG、PNG、WebP の画像か、PDF のファイルを、1 つずつ。${MOST} まで。アップロードしたファイルは、このサロンのスタッフのだれもが見られます。`,
    }),
    done: (filename: string) =>
      text({
        en: `Uploaded “${filename}”.`,
        ja: `「${filename}」をアップロードしました。`,
      }),
    /** What is wrong with a file, before it is sent and after */
    errors: {
      missing: text({
        en: 'Choose a file to upload.',
        ja: 'アップロードするファイルを選んでください。',
      }),
      type: text({
        en: 'Choose an image in JPEG, PNG or WebP, or a PDF file.',
        ja: 'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
      }),
      empty: text({
        en: 'This file is empty. Choose another file.',
        ja: '中身のないファイルです。ほかのファイルを選んでください。',
      }),
      tooLarge: (size: LocalizedText) =>
        text({
          en: `The file is too large (${size.en}). Choose a file of up to ${MOST}.`,
          ja: `ファイルが大きすぎます（${size.ja}）。${MOST} までのファイルを選んでください。`,
        }),
      nameTooLong: (most: LocalizedText) =>
        text({
          en: `The file name is too long. Rename the file to up to ${most.en}, then choose it.`,
          ja: `ファイル名が長すぎます。${most.ja}までの名前にしてから、選んでください。`,
        }),
      nameInvalid: text({
        en: 'The file name has characters that cannot be used. Rename the file, then choose it.',
        ja: 'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
      }),
      refused: text({
        en: 'This file could not be uploaded. Check its type, size and name.',
        ja: 'このファイルは、アップロードできませんでした。ファイルの種類、大きさ、名前を確かめてください。',
      }),
      unreadable: text({
        en: 'Could not read the file. It may have been moved or changed after it was chosen. Choose it again.',
        ja: 'ファイルを読めませんでした。選んだあとで、ファイルが移されたか、変えられたのかもしれません。もう一度選んでください。',
      }),
      mismatch: text({
        en: 'The content of the file does not match the type of its extension. Choose a file whose content matches its extension.',
        ja: 'ファイルの中身が、名前の拡張子の種類と合いませんでした。中身と拡張子の合うファイルを選んでください。',
      }),
    },
    notSent: text({
      en: 'Could not send the file. Check your connection and upload it again.',
      ja: 'ファイルを送れませんでした。通信の状態を確かめて、もう一度アップロードしてください。',
    }),
    forbidden: text({
      en: 'This account cannot put files in this salon. Only the staff of this salon and administrators can.',
      ja: 'このアカウントでは、このサロンにファイルを置けません。置けるのは、このサロンのスタッフと、管理者です。',
    }),
    failed: text({
      en: 'Could not upload the file. Check your connection and try again.',
      ja: 'ファイルをアップロードできませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** A file, with the way to open it */
  record: {
    title: text({ en: 'File', ja: 'ファイル' }),
    open: text({ en: 'Open the file', ja: 'ファイルを開く' }),
    newTab: text({ en: 'Open in a new tab', ja: '新しいタブで開く' }),
    save: text({ en: 'Save', ja: '保存する' }),
    filename: FILE_NAME,
    type: TYPE,
    size: SIZE,
    uploader: UPLOADER,
    uploadedAt: UPLOADED_AT,
    /** The size of a file, as a person reads it and in bytes: 「1.2 MB（1,234,567 バイト）」 */
    sizeOf: (size: LocalizedText, bytes: LocalizedText) =>
      text({ en: `${size.en} (${bytes.en})`, ja: `${size.ja}（${bytes.ja}）` }),
  },
  /** The removal of a file, after a dialog */
  removal: {
    button: text({ en: 'Delete the file', ja: 'ファイルを削除する' }),
    title: text({ en: 'Delete the file?', ja: 'ファイルを削除しますか？' }),
    description: (filename: string) =>
      text({
        en: `Deletes “${filename}” from the files of the salon. A deleted file cannot be restored. The share links of this file stop working too.`,
        ja: `「${filename}」を、サロンのファイルから削除します。削除したファイルは元に戻せません。このファイルの共有リンクも、使えなくなります。`,
      }),
    back: uiMessages.back,
    confirm: text({ en: 'Delete', ja: '削除する' }),
    done: (filename: string) =>
      text({
        en: `Deleted “${filename}”.`,
        ja: `「${filename}」を削除しました。`,
      }),
    forbidden: text({
      en: 'Only the person who uploaded this file, the owners and managers of the salon and administrators can delete it.',
      ja: 'このファイルを削除できるのは、アップロードした人と、サロンのオーナー、マネージャー、管理者です。',
    }),
    failed: text({
      en: 'Could not delete the file. Check your connection and try again.',
      ja: 'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The screen of a file when there is none to show */
  notFound: {
    title: text({ en: 'File not found', ja: 'ファイルが見つかりません' }),
    description: text({
      en: 'Check that the address is correct. A deleted file cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除したファイルは、表示できません。',
    }),
    toList: text({ en: 'Back to the files', ja: 'ファイルの一覧へ' }),
  },
}
