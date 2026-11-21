import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerPreferencesResponse,
  ModelsCustomerPreferencesUpdateRequest,
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  afterPreferencesChange,
  PreferencesForm,
  readPreferencesChange,
  type StaffChoice,
} from '@beauty-salon-frontend/preferences'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerHrefOf, customersHrefOf } from '../navigation'
import { CANNOT_HANDLE_CUSTOMERS } from './customer-form'
import {
  customerKeyOf,
  preferencesKeyOf,
  preferencesToChangeKeyOf,
  readPreferencesToChange,
  updatePreferences,
} from './customers-api'
import { WithCustomer } from './with-customer'

const TITLE = '好み設定を直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type PreferencesChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  /** What the form opens with */
  preferences: ModelsCustomerPreferencesResponse
  /** The members of the staff it offers */
  staff: readonly StaffChoice[]
}

/**
 * The form of the preferences of a customer, opened with what is stored.
 * It sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing: what the customer wrote on their page
 * meanwhile stays, unless the same value was changed here. The page of the
 * customer reads the preferences anew after a change.
 */
const PreferencesChange = ({
  salon,
  customer,
  preferences,
  staff,
}: PreferencesChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const back = customerHrefOf(salon.id, customer.id)
  const update = useMutation({
    mutationFn: (request: ModelsCustomerPreferencesUpdateRequest) =>
      updatePreferences(customer.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'updated' }, () => {
          // The part of the page names the staff by their profiles, which
          // the form does not have: it reads what was written when it shows
          queryClient.removeQueries({
            queryKey: preferencesKeyOf(customer.id),
            exact: true,
          })
          notify({ tone: 'success', message: '好み設定を直しました。' })
          void navigate(back)
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .with({ type: 'forbidden' }, () => setSaid(CANNOT_HANDLE_CUSTOMERS))
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterPreferencesChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readPreferencesChange(values, preferences, staff))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_SAID)
        update.mutate(value)
      })
      .exhaustive()

  return (
    <PreferencesForm
      preferences={preferences}
      staff={staff}
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={update.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type PreferencesToChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The preferences and the staff the form offers, read whenever the screen
 * opens, and then not behind it: what somebody is filling in is not taken
 * away by an answer nobody asked for.
 */
const PreferencesToChange = ({ salon, customer }: PreferencesToChangeProps) => {
  const read = useQuery({
    queryKey: preferencesToChangeKeyOf(customer.id, salon.id),
    queryFn: () => readPreferencesToChange(customer.id, salon),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // What the form was opened with a while ago is not what it opens with
  return (
    match(read.isFetchedAfterMount ? read.data : undefined)
      .with(undefined, () => (
        <LoadingIndicator label='好み設定を読み込んでいます' />
      ))
      .with({ type: 'found' }, ({ preferences, staff }) => (
        <PreferencesChange
          salon={salon}
          customer={customer}
          preferences={preferences}
          staff={staff}
        />
      ))
      // Removed between the read of the customer and that of the preferences
      .with({ type: 'notFound' }, () => (
        <>
          <p>このお客様は、台帳から削除されました。</p>
          <ButtonLink href={customersHrefOf(salon.id)}>顧客台帳へ</ButtonLink>
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <UnreadNotice
          message={unreadMessageOf('好み設定', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      ))
      .exhaustive()
  )
}

/**
 * Changes what a customer wishes for, below the salon of the address: the
 * members of the staff of the salon to wish for or avoid, the time slots,
 * the style and how they like to be served.
 */
export const CustomerPreferencesScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <PreferencesToChange
              key={customer.id}
              salon={salon}
              customer={customer}
            />
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
