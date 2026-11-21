import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import * as pageHeaderStories from './page-header.stories'

const stories = composeStories(pageHeaderStories)

const otherActions = () => screen.getByRole('button', { name: 'ほかの操作' })
const sheet = () => screen.getByRole('dialog', { name: 'ほかの操作' })

describe('PageHeader', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show its title as the one heading of level 1', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(
      screen.getByRole('heading', { level: 1, name: '予約台帳' }),
    ).toBeVisible()
  })

  it('should show its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(screen.getByText('今日の予約は 12 件です。')).toHaveClass(
      'description',
    )
  })

  it('should show its actions', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    expect(
      screen.getByRole('link', { name: '新しい予約' }).parentElement,
    ).toHaveClass('actions')
  })

  it('should hold nothing but its title when it is given nothing else', async () => {
    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(
      screen.getByRole('heading').parentElement?.parentElement,
    ).toHaveTextContent(/^予約台帳$/)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('should leave the title of the document alone outside the frame of an application', async () => {
    // Arrange
    document.title = 'カタログ'

    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(document.title).toBe('カタログ')
  })

  it('should put the other actions in the row of its actions on a wide screen', async () => {
    // Act
    await stories.WithOtherActions.run()

    // Assert
    const main = screen.getByRole('link', { name: 'お客様を登録する' })
    const other = screen.getByRole('button', { name: 'CSV に出力する' })
    expect(other.parentElement).toBe(main.parentElement)
    expect(screen.queryByRole('button', { name: 'ほかの操作' })).toBeNull()
  })

  it('should keep the main action in sight on a narrow screen, and the other actions behind a button', async () => {
    // Act
    await stories.OtherActionsOnANarrowScreen.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'お客様を登録する' }).parentElement,
    ).toBe(otherActions().parentElement)
    expect(otherActions()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('link', { name: 'カルテを探す' })).toBeNull()
  })

  it('should open the other actions as a sheet, one below the other', async () => {
    // Act
    await stories.OtherActionsInTheSheet.run()

    // Assert
    const inTheSheet = within(sheet())
    expect(
      inTheSheet.getByRole('link', { name: 'CSV から登録する' }).parentElement,
    ).toHaveClass('otherActions')
    expect(
      inTheSheet.getByRole('link', { name: 'カルテを探す' }),
    ).toHaveAttribute('href', '/customers/charts')
    expect(
      inTheSheet.getByRole('button', { name: 'CSV に出力する' }),
    ).toBeVisible()
  })

  it('should close the sheet once one of its actions has done its work', async () => {
    // Arrange
    const onExport = vi.fn<() => void>()
    await stories.OtherActionsInTheSheet.run({
      args: {
        ...stories.OtherActionsInTheSheet.args,
        otherActions: (
          <>
            <ButtonLink href='/customers/import' variant='secondary'>
              CSV から登録する
            </ButtonLink>
            <Button onClick={onExport}>CSV に出力する</Button>
          </>
        ),
      },
    })

    // Act
    await userEvent.click(
      within(sheet()).getByRole('button', { name: 'CSV に出力する' }),
    )

    // Assert
    expect(onExport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should close the sheet with its button, and do nothing else', async () => {
    // Arrange
    await stories.OtherActionsInTheSheet.run()

    // Act
    await userEvent.click(
      within(sheet()).getByRole('button', { name: '閉じる' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should put the other actions of an open sheet in the row when the window is made wide, and keep the sheet closed when it is made narrow again', async () => {
    // Arrange
    await stories.OtherActionsInTheSheet.run()

    // Act
    act(() => setWindowWidth(1024))
    const inTheRow = screen.getByRole('link', { name: 'カルテを探す' })
    act(() => setWindowWidth(390))

    // Assert
    expect(inTheRow.closest('dialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(otherActions()).toBeVisible()
  })

  it('should keep two actions in sight on a narrow screen, without the button of the other actions', async () => {
    // Act
    await stories.TwoActionsOnANarrowScreen.run()

    // Assert
    expect(screen.getByRole('link', { name: '営業時間を直す' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'ほかの操作' })).toBeNull()
  })
})
