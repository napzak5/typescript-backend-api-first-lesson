import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { visit } from '../examples'
import { ReviewForm, type ReviewFormProps } from './review-form'
import * as reviewFormStories from './review-form.stories'

const stories = composeStories(reviewFormStories)

const STYLIST = '田中 ひろし'

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const select = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const overall = (): HTMLElement =>
  screen.getByRole('radiogroup', { name: '総合の評価' })

const rating = (name: string): HTMLElement =>
  within(overall()).getByRole('radio', { name })

/** The names of the selects of the form, in the order of the page. */
const selects = (): (string | null)[] =>
  screen.getAllByRole('combobox').map((control) => control.getAttribute('name'))

const sendButton = (name = 'レビューを投稿する'): HTMLElement =>
  screen.getByRole('button', { name })

const SOMEBODY_ELSE = {
  value: 'c7d2e9b4-1a6f-4c83-b05e-3f8a6d2c9b17',
  label: '佐藤 健太',
}

/**
 * A form whose visit is read again when 「読み込み直す」 is pressed, as the
 * screen does after the API refused a review: the member who was offered
 * is offered no more, and somebody else is.
 */
const ReadAgain = (props: ReviewFormProps) => {
  const [staff, setStaff] = useState(props.staff)

  return (
    <>
      <ReviewForm {...props} staff={staff} />
      <button
        type='button'
        onClick={() => setStaff({ type: 'choice', options: [SOMEBODY_ELSE] })}
      >
        読み込み直す
      </button>
    </>
  )
}

const readAgain = composeStory(
  { ...reviewFormStories.New, render: (args) => <ReadAgain {...args} /> },
  reviewFormStories.default,
)

