import type { ComponentProps, MouseEvent } from 'react'
import { classNames } from '../../utils/class-names'
import styles from './button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'medium' | 'small'

export type ButtonProps = ComponentProps<'button'> & {
  /** `primary` is the one main action of a view; `danger` destroys something */
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  /**
   * The action has started and has not finished. The button stays focusable
   * and announces that it is busy, and a press does nothing.
   */
  pending?: boolean | undefined
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

/** The classes of what looks like a button: a `Button`, or a link that leads to an action. */
export const buttonClassName = (
  variant: ButtonVariant,
  size: ButtonSize,
  className: string | undefined,
): string =>
  classNames(
    styles['button'],
    variantClass[variant],
    sizeClass[size],
    className,
  )

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
      className={buttonClassName(variant, size, className)}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}
