import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { match } from 'ts-pattern'
import { timeZoneNoteOf } from '../user-accounts/user-accounts'
import { ExecutedRequests } from './components/executed-requests/executed-requests'
import { OperationRun } from './components/operation-run/operation-run'
import { SystemStateRecord } from './components/system-state/system-state'
import {
  ADMINISTRATORS_ONLY,
  afterErasure,
  afterExpiry,
  afterPurge,
  ERASURE_COPY,
  EXPIRY_COPY,
  erasureResultOf,
  expiryResultOf,
  PURGE_COPY,
  purgeResultOf,
  type RunCopy,
  type RunSays,
  ranAtOf,
} from './operations'
import {
  executeDeletionRequests,
  expirePoints,
  purgeAttachments,
  readSystemState,
  SYSTEM_STATE_KEY,
} from './operations-api'
import { useRunsOperations } from './runs-operations'

const TITLE = '運用'

/** What the operations that are run by hand have in common, said above them */
const LEAD =
  'ポイントの失効、データの消去の依頼の実行、添付ファイルの掃除は、定期的に行う操作で、ここでは管理者が手で実行します。どれも、そのときに期限の来たものをすべて処理し、同じものを二度は処理しません。'

type SystemPartProps = { timezone: string }

/** The state of the system, asked whenever the screen opens and whenever the administrator asks again */
const SystemPart = ({ timezone }: SystemPartProps) => {
  const read = useQuery({
    queryKey: SYSTEM_STATE_KEY,
    queryFn: readSystemState,
    staleTime: 0,
  })

  return read.data === undefined ? (
    <LoadingIndicator label='システムの状態を確かめています' />
  ) : (
    <SystemStateRecord
      state={read.data}
      readAt={new Date(read.dataUpdatedAt).toISOString()}
      timezone={timezone}
      checking={read.isFetching}
      onCheck={() => void read.refetch()}
    />
  )
}

type RunPartProps<Result> = {
  copy: RunCopy
  /** Runs the operation, and says what the screen does then */
  run: () => Promise<RunSays<Result>>
  /** What a run did, in words: in the part and in the notification */
  wordsOf: (result: Result) => string
  /** What a run did, in detail, below the words */
  details?: ((result: Result) => ReactNode) | undefined
  timezone: string
}

/**
 * One operation that is run by hand, after its dialog. What a run did is
 * said in the part with its moment, and in a notification; a failure that
 * another attempt may mend is said in the dialog, a refusal in the part.
 */
const RunPart = <Result,>({
  copy,
  run,
  wordsOf,
  details,
  timezone,
}: RunPartProps<Result>) => {
  const { notify } = useNotifications()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<string>()
  const [refusal, setRefusal] = useState<string>()
  const [ran, setRan] = useState<{ at: string; result: Result }>()

  const mutation = useMutation({
    mutationFn: run,
    onSuccess: (says) =>
      match(says)
        .with({ type: 'done' }, ({ result }) => {
          setAsking(false)
          setRan({ at: new Date().toISOString(), result })
          notify({ tone: 'success', message: wordsOf(result) })
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setAsking(false)
          setRefusal(refused)
        })
        .exhaustive(),
  })

  return (
    <OperationRun
      copy={copy}
      result={
        ran === undefined
          ? undefined
          : ranAtOf(momentNameAt(ran.at, timezone), wordsOf(ran.result))
      }
      refusal={refusal}
      asking={asking}
      pending={mutation.isPending}
      message={message}
      onAsk={() => {
        setMessage(undefined)
        setRefusal(undefined)
        setAsking(true)
      }}
      onClose={() => setAsking(false)}
      onRun={() => {
        setMessage(undefined)
        mutation.mutate()
      }}
    >
      {ran !== undefined && details?.(ran.result)}
    </OperationRun>
  )
}

const OperationsPage = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <>
      <PageHeader
        title={TITLE}
        description='システムの状態と、定期的に行う操作'
      />
      <p>{timeZoneNoteOf(timezone)}</p>
      <SystemPart timezone={timezone} />
      <p>{LEAD}</p>
      <RunPart
        copy={EXPIRY_COPY}
        run={async () => afterExpiry(await expirePoints())}
        wordsOf={expiryResultOf}
        timezone={timezone}
      />
      <RunPart
        copy={ERASURE_COPY}
        run={async () => afterErasure(await executeDeletionRequests())}
        wordsOf={erasureResultOf}
        details={(requests) =>
          requests.length > 0 && (
            <ExecutedRequests requests={requests} timezone={timezone} />
          )
        }
        timezone={timezone}
      />
      <RunPart
        copy={PURGE_COPY}
        run={async () => afterPurge(await purgeAttachments())}
        wordsOf={purgeResultOf}
        timezone={timezone}
      />
    </>
  )
}

/**
 * What an administrator runs the platform with: the state of the system,
 * and the operations that are meant to run at intervals, run by hand.
 * Another role is told who does it, and the API is not asked.
 */
export const OperationsScreen = () =>
  useRunsOperations() ? (
    <OperationsPage />
  ) : (
    <>
      <PageHeader title={TITLE} />
      <p>{ADMINISTRATORS_ONLY}</p>
      <ButtonLink href='/'>トップへ戻る</ButtonLink>
    </>
  )
