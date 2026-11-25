import { languageStore } from '@beauty-salon-frontend/io'
import { signIn } from '@beauty-salon-frontend/session'
import {
  findAccessibilityViolations,
  PDF_BYTES,
  PDF_TEXT,
  PNG_BYTES,
  savedFiles,
} from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import { giveBack, takeAway, testApi } from '@beauty-salon-frontend/testing/api'
import {
  address,
  goTo,
  heading,
  readAgain,
} from '@beauty-salon-frontend/testing/screens'
import { CUSTOMER } from '@beauty-salon-frontend/testing/seed'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import {
  BECOMINGS,
  countsOf,
  fileNotStored,
  lock,
  PASSWORD,
  revoke,
  share,
  uploadFile,
} from '../__tests__/arrangements'

/*
 * The screen of a share link, against the real API, a real PostgreSQL and
 * the object storage of the test server: the owner of the salon in Tokyo
 * uploads a file and shares it through the API, and somebody who has no
 * account opens the link, as its fragment carries the token.
 */

const PHOTO = '施術後のスタイル_正面.png'
const CONSENT = 'カラー同意書_田中様.pdf'

const UNUSABLE =
  '有効期限が過ぎたか、ダウンロードの回数の上限に達したか、共有が取り消されたか、ファイルが削除されています。必要なときは、共有したサロンにお問い合わせください。'
const PASSWORD_REFUSED =
  'パスワードが違うか、5 回続けて間違えたために、15 分のあいだ使えなくなっています。確かめて、もう一度入力してください。'

/** Opens a share link, as somebody who received it does. */
const openLink = (token: string) => renderAt(`/share#token=${token}`)

const main = () => within(screen.getByRole('main'))

const part = () => main().getByRole('region', { name: 'ファイル' })

const facts = () =>
  within(part())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent])

const loadButton = () =>
  within(part()).getByRole('button', { name: 'ファイルを読み込む' })

const passwordField = () =>
  main().getByLabelText('パスワード', { selector: 'input' })

/** Waits until the screen asks for the password: while the link is checked, the heading is the same */
const passwordAsked = () =>
  screen.findByLabelText('パスワード', { selector: 'input' })

/** Types a password, and opens the file with it */
const enterPassword = async (password: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(passwordField(), password)
  await user.click(main().getByRole('button', { name: 'ファイルを開く' }))
}

const PNG_AS_TEXT = new TextDecoder('utf-8', { ignoreBOM: true }).decode(
  PNG_BYTES,
)

const sharePhoto = async (options: Parameters<typeof share>[1] = {}) => {
  const file = await uploadFile({
    filename: PHOTO,
    contentType: 'image/png',
    bytes: PNG_BYTES,
  })

  return { file, ...(await share(file, options)) }
}

const shareConsent = async (
  options: Parameters<typeof share>[1] = { password: PASSWORD },
) => {
  const file = await uploadFile({
    filename: CONSENT,
    contentType: 'application/pdf',
    bytes: PDF_BYTES,
  })

  return { file, ...(await share(file, options)) }
}

