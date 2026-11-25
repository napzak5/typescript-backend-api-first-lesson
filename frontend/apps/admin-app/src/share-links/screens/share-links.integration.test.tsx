import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { refuse, salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  address,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  arrangeAwaitedFile,
  arrangeFile,
  fileRemovedMeanwhile,
} from '../../attachments/__tests__/arrangements'
import {
  attachmentHrefOf,
  shareLinkEntryHrefOf,
  shareLinkHrefOf,
} from '../../navigation'
import {
  arrangeShareLink,
  openedWith,
  revokedMeanwhile,
  storedShareLinksOf,
} from '../__tests__/arrangements'

/*
 * The share links of a file against the API: the links below the file,
 * the issue of a link and the address that gives it, which the API opens,
 * and the screen of a link, which revokes it. The seed data has no file
 * and no share link; the files and the links a test needs are put into
 * the database. Opening a link is the screen of the portal
 * (`share.integration.test.tsx` there, and the browser tests).
 */

const PORTAL = 'https://portal.salon.example'

const CONSENT = 'カラー同意書_田中様.pdf'

const PASSWORD = 'umi no mieru heya'

const DAY = 24 * 60 * 60 * 1000

/** A form of the salon in Tokyo that the owner uploaded: its ID, and the ID of the salon */
const consentOfTokyo = async () => {
  const salonId = await salonIdOf(TOKYO)
  const attachmentId = await arrangeFile({
    salonId,
    filename: CONSENT,
    uploadedBy: OWNER,
  })

  return { salonId, attachmentId }
}

/** The part of the screen of the file that holds its links */
const linksPart = () => screen.getByRole('region', { name: '共有リンク' })

/** Opens the screen of a file, and waits for its links to be read. */
const openFileAs = async (
  file: { salonId: string; attachmentId: string },
  email: string,
): Promise<void> => {
  await openAs(attachmentHrefOf(file.salonId, file.attachmentId), email)
  await heading(CONSENT)
  await waitFor(() =>
    expect(
      within(linksPart()).queryByText('共有リンクを読み込んでいます'),
    ).toBeNull(),
  )
}

