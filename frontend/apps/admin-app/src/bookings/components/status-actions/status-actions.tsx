import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, type Ref, useId } from 'react'
import type { StatusAction } from '../../booking-actions'
import { statusNameOf, statusToneOf } from '../../booking-format'
import styles from './status-actions.module.css'

/** The operations that a dialog asks about first: they cannot be undone */
export type AskedAction = 'complete' | 'cancel' | 'noShow'

/** The operations that are done at once */
type DirectAction = 'confirm' | 'start'

export type StatusActionsProps = {
  status: ModelsBookingStatusType
  /** The operations the booking can take now, in the order of their buttons */
  actions: readonly StatusAction[]
  /** When the booking is, as the dialogs name it: 「2026年11月20日（金） 10:00〜11:00」 */
  when: string
  /** The heading of the part: the focus goes there after an operation */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The operation that is on its way */
  pending?: StatusAction | undefined
  /** The dialog that is open */
  asking?: AskedAction | undefined
  /** What went wrong with the attempt in the dialog that is open */
  message?: string | undefined
  /** What is wrong with the fields of the completion */
  completionErrors?: Record<string, string> | undefined
  /** When the treatment began, as it was recorded; `undefined` when it was not */
  recordedStart?: string | undefined
  onAct: (action: DirectAction) => void
  onAsk: (action: AskedAction) => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onComplete: (values: FormData) => void
  onCancel: (values: FormData) => void
  onNoShow: () => void
}

const LABELS: Record<StatusAction, string> = {
  confirm: '予約を確定する',
  start: '施術を始める',
  complete: '完了にする',
  noShow: '無断キャンセルを記録する',
  cancel: '予約をキャンセルする',
}

/**
 * The state of a booking, and what can be done to it. Confirming it and
 * beginning the treatment are done at once; completing it, cancelling it
 * and recording that nobody came cannot be undone, so a dialog asks first.
 */
export const StatusActions = ({
  status,
  actions,
  when,
  headingRef,
  pending,
  asking,
  message,
  completionErrors = {},
  recordedStart,
  onAct,
  onAsk,
  onClose,
  onComplete,
  onCancel,
  onNoShow,
}: StatusActionsProps) => {
  const completionId = useId()
  const cancellationId = useId()

  const sent =
    (send: (values: FormData) => void, action: StatusAction) =>
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault()
      if (pending !== action) {
        send(new FormData(event.currentTarget))
      }
    }

  const said = message !== undefined && <Alert tone='danger'>{message}</Alert>
  const back = <Button onClick={onClose}>戻る</Button>

  return (
    <Card title='状態' headingRef={headingRef}>
      <div className={styles['statusActions']}>
        <p>
          <Badge tone={statusToneOf(status)}>{statusNameOf(status)}</Badge>
        </p>
        {actions.length === 0 ? (
          <p className={styles['note']}>
            この予約の状態は、もう変えられません。誤って記録したときは、予約を削除して入れ直してください。
          </p>
        ) : (
          <div className={styles['buttons']}>
            {actions.map((action) =>
              action === 'confirm' || action === 'start' ? (
                <Button
                  key={action}
                  variant='primary'
                  pending={pending === action}
                  onClick={() => onAct(action)}
                >
                  {LABELS[action]}
                </Button>
              ) : (
                <Button
                  key={action}
                  variant={action === 'complete' ? 'secondary' : 'danger'}
                  onClick={() => onAsk(action)}
                >
                  {LABELS[action]}
                </Button>
              ),
            )}
          </div>
        )}
      </div>
      <Dialog
        open={asking === 'complete'}
        onClose={onClose}
        title='予約を完了にしますか？'
        description={`${when}の予約を完了にします。完了にした予約は、元に戻せません。`}
        actions={
          <>
            {back}
            <Button
              type='submit'
              form={completionId}
              variant='primary'
              pending={pending === 'complete'}
            >
              完了にする
            </Button>
          </>
        }
      >
        <form
          className={styles['form']}
          id={completionId}
          noValidate
          onSubmit={sent(onComplete, 'complete')}
        >
          {said}
          <TextField
            label='実際の開始'
            name='actualStartTime'
            type='datetime-local'
            description={
              recordedStart === undefined
                ? 'サロンの時計の日時。空欄のときは、記録しません。'
                : `サロンの時計の日時。空欄のときは、施術を始めたときに記録した日時（${recordedStart}）のままです。`
            }
            error={completionErrors['actualStartTime']}
          />
          <TextField
            label='実際の終了'
            name='actualEndTime'
            type='datetime-local'
            description='サロンの時計の日時。空欄のときは、記録しません。'
            error={completionErrors['actualEndTime']}
          />
        </form>
      </Dialog>
      <Dialog
        open={asking === 'cancel'}
        onClose={onClose}
        title='予約をキャンセルしますか？'
        description={`${when}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`}
        actions={
          <>
            {back}
            <Button
              type='submit'
              form={cancellationId}
              variant='danger'
              pending={pending === 'cancel'}
            >
              キャンセルを確定する
            </Button>
          </>
        }
      >
        <form
          className={styles['form']}
          id={cancellationId}
          noValidate
          onSubmit={sent(onCancel, 'cancel')}
        >
          {said}
          <TextArea
            label='キャンセルの理由'
            name='cancellationReason'
            description='お客様からの連絡の内容など。空欄のままでも、キャンセルできます。'
          />
        </form>
      </Dialog>
      <Dialog
        open={asking === 'noShow'}
        onClose={onClose}
        title='無断キャンセルを記録しますか？'
        description={`${when}の予約に、お客様が来店しなかったことを記録します。記録した予約は、元に戻せません。`}
        actions={
          <>
            {back}
            <Button
              variant='danger'
              pending={pending === 'noShow'}
              onClick={onNoShow}
            >
              記録する
            </Button>
          </>
        }
      >
        {said}
      </Dialog>
    </Card>
  )
}
