import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Dialog,
  EmptyState,
  FormDialog,
  type FormErrors,
  LoadingIndicator,
  NO_ERRORS,
  TextArea,
  UnreadNotice,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import type { ErasureRequest } from '../../api/customer-erasure-api'
import { erasureStateOf } from '../../utils/customer-erasure'
import styles from './customer-erasure.module.css'

const { erasure: words } = adminCustomerMessages

/** What the part shows of the latest request below its heading */
export type ErasureShown =
  | { type: 'reading' }
  | { type: 'unread'; message: LocalizedText; retrying: boolean }
  /** `null` when the customer never asked */
  | { type: 'read'; request: ErasureRequest | null }

/** The dialog of the part that is open: one that takes a request, or one that calls it off */
export type ErasureDialog = 'none' | 'ask' | 'cancel'

export type CustomerErasureProps = {
  /** The name of the customer, as the dialogs say it: 「田中 優希」 */
  name: string
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  shown: ErasureShown
  /** The request that could not be read is to be read again */
  onRetry: () => void
  /**
   * A new request is taken: not of a customer who left the ledger, whose
   * request is taken once they are back
   */
  requestable: boolean
  /** What the API refused, or what changed meanwhile: said under the heading, in the language of the page */
  refusal?: LocalizedText | undefined
  /** The heading, which takes the focus when a dialog closes on what it changed */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  dialog: ErasureDialog
  /** A button that opens a dialog was pressed */
  onOpen: (dialog: Exclude<ErasureDialog, 'none'>) => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `dialog` to `none` here
   */
  onClose: () => void
  /** What went wrong with an attempt that can be made again: said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the reason, under its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The request, or its calling off, is on its way */
  pending?: boolean | undefined
  /** The form of the request was sent: `reason` */
  onAsk: (values: FormData) => void
  /** The calling off was confirmed */
  onCancel: () => void
}

/**
 * The request of the customer to have the data held of them erased: what
 * erasing does, the latest request and what became of it, a new request
 * taken with its reason, and a pending one called off. The salon makes
 * sure first that the one who asks is the customer; the erasure is run
 * 14 days after the request, and until then the request can be called
 * off.
 */
export const CustomerErasure = ({
  name,
  timezone,
  shown,
  onRetry,
  requestable,
  refusal,
  headingRef,
  dialog,
  onOpen,
  onClose,
  message,
  errors = NO_ERRORS,
  pending = false,
  onAsk,
  onCancel,
}: CustomerErasureProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const pendingShown =
    shown.type === 'read' && shown.request?.status === 'pending'

  const asking = (
    <>
      <p>{say(words.about)}</p>
      <Button variant='danger' onClick={() => onOpen('ask')}>
        {say(words.ask)}
      </Button>
    </>
  )

  const saidState = (request: ErasureRequest): string | undefined => {
    const state = erasureStateOf(request, timezone)
    return state === undefined ? undefined : say(state)
  }

  const shownRequest = (request: ErasureRequest | null) =>
    match(request)
      .with(null, () =>
        requestable ? (
          asking
        ) : (
          <EmptyState kind='part' title={say(words.none)} />
        ),
      )
      .with({ status: 'pending' }, ({ requestedAt, scheduledAt, reason }) => (
        <>
          <DescriptionList
            className={styles['details']}
            items={[
              {
                term: say(words.pending.requestedAt),
                description: say(momentNameAt(requestedAt, timezone)),
              },
              {
                term: say(words.pending.scheduled),
                description: say(
                  words.pending.scheduledOf(
                    momentNameAt(scheduledAt, timezone),
                  ),
                ),
              },
              { term: say(words.pending.reason), description: reason },
            ]}
          />
          <p>{say(words.pending.about)}</p>
          <Button onClick={() => onOpen('cancel')}>
            {say(words.pending.cancel)}
          </Button>
        </>
      ))
      .with({ status: 'cancelled' }, (cancelled) => (
        <>
          <p>{saidState(cancelled)}</p>
          {requestable && asking}
        </>
      ))
      .with({ status: 'completed' }, (completed) => (
        <p>{saidState(completed)}</p>
      ))
      .exhaustive()

  return (
    <Card title={say(words.title)} headingLevel={3} headingRef={headingRef}>
      <div className={styles['erasure']}>
        {refusal !== undefined && <Alert tone='warning'>{say(refusal)}</Alert>}
        {match(shown)
          .with({ type: 'reading' }, () => (
            <LoadingIndicator label={say(words.loading)} />
          ))
          .with({ type: 'unread' }, ({ message: unread, retrying }) => (
            <UnreadNotice
              message={say(unread)}
              onRetry={onRetry}
              pending={retrying}
            />
          ))
          .with({ type: 'read' }, ({ request }) => shownRequest(request))
          .exhaustive()}
      </div>
      {requestable && (
        <FormDialog
          open={dialog === 'ask'}
          onClose={onClose}
          title={say(words.asking.title)}
          description={say(words.asking.description(name))}
          submitLabel={say(words.asking.submit)}
          submitVariant='danger'
          message={said.message}
          errors={errors}
          pending={pending}
          onSubmit={onAsk}
        >
          <TextArea
            label={say(words.asking.reason)}
            name='reason'
            required
            description={say(words.asking.reasonDescription)}
            error={said.errors['reason']}
          />
        </FormDialog>
      )}
      {pendingShown && (
        <Dialog
          open={dialog === 'cancel'}
          onClose={onClose}
          title={say(words.cancelling.title)}
          description={say(words.cancelling.description(name))}
          actions={
            <>
              <Button onClick={onClose}>{say(words.cancelling.back)}</Button>
              <Button pending={pending} onClick={onCancel}>
                {say(words.cancelling.confirm)}
              </Button>
            </>
          }
        >
          {said.message !== undefined && (
            <Alert tone='danger'>{said.message}</Alert>
          )}
        </Dialog>
      )}
    </Card>
  )
}
