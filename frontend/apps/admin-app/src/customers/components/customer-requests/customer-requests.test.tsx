import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as customerRequestsStories from './customer-requests.stories'

const stories = composeStories(customerRequestsStories)

describe('CustomerRequests', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the data is for and export it when asked', async () => {
    // Arrange
    await stories.Answerable.run()
    expect(
      screen.getByRole('heading', { level: 2, name: 'ご本人からの請求' }),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map(({ textContent }) => textContent),
    ).toEqual(['データの開示', 'データの消去'])
    expect(
      screen.getByText(/保有している個人データの開示を求められたときは/),
    ).toHaveTextContent(
      'ご本人であることを確かめてから、データを出力してお渡しします。',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'データを出力する' }),
    )

    // Assert
    expect(stories.Answerable.args.dataExport?.onExport).toHaveBeenCalledTimes(
      1,
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should tell a member of the staff who answers, and offer nothing', async () => {
    // Act
    await stories.ByOthers.run()

    // Assert
    expect(
      screen.getByText(
        'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('should not export again while the data is on its way', async () => {
    // Arrange
    await stories.Exporting.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'データを出力する' }),
    )

    // Assert
    expect(stories.Exporting.args.dataExport?.onExport).not.toHaveBeenCalled()
  })

  it('should say why no file was saved, and export again when asked', async () => {
    // Arrange
    await stories.NotSaved.run()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'お客様のデータを出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'データを出力する' }),
    )

    // Assert
    expect(stories.NotSaved.args.dataExport?.onExport).toHaveBeenCalledTimes(1)
  })

  it('should offer no export of a customer who left the ledger, and show their request', async () => {
    // Act
    await stories.Removed.run()

    // Assert
    expect(
      screen.queryByRole('button', { name: 'データを出力する' }),
    ).toBeNull()
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map(({ textContent }) => textContent),
    ).toEqual(['データの消去'])
    expect(screen.getByRole('button', { name: '依頼を取り消す' })).toBeVisible()
  })
})

describe('CustomerRequests on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what the data is for, and why no file was saved, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotSaved.run()

    // Assert
    const disclosure = screen.getByRole('region', {
      name: 'Disclosure of the data',
    })
    expect(
      screen.getByRole('region', { name: 'Requests from the customer' }),
    ).toContainElement(disclosure)
    expect(disclosure).toHaveTextContent(
      'When a customer asks to see the personal data held of them, make sure it is the customer, then export the data and hand it to them.',
    )
    expect(within(disclosure).getByRole('alert')).toHaveTextContent(
      'The data of the customer could not be exported. Check your connection and try again.',
    )
    expect(
      within(disclosure).getByRole('button', { name: 'Export the data' }),
    ).toBeVisible()
  })

  it('should tell a member of the staff in English who answers', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ByOthers.run()

    // Assert
    expect(
      screen.getByText(
        'Owners and managers answer the requests of customers to see or erase their data.',
      ),
    ).toBeVisible()
  })
})
