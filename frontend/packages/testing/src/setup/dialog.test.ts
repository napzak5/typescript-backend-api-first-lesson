import { afterEach, describe, expect, it, vi } from 'vitest'

// `setup.ts`, which this package names in its own `setupFiles`, has installed the methods

const addDialog = (): HTMLDialogElement => {
  const dialog = document.createElement('dialog')
  document.body.append(dialog)
  return dialog
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('the dialog methods given to jsdom', () => {
  it('should open a dialog with showModal', () => {
    // Arrange
    const dialog = addDialog()

    // Act
    dialog.showModal()

    // Assert
    expect(dialog.open).toBe(true)
  })

  it('should close an open dialog and tell its listeners once', () => {
    // Arrange
    const dialog = addDialog()
    const onClose = vi.fn()
    dialog.addEventListener('close', onClose)
    dialog.showModal()

    // Act
    dialog.close()

    // Assert
    expect(dialog.open).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should tell nobody when a dialog that is closed is closed again', () => {
    // Arrange
    const dialog = addDialog()
    const onClose = vi.fn()
    dialog.addEventListener('close', onClose)

    // Act
    dialog.close()

    // Assert
    expect(onClose).not.toHaveBeenCalled()
  })
})
