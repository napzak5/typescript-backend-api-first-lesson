import { ButtonLink } from '@beauty-salon-frontend/ui'

/*
 * The page of a customer, which the screens below it lead back to.
 */

/** The address of the page of a customer */
export const MY_PAGE = '/mypage'

/** The link of a screen below the page of a customer back to it, beside its title */
export const BACK_TO_MY_PAGE = (
  <ButtonLink href={MY_PAGE} variant='quiet'>
    マイページへ戻る
  </ButtonLink>
)
