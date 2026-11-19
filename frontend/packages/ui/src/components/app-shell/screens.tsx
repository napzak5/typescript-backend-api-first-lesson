import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'

type Screens = {
  /** The name of the application: how the title of every document ends */
  applicationTitle: string
  /** The title of the screen that was shown last; `null` before the first one */
  shown: RefObject<string | null>
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
  const shown = useRef<string | null>(null)
  const screens = useMemo(
    () => ({ applicationTitle, shown }),
    [applicationTitle],
  )

  return <ScreensContext value={screens}>{children}</ScreensContext>
}

/**
 * Makes `title` the screen that is shown, and returns the ref of its heading.
 *
 * The document is named after the screen (「予約台帳 | Beauty Salon Admin」),
 * which is what a tab, the history and a screen reader say of it. When the
 * screen takes the place of another one, the focus moves to its heading: a
 * page that loads starts at its top, and a screen that replaces another
 * without a load has to say so itself. The first screen of a page leaves the
 * focus alone, as the load already put it at the top.
 *
 * Outside the frame of an application it does nothing.
 */
export const useScreen = (
  title: string,
): RefObject<HTMLHeadingElement | null> => {
  const screens = useContext(ScreensContext)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (screens === null) {
      return
    }
    document.title =
      title === screens.applicationTitle
        ? title
        : `${title} | ${screens.applicationTitle}`

    const previous = screens.shown.current
    screens.shown.current = title
    if (previous !== null && previous !== title) {
      heading.current?.focus()
    }
  }, [screens, title])

  return heading
}