describe('the screen of a share link, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('a link without a password', () => {
    it('should say what the file is when the link is opened, count no download, and take the token out of the address', async () => {
      // Arrange
      const link = await sharePhoto({ maxDownloads: 3 })

      // Act
      openLink(link.token)

      // Assert
      expect(await heading(PHOTO)).toBeVisible()
      expect(address()).toBe('/share')
      expect(facts()).toEqual([
        ['種類', 'PNG 画像'],
        ['サイズ', '24 バイト'],
      ])
      expect(part()).toHaveTextContent(
        'ファイルを読み込むたびに、ダウンロードを 1 回と数えます。共有リンクにダウンロードの回数の上限があるときは、残りの回数が 1 回減ります。',
      )
      expect(within(part()).queryByRole('img')).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 0,
      })
    })

    it('should load the file from the storage when the button is pressed, show it and save it under its name, and count one download', async () => {
      // Arrange
      const link = await sharePhoto({ maxDownloads: 3 })
      const fetched = vi.spyOn(globalThis, 'fetch')
      openLink(link.token)
      await heading(PHOTO)

      // Act
      await userEvent.click(loadButton())

      // Assert
      const image = await within(part()).findByRole('img', { name: PHOTO })
      expect(
        within(part()).getByRole('heading', { name: 'ファイル' }),
      ).toHaveFocus()
      const saving = within(part()).getByRole('link', { name: '保存する' })
      expect(saving).toHaveAttribute('download', PHOTO)
      expect(image).toHaveAttribute('src', saving.getAttribute('href'))
      expect(
        within(part()).getByRole('link', { name: '新しいタブで開く' }),
      ).toHaveAttribute('href', saving.getAttribute('href'))
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(saving)
      await userEvent.click(saving)

      // Assert
      expect(await savedFiles()).toEqual([
        { name: PHOTO, type: 'image/png', text: PNG_AS_TEXT },
        { name: PHOTO, type: 'image/png', text: PNG_AS_TEXT },
      ])
      // The page saves what it holds: the link counted the load alone
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 1,
        failedAttempts: 0,
      })
      // What is known of the file was asked for once
      expect(
        asked(fetched).filter((line) => line.includes(' /share/')),
      ).toEqual(['POST /share/file', 'POST /share/download-url'])
    })

    it('should show the file of another link opened in the same tab, and nothing of the one before', async () => {
      // Arrange
      const first = await shareConsent()
      openLink(first.token)
      await passwordAsked()
      await enterPassword(PASSWORD)
      await heading(CONSENT)
      await userEvent.click(loadButton())
      await within(part()).findByRole('link', { name: '保存する' })
      const second = await sharePhoto()

      // Act
      act(() => goTo(`/share#token=${second.token}`))

      // Assert
      expect(await heading(PHOTO)).toBeVisible()
      expect(loadButton()).toBeVisible()
      expect(within(part()).queryByRole('link')).toBeNull()
      expect(main().queryByText(CONSENT)).toBeNull()
      expect(address()).toBe('/share')
    })

    it('should be the same for somebody who is signed in', async () => {
      // Arrange
      const link = await sharePhoto()
      await signIn({
        email: CUSTOMER,
        password: testApi().seedPassword,
        rememberMe: false,
        twoFactorCode: null,
      })

      // Act
      openLink(link.token)

      // Assert
      expect(await heading(PHOTO)).toBeVisible()
      await userEvent.click(loadButton())
      expect(
        await within(part()).findByRole('img', { name: PHOTO }),
      ).toBeVisible()
    })
  })

  describe('a link with a password', () => {
    it('should ask for the password before it says what the file is', async () => {
      // Arrange
      const link = await shareConsent()

      // Act
      openLink(link.token)

      // Assert
      expect(await passwordAsked()).toBeVisible()
      expect(await heading('共有されたファイル')).toBeVisible()
      expect(
        main().getByText(
          'このファイルは、パスワードで保護されています。共有したサロンから、リンクとは別に伝えられたパスワードを入力してください。',
        ),
      ).toBeVisible()
      expect(passwordField()).toHaveAttribute('autocomplete', 'off')
      expect(main().queryByText(CONSENT)).toBeNull()
      expect(main().queryByRole('region', { name: 'ファイル' })).toBeNull()
      expect(address()).toBe('/share')
      expect(await findAccessibilityViolations()).toEqual([])
      // Asking without a password is no guess at it
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 0,
      })
    })

    it('should send no empty password, and say so at the control', async () => {
      // Arrange
      const link = await shareConsent()
      openLink(link.token)
      await passwordAsked()
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(
        main().getByRole('button', { name: 'ファイルを開く' }),
      )

      // Assert
      expect(passwordField()).toHaveAccessibleDescription(
        'パスワードを入力してください。',
      )
      expect(passwordField()).toHaveFocus()
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should say at the control that a password is not the one, which the link counts', async () => {
      // Arrange
      const link = await shareConsent()
      openLink(link.token)
      await passwordAsked()

      // Act
      await enterPassword('yama no mieru heya')

      // Assert
      expect(await screen.findByText(PASSWORD_REFUSED)).toBeVisible()
      expect(passwordField()).toHaveAccessibleDescription(PASSWORD_REFUSED)
      expect(passwordField()).toHaveFocus()
      expect(main().queryByText(CONSENT)).toBeNull()
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 1,
      })
    })

    it('should open the file with the password, load it with the same password, and save it under its name', async () => {
      // Arrange
      const link = await shareConsent()
      openLink(link.token)
      await passwordAsked()
      await enterPassword('yama no mieru heya')
      await screen.findByText(PASSWORD_REFUSED)
      await userEvent.clear(passwordField())

      // Act
      await enterPassword(PASSWORD)

      // Assert
      expect(await heading(CONSENT)).toHaveFocus()
      expect(facts()).toEqual([
        ['種類', 'PDF'],
        ['サイズ', '77 バイト'],
      ])
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 0,
      })

      // Act
      await userEvent.click(loadButton())
      await userEvent.click(
        await within(part()).findByRole('link', { name: '保存する' }),
      )

      // Assert
      expect(within(part()).queryByRole('img')).toBeNull()
      expect(await savedFiles()).toEqual([
        { name: CONSENT, type: 'application/pdf', text: PDF_TEXT },
      ])
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 1,
        failedAttempts: 0,
      })
    })

    it('should say the same of the right password while the link is locked, and count it not', async () => {
      // Arrange
      const link = await shareConsent()
      await lock(link.id)
      openLink(link.token)
      await passwordAsked()

      // Act
      await enterPassword(PASSWORD)

      // Assert
      expect(await screen.findByText(PASSWORD_REFUSED)).toBeVisible()
      expect(passwordField()).toHaveAccessibleDescription(PASSWORD_REFUSED)
      expect(main().queryByText(CONSENT)).toBeNull()
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 5,
      })
    })

    it('should ask for the password again when the link was locked after it opened the file, and load nothing', async () => {
      // Arrange
      const link = await shareConsent()
      openLink(link.token)
      await passwordAsked()
      await enterPassword(PASSWORD)
      await heading(CONSENT)
      await lock(link.id)

      // Act
      await userEvent.click(loadButton())

      // Assert
      expect(await heading('共有されたファイル')).toHaveFocus()
      expect(main().getByRole('alert')).toHaveTextContent(
        'パスワードを、もう一度入力してください。ほかの人が続けて間違えたために、しばらく使えなくなっていることがあります。',
      )
      expect(passwordField()).toHaveValue('')
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 5,
      })
    })
  })

  describe('a link that works no more', () => {
    it('should say that a link revoked while its password was typed cannot be opened', async () => {
      // Arrange
      const link = await shareConsent()
      openLink(link.token)
      await passwordAsked()
      await revoke(link.id)

      // Act
      await enterPassword(PASSWORD)

      // Assert
      expect(await heading('この共有リンクは開けません')).toHaveFocus()
      expect(main().queryByLabelText('パスワード')).toBeNull()
    })

    it.each(BECOMINGS)(
      'should say that a link that was %s cannot be opened, and why it may be',
      async (_, become) => {
        // Arrange
        const link = await sharePhoto()
        await become(link.id, link.file)

        // Act
        openLink(link.token)

        // Assert
        expect(await heading('この共有リンクは開けません')).toBeVisible()
        expect(main().getByText(UNUSABLE)).toBeVisible()
        expect(main().queryByText(PHOTO)).toBeNull()
        expect(await findAccessibilityViolations()).toEqual([])
      },
    )

    it('should say so when the link was revoked after it was opened, and load nothing', async () => {
      // Arrange
      const link = await sharePhoto()
      openLink(link.token)
      await heading(PHOTO)
      await revoke(link.id)

      // Act
      await userEvent.click(loadButton())

      // Assert
      expect(await heading('この共有リンクは開けません')).toHaveFocus()
      expect(main().queryByRole('img')).toBeNull()
    })

    it('should not open again a link that gave its file as often as it may', async () => {
      // Arrange
      const link = await sharePhoto({ maxDownloads: 1 })
      const { unmount } = openLink(link.token)
      await heading(PHOTO)
      await userEvent.click(loadButton())
      await within(part()).findByRole('img', { name: PHOTO })
      unmount()

      // Act
      openLink(link.token)

      // Assert
      expect(await heading('この共有リンクは開けません')).toBeVisible()
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 1,
        failedAttempts: 0,
      })
    })

    it('should say that a page opened without the token cannot show a file, and ask the API nothing', async () => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      renderAt('/share')

      // Assert
      expect(await heading('この共有リンクは開けません')).toBeVisible()
      expect(
        main().getByText(
          'このページは、受け取った共有リンクから開いてください。ページを読み込み直したときも、受け取ったリンクから、もう一度開いてください。',
        ),
      ).toBeVisible()
      expect(
        asked(fetched).filter((line) => line.includes(' /share/')),
      ).toEqual([])
    })
  })

  describe('a link the API could not check', () => {
    it('should say that what the file is could not be read, and say it when asked again', async () => {
      // Arrange
      const link = await sharePhoto()
      await takeAway('share_links')
      openLink(link.token)
      expect(await main().findByRole('alert')).toHaveTextContent(
        'ファイルの情報を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      const notChecked = {
        heading: screen.getByRole('heading', { level: 1 }).textContent,
        address: address(),
        violations: await findAccessibilityViolations(),
      }
      await giveBack('share_links')

      // Act
      await readAgain(userEvent, { inside: main() })

      // Assert
      expect(await heading(PHOTO)).toBeVisible()
      expect(notChecked).toEqual({
        heading: '共有されたファイル',
        address: '/share',
        violations: [],
      })
      expect(main().queryByRole('alert')).toBeNull()
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 0,
        failedAttempts: 0,
      })
    })
  })

  describe('a file the storage does not answer with', () => {
    it('should say that the download was counted, and count another when the file is loaded again', async () => {
      // Arrange
      const file = await fileNotStored(PHOTO)
      const link = await share(file)
      openLink(link.token)
      await heading(PHOTO)

      // Act
      await userEvent.click(loadButton())

      // Assert
      expect(await within(part()).findByRole('alert')).toHaveTextContent(
        'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
      )
      expect(within(part()).queryByRole('img')).toBeNull()
      expect(await countsOf(link.id)).toEqual({
        downloadCount: 1,
        failedAttempts: 0,
      })

      // Act
      await readAgain(userEvent, { inside: within(part()) })

      // Assert
      await waitFor(async () =>
        expect(await countsOf(link.id)).toEqual({
          downloadCount: 2,
          failedAttempts: 0,
        }),
      )
    })
  })
})

