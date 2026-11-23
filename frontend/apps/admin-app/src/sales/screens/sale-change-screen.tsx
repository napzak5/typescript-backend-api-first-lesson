import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSaleResponse,
  ModelsSaleUpdateRequest,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
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
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { saleHrefOf } from '../../navigation'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import {
  attemptSaleChange,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from '../api/sales-api'
import { SaleChangeForm } from '../components/sale-change-form/sale-change-form'
import {
  afterSaleChange,
  readSaleChange,
  whyUnchangeable,
} from '../utils/sale-changes'
import { Unwritable, WithSale } from './with-sale'

const { loading, names, titles, words } = adminSaleMessages
const { change: texts } = adminSaleMessages.changes

type SaleChangeProps = {
  salon: ModelsSalonResponse
  sale: ModelsSaleResponse
  staff: readonly ModelsStaffProfileResponse[]
}

/**
 * The form of what a sale records beside what it bills, opened with what
 * the sale has. It sends what was changed and nothing else, and a form
 * sent as it was opened asks the API for nothing. The sale the API answers
 * with is what the page of the sale shows at once; the lists that were read
 * are dropped, since the day of the sale may have changed.
 *
 * A sale that was voided meanwhile is shown as it is now, and the screen
 * says why it is not changed.
 */
const SaleChange = ({ salon, sale, staff }: SaleChangeProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const key = saleKeyOf(sale.id)
  const back = saleHrefOf(salon.id, sale.id)
  const show = (now: ModelsSaleResponse): void => {
    const read: SaleRead = { type: 'found', sale: now }
    queryClient.setQueryData(key, read)
    queryClient.removeQueries({ queryKey: saleListsKeyOf(salon.id) })
    if (now.bookingId !== null) {
      queryClient.removeQueries({
        queryKey: salesOfBookingKeyOf(now.bookingId),
      })
    }
  }
  const change = useMutation({
    mutationFn: (request: ModelsSaleUpdateRequest) =>
      attemptSaleChange(sale.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'updated' }, ({ sale: updated }) => {
          show(updated)
          notify({ tone: 'success', message: texts.done })
          void navigate(back)
        })
        // The sale was voided meanwhile: the screen shows it as it is now
        .with({ type: 'refused' }, ({ sale: now }) => show(now))
        // The sale was removed meanwhile, or is no longer this account's to see
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with(
          {
            type: P.union(
              'invalid',
              'undated',
              'forbidden',
              P.union(...UNREAD_TYPES),
            ),
          },
          (refused) => setSaid(afterSaleChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readSaleChange(values, sale, salon.timezone, new Date()))
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
    <SaleChangeForm
      sale={sale}
      staff={staff}
      timezone={salon.timezone}
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

/** The form, once the members of the staff it offers were read. */
const WithStaff = ({ salon, sale }: Omit<SaleChangeProps, 'staff'>) => {
  const say = useSay()
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
    refetchOnReconnect: false,
  })

  return match(staff.data)
    .with(undefined, () => <LoadingIndicator label={say(loading.staff)} />)
    .with({ type: 'found' }, ({ items }) => (
      <SaleChange salon={salon} sale={sale} staff={items} />
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.staff, reason))}
        onRetry={() => void staff.refetch()}
        pending={staff.isFetching}
      />
    ))
    .exhaustive()
}

/**
 * Changes what a sale of the salon of the address records beside what it
 * bills: who took the payment, when, and the note. What it bills is not
 * changed here: the screen says how it is put right.
 */
export const SaleChangeScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.change)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={title} fresh>
          {(sale) =>
            match(whyUnchangeable(sale))
              .with(P.nonNullable, (why) => (
                <Unwritable why={why} back={saleHrefOf(salon.id, sale.id)} />
              ))
              .with(undefined, () => (
                <>
                  <p>{say(texts.notHere)}</p>
                  <WithStaff salon={salon} sale={sale} />
                </>
              ))
              .exhaustive()
          }
        </WithSale>
      )}
    </WithSalon>
  )
}
