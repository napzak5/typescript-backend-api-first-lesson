import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as fileFieldStories from './file-field.stories'

const stories = composeStories(fileFieldStories)

const LABEL = 'CSV ファイル'

const control = (): HTMLInputElement => screen.getByLabelText(LABEL)

describe('FileField', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be named by its label, and take the kinds of file it is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(control()).toHaveAttribute('type', 'file')
    expect(control()).toHaveAttribute('accept', '.csv,text/csv')
    expect(control()).toHaveAttribute('name', 'file')
  })

  it('should take the chosen file and report the change', async () => {
    // Arrange
    await stories.Default.run()
    const file = new File(['lastName\r\n'], 'customers.csv', {
      type: 'text/csv',
    })

    // Act
    await userEvent.upload(control(), file)

    // Assert
    expect(control().files?.item(0)).toBe(file)
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(1)
  })

  it('should be reached with the Tab key', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(control()).toHaveFocus()
  })

  it('should be described by its description, then by its error, and be invalid while it has one', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(control()).toHaveAttribute('aria-invalid', 'true')
    expect(control()).toHaveAccessibleDescription(
      'UTF-8 か Shift_JIS の、カンマで区切ったファイル ファイルを選んでください',
    )
  })

  it('should say nothing about the file without a description or an error', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(control()).not.toHaveAttribute('aria-describedby')
    expect(control()).not.toHaveAttribute('aria-invalid')
  })

  it('should be required for the browser, marked for the eye, and still named by its label alone', async () => {
    // Act
    await stories.Required.run()

    // Assert
    expect(control()).toBeRequired()
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
    expect(control()).toHaveAccessibleName(LABEL)
  })

  it('should take no file while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()

    // Act
    await userEvent.upload(
      control(),
      new File(['lastName\r\n'], 'customers.csv', { type: 'text/csv' }),
    )

    // Assert
    expect(control()).toBeDisabled()
    expect(control().files).toHaveLength(0)
    expect(stories.Disabled.args.onChange).not.toHaveBeenCalled()
  })
})
