import type { ComponentProps, MouseEvent } from 'react'
import { classNames } from '../../class-names'
import styles from './button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
type ButtonSize = 'medium' | 'small'

export type ButtonProps = ComponentProps<'button'> & {
  /** `primary` is the one main action of a view; `danger` destroys something */
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * The action has started and has not finished. The button stays focusable
   * and announces that it is busy, and a press does nothing.
   */
  pending?: boolean
}

const variantClass: Record<ButtonVariant, string | undefined> = {
  primary: styles['primary'],
  secondary: styles['secondary'],
  quiet: styles['quiet'],
  danger: styles['danger'],
}

const sizeClass: Record<ButtonSize, string | undefined> = {
  medium: undefined,
  small: styles['small'],
}

/**
 * A button. `type` is `button` unless it is given, so a button inside a form
 * submits it only when it says `type='submit'`.
 */
export const Button = ({
  variant = 'secondary',
  size = 'medium',
  pending = false,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      {...rest}
      type={type}
      className={classNames(
        styles['button'],
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}
