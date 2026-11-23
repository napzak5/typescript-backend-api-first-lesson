import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerAllergyResponse,
  ModelsCustomerAllergyUpdateRequest,
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  customerKeyOf,
  customerNameOf,
} from '../../customers/api/customers-api'
import { WithCustomer } from '../../customers/screens/with-customer'
import { chartHrefOf } from '../../navigation'
import {
  allergiesKeyOf,
  allergyKeyOf,
  findAllergy,
  updateAllergy,
} from '../api/allergies-api'
import { AllergyForm } from '../components/allergy-form/allergy-form'
import {
  afterAllergyWrite,
  allergyWrittenOf,
  readAllergyChange,
} from '../utils/allergies'

const TITLE = 'アレルギーの記録を直す'

type WithAllergyProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  allergyId: string
  children: (allergy: ModelsCustomerAllergyResponse) => ReactNode
}

/**
 * The allergy of the address, looked for among those of the customer, as
 * the API reads no allergy by itself. It is shown only once it was read
 * anew, so that the form opens with what is stored now. One that is not
 * there (removed by another account, or never there) is said so.
 */
const WithAllergy = ({
  salon,
  customer,
  allergyId,
  children,
}: WithAllergyProps) => {
  const read = useQuery({
    queryKey: allergyKeyOf(customer.id, allergyId),
    queryFn: () => findAllergy(customer.id, allergyId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <LoadingIndicator label='アレルギーを読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ allergy }) => children(allergy))
    .with({ type: 'notFound' }, () => (
      <>
        <p>
          このアレルギーの記録は、ありません。ほかのアカウントが削除したのかもしれません。
        </p>
        <ButtonLink href={chartHrefOf(salon.id, customer.id)}>
          カルテへ
        </ButtonLink>
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={inJapanese(
          unreadMessageOf(writtenInJapanese('アレルギー'), reason),
        )}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}

type AllergyChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  allergy: ModelsCustomerAllergyResponse
}

/**
 * The form of an allergy, opened with what is stored. It sends what was
 * changed and nothing else, and a form sent as it was opened asks the API
 * for nothing: what another account wrote meanwhile stays, unless the
 * same property was changed here.
 */
const AllergyChange = ({ salon, customer, allergy }: AllergyChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const back = chartHrefOf(salon.id, customer.id)
  const today = dayAt(new Date(), salon.timezone)
  const change = useMutation({
    mutationFn: (request: ModelsCustomerAllergyUpdateRequest) =>
      updateAllergy(customer.id, allergy.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ allergy: changed }) => {
          // The list, read anew on the chart; an allergy of the address is read anew whenever its screen opens
          queryClient.removeQueries({
            queryKey: allergiesKeyOf(customer.id),
            exact: true,
          })
          notify({
            tone: 'success',
            message: allergyWrittenOf(
              customerNameOf(customer),
              changed.allergenName,
              'change',
            ),
          })
          void navigate(back)
        })
        // The customer left the ledger, or another account removed the allergy: both are read anew
        .with({ type: 'notFound' }, () => {
          void queryClient.invalidateQueries({
            queryKey: customerKeyOf(customer.id),
          })
        })
        .with(
          {
            type: P.union(
              'invalid',
              'exists',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterAllergyWrite(refused, 'change')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readAllergyChange(values, allergy, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  return (
    <AllergyForm
      allergy={allergy}
      today={today}
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Changes an allergy of a customer, below the salon of the address. */
export const AllergyChangeScreen = () => {
  const { salonId = '', allergyId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <WithAllergy
              key={customer.id}
              salon={salon}
              customer={customer}
              allergyId={allergyId}
            >
              {(allergy) => (
                <AllergyChange
                  key={allergy.id}
                  salon={salon}
                  customer={customer}
                  allergy={allergy}
                />
              )}
            </WithAllergy>
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