/** Each term of a part of the screen with its description */
const detailsOf = (region: string): string[][] => {
  const part = screen.getByRole('region', { name: region })
  const descriptions = within(part).getAllByRole('definition')

  return within(part)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

/** Opens the form of a link of a file, and waits until the file is read. */
const openFormAs = async (
  file: { salonId: string; attachmentId: string },
  email: string,
): Promise<void> => {
  await openAs(shareLinkEntryHrefOf(file.salonId, file.attachmentId), email)
  await screen.findByRole('combobox', { name: '有効期間' })
}

const periodControl = () => screen.getByRole('combobox', { name: '有効期間' })

const limitControl = () =>
  screen.getByRole('textbox', { name: 'ダウンロードの回数の上限' })

const passwordControl = () =>
  screen.getByLabelText('パスワード', { selector: 'input' })

const ISSUE = '共有リンクを発行する'

/** The address of the link that was issued, as the page shows it */
const issuedAddress = async (): Promise<string> => {
  const field = await screen.findByRole('textbox', { name: '共有リンク' })

  return field.getAttribute('value') ?? ''
}

/** The token in an address the page gave */
const tokenOf = (given: string): string => given.split('#token=')[1] ?? ''

const MOMENT = /^\d{4}年\d+月\d+日（.） \d{2}:\d{2}$/

describe('the share links of a file', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_PORTAL_APP_URL', PORTAL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the links below the file', () => {
    it('should list the links of a file to the owner, the latest issued first, with what each allows and whether it still opens the file', async () => {
      // Arrange
      const file = await consentOfTokyo()
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: MANAGER,
        hoursAgo: 48,
        hoursLeft: -1,
        downloadCount: 2,
      })
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
        hoursAgo: 5,
        maxDownloads: 1,
        downloadCount: 1,
      })
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
        hoursAgo: 1,
        maxDownloads: 3,
        withPassword: true,
      })

      // Act
      await openFileAs(file, OWNER)

      // Assert
      const rows = rowsOf('発行した共有リンク')
      expect(rows.map(([issued, ends]) => [issued, ends])).toEqual([
        [expect.stringMatching(MOMENT), expect.stringMatching(MOMENT)],
        [expect.stringMatching(MOMENT), expect.stringMatching(MOMENT)],
        [expect.stringMatching(MOMENT), expect.stringMatching(MOMENT)],
      ])
      expect(rows.map((row) => row.slice(2))).toEqual([
        ['0 回（上限 3 回）', 'あり', '使える'],
        ['1 回（上限 1 回）', 'なし', '回数の上限に達した'],
        ['2 回（上限なし）', 'なし', '期限切れ'],
      ])
      expect(
        within(linksPart()).getByRole('link', { name: ISSUE }),
      ).toHaveAttribute(
        'href',
        shareLinkEntryHrefOf(file.salonId, file.attachmentId),
      )
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should read the links that come next, after the first twenty', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      for (const hoursAgo of Array.from({ length: 21 }, (_, at) => at + 1)) {
        await arrangeShareLink({
          attachmentId: file.attachmentId,
          issuedBy: OWNER,
          hoursAgo,
        })
      }
      await openFileAs(file, OWNER)
      expect(rowsOf('発行した共有リンク')).toHaveLength(20)

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await waitFor(() => expect(rowsOf('発行した共有リンク')).toHaveLength(21))
      expect(within(linksPart()).getByText('21 件')).toBeVisible()
    })

    it('should say that a file was never shared, and offer to share it', async () => {
      // Arrange
      const file = await consentOfTokyo()

      // Act
      await openFileAs(file, MANAGER)

      // Assert
      expect(
        within(linksPart()).getByText('共有リンクはありません'),
      ).toBeVisible()
      expect(
        within(linksPart()).getByRole('link', { name: ISSUE }),
      ).toBeVisible()
    })

    it('should read the links anew whenever the file is opened, with those others issued meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFileAs(file, OWNER)
      await user.click(within(linksPart()).getByRole('link', { name: ISSUE }))
      await screen.findByRole('combobox', { name: '有効期間' })
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: MANAGER,
      })

      // Act
      await user.click(screen.getByRole('link', { name: 'やめる' }))

      // Assert
      await heading(CONSENT)
      await waitFor(() => expect(rowsOf('発行した共有リンク')).toHaveLength(1))
    })

    it('should tell a stylist who shares a file, and read no link for them', async () => {
      // Arrange
      const file = await consentOfTokyo()
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })

      // Act
      await openFileAs(file, STYLIST)

      // Assert
      expect(
        within(linksPart()).getByText(/オーナー、マネージャー、管理者です/),
      ).toBeVisible()
      expect(within(linksPart()).queryByRole('link')).toBeNull()
      expect(within(linksPart()).queryByRole('table')).toBeNull()
    })
  })

  describe('the issue of a link', () => {
    it('should lead a manager from the file to the form, issue a link of seven days without a limit or a password, and give it once as an address of the portal that the API opens', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFileAs(file, MANAGER)
      await user.click(within(linksPart()).getByRole('link', { name: ISSUE }))
      await screen.findByRole('combobox', { name: '有効期間' })
      expect(await findAccessibilityViolations()).toEqual([])
      const before = Date.now()

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      const given = await issuedAddress()
      const after = Date.now()
      expect(given).toMatch(
        new RegExp(`^${PORTAL}/share#token=[A-Za-z0-9_-]{43}$`),
      )
      expect(
        screen.getByRole('heading', { name: '発行した共有リンク' }),
      ).toHaveFocus()
      expect(detailsOf('発行した共有リンク')).toEqual([
        ['有効期限', expect.stringMatching(MOMENT)],
        ['ダウンロードの回数の上限', '上限なし'],
        ['パスワード', 'なし'],
      ])
      const [stored] = await storedShareLinksOf(file.attachmentId)
      expect(stored).toMatchObject({
        maxDownloads: null,
        downloadCount: 0,
        passwordHashed: null,
        issuedBy: MANAGER,
      })
      // Seven days of 24 hours after the button was pressed, in whole minutes
      expect(stored?.expiresAt).toBeGreaterThan(before + 7 * DAY - 60_000)
      expect(stored?.expiresAt).toBeLessThanOrEqual(after + 7 * DAY)
      expect((stored?.expiresAt ?? 1) % 60_000).toBe(0)
      expect(await openedWith(tokenOf(given), null)).toBe(CONSENT)
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: 'ファイルへ戻る' }))

      // Assert: the list read before the issue is not shown meanwhile
      await heading(CONSENT)
      expect(
        within(linksPart()).queryByText('共有リンクはありません'),
      ).toBeNull()
      await waitFor(() => expect(rowsOf('発行した共有リンク')).toHaveLength(1))
      expect(rowsOf('発行した共有リンク')[0]?.slice(2)).toEqual([
        '0 回（上限なし）',
        'なし',
        '使える',
      ])
    })

    it('should issue a link of thirty days with a limit and a password, which the API opens with that password alone', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.selectOptions(periodControl(), '30 日')
      await user.type(limitControl(), '３')
      await user.type(passwordControl(), PASSWORD)
      const before = Date.now()

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      const given = await issuedAddress()
      expect(detailsOf('発行した共有リンク').slice(1)).toEqual([
        ['ダウンロードの回数の上限', '3 回'],
        ['パスワード', 'あり'],
      ])
      expect(screen.getByText(/リンクとは別の方法/)).toBeVisible()
      const [stored] = await storedShareLinksOf(file.attachmentId)
      expect(stored).toMatchObject({
        maxDownloads: 3,
        passwordHashed: true,
        issuedBy: OWNER,
      })
      expect(stored?.expiresAt).toBeGreaterThan(before + 30 * DAY - 60_000)
      expect(await openedWith(tokenOf(given), null)).toBe(403)
      expect(await openedWith(tokenOf(given), PASSWORD)).toBe(CONSENT)
    })

    it('should copy the address of the link, and say so', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.click(screen.getByRole('button', { name: ISSUE }))
      const given = await issuedAddress()

      // Act
      await user.click(
        screen.getByRole('button', { name: 'リンクをコピーする' }),
      )

      // Assert
      expect(await screen.findByText('リンクをコピーしました。')).toBeVisible()
      expect(await navigator.clipboard.readText()).toBe(given)
    })

    it('should say how to copy the link when the browser does not let the page write to the clipboard', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new DOMException('Write permission denied.', 'NotAllowedError'),
      )
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.click(screen.getByRole('button', { name: ISSUE }))
      await issuedAddress()

      // Act
      await user.click(
        screen.getByRole('button', { name: 'リンクをコピーする' }),
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '上の欄のアドレスを選んで、コピーしてください',
      )
    })

    it('should say at the password that the API refused one too easy to guess, and issue nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.type(passwordControl(), 'password123')

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      await waitFor(() =>
        expect(passwordControl()).toHaveAccessibleDescription(
          /推測されやすいパスワードです/,
        ),
      )
      expect(passwordControl()).toHaveFocus()
      expect(await storedShareLinksOf(file.attachmentId)).toEqual([])
    })

    it('should say at their controls that a password is too short and a limit no whole number, without asking the API', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.type(limitControl(), '0')
      await user.type(passwordControl(), 'umiheya')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      expect(limitControl()).toHaveAccessibleDescription(/1 から/)
      expect(limitControl()).toHaveFocus()
      expect(passwordControl()).toHaveAccessibleDescription(
        /8 文字から 128 文字/,
      )
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should say that a link could not be issued when the database fails, and keep what was typed', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.type(limitControl(), '2')
      await refuse('insert', 'share_links')

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      expect(
        await screen.findByText(
          '共有リンクを発行できませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(limitControl()).toHaveValue('2')
    })

    it('should say that a file removed while the form was open is gone', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await fileRemovedMeanwhile(file.attachmentId)

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      expect(await heading('ファイルが見つかりません')).toBeVisible()
      expect(await storedShareLinksOf(file.attachmentId)).toEqual([])
    })

    it('should read the file anew when the form opens, and say that a file removed since is gone', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFileAs(file, OWNER)
      await fileRemovedMeanwhile(file.attachmentId)

      // Act
      await user.click(within(linksPart()).getByRole('link', { name: ISSUE }))

      // Assert
      expect(await heading('ファイルが見つかりません')).toBeVisible()
      expect(
        within(screen.getByRole('main')).queryByRole('combobox'),
      ).toBeNull()
    })

    it('should let an administrator issue a link of a file of a salon', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OPERATOR)

      // Act
      await user.click(screen.getByRole('button', { name: ISSUE }))

      // Assert
      expect(await issuedAddress()).toContain(`${PORTAL}/share#token=`)
      expect(await storedShareLinksOf(file.attachmentId)).toMatchObject([
        { issuedBy: OPERATOR },
      ])
    })

    it('should tell a stylist at the address of the form who shares a file, without the form', async () => {
      // Arrange
      const file = await consentOfTokyo()

      // Act
      await openAs(
        shareLinkEntryHrefOf(file.salonId, file.attachmentId),
        STYLIST,
      )

      // Assert
      expect(await heading(ISSUE)).toBeVisible()
      expect(
        screen.getByText(/このアカウントでは、ファイルを共有できません/),
      ).toBeVisible()
      expect(
        within(screen.getByRole('main')).queryByRole('combobox'),
      ).toBeNull()
      expect(
        screen.getByRole('link', { name: 'ファイルへ戻る' }),
      ).toHaveAttribute(
        'href',
        attachmentHrefOf(file.salonId, file.attachmentId),
      )
    })

    it.each<[string, () => Promise<{ salonId: string; attachmentId: string }>]>(
      [
        [
          'a file of another salon at the address of this one',
          async () => ({
            salonId: await salonIdOf(OSAKA),
            attachmentId: (await consentOfTokyo()).attachmentId,
          }),
        ],
        [
          'a file that was removed',
          async () => {
            const file = await consentOfTokyo()
            await fileRemovedMeanwhile(file.attachmentId)

            return file
          },
        ],
      ],
    )(
      'should say that %s is not found, without the form',
      async (_, arrange) => {
        // Arrange
        const file = await arrange()

        // Act
        await openAs(
          shareLinkEntryHrefOf(file.salonId, file.attachmentId),
          OPERATOR,
        )

        // Assert
        expect(await heading('ファイルが見つかりません')).toBeVisible()
        expect(
          within(screen.getByRole('main')).queryByRole('combobox'),
        ).toBeNull()
      },
    )

    it('should say that a file whose upload was not finished is not found, without the form', async () => {
      // Arrange
      const salonId = await salonIdOf(TOKYO)
      const attachmentId = await arrangeAwaitedFile({
        salonId,
        filename: CONSENT,
        uploadedBy: OWNER,
      })

      // Act
      await openAs(shareLinkEntryHrefOf(salonId, attachmentId), OWNER)

      // Assert
      expect(await heading('ファイルが見つかりません')).toBeVisible()
      expect(
        within(screen.getByRole('main')).queryByRole('combobox'),
      ).toBeNull()
    })
  })

  describe('a link and its revocation', () => {
    it('should lead from the list to a link, and revoke it after the dialog asks, so that the API opens nothing with it', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      await openFormAs(file, OWNER)
      await user.type(limitControl(), '5')
      await user.click(screen.getByRole('button', { name: ISSUE }))
      const token = tokenOf(await issuedAddress())
      await user.click(screen.getByRole('link', { name: 'ファイルへ戻る' }))
      await waitFor(() => expect(rowsOf('発行した共有リンク')).toHaveLength(1))
      await user.click(within(linksPart()).getByRole('link', { name: MOMENT }))
      await screen.findByRole('button', { name: '共有リンクを取り消す' })
      expect(screen.getByText(`${CONSENT}（${TOKYO}）`)).toBeVisible()
      expect(detailsOf('共有リンク')).toEqual([
        ['状態', '使える'],
        ['有効期限', expect.stringMatching(MOMENT)],
        ['ダウンロード', '0 回（上限 5 回）'],
        ['パスワード', 'なし'],
        ['発行した人', 'あなた'],
        ['発行日時', expect.stringMatching(MOMENT)],
      ])
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await user.click(
        screen.getByRole('button', { name: '共有リンクを取り消す' }),
      )
      const dialog = screen.getByRole('dialog', {
        name: '共有リンクを取り消しますか？',
      })
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      expect(
        await screen.findByText('共有リンクを取り消しました。'),
      ).toBeVisible()
      // The list read before the revocation is not shown meanwhile
      expect(
        within(linksPart()).queryByRole('table', {
          name: '発行した共有リンク',
        }),
      ).toBeNull()
      await heading(CONSENT)
      expect(address()).toBe(attachmentHrefOf(file.salonId, file.attachmentId))
      expect(
        await within(linksPart()).findByText('共有リンクはありません'),
      ).toBeVisible()
      expect(await storedShareLinksOf(file.attachmentId)).toEqual([])
      expect(await openedWith(token, null)).toBe(404)
    })

    it('should say that a link revoked meanwhile is gone, when it is to be revoked', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: MANAGER,
      })
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        OWNER,
      )
      await screen.findByRole('button', { name: '共有リンクを取り消す' })
      await revokedMeanwhile(shareLinkId)

      // Act
      await user.click(
        screen.getByRole('button', { name: '共有リンクを取り消す' }),
      )
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: '取り消す',
        }),
      )

      // Assert
      expect(await heading('共有リンクが見つかりません')).toBeVisible()
    })

    it('should say in the dialog that a link could not be revoked when the database fails', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        MANAGER,
      )
      await screen.findByRole('button', { name: '共有リンクを取り消す' })
      await refuse('delete', 'share_links')

      // Act
      await user.click(
        screen.getByRole('button', { name: '共有リンクを取り消す' }),
      )
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '共有リンクを取り消せませんでした',
      )
      expect(await storedShareLinksOf(file.attachmentId)).toHaveLength(1)
    })

    it.each<[string, (file: { attachmentId: string }) => Promise<string>]>([
      [
        'a link that was revoked',
        async ({ attachmentId }) => {
          const id = await arrangeShareLink({
            attachmentId,
            issuedBy: OWNER,
          })
          await revokedMeanwhile(id)

          return id
        },
      ],
      [
        'a link of another file at the address of this one',
        async () => {
          const other = await consentOfTokyo()

          return arrangeShareLink({
            attachmentId: other.attachmentId,
            issuedBy: OWNER,
          })
        },
      ],
    ])('should say that %s is not found', async (_, arrange) => {
      // Arrange
      const file = await consentOfTokyo()
      const shareLinkId = await arrange(file)

      // Act
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        OWNER,
      )

      // Assert
      expect(await heading('共有リンクが見つかりません')).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'ファイルへ戻る' }),
      ).toHaveAttribute(
        'href',
        attachmentHrefOf(file.salonId, file.attachmentId),
      )
    })

    it('should never show a link as an earlier screen read it, since it may have been revoked', async () => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        OWNER,
      )
      await screen.findByRole('button', { name: '共有リンクを取り消す' })
      await user.click(screen.getByRole('link', { name: 'ファイルへ戻る' }))
      await waitFor(() => expect(rowsOf('発行した共有リンク')).toHaveLength(1))
      await revokedMeanwhile(shareLinkId)

      // Act
      await user.click(within(linksPart()).getByRole('link', { name: MOMENT }))

      // Assert
      expect(
        screen.queryByRole('button', { name: '共有リンクを取り消す' }),
      ).toBeNull()
      expect(await heading('共有リンクが見つかりません')).toBeVisible()
    })

    it('should say that a link of a file of another salon is not found at the address of this one', async () => {
      // Arrange
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })

      // Act
      await openAs(
        shareLinkHrefOf(await salonIdOf(OSAKA), file.attachmentId, shareLinkId),
        OPERATOR,
      )

      // Assert
      expect(await heading('ファイルが見つかりません')).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '共有リンクを取り消す' }),
      ).toBeNull()
    })

    it('should tell a stylist at the address of a link who shares a file, and read no link for them', async () => {
      // Arrange
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })

      // Act
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        STYLIST,
      )

      // Assert
      expect(await heading('共有リンク')).toBeVisible()
      expect(
        screen.getByText(/このアカウントでは、ファイルを共有できません/),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '共有リンクを取り消す' }),
      ).toBeNull()
    })
  })
})

