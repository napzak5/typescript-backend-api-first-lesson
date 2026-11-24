import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as systemStateStories from './system-state.stories'

const stories = composeStories(systemStateStories)

const record = (name = 'システムの状態') => screen.getByRole('region', { name })

/** The terms of the record, each with what it says */
const describedOf = (name?: string): string[][] =>
  within(record(name))
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
        '3,002 ミリ秒',
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

describe('SystemStateRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the state of the system in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Running.run()

    // Assert
    expect(describedOf('State of the system')).toEqual([
      ['Process', 'Running'],
      ['Accepting requests', 'Accepting'],
      ['Overall state', 'Healthy'],
      ['API version', '1.0.0'],
      ['Checked', 'Fri, November 20, 2026 at 12:00'],
    ])
    const dependencies = within(record('State of the system')).getByRole(
      'table',
      { name: 'State of the dependencies' },
    )
    expect(
      within(dependencies)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Dependency', 'Status', 'Response time', 'Error'])
    expect(rowsOf(dependencies)).toEqual([['Database', 'Up', '4 ms', 'None']])
    expect(screen.getByRole('button', { name: 'Check again' })).toBeVisible()
  })

  it('should say in English that the API takes no requests, since its database does not answer', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithoutDatabase.run()

    // Assert
    expect(describedOf('State of the system').slice(0, 3)).toEqual([
      ['Process', 'Running'],
      ['Accepting requests', 'Not accepting (Database cannot be reached)'],
      ['Overall state', 'Down'],
    ])
    expect(rowsOf('State of the dependencies')).toEqual([
      ['Database', 'Down', '3,002 ms', 'Database is unreachable'],
    ])
  })

  it('should say in English that no probe answered', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Silent.run()

    // Assert
    expect(describedOf('State of the system').slice(0, 3)).toEqual([
      ['Process', 'No answer'],
      ['Accepting requests', 'No answer'],
      ['Overall state', 'No answer'],
    ])
  })
})
