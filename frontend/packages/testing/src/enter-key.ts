import { userEvent } from 'storybook/test'
import { expect, it, vi } from 'vitest'

/** What `composeStories` returns for one story, as far as this file needs it. */
type ComposedStory = {
  run: () => Promise<void>
}

/**
 * How many times a form was sent when the Enter key was pressed in one of
 * its controls. A browser sends the form of a one-line control on Enter
 * when the form has a button that sends it, or when that control is its
 * only one-line control; a text area takes a line instead.
 *
 * user-event (the copy that `storybook/test` holds) looks for the button
 * inside the form element alone, and without one sends a form only when
 * the control is its only `input`, radio buttons and check boxes counted.
 * A form whose button is outside it and belongs to it through `form` (the
 * form of a `FormDialog`) is sent by a browser in every case: the browser
 * tests see that.
 */
export const sendingsOnEnter = async (
  control: HTMLElement,
): Promise<number> => {
  // What a browser would do once the form is sent (go to its action) is
  // not done: jsdom has no navigation, and the component has done its part
  const sent = vi.fn((event: Event) => event.preventDefault())
  document.addEventListener('submit', sent)
  await userEvent.type(control, '{Enter}')
  document.removeEventListener('submit', sent)
  return sent.mock.calls.length
}

/**
 * Declares the test that the form of a story is sent by the Enter key in
 * a one-line control, as a browser sends it: once. Call it inside the
 * `describe` of the form, with the control to press it in:
 *
 *   itShouldBeSentByTheEnterKey(stories.Default, () =>
 *     screen.getByRole('textbox', { name: 'お名前' }),
 *   )
 *
 * What the form does with what is sent is the business of its other tests:
 * the Enter key and the button send it the same way.
 */
export const itShouldBeSentByTheEnterKey = (
  story: ComposedStory,
  control: () => HTMLElement,
): void => {
  it('should be sent by the Enter key in a one-line control', async () => {
    // Arrange
    await story.run()

    // Act
    const sendings = await sendingsOnEnter(control())

    // Assert
    expect(sendings).toBe(1)
  })
}