describe('ReviewForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say who reads a review, and ask in two parts: the ratings, and the words', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      screen.getByText(
        'レビューは、サロンのページに掲載され、誰でも読めます。',
      ),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent),
    ).toEqual(['評価', '感想'])
    expect(
      within(overall())
        .getAllByRole<HTMLInputElement>('radio')
        .map((radio) => [radio.value, radio.labels?.[0]?.textContent]),
    ).toEqual([
      ['5', '5（とても満足）'],
      ['4', '4（満足）'],
      ['3', '3（ふつう）'],
      ['2', '2（やや不満）'],
      ['1', '1（不満）'],
    ])
  })

  it('should open the form of a new review with nothing but the member of the staff the booking was with', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(within(overall()).queryByRole('radio', { checked: true })).toBeNull()
    expect(overall()).toBeRequired()
    expect(select('評価するスタッフ')).toHaveValue(visit.booking.staffId)
    expect(
      within(select('評価するスタッフ'))
        .getAllByRole('option')
        .map((option) => [option.getAttribute('value'), option.textContent]),
    ).toEqual([
      ['', 'スタッフを評価しない'],
      [visit.booking.staffId, STYLIST],
    ])
    expect(selects()).toEqual([
      'staffId',
      'serviceRating',
      'staffRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])
    for (const name of ['サービス', 'スタッフ', '雰囲気', '清潔さ', '価格']) {
      expect(select(name)).toHaveValue('')
      expect(
        within(select(name))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        '評価しない',
        '5（とても満足）',
        '4（満足）',
        '3（ふつう）',
        '2（やや不満）',
        '1（不満）',
      ])
    }
    for (const control of screen.getAllByRole('textbox')) {
      expect(control).toHaveValue('')
    }
  })

  it('should have no rating of the staff while nobody is rated, and one again when somebody is', async () => {
    // Arrange
    await stories.New.run()
    await userEvent.selectOptions(select('スタッフ'), '4')

    // Act
    await userEvent.selectOptions(
      select('評価するスタッフ'),
      'スタッフを評価しない',
    )

    // Assert
    expect(selects()).toEqual([
      'staffId',
      'serviceRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])

    // Act
    await userEvent.selectOptions(select('評価するスタッフ'), STYLIST)

    // Assert: the rating that went with the control is not back
    expect(select('スタッフ')).toHaveValue('')
  })

  it('should choose nobody, and have no rating of the staff, when the member who was chosen is offered no more', async () => {
    // Arrange
    await readAgain.run()
    await userEvent.selectOptions(select('スタッフ'), '4')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '読み込み直す' }))

    // Assert
    expect(select('評価するスタッフ')).toHaveValue('')
    expect(
      within(select('評価するスタッフ'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['スタッフを評価しない', SOMEBODY_ELSE.label])
    expect(selects()).toEqual([
      'staffId',
      'serviceRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])
  })

  it('should have no control for the staff when there is nobody to rate, and say why', async () => {
    // Act
    await stories.NewWithoutStaff.run()

    // Assert
    expect(selects()).toEqual([
      'serviceRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])
    expect(
      screen.getByText(
        'この来店を担当したスタッフは、いまサロンのページに掲載されていないため、スタッフの評価はできません。',
      ),
    ).toBeVisible()
  })

  it('should open the form of a review that is changed with what the review holds, and say whom it rates in place of the choice', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(rating('5（とても満足）')).toBeChecked()
    expect(selects()).toEqual([
      'serviceRating',
      'staffRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])
    expect(select('サービス')).toHaveValue('5')
    expect(select('スタッフ')).toHaveValue('5')
    expect(select('雰囲気')).toHaveValue('4')
    expect(select('清潔さ')).toHaveValue('5')
    expect(select('価格')).toHaveValue('4')
    expect(text('タイトル')).toHaveValue('思ったとおりの色になりました')
    expect(text('本文')).toHaveValue(
      '写真を見せて相談したら、髪の状態に合わせた染め方を提案してくれました。色もちもよいです。',
    )
    expect(text('写真の URL')).toHaveValue(
      'https://images.example.com/reviews/after.jpg\nhttps://images.example.com/reviews/three-weeks-later.jpg',
    )
    expect(
      screen.getByText(
        `評価するスタッフ: ${STYLIST}。評価するスタッフは、変更できません。`,
      ),
    ).toBeVisible()
  })

  it('should say that the member a review rates is no longer shown, and still ask for their rating', async () => {
    // Act
    await stories.WrittenOfStaffThatLeft.run()

    // Assert
    expect(
      screen.getByText(
        '評価するスタッフ: スタッフ（掲載を終えています）。評価するスタッフは、変更できません。',
      ),
    ).toBeVisible()
    expect(select('スタッフ')).toHaveValue('5')
  })

  it('should have no rating of the staff for a review that rates nobody, and say that nobody can be added', async () => {
    // Act
    await stories.WrittenOfNobody.run()

    // Assert
    expect(selects()).toEqual([
      'serviceRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
    ])
    expect(rating('3（ふつう）')).toBeChecked()
    expect(
      screen.getByText(
        'このレビューは、スタッフを評価していません。評価するスタッフは、あとから追加できません。',
      ),
    ).toBeVisible()
  })

  it('should hand over what it holds under the names of the request when it is sent', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.New.run({
      args: {
        ...stories.New.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values])
        }),
      },
    })
    await userEvent.click(rating('4（満足）'))
    await userEvent.selectOptions(select('サービス'), '5')
    await userEvent.selectOptions(select('スタッフ'), '3')
    await userEvent.selectOptions(select('価格'), '2')
    await userEvent.type(text('タイトル'), 'また行きます')
    await userEvent.type(
      text('本文'),
      '丁寧でした。{Enter}待ち時間もありません。',
    )
    await userEvent.type(
      text('写真の URL'),
      'https://images.example.com/reviews/after.jpg',
    )

    // Act
    await userEvent.click(sendButton())

    // Assert
    expect(received).toEqual([
      [
        ['overallRating', '4'],
        ['staffId', visit.booking.staffId],
        ['serviceRating', '5'],
        ['staffRating', '3'],
        ['atmosphereRating', ''],
        ['cleanlinessRating', ''],
        ['valueRating', '2'],
        ['title', 'また行きます'],
        ['comment', '丁寧でした。\n待ち時間もありません。'],
        ['imageUrls', 'https://images.example.com/reviews/after.jpg'],
      ],
    ])
  })

  it('should hand over no rating at all, and nothing of the staff, when nothing is chosen and nobody can be rated', async () => {
    // Arrange
    const received: string[][] = []
    await stories.NewWithoutStaff.run({
      args: {
        ...stories.NewWithoutStaff.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values.keys()])
        }),
      },
    })

    // Act
    await userEvent.click(sendButton())

    // Assert: a group of radio buttons of which none is chosen is not sent
    expect(received).toEqual([
      [
        'serviceRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
        'title',
        'comment',
        'imageUrls',
      ],
    ])
  })

  it('should say what is wrong at its control, and put the focus on the first control with an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(rating('5（とても満足）')).toHaveFocus()
    expect(overall()).toHaveAccessibleDescription(
      '総合の評価を選んでください。',
    )
    expect(text('タイトル')).toHaveAccessibleDescription(
      expect.stringContaining('255 文字以内で入力してください。'),
    )
    expect(text('写真の URL')).toHaveAttribute('aria-invalid', 'true')
    expect(text('本文')).not.toHaveAttribute('aria-invalid')
  })

  it('should say what went wrong with the attempt above the controls, at once', async () => {
    // Act
    await stories.WithMessage.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should be busy, and hand over nothing more, while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const button = sendButton()

    // Act
    await userEvent.click(button)
    await userEvent.type(text('タイトル'), '{Enter}')

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should say at the title how long it may be', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(text('タイトル')).toHaveAccessibleDescription(
      '255 文字以内で書いてください。空欄のままでも、かまいません。',
    )
  })
})
