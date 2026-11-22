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
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import { erasureStateOf } from '../../customer-erasure'
import type { ErasureRequest } from '../../customer-erasure-api'
import styles from './customer-erasure.module.css'

/** What the part shows of the latest request below its heading */
export type ErasureShown =
  | { type: 'reading' }
  | { type: 'unread'; message: string; retrying: boolean }
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
  /** What the API refused, or what changed meanwhile: said under the heading */
  refusal?: string | undefined
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
  /** What went wrong with an attempt that can be made again: said in the dialog */
  message?: string | undefined
  /** What is wrong with the reason, under its control */
  errors?: FormErrors | undefined
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
  const pendingShown =
    shown.type === 'read' && shown.request?.status === 'pending'

  const asking = (
    <>
      <p>
        お客様ご本人から、保有している個人データの消去を求められたときは、ご本人であることを確かめてから、依頼を受け付けます。受け付けてから
        14
        日のあいだは取り消せ、そのあとで消去します。売上と、売上のもとになった予約は、帳簿の保存のために残し、お客様を特定できる情報を消します。消去したデータは、元に戻せません。
      </p>
      <Button variant='danger' onClick={() => onOpen('ask')}>
        消去の依頼を受け付ける
      </Button>
    </>
  )

  const shownRequest = (request: ErasureRequest | null) =>
    match(request)
      .with(null, () =>
        requestable ? (
          asking
        ) : (
          <EmptyState kind='part' title='消去の依頼はありません。' />
        ),
      )
      .with({ status: 'pending' }, ({ requestedAt, scheduledAt, reason }) => (
        <>
          <DescriptionList
            className={styles['details']}
            items={[
              {
                term: '受け付けた日時',
                description: momentNameAt(requestedAt, timezone),
              },
              {
                term: '消去の予定',
                description: `${momentNameAt(scheduledAt, timezone)} 以降`,
              },
              { term: '依頼の理由', description: reason },
            ]}
          />
          <p>
            予定の日時を過ぎたあとに、消去が実行されます。それまでは、依頼を取り消せます。
          </p>
          <Button onClick={() => onOpen('cancel')}>依頼を取り消す</Button>
        </>
      ))
      .with({ status: 'cancelled' }, (cancelled) => (
        <>
          <p>{erasureStateOf(cancelled, timezone)}</p>
          {requestable && asking}
        </>
      ))
      .with({ status: 'completed' }, (completed) => (
        <p>{erasureStateOf(completed, timezone)}</p>
      ))
      .exhaustive()

  return (
    <Card title='データの消去' headingLevel={3} headingRef={headingRef}>
      <div className={styles['erasure']}>
        {refusal !== undefined && <Alert tone='warning'>{refusal}</Alert>}
        {match(shown)
          .with({ type: 'reading' }, () => (
            <LoadingIndicator label='消去の依頼を読み込んでいます' />
          ))
          .with({ type: 'unread' }, ({ message: unread, retrying }) => (
            <UnreadNotice
              message={unread}
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
          title='消去の依頼を受け付けますか？'
          description={`${name} 様のデータの消去の依頼を受け付けます。受け付けてから 14 日のあいだは、取り消せます。`}
          submitLabel='受け付ける'
          submitVariant='danger'
          message={message}
          errors={errors}
          pending={pending}
          onSubmit={onAsk}
        >
          <TextArea
            label='依頼の理由'
            name='reason'
            required
            description='ご本人が述べた理由や、依頼を受けた方法を書きます。依頼の記録に残ります。'
            error={errors['reason']}
          />
        </FormDialog>
      )}
      {pendingShown && (
        <Dialog
          open={dialog === 'cancel'}
          onClose={onClose}
          title='消去の依頼を取り消しますか？'
          description={`${name} 様のデータは消去されません。ご本人が依頼を撤回したときや、誤って受け付けたときに取り消します。`}
          actions={
            <>
              <Button onClick={onClose}>戻る</Button>
              <Button pending={pending} onClick={onCancel}>
                取り消す
              </Button>
            </>
          }
        >
          {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        </Dialog>
      )}
    </Card>
  )
}
