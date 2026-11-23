import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { frameMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { notFound } = frameMessages

/**
 * The screen of an address that is none of the application: the last route
 * of every application (`path='*'`). It leads back to the first screen.
 */
export const NotFoundPage = () => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ButtonLink href='/'>{say(notFound.back)}</ButtonLink>
    </>
  )
}