describe('the screen of a share link on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  const partInEnglish = () => main().getByRole('region', { name: 'File' })

  const passwordInEnglish = () =>
    screen.findByLabelText('Password', { selector: 'input' })

  it('should say in English what the file is, and load it when asked', async () => {
    // Arrange
    const link = await sharePhoto()

    // Act
    openLink(link.token)

    // Assert
    expect(await heading(PHOTO)).toBeVisible()
    expect(main().getByText('A file a salon shared with you.')).toBeVisible()
    expect(
      within(partInEnglish())
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Type', 'PNG image'],
      ['Size', '24 bytes'],
    ])

    // Act
    await userEvent.click(
      within(partInEnglish()).getByRole('button', { name: 'Load the file' }),
    )

    // Assert
    expect(
      await within(partInEnglish()).findByRole('link', { name: 'Save' }),
    ).toHaveAttribute('download', PHOTO)
  })

  it('should ask in English for the password, and say what is wrong with it', async () => {
    // Arrange
    const link = await shareConsent()
    const user = userEvent.setup()

    // Act
    openLink(link.token)

    // Assert
    const password = await passwordInEnglish()
    expect(await heading('Shared file')).toBeVisible()
    expect(
      main().getByText(
        'This file is protected by a password. Enter the password the salon that shared it gave you apart from the link.',
      ),
    ).toBeVisible()

    // Act
    await user.click(main().getByRole('button', { name: 'Open the file' }))

    // Assert
    expect(password).toHaveAccessibleDescription('Enter the password.')

    // Act
    await user.type(password, 'yama no mieru heya')
    await user.click(main().getByRole('button', { name: 'Open the file' }))

    // Assert
    await waitFor(() =>
      expect(password).toHaveAccessibleDescription(
        'The password is wrong, or it cannot be used for 15 minutes after 5 wrong attempts in a row. Check it and enter it again.',
      ),
    )
  })

  it('should say in English that a link that works no more cannot be opened', async () => {
    // Arrange
    const link = await sharePhoto()
    await revoke(link.id)

    // Act
    openLink(link.token)

    // Assert
    expect(await heading('This share link cannot be opened')).toBeVisible()
    expect(
      main().getByText(
        'The link has expired, reached its limit of downloads, or been withdrawn, or the file was deleted. If you need the file, contact the salon that shared it.',
      ),
    ).toBeVisible()
  })

  it('should say in English that a page without the token shows no file', async () => {
    // Act
    renderAt('/share')

    // Assert
    expect(await heading('This share link cannot be opened')).toBeVisible()
    expect(
      await screen.findByText(
        'Open this page from the share link you received. When you reload the page, open it from the link again too.',
      ),
    ).toBeVisible()
  })
})
