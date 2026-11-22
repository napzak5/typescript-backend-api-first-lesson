import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as systemStateStories from './system-state.stories'

const stories = composeStories(systemStateStories)

const record = () => screen.getByRole('region', { name: 'システムの状態' })

/** The terms of the record, each with what it says */
const describedOf = (): string[][] =>
  within(record())
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('SystemStateRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say that the API runs, takes requests and reaches its database, and when it was asked', async () => {
    // Act
    await stories.Running.run()

    // Assert
    expect(describedOf()).toEqual([
      ['プロセス', '動いています'],
      ['リクエストの受け付け', '受け付けています'],
      ['全体の状態', '正常です'],
      ['API のバージョン', '1.0.0'],
      ['確かめた日時', '2026年11月20日（金） 12:00'],
    ])
    const dependencies = within(record()).getByRole('table', {
      name: '依存先の状態',
    })
    expect(
      within(dependencies)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['依存先', '状態', '応答時間', 'エラー'])
    expect(rowsOf(dependencies)).toEqual([
      ['データベース', '動いています', '4 ミリ秒', 'ありません'],
    ])
  })

  it('should ask the probes again when its button is pressed', async () => {
    // Arrange
    const onCheck = vi.fn()
    await stories.Running.run({ args: { ...stories.Running.args, onCheck } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度確かめる' }),
    )

    // Assert
    expect(onCheck).toHaveBeenCalledOnce()
  })

  it('should not ask again while the probes are being asked', async () => {
    // Arrange
    const onCheck = vi.fn()
    await stories.Checking.run({ args: { ...stories.Checking.args, onCheck } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度確かめる' }),
    )

    // Assert
    expect(onCheck).not.toHaveBeenCalled()
  })

  it('should say that the API runs and takes no requests, since its database does not answer', async () => {
    // Act
    await stories.WithoutDatabase.run()

    // Assert
    expect(describedOf().slice(0, 3)).toEqual([
      ['プロセス', '動いています'],
      [
        'リクエストの受け付け',
        '受け付けていません（データベースに接続できません）',
      ],
      ['全体の状態', '止まっています'],
    ])
    expect(rowsOf('依存先の状態')).toEqual([
      [
        'データベース',
        '止まっています',
        '3002 ミリ秒',
        'Database is unreachable',
      ],
    ])
  })

  it('should say that no probe answered, with nothing that only an answer tells', async () => {
    // Act
    await stories.Silent.run()

    // Assert
    expect(describedOf()).toEqual([
      ['プロセス', '応答がありません'],
      ['リクエストの受け付け', '応答がありません'],
      ['全体の状態', '応答がありません'],
      ['確かめた日時', '2026年11月20日（金） 12:00'],
    ])
    expect(screen.queryByRole('table')).toBeNull()
  })
})
