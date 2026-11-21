import type { ReactNode } from 'react'
import {
  type ButtonSize,
  type ButtonVariant,
  buttonClassName,
} from '../button/button'
import { Link } from '../link/link'

export type ButtonLinkProps = {
  href: string
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  children: ReactNode
  className?: string | undefined
  /**
   * The name of the link where its text does not say enough: one of many
   * links 「変更する」 says what it changes. It holds the text of the link
   */
  'aria-label'?: string | undefined
}

/**
 * A link that looks like a button, for a step that leads to another screen:
 * 「新しい予約」. It is a link to assistive technology and to the keyboard,
 * because it goes somewhere; what does something here is a `Button`.
 */
export const ButtonLink = ({
  href,
  variant = 'secondary',
  size = 'medium',
  children,
  className,
  'aria-label': label,
}: ButtonLinkProps) => (
  <Link
    href={href}
    className={buttonClassName(variant, size, className)}
    aria-label={label}
  >
    {children}
  </Link>
)
