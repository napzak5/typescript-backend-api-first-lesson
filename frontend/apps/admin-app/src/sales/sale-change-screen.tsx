import type {
  ModelsSaleResponse,
  ModelsSaleUpdateRequest,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  NOT_FOUND,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
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
import { saleHrefOf } from '../navigation'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { SaleChangeForm } from './components/sale-change-form/sale-change-form'
import {
  afterSaleChange,
  readSaleChange,
  whyUnchangeable,
} from './sale-changes'
import {
  attemptSaleChange,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from './sales-api'
import { WithSale } from './with-sale'

const TITLE = '売上を直す'

const UNREAD = P.union('tooManyRequests', 'failed')

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
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
          notify({ tone: 'success', message: '売上を直しました。' })
          void navigate(back)
        })
        // The sale was voided meanwhile: the screen shows it as it is now
        .with({ type: 'refused' }, ({ sale: now }) => show(now))
        // The sale was removed meanwhile, or is no longer this account's to see
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with(
          { type: P.union('invalid', 'undated', 'forbidden', UNREAD) },
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
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        change.mutate(request)
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
          やめる
        </ButtonLink>
      }
    />
  )
}

/** The form, once the members of the staff it offers were read. */
const WithStaff = ({ salon, sale }: Omit<SaleChangeProps, 'staff'>) => {
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
    refetchOnReconnect: false,
  })

  return match(staff.data)
    .with(undefined, () => (
      <LoadingIndicator label='スタッフを読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ items }) => (
      <SaleChange salon={salon} sale={sale} staff={items} />
    ))
    .with({ type: UNREAD }, (reason) => (
      <UnreadNotice
        message={unreadMessageOf('スタッフ', reason)}
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
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={TITLE} fresh>
          {(sale) =>
            match(whyUnchangeable(sale))
              .with(P.string, (why) => (
                <>
                  <p>{why}</p>
                  <p>
                    <ButtonLink href={saleHrefOf(salon.id, sale.id)}>
                      売上の内容へ
                    </ButtonLink>
                  </p>
                </>
              ))
              .with(undefined, () => (
                <>
                  <p>
                    明細と金額は、ここでは直せません。誤りがあるときは、オーナーかマネージャーが、支払いを全額返金して売上を取り消し、予約から会計を入れ直します。
                  </p>
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
