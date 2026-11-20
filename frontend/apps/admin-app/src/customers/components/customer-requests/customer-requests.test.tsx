import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as customerRequestsStories from './customer-requests.stories'

const stories = composeStories(customerRequestsStories)

describe('CustomerRequests', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the data is for and export it when asked', async () => {
    // Arrange
    await stories.Answerable.run()
    expect(
      screen.getByRole('heading', { name: 'ご本人からの請求' }),
    ).toBeVisible()
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
    expect(stories.Answerable.args.onExport).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should tell a member of the staff who answers, and offer nothing', async () => {
    // Act
    await stories.ByOthers.run()

    // Assert
    expect(
      screen.getByText(
        'ご本人からのデータの開示の請求には、オーナーとマネージャーが応えます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should not export again while the data is on its way', async () => {
    // Arrange
    await stories.Exporting.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'データを出力する' }),
    )

    // Assert
    expect(stories.Exporting.args.onExport).not.toHaveBeenCalled()
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
    expect(stories.NotSaved.args.onExport).toHaveBeenCalledTimes(1)
  })
})
