import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { encode } from 'uqr'
import { describe, expect, it } from 'vitest'
import { darkModulesOf } from './qr-code'
import * as qrCodeStories from './qr-code.stories'

const stories = composeStories(qrCodeStories)

/** The modules a path of squares of one module covers, as `x,y`. */
const coveredBy = (path: string): string[] =>
  Array.from(path.matchAll(/M(\d+) (\d+)h1v1h-1z/g), ([, x, y]) => `${x},${y}`)

describe('QrCode', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each([
    {
      story: stories.ForAnAuthenticatorApp,
      name: '認証アプリで読み取る QR コード',
    },
    { story: stories.Short, name: 'サロンのページの QR コード' },
  ])(
    'should be a drawing named $name, of the modules of what it holds, with four light modules around them',
    async ({ story, name }) => {
      // Act
      await story.run()

      // Assert
      const drawing = screen.getByRole('img', { name })
      const value = story.args.value ?? ''
      const { size, data } = encode(value, { ecc: 'M', border: 0 })
      expect(drawing).toHaveAttribute('viewBox', `0 0 ${size + 8} ${size + 8}`)
      const dark = drawing.querySelector('path')?.getAttribute('d') ?? ''
      // The modules of the code, moved in by the four around them
      expect(coveredBy(dark)).toEqual(
        data.flatMap((row, y) =>
          row.flatMap((module, x) => (module ? [`${x + 4},${y + 4}`] : [])),
        ),
      )
    },
  )

  it('should draw nothing for a code without dark modules', () => {
    expect(
      darkModulesOf([
        [false, false],
        [false, false],
      ]),
    ).toBe('')
  })
})