describe('the share links of a file on a page in English', () => {
  /** A moment as a page in English writes it */
  const MOMENT_IN_ENGLISH =
    /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d+, \d{4} at \d{2}:\d{2}$/

  const englishLinksPart = () =>
    screen.getByRole('region', { name: 'Share links' })

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_PORTAL_APP_URL', PORTAL)
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should list the links of a file in English', async () => {
    // Arrange
    const file = await consentOfTokyo()
    await arrangeShareLink({
      attachmentId: file.attachmentId,
      issuedBy: OWNER,
      hoursAgo: 5,
      maxDownloads: 1,
      downloadCount: 1,
    })
    await arrangeShareLink({
      attachmentId: file.attachmentId,
      issuedBy: OWNER,
      hoursAgo: 1,
      maxDownloads: 3,
      withPassword: true,
    })

    // Act
    await openAs(attachmentHrefOf(file.salonId, file.attachmentId), OWNER, 'en')

    // Assert
    await heading(CONSENT)
    await waitFor(() => expect(rowsOf('Issued share links')).toHaveLength(2))
    const rows = rowsOf('Issued share links')
    expect(rows.map(([issued]) => issued)).toEqual([
      expect.stringMatching(MOMENT_IN_ENGLISH),
      expect.stringMatching(MOMENT_IN_ENGLISH),
    ])
    expect(rows.map((row) => row.slice(2))).toEqual([
      ['0 times (limit: 3 times)', 'Set', 'Usable'],
      ['1 time (limit: 1 time)', 'None', 'Download limit reached'],
    ])
    expect(
      within(englishLinksPart()).getByRole('link', {
        name: 'Issue a share link',
      }),
    ).toBeVisible()
  })

  it('should issue a link from the form in English, and say what it allows', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    await openAs(
      shareLinkEntryHrefOf(file.salonId, file.attachmentId),
      MANAGER,
      'en',
    )
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Valid for' }),
      '30 days',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Download limit' }),
      '2',
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Issue a share link' }))

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Issued share link' }),
    ).toHaveFocus()
    expect(detailsOf('Issued share link')).toEqual([
      ['Expires', expect.stringMatching(MOMENT_IN_ENGLISH)],
      ['Download limit', '2 times'],
      ['Password', 'None'],
    ])
    expect(screen.getByRole('textbox', { name: 'Share link' })).toHaveAttribute(
      'value',
      expect.stringMatching(`^${PORTAL}/share#token=`),
    )
  })

  it('should say in English at the password that the API refused one too easy to guess', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    await openAs(
      shareLinkEntryHrefOf(file.salonId, file.attachmentId),
      OWNER,
      'en',
    )
    await screen.findByRole('combobox', { name: 'Valid for' })
    await user.type(
      screen.getByLabelText('Password', { selector: 'input' }),
      'password123',
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Issue a share link' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByLabelText('Password', { selector: 'input' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining('This password is easy to guess.'),
      ),
    )
    expect(await storedShareLinksOf(file.attachmentId)).toEqual([])
  })

  it('should revoke a link after the dialog asks, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    await arrangeShareLink({
      attachmentId: file.attachmentId,
      issuedBy: OWNER,
      hoursAgo: 1,
    })
    await openAs(attachmentHrefOf(file.salonId, file.attachmentId), OWNER, 'en')
    await heading(CONSENT)
    await waitFor(() => expect(rowsOf('Issued share links')).toHaveLength(1))
    await user.click(
      within(englishLinksPart()).getByRole('link', { name: MOMENT_IN_ENGLISH }),
    )
    await screen.findByRole('button', { name: 'Revoke the share link' })
    expect(screen.getByText(`${CONSENT} (${TOKYO})`)).toBeVisible()
    expect(detailsOf('Share link')).toContainEqual(['Issued by', 'You'])

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Revoke the share link' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke the share link?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    // Assert
    expect(await screen.findByText('Revoked the share link.')).toBeVisible()
    await heading(CONSENT)
    expect(address()).toBe(attachmentHrefOf(file.salonId, file.attachmentId))
    expect(
      await within(englishLinksPart()).findByText('No share links'),
    ).toBeVisible()
    expect(await storedShareLinksOf(file.attachmentId)).toEqual([])
  })

  it('should tell a stylist in English who shares a file', async () => {
    // Arrange
    const file = await consentOfTokyo()

    // Act
    await openAs(
      shareLinkEntryHrefOf(file.salonId, file.attachmentId),
      STYLIST,
      'en',
    )

    // Assert
    expect(await heading('Issue a share link')).toBeVisible()
    expect(
      screen.getByText(
        'This account cannot share files. Only the owners and managers of the salon and administrators can issue and revoke the share links of files.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to the file' })).toBeVisible()
  })

  it('should tell a stylist in English below a file who shares it', async () => {
    // Arrange
    const file = await consentOfTokyo()

    // Act
    await openAs(
      attachmentHrefOf(file.salonId, file.attachmentId),
      STYLIST,
      'en',
    )

    // Assert
    await heading(CONSENT)
    expect(
      await within(englishLinksPart()).findByText(
        'Only the owners and managers of the salon and administrators can issue and revoke the share links of files.',
      ),
    ).toBeVisible()
    expect(within(englishLinksPart()).queryByRole('link')).toBeNull()
  })
})
