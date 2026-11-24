import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as customerImportFormStories from './customer-import-form.stories'

const stories = composeStories(customerImportFormStories)

const file = (): HTMLInputElement => screen.getByLabelText('CSV ファイル')

describe('CustomerImportForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should ask for a CSV file and say how it is written, before one is chosen', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(file()).toHaveAttribute('accept', '.csv,text/csv')
    expect(file()).toBeRequired()
    expect(file()).toHaveAccessibleDescription(
      'UTF-8 か Shift_JIS の、カンマで区切ったファイル。1 行目に列名を、2 行目から 1 行に 1 人ずつ、100 人まで書きます。',
    )
    expect(screen.getByRole('button', { name: '登録する' })).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should tell the file that is chosen', async () => {
    // Arrange
    const onChoose = vi.fn()
    await stories.Empty.run({ args: { ...stories.Empty.args, onChoose } })
    const chosen = new File(['lastName\r\n'], 'customers.csv', {
      type: 'text/csv',
    })

    // Act
    await userEvent.upload(file(), chosen)

    // Assert
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(chosen)
  })

  it('should tell that no file is chosen when the one chosen is taken away', async () => {
    // Arrange
    const onChoose = vi.fn()
    await stories.Empty.run({ args: { ...stories.Empty.args, onChoose } })
    await userEvent.upload(
      file(),
      new File(['lastName\r\n'], 'customers.csv', { type: 'text/csv' }),
    )

    // Act
    await userEvent.upload(file(), [])

    // Assert
    expect(onChoose).toHaveBeenLastCalledWith(undefined)
  })

  it('should not register the customers again while the registration is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const button = screen.getByRole('button', { name: '3 人を登録する' })

    // Act: a press, and a script that sends the form itself
    await userEvent.click(button)
    file().closest('form')?.requestSubmit()

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should say that the file is being read, and send nothing until it is', async () => {
    // Arrange
    await stories.Reading.run()
    const button = screen.getByRole('button', { name: '登録する' })

    // Act: a press, and a script that sends the form itself
    await userEvent.click(button)
    file().closest('form')?.requestSubmit()

    // Assert
    expect(screen.getByText('ファイルを読んでいます')).toBeVisible()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Reading.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should send the form with no file when none is chosen', async () => {
    // Arrange
    const onSubmit = vi.fn()
    await stories.Empty.run({ args: { ...stories.Empty.args, onSubmit } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('should send the form with what is wrong in the file', async () => {
    // Arrange
    const onSubmit = vi.fn()
    await stories.Invalid.run({ args: { ...stories.Invalid.args, onSubmit } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'invalid' }),
    )
  })

  it('should show the customers of the file with their rows, and offer to register them all', async () => {
    // Arrange
    const onSubmit = vi.fn()
    await stories.Read.run({ args: { ...stories.Read.args, onSubmit } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '3 人を登録する' }),
    )

    // Assert
    const table = screen.getByRole('table', { name: '登録するお客様' })
    expect(rowsOf(table)).toEqual([
      [
        '2',
        '山田 花子',
        'ヤマダ ハナコ',
        'hanako@example.com',
        '090-1234-5678',
        'レギュラー',
      ],
      ['3', '鈴木 一郎', '', 'ichiro@example.com', '090-1234-5678', 'ゴールド'],
      [
        '5',
        '佐藤 健',
        'サトウ ケン',
        'ken@example.com',
        '+81-80-2345-6789',
        'レギュラー',
      ],
    ])
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      type: 'read',
      customers: expect.arrayContaining([expect.objectContaining({ row: 2 })]),
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should say each thing that is wrong with the file, row by row, and register nobody', async () => {
    // Act
    await stories.Invalid.run()

    // Assert
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('ファイルの誤り')
    expect(alert).toHaveTextContent(
      '直したファイルを選び直してください。どのお客様も、まだ登録していません。',
    )
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '3 行目 メールアドレス: メールアドレスは、hanako@example.com のような形で入力してください。',
      '4 行目 会員ランク: 会員ランクは、regular、silver、gold、platinum、vip のどれかで書いてください。',
      '1 行目: 列「emial」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。',
    ])
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: '登録する' })).toBeVisible()
  })

  it('should say at the file that none was chosen, and put the focus there', async () => {
    // Act
    await stories.NoFile.run()

    // Assert
    expect(file()).toBeInvalid()
    expect(file()).toHaveAccessibleDescription(
      expect.stringContaining('ファイルを選んでください。'),
    )
    expect(file()).toHaveFocus()
  })

  it('should say what the API refused of the customers of the file, by row, beside them', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(
      within(screen.getByRole('alert'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '5 行目 メールアドレス: このメールアドレスのお客様が、もう台帳にいます。台帳で探して、このお客様の行を外してください。',
    ])
    expect(screen.getByRole('table', { name: '登録するお客様' })).toBeVisible()
  })
})

describe('CustomerImportForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should ask for a CSV file in English, and say that none was chosen', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NoFile.run()

    // Assert
    expect(screen.getByLabelText('CSV file')).toHaveAccessibleDescription(
      'A file of values separated by commas, in UTF-8 or Shift_JIS. The names of the columns in row 1, then one customer a row from row 2, up to 100 customers. Choose a file.',
    )
    expect(screen.getByRole('button', { name: 'Register' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()

    // Act
    await stories.Reading.run()

    // Assert
    expect(screen.getByText('Reading the file')).toBeVisible()
  })

  it('should show the customers of the file in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Read.run()

    // Assert
    expect(columnsOf('Customers to register')).toEqual([
      'Row',
      'Name',
      'Phonetic name',
      'Email address',
      'Phone number',
      'Membership rank',
    ])
    expect(rowsOf('Customers to register').map((row) => row.at(-1))).toEqual([
      'Regular',
      'Gold',
      'Regular',
    ])
    expect(
      screen.getByRole('button', { name: 'Register 3 customers' }),
    ).toBeVisible()
  })

  it('should say in English what is wrong with the file, row by row', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Invalid.run()

    // Assert
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Errors in the file')
    expect(alert).toHaveTextContent(
      'Choose the corrected file. No customer has been registered yet.',
    )
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Row 3, Email address: Enter an email address in a form such as hanako@example.com.',
      'Row 4, Membership rank: Write one of regular, silver, gold, platinum, vip.',
      'Row 1: “emial” is not an item of the ledger. Name the columns as in the table below.',
    ])
  })
})
