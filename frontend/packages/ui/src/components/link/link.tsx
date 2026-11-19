import { createContext, type ReactNode, useContext } from 'react'

/** What a component of this package hands to whatever draws its links. */
export type LinkComponentProps = {
  href: string
  className?: string | undefined
  'aria-current'?: 'page' | undefined
  /**
   * The name of a link whose text alone does not say where it leads: one
   * of several 「予約する」 on a screen. It holds the text that is seen
   */
  'aria-label'?: string | undefined
  children: ReactNode
}

export type LinkComponent = (props: LinkComponentProps) => ReactNode

const PlainLink: LinkComponent = ({ href, children, ...rest }) => (
  <a {...rest} href={href}>
    {children}
  </a>
)

const LinkContext = createContext<LinkComponent>(PlainLink)

export type LinkProviderProps = {
  /** Draws a link that moves within the application, without loading a page */
  component: LinkComponent
  children: ReactNode
}

/**
 * This package does not know the router of an application. An application
 * gives the link of its router once, at its root, and every component below
 * draws its links with it:
 *
 *   const RouterLink: LinkComponent = ({ href, ...rest }) => (
 *     <Link {...rest} to={href} />
 *   )
 *
 *   <LinkProvider component={RouterLink}>…</LinkProvider>
 *
 * Without a provider a link is a plain `a` element.
 */
export const LinkProvider = ({ component, children }: LinkProviderProps) => (
  <LinkContext value={component}>{children}</LinkContext>
)

/** A link drawn by a component of this package. */
export const Link = (props: LinkComponentProps) => {
  const Component = useContext(LinkContext)

  return <Component {...props} />
}
