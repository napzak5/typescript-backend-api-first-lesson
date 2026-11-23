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
  aboutTheAttempt,
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerHrefOf, customersHrefOf } from '../../navigation'
import {
  customerKeyOf,
  preferencesKeyOf,
  preferencesToChangeKeyOf,
  readPreferencesToChange,
  updatePreferences,
} from '../api/customers-api'
import { CANNOT_HANDLE_CUSTOMERS_MESSAGE } from '../utils/customer-form'
import { WithCustomer } from './with-customer'

const {
  form,
  gone,
  names,
  notFound,
  notices,
  preferences: words,
  titles,
} = adminCustomerMessages

const TITLE = titles.preferences

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
          notify({ tone: 'success', message: notices.preferencesChanged })
          void navigate(back)
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .with({ type: 'forbidden' }, () =>
          setSaid(aboutTheAttempt(CANNOT_HANDLE_CUSTOMERS_MESSAGE)),
        )
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
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        update.mutate(value)
      })
      .exhaustive()

  return (
    <PreferencesForm
      preferences={preferences}
      staff={staff}
      submitLabel={say(form.save)}
      message={said.message}
      errors={said.errors}
      pending={update.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          {say(form.cancel)}
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
  const say = useSay()
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
      .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
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
          <p>{say(gone)}</p>
          <ButtonLink href={customersHrefOf(salon.id)}>
            {say(notFound.toLedger)}
          </ButtonLink>
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <UnreadNotice
          message={say(unreadMessageOf(names.preferences, reason))}
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
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={say(TITLE)} fresh>
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
