import type {
  ModelsCustomerVersionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerHistoryHrefOf, customerHrefOf } from '../navigation'
import { unreadMessageOf } from '../reading'
import { WithSalon } from '../salons/with-salon'
import { VersionRecord } from './components/version-record/version-record'
import {
  changerNameOf,
  KEPT_BY_OTHERS,
  mayKeepCustomers,
} from './customer-history'
import { readVersion, versionKeyOf } from './customer-history-api'
import { RemovedCustomer } from './removed-customer'
import { WithCustomer } from './with-customer'

const TITLE = '台帳の版'

const UNREAD = P.union('tooManyRequests', 'failed')

type ComparedVersionProps = {
  salon: ModelsSalonResponse
  version: ModelsCustomerVersionResponse
  changer: string
}

/**
 * A version that changed values (an update, a merge) beside the one before
 * it: what it changed is shown once both are read. When the one before
 * cannot be read, the version is shown alone, and the page says so.
 */
const ComparedVersion = ({ salon, version, changer }: ComparedVersionProps) => {
  const before = String(version.version - 1)
  const read = useQuery({
    queryKey: versionKeyOf(version.customerId, before),
    queryFn: () => readVersion(version.customerId, before),
  })
  const record = (previous: ModelsCustomerVersionResponse | undefined) => (
    <VersionRecord
      version={version}
      previous={previous}
      changer={changer}
      timezone={salon.timezone}
      customerHref={(id) => customerHrefOf(salon.id, id)}
    />
  )

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label='前の版を読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ version: previous }) => record(previous))
    .with({ type: P.union('notFound', 'forbidden') }, () => record(undefined))
    .with({ type: UNREAD }, (reason) => (
      <>
        <UnreadNotice
          message={unreadMessageOf('前の版', reason)}
          onRetry={() => void read.refetch()}
          retrying={read.isFetching}
        />
        {record(undefined)}
      </>
    ))
    .exhaustive()
}

type VersionPartProps = {
  salon: ModelsSalonResponse
  customerId: string
  /** The account of the customer, when they have one: a version they made is named as theirs */
  customerAccount: string | null
}

/**
 * The version of the address: what made it, what it changed and the
 * values the ledger held then. A version nobody made is the values the
 * history began with.
 */
const VersionPart = ({
  salon,
  customerId,
  customerAccount,
}: VersionPartProps) => {
  const { version: number = '' } = useParams()
  const session = useSession()
  const keeper =
    session.type === 'signedIn' && mayKeepCustomers(session.user.role)
  const me = session.type === 'signedIn' ? session.user.id : ''
  const read = useQuery({
    queryKey: versionKeyOf(customerId, number),
    queryFn: () => readVersion(customerId, number),
    enabled: keeper,
  })

  return (
    <>
      <p>
        <ButtonLink
          href={customerHistoryHrefOf(salon.id, customerId)}
          variant='secondary'
        >
          変更履歴へ
        </ButtonLink>
      </p>
      {keeper ? (
        match(read.data)
          .with(undefined, () => (
            <LoadingIndicator label='版を読み込んでいます' />
          ))
          .with({ type: 'found' }, ({ version }) => {
            const changer = changerNameOf(version.changedBy, {
              me,
              customer: customerAccount,
            })

            return match(version.operation)
              .with('update', 'merge', () => (
                <ComparedVersion
                  key={version.id}
                  salon={salon}
                  version={version}
                  changer={changer}
                />
              ))
              .with('baseline', 'create', 'delete', 'restore', 'erase', () => (
                <VersionRecord
                  version={version}
                  previous={undefined}
                  changer={changer}
                  timezone={salon.timezone}
                  customerHref={(id) => customerHrefOf(salon.id, id)}
                />
              ))
              .exhaustive()
          })
          .with({ type: 'notFound' }, () => (
            <p>
              この番号の版はありません。アドレスが正しいか、お確かめください。
            </p>
          ))
          .with({ type: 'forbidden' }, () => <p>{KEPT_BY_OTHERS}</p>)
          .with({ type: UNREAD }, (reason) => (
            <UnreadNotice
              message={unreadMessageOf('版', reason)}
              onRetry={() => void read.refetch()}
              retrying={read.isFetching}
            />
          ))
          .exhaustive()
      ) : (
        <p>{KEPT_BY_OTHERS}</p>
      )}
    </>
  )
}

type CustomerVersionPageProps = {
  salon: ModelsSalonResponse
}

const CustomerVersionPage = ({ salon }: CustomerVersionPageProps) => (
  <WithCustomer
    salon={salon}
    title={TITLE}
    fresh={false}
    removed={(customerId) => (
      <RemovedCustomer salon={salon} customerId={customerId} title={TITLE}>
        {() => (
          <VersionPart
            salon={salon}
            customerId={customerId}
            customerAccount={null}
          />
        )}
      </RemovedCustomer>
    )}
  >
    {(customer) => (
      <VersionPart
        salon={salon}
        customerId={customer.id}
        customerAccount={customer.userId}
      />
    )}
  </WithCustomer>
)

/**
 * A version of a customer, as the history leads to it: the values the
 * ledger held then, and what the version changed. An owner or a manager
 * reads it; a member of the staff is told who does.
 */
export const CustomerVersionScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <CustomerVersionPage key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
