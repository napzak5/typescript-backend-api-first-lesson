import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerVersionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSignedInUser } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerHistoryHrefOf, customerHrefOf } from '../../navigation'
import { readVersion, versionKeyOf } from '../api/customer-history-api'
import { VersionRecord } from '../components/version-record/version-record'
import {
  changerNameOf,
  KEPT_BY_OTHERS,
  mayKeepCustomers,
} from '../utils/customer-history'
import { RemovedCustomer } from './removed-customer'
import { WithCustomer } from './with-customer'

const { names, titles, version: words } = adminCustomerMessages

const TITLE = titles.version

type ComparedVersionProps = {
  salon: ModelsSalonResponse
  version: ModelsCustomerVersionResponse
  /** Who made the version; `null` for nobody */
  changer: LocalizedText | null
}

/**
 * A version that changed values (an update, a merge) beside the one before
 * it: what it changed is shown once both are read. When the one before
 * cannot be read, the version is shown alone, and the page says so.
 */
const ComparedVersion = ({ salon, version, changer }: ComparedVersionProps) => {
  const say = useSay()
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
      <LoadingIndicator label={say(words.loadingPrevious)} />
    ))
    .with({ type: 'found' }, ({ version: previous }) => record(previous))
    .with({ type: P.union('notFound', 'forbidden') }, () => record(undefined))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        <UnreadNotice
          message={say(unreadMessageOf(names.previousVersion, reason))}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
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
  const say = useSay()
  const { version: number = '' } = useParams()
  const user = useSignedInUser()
  const keeper = user !== undefined && mayKeepCustomers(user.role)
  const me = user?.id
  const read = useQuery({
    queryKey: versionKeyOf(customerId, number),
    queryFn: () => readVersion(customerId, number),
    enabled: keeper,
  })

  return (
    <>
      <ButtonLink href={customerHistoryHrefOf(salon.id, customerId)}>
        {say(words.backToHistory)}
      </ButtonLink>
      {keeper ? (
        match(read.data)
          .with(undefined, () => (
            <LoadingIndicator label={say(words.loading)} />
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
          .with({ type: 'notFound' }, () => <p>{say(words.notFound)}</p>)
          .with({ type: 'forbidden' }, () => <p>{say(KEPT_BY_OTHERS)}</p>)
          .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.version, reason))}
              onRetry={() => void read.refetch()}
              pending={read.isFetching}
            />
          ))
          .exhaustive()
      ) : (
        <p>{say(KEPT_BY_OTHERS)}</p>
      )}
    </>
  )
}

type CustomerVersionPageProps = {
  salon: ModelsSalonResponse
}

const CustomerVersionPage = ({ salon }: CustomerVersionPageProps) => {
  const say = useSay()

  return (
    <WithCustomer
      salon={salon}
      title={say(TITLE)}
      fresh={false}
      removed={(customerId) => (
        <RemovedCustomer
          salon={salon}
          customerId={customerId}
          title={say(TITLE)}
        >
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
}

/**
 * A version of a customer, as the history leads to it: the values the
 * ledger held then, and what the version changed. An owner or a manager
 * reads it; a member of the staff is told who does.
 */
export const CustomerVersionScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => <CustomerVersionPage key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
