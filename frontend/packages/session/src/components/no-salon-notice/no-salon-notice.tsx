import { PageHeader } from '@beauty-salon-frontend/ui'

/**
 * The screen of an account of a salon role that no salon reaches: the
 * screens of a salon have nothing to show it until it joins one.
 */
export const NoSalonNotice = () => (
  <PageHeader
    title='どのサロンにも属していません'
    description='このアカウントは、いま、どのサロンのスタッフにもなっていません。サロンから招待のメールを受け取り、そのリンクから参加すると、サロンの画面を使えるようになります。'
  />
)
