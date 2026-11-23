import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerDeletionRequestCreateRequest,
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { saveFile } from '@beauty-salon-frontend/io'
import { useSession } from '@beauty-salon-frontend/session'
import {
  type FormErrors,
  inJapanese,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  askForErasure,
  cancelErasureRequest,
  erasureKeyOf,
  readErasureRequest,
} from '../api/customer-erasure-api'
import { exportCustomerData } from '../api/customer-export-api'
import { customerKeyOf, customerNameOf } from '../api/customers-api'
import {
  CustomerErasure,
  type ErasureDialog,
  type ErasureShown,
} from '../components/customer-erasure/customer-erasure'
import { CustomerRequests } from '../components/customer-requests/customer-requests'
import {
  afterErasureAsk,
  afterErasureCancel,
  type ErasureSays,
  readErasureAsk,
} from '../utils/customer-erasure'
import { ANSWERED_BY_OTHERS, afterDataExport } from '../utils/customer-export'
import { mayKeepCustomers } from '../utils/customer-history'

type ErasurePartProps = {
  customerId: string
  /** The name of the customer, as the dialogs and the notifications say it */
  name: string
  timezone: string
  /**
   * Given for a customer in the ledger, whose new request is taken: called
   * when they turn out to have left it meanwhile
   */
  onLeft?: (() => void) | undefined
}

/**
 * The latest request of the customer to have their data erased, a new
 * one taken and a pending one called off. What the API refused, or what
 * changed meanwhile, closes the dialog: the customer is read again, the
 * part says why under its heading, and its heading takes the focus. So
 * does what was done, whose button went with it.
 */
const ErasurePart = ({
  customerId,
  name,
  timezone,
  onLeft,
}: ErasurePartProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const heading = useRef<HTMLHeadingElement>(null)
  const read = useQuery({
    queryKey: erasureKeyOf(customerId),
    queryFn: () => readErasureRequest(customerId),
    staleTime: 0,
  })
  const [dialog, setDialog] = useState<ErasureDialog>('none')
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const [errors, setErrors] = useState<FormErrors>()
  /** What the API refused, or what changed meanwhile: said under the heading */
  const [refusal, setRefusal] = useState<string>()
  /** How many times a dialog closed on what it changed: the heading takes the focus each time */
  const [moves, setMoves] = useState(0)

  useLayoutEffect(() => {
    if (moves > 0) {
      heading.current?.focus()
    }
  }, [moves])

  const follow = (says: ErasureSays): void =>
    match(says)
      .with({ type: 'done' }, ({ request, message: said }) => {
        queryClient.setQueryData(erasureKeyOf(customerId), {
          type: 'read',
          request,
        })
        setDialog('none')
        setRefusal(undefined)
        setMoves((count) => count + 1)
        notify({ tone: 'success', message: said })
      })
      .with({ type: 'again' }, ({ message: said, errors: wrong }) => {
        setMessage(said)
        setErrors(wrong)
      })
      .with({ type: 'refused' }, ({ message: said }) => {
        setDialog('none')
        setRefusal(said)
        setMoves((count) => count + 1)
        // The request, and the customer, whom an erasure takes out of the ledger
        void queryClient.invalidateQueries({
          queryKey: customerKeyOf(customerId),
        })
      })
      .with({ type: 'gone' }, () => onLeft?.())
      .exhaustive()

  const asking = useMutation({
    mutationFn: (request: ModelsCustomerDeletionRequestCreateRequest) =>
      askForErasure(customerId, request),
    onMutate: () => setMessage(undefined),
    onSuccess: (outcome) => follow(afterErasureAsk(outcome, name, timezone)),
  })

  const cancelling = useMutation({
    mutationFn: () => cancelErasureRequest(customerId),
    onMutate: () => setMessage(undefined),
    onSuccess: (outcome) => follow(afterErasureCancel(outcome, name)),
  })

  const ask = (values: FormData): void => {
    const filled = readErasureAsk(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    asking.mutate(filled.value)
  }

  const shown = match(read.data)
    .returnType<ErasureShown>()
    .with(undefined, () => ({ type: 'reading' }))
    .with({ type: 'read' }, ({ request }) => ({ type: 'read', request }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'unread',
      message: `このアカウントでは、消去の依頼を読み込めません。${ANSWERED_BY_OTHERS}`,
      retrying: read.isFetching,
    }))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
      type: 'unread',
      message: inJapanese(
        unreadMessageOf(writtenInJapanese('消去の依頼'), reason),
      ),
      retrying: read.isFetching,
    }))
    .exhaustive()

  return (
    <CustomerErasure
      name={name}
      timezone={timezone}
      shown={shown}
      onRetry={() => void read.refetch()}
      requestable={onLeft !== undefined}
      refusal={refusal}
      headingRef={heading}
      dialog={dialog}
      onOpen={(opened) => {
        setMessage(undefined)
        setErrors(undefined)
        setDialog(opened)
      }}
      onClose={() => setDialog('none')}
      message={message}
      errors={errors}
      pending={asking.isPending || cancelling.isPending}
      onAsk={ask}
      onCancel={() => cancelling.mutate()}
    />
  )
}

type RequestsPartProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  /** The customer turned out to have left the ledger meanwhile: the page shows them as removed */
  onLeft: () => void
}

/**
 * What the salon answers when the customer asks about the data held of
 * them: the data is saved as a file, and their request to have it erased
 * is taken. A customer who left the ledger meanwhile is shown as removed,
 * as after a removal by another account.
 */
export const RequestsPart = ({
  salon,
  customer,
  onLeft,
}: RequestsPartProps) => {
  const session = useSession()
  const { notify } = useNotifications()
  /** Why no file was saved: said above the button */
  const [message, setMessage] = useState<string>()
  const name = customerNameOf(customer)

  const exporting = useMutation({
    mutationFn: () => exportCustomerData(customer.id),
    onMutate: () => setMessage(undefined),
    onSuccess: (outcome) =>
      match(afterDataExport(outcome, name))
        .with({ type: 'saved' }, ({ file, message: said }) => {
          saveFile(file)
          notify({ tone: 'success', message: said })
        })
        .with({ type: 'said' }, ({ message: said }) => setMessage(said))
        .with({ type: 'gone' }, onLeft)
        .exhaustive(),
  })

  return (
    <CustomerRequests
      answerable={
        session.type === 'signedIn' && mayKeepCustomers(session.user.role)
      }
      dataExport={{
        exporting: exporting.isPending,
        message,
        onExport: () => exporting.mutate(),
      }}
    >
      <ErasurePart
        customerId={customer.id}
        name={name}
        timezone={salon.timezone}
        onLeft={onLeft}
      />
    </CustomerRequests>
  )
}

type RemovedRequestsPartProps = {
  customerId: string
  /** The name of the customer, as the dialogs and the notifications say it */
  name: string
  timezone: string
}

/** The request of a customer who left the ledger to have their data erased: called off, never taken. */
export const RemovedRequestsPart = ({
  customerId,
  name,
  timezone,
}: RemovedRequestsPartProps) => (
  <CustomerRequests answerable>
    <ErasurePart customerId={customerId} name={name} timezone={timezone} />
  </CustomerRequests>
)
