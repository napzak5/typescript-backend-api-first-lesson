import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { paymentMethodsHrefOf } from '../navigation'
import { mayKeepPaymentMethods } from './payment-methods-api'

/** Whether the signed-in account has a role that keeps the payment methods: the owner, a manager and an administrator. */
export const useKeepsPaymentMethods = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepPaymentMethods(session.user.role)
}

type PaymentMethodsForbiddenProps = {
  salon: ModelsSalonResponse
  title: string
}

/** What a screen that changes the payment methods says to an account whose role does not change them. */
export const PaymentMethodsForbidden = ({
  salon,
  title,
}: PaymentMethodsForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>
      このアカウントでは、支払い方法を変えられません。支払い方法を変えられるのは、サロンのオーナーとマネージャーと、管理者です。
    </p>
    <p>
      <ButtonLink href={paymentMethodsHrefOf(salon.id)} variant='secondary'>
        支払い方法へ戻る
      </ButtonLink>
    </p>
  </>
)

/** What a screen of a payment method says when there is none to show. */
export const PaymentMethodNotFound = ({
  salon,
}: {
  salon: ModelsSalonResponse
}) => (
  <>
    <PageHeader
      title='支払い方法が見つかりません'
      description='アドレスが正しいか、お確かめください。削除した支払い方法は、表示できません。'
    />
    <p>
      <ButtonLink href={paymentMethodsHrefOf(salon.id)} variant='secondary'>
        支払い方法へ
      </ButtonLink>
    </p>
  </>
)
