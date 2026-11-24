import type { Locale } from '@beauty-salon-shared/i18n'
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { usePageLanguage } from '../../hooks/language'

/** A screen as it was shown: its title, in the language of the page then */
type ShownScreen = {
  title: string
  language: Locale
}

type Screens = {
  /** The name of the application: how the title of every document ends */
  applicationTitle: string
  /** The screen that was shown last; `null` before the first one */
  shown: RefObject<ShownScreen | null>
  /** The heading of the screen that was shown last; `null` before the first one */
  heading: RefObject<HTMLHeadingElement | null>
}

const ScreensContext = createContext<Screens | null>(null)

type ScreensProviderProps = {
  applicationTitle: string
  children: ReactNode
}

/** What the frame of an application knows about the screens it shows. */
export const ScreensProvider = ({
  applicationTitle,
  children,
}: ScreensProviderProps) => {
  const shown = useRef<ShownScreen | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const screens = useMemo(
    () => ({ applicationTitle, shown, heading }),
    [applicationTitle],
  )

  return <ScreensContext value={screens}>{children}</ScreensContext>
}

/**
 * Makes `title` the screen that is shown, and returns the ref of its heading.
 *
 * The document is named after the screen (「予約台帳 | Kushi Admin」),
 * which is what a tab, the history and a screen reader say of it. When the
 * screen takes the place of another one, the focus moves to its heading: a
 * page that loads starts at its top, and a screen that replaces another
 * without a load has to say so itself. The first screen of a page leaves the
 * focus alone, as the load already put it at the top.
 *
 * Both are done in the commit that shows the screen, before the browser
 * paints it: whoever waits for the screen finds the focus on it, and not for
 * a moment where the screen it replaced has left it.
 *
 * A title that is said anew in another language is the same screen: the
 * document is named in that language, and the focus stays where it is, on
 * the choice of the language that changed it.
 *
 * Outside the frame of an application it does nothing.
 */
export const useScreen = (
  title: string,
): RefObject<HTMLHeadingElement | null> => {
  const screens = useContext(ScreensContext)
  const heading = useRef<HTMLHeadingElement>(null)
  const { language } = usePageLanguage()

  useLayoutEffect(() => {
    if (screens === null) {
      return
    }
    document.title =
      title === screens.applicationTitle
        ? title
        : `${title} | ${screens.applicationTitle}`

    const previous = screens.shown.current
    screens.shown.current = { title, language }
    screens.heading.current = heading.current
    if (
      previous !== null &&
      previous.title !== title &&
      previous.language === language
    ) {
      heading.current?.focus()
    }
  }, [screens, title, language])

  return heading
}

/**
 * Returns what moves the focus to the heading of the screen that is shown.
 *
 * It is for a screen that took away what had the focus and stayed the same
 * screen: a step that the next one replaced, a button that went with what
 * it did. The focus would be left nowhere, and the keyboard would go on
 * from the top of the document. Call it in the commit that shows the
 * change (`useLayoutEffect`), as the frame does for a screen that takes
 * the place of another.
 *
 * Outside the frame of an application it does nothing.
 */
export const useScreenHeadingFocus = (): (() => void) => {
  const screens = useContext(ScreensContext)

  return useCallback(() => {
    screens?.heading.current?.focus()
  }, [screens])
}
