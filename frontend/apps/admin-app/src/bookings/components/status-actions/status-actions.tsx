import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  Note,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import type { StatusAction } from '../../utils/booking-actions'
import { statusNameOf, statusToneOf } from '../../utils/booking-format'
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
  when: LocalizedText
  /** The heading of the part: the focus goes there after an operation */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The operation that is on its way */
  pending?: StatusAction | undefined
  /** The dialog that is open */
  asking?: AskedAction | undefined
  /** What went wrong with the attempt in the dialog that is open, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the fields of the completion. A new object is the answer to another attempt */
  completionErrors?: FormErrors<LocalizedText> | undefined
  /** When the treatment began, as it was recorded; `undefined` when it was not */
  recordedStart?: LocalizedText | undefined
  onAct: (action: DirectAction) => void
  onAsk: (action: AskedAction) => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onComplete: (values: FormData) => void
  onCancel: (values: FormData) => void
  onNoShow: () => void
}

const WORDS = adminBookingMessages.details.status
const LABELS: Record<StatusAction, LocalizedText> = WORDS.actions

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
  completionErrors = NO_ERRORS,
  recordedStart,
  onAct,
  onAsk,
  onClose,
  onComplete,
  onCancel,
  onNoShow,
}: StatusActionsProps) => {
  const say = useSay()
  const completion = useSaidForm(message, completionErrors)
  const said = message !== undefined && (
    <Alert tone='danger'>{say(message)}</Alert>
  )

  return (
    <Card title={say(WORDS.title)} headingRef={headingRef}>
      <div className={styles['statusActions']}>
        <p>
          <Badge tone={statusToneOf(status)}>{say(statusNameOf(status))}</Badge>
        </p>
        {actions.length === 0 ? (
          <Note>{say(WORDS.closed)}</Note>
        ) : (
          <Actions>
            {actions.map((action) =>
              action === 'confirm' || action === 'start' ? (
                <Button
                  key={action}
                  variant='primary'
                  pending={pending === action}
                  onClick={() => onAct(action)}
                >
                  {say(LABELS[action])}
                </Button>
              ) : (
                <Button
                  key={action}
                  variant={action === 'complete' ? 'secondary' : 'danger'}
                  onClick={() => onAsk(action)}
                >
                  {say(LABELS[action])}
                </Button>
              ),
            )}
          </Actions>
        )}
      </div>
      <FormDialog
        open={asking === 'complete'}
        onClose={onClose}
        title={say(WORDS.completion.title)}
        description={say(WORDS.completion.description(when))}
        submitLabel={say(WORDS.completion.submit)}
        message={completion.message}
        errors={completionErrors}
        pending={pending === 'complete'}
        onSubmit={onComplete}
      >
        <TextField
          label={say(WORDS.completion.actualStart)}
          name='actualStartTime'
          autoComplete='off'
          type='datetime-local'
          description={say(
            recordedStart === undefined
              ? WORDS.completion.notRecorded
              : WORDS.completion.recordedStart(recordedStart),
          )}
          error={completion.errors['actualStartTime']}
        />
        <TextField
          label={say(WORDS.completion.actualEnd)}
          name='actualEndTime'
          autoComplete='off'
          type='datetime-local'
          description={say(WORDS.completion.notRecorded)}
          error={completion.errors['actualEndTime']}
        />
      </FormDialog>
      <FormDialog
        open={asking === 'cancel'}
        onClose={onClose}
        title={say(WORDS.cancellation.title)}
        description={say(WORDS.cancellation.description(when))}
        submitLabel={say(WORDS.cancellation.submit)}
        submitVariant='danger'
        message={completion.message}
        pending={pending === 'cancel'}
        onSubmit={onCancel}
      >
        <TextArea
          label={say(WORDS.cancellation.reason)}
          name='cancellationReason'
          rows={4}
          description={say(WORDS.cancellation.reasonDescription)}
        />
      </FormDialog>
      <Dialog
        open={asking === 'noShow'}
        onClose={onClose}
        title={say(WORDS.noShow.title)}
        description={say(WORDS.noShow.description(when))}
        actions={
          <>
            <Button onClick={onClose}>{say(WORDS.noShow.back)}</Button>
            <Button
              variant='danger'
              pending={pending === 'noShow'}
              onClick={onNoShow}
            >
              {say(WORDS.noShow.submit)}
            </Button>
          </>
        }
      >
        {said}
      </Dialog>
    </Card>
  )
}
