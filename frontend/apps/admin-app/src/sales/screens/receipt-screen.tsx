import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { saleHrefOf, salesHrefOf } from '../../navigation'
import { attemptReceipt, saleKeyOf } from '../api/sales-api'
import { Receipt } from '../components/receipt/receipt'
import { whyNoReceipt } from '../utils/sale-format'
import styles from './receipt-screen.module.css'
import { WithPaymentMethods } from './with-sale'

const {
  loading,
  names,
  noReceipt,
  notFound,
  receipt: texts,
  titles,
  words,
} = adminSaleMessages

/**
 * What is on the screen and not on paper: the heading and the ways on. The
 * heading is in it whatever the screen shows, so that it stays one element
 * from the receipt being read to the receipt being shown, and keeps the
 * focus it took.
 */
const OnScreen = ({ children }: { children: ReactNode }) => (
  <div className={styles['onScreen']}>{children}</div>
)

type ReceiptOfSaleProps = {
  salon: ModelsSalonResponse
}

/**
 * The receipt of a sale, made by the API whenever the screen opens: the
 * API keeps none, and dates each one when it makes it. 印刷する prints it
 * alone, without the frame of the screen. A sale whose total was not received, or that was voided, has
 * none, and the screen says why.
 */
const ReceiptOfSale = ({ salon }: ReceiptOfSaleProps) => {
  const say = useSay()
  const title = say(titles.receipt)
  const { saleId = '' } = useParams()
  const read = useQuery({
    queryKey: [...saleKeyOf(saleId), 'receipt'],
    queryFn: () => attemptReceipt(saleId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const toTheSale = (
    <ButtonLink href={saleHrefOf(salon.id, saleId)}>
      {say(words.toSale)}
    </ButtonLink>
  )

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <OnScreen>
            <PageHeader title={title} description={salon.name} />
          </OnScreen>
          <LoadingIndicator label={say(loading.receipt)} />
        </>
      ))
      .with(
        { type: 'found', receipt: { sale: { salonId: salon.id } } },
        ({ receipt }) => (
          <>
            <OnScreen>
              <PageHeader
                title={title}
                description={salon.name}
                actions={
                  <Button variant='primary' onClick={() => window.print()}>
                    {say(texts.print)}
                  </Button>
                }
              />
            </OnScreen>
            <WithPaymentMethods salonId={salon.id}>
              {(methods) => (
                <Receipt receipt={receipt} salon={salon} methods={methods} />
              )}
            </WithPaymentMethods>
            <OnScreen>{toTheSale}</OnScreen>
          </>
        ),
      )
      .with({ type: 'unissued', sale: { salonId: salon.id } }, ({ sale }) => (
        <>
          <OnScreen>
            <PageHeader title={title} description={salon.name} />
          </OnScreen>
          <p>{say(whyNoReceipt(sale) ?? noReceipt.unissued)}</p>
          {toTheSale}
        </>
      ))
      // A sale of another salon is not one of this salon's
      .with({ type: P.union('found', 'unissued', 'notFound') }, () => (
        <>
          <PageHeader
            title={say(notFound.title)}
            description={say(notFound.description)}
          />
          <ButtonLink href={salesHrefOf(salon.id)}>
            {say(notFound.toToday)}
          </ButtonLink>
        </>
      ))
      .with({ type: 'forbidden' }, () => (
        <>
          <OnScreen>
            <PageHeader title={title} description={salon.name} />
          </OnScreen>
          <OtherSalonNotice what={names.salesOfTheSalon} />
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <OnScreen>
            <PageHeader title={title} description={salon.name} />
          </OnScreen>
          <UnreadNotice
            message={say(unreadMessageOf(names.receipt, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}

/** The receipt of a sale of the salon of the address, to print. */
export const ReceiptScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.receipt)}>
      {(salon) => <ReceiptOfSale key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
