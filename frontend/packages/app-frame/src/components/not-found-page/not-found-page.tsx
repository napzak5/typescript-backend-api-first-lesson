import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'

/**
 * The screen of an address that is none of the application: the last route
 * of every application (`path='*'`). It leads back to the first screen.
 */
export const NotFoundPage = () => (
  <>
    <PageHeader
      title='ページが見つかりません'
      description='アドレスが正しいか、お確かめください。'
    />
    <ButtonLink href='/'>トップへ戻る</ButtonLink>
  </>
)
