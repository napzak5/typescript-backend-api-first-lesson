import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import { portalFrameMessages } from '@beauty-salon-shared/i18n/messages/portal'

/*
 * The page of a customer, which the screens below it lead back to.
 */

/** The address of the page of a customer */
export const MY_PAGE = '/mypage'

const BackToMyPage = () => {
  const say = useSay()

  return (
    <ButtonLink href={MY_PAGE} variant='quiet'>
      {say(portalFrameMessages.backToMyPage)}
    </ButtonLink>
  )
}

/** The link of a screen below the page of a customer back to it, beside its title */
export const BACK_TO_MY_PAGE = <BackToMyPage />
