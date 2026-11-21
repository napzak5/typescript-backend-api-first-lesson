import type { ModelsSharedFileResponse } from '@beauty-salon-frontend/api-client'
import {
  Form,
  LoadingIndicator,
  PageHeader,
  PasswordField,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { useMailedToken } from '../account/mailed-token'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { unreadMessageOf } from '../salons/pages'
import {
  type SharedFileContent,
  SharedFileRecord,
} from './components/shared-file-record/shared-file-record'
import { loadSharedFile, readSharedFile } from './share-api'
import {
  afterPassword,
  loadMessageOf,
  NO_TOKEN_SAID,
  PASSWORD_AGAIN_SAID,
  readPassword,
  UNUSABLE_SAID,
} from './shared-file'

const TITLE = '共有されたファイル'

const UNREAD = P.union('tooManyRequests', 'failed')

const NOT_LOADED: SharedFileContent = {
  type: 'notLoaded',
  pending: false,
  message: undefined,
}

/** What the screen shows of a link, as far as it got */
type Gate =
  /** As the check of the link found it, when the screen opened */
  | { type: 'checked' }
  /** The API refused the password that opened the file: it is asked for again */
  | { type: 'askingAgain' }
  | { type: 'open'; file: ModelsSharedFileResponse; password: string }
  | { type: 'unusable' }

/** The link works no more: the API does not say why. */
const ShareLinkUnusable = () => (
  <PageHeader title='この共有リンクは開けません' description={UNUSABLE_SAID} />
)

type SharedFileViewProps = {
  token: string
  file: ModelsSharedFileResponse
  /** The password that opened the file; `null` for a link that has none */
  password: string | null
  onPasswordRefused: () => void
  onUnusable: () => void
}

/**
 * The file of the link, which the page loads when a button is pressed and
 * holds at an object URL until the screen closes. The link counts every
 * load, so the page loads it once, and shows, opens and saves what it
 * holds.
 */
const SharedFileView = ({
  token,
  file,
  password,
  onPasswordRefused,
  onUnusable,
}: SharedFileViewProps) => {
  const [loaded, setLoaded] = useState<string | null>(null)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const heading = useRef<HTMLHeadingElement>(null)
  const loading = useMutation({
    mutationFn: () => loadSharedFile(token, password, file),
    onSuccess: (load) => {
      match(load)
        .with({ type: 'loaded' }, ({ content }) => {
          setLoaded(URL.createObjectURL(content))
        })
        .with({ type: 'passwordRefused' }, onPasswordRefused)
        .with({ type: 'unusable' }, onUnusable)
        .with(
          { type: P.union('notFetched', 'tooManyRequests', 'failed') },
          (reason) => setMessage(loadMessageOf(reason)),
        )
        .exhaustive()
    },
  })

  // The object is let go of with the screen, or when another takes its place
  useEffect(
    () => () => {
      if (loaded !== null) {
        URL.revokeObjectURL(loaded)
      }
    },
    [loaded],
  )

  // The button went with what it did: the part of the file takes the focus
  useLayoutEffect(() => {
    if (loaded !== null) {
      heading.current?.focus()
    }
  }, [loaded])

  return (
    <>
      <PageHeader
        title={file.filename}
        description='サロンから共有されたファイルです。'
      />
      <SharedFileRecord
        file={file}
        content={
          loaded === null
            ? { ...NOT_LOADED, pending: loading.isPending, message }
            : { type: 'loaded', url: loaded }
        }
        onLoad={() => loading.mutate()}
        headingRef={heading}
      />
    </>
  )
}

type PasswordGateProps = {
  token: string
  /** The password is asked for again, after the API refused the one that opened the file */
  again: boolean
  onOpened: (file: ModelsSharedFileResponse, password: string) => void
  onUnusable: () => void
}

/**
 * The password of a link that has one. The screen keeps it while it is
 * open, and sends it again with the request that loads the file; it is put
 * nowhere else.
 */
const PasswordGate = ({
  token,
  again,
  onOpened,
  onUnusable,
}: PasswordGateProps) => {
  const [says, setSays] = useState<FormSays>(
    again ? { message: PASSWORD_AGAIN_SAID, errors: {} } : NOTHING_TO_SAY,
  )
  const opening = useMutation({
    mutationFn: (password: string) => readSharedFile(token, password),
    onSuccess: (read, password) => {
      match(read)
        .with({ type: 'found' }, ({ file }) => onOpened(file, password))
        .with({ type: 'unusable' }, onUnusable)
        .with(
          { type: P.union('passwordRefused', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterPassword(refusal)),
        )
        .exhaustive()
    },
  })

  const submit = (values: FormData): void => {
    const read = readPassword(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    opening.mutate(read.value)
  }

  return (
    <>
      <PageHeader
        title={TITLE}
        description='このファイルは、パスワードで保護されています。共有したサロンから、リンクとは別に伝えられたパスワードを入力してください。'
      />
      <Form
        submitLabel='ファイルを開く'
        message={says.message}
        errors={says.errors}
        pending={opening.isPending}
        onSubmit={submit}
      >
        <PasswordField
          label='パスワード'
          name='password'
          autoComplete='off'
          required
          error={says.errors['password']}
        />
      </Form>
    </>
  )
}

const SharedFileOfToken = ({ token }: { token: string }) => {
  // Asked once for this screen, and forgotten with it: reading what is
  // known of the file uses nothing up
  const check = useQuery({
    queryKey: ['share', token],
    queryFn: () => readSharedFile(token, null),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  })
  const [gate, setGate] = useState<Gate>({ type: 'checked' })
  const opened = (file: ModelsSharedFileResponse, password: string) =>
    setGate({ type: 'open', file, password })
  const unusable = () => setGate({ type: 'unusable' })
  const askAgain = () => setGate({ type: 'askingAgain' })

  return match(gate)
    .with({ type: 'unusable' }, () => <ShareLinkUnusable />)
    .with({ type: 'open' }, ({ file, password }) => (
      <SharedFileView
        token={token}
        file={file}
        password={password}
        onPasswordRefused={askAgain}
        onUnusable={unusable}
      />
    ))
    .with({ type: 'askingAgain' }, () => (
      <PasswordGate
        token={token}
        again
        onOpened={opened}
        onUnusable={unusable}
      />
    ))
    .with({ type: 'checked' }, () =>
      match(check.data)
        .with(undefined, () => (
          <>
            <PageHeader title={TITLE} />
            <LoadingIndicator label='共有リンクを確かめています' />
          </>
        ))
        .with({ type: 'found' }, ({ file }) => (
          <SharedFileView
            token={token}
            file={file}
            password={null}
            onPasswordRefused={askAgain}
            onUnusable={unusable}
          />
        ))
        .with({ type: 'passwordRefused' }, () => (
          <PasswordGate
            token={token}
            again={false}
            onOpened={opened}
            onUnusable={unusable}
          />
        ))
        .with({ type: 'unusable' }, () => <ShareLinkUnusable />)
        .with({ type: UNREAD }, (reason) => (
          <>
            <PageHeader title={TITLE} />
            <UnreadNotice
              message={unreadMessageOf('ファイルの情報', reason)}
              onRetry={() => void check.refetch()}
              pending={check.isFetching}
            />
          </>
        ))
        .exhaustive(),
    )
    .exhaustive()
}

/**
 * Where a share link leads: a file a salon shares with somebody who has no
 * account, which anybody who has the link sees, signed in or not. The token
 * is in the fragment of the address, which no server is sent, and is taken
 * out of the address once it is read.
 */
export const SharedFileScreen = () => {
  const token = useMailedToken()

  return token === null ? (
    <PageHeader
      title='この共有リンクは開けません'
      description={NO_TOKEN_SAID}
    />
  ) : (
    <SharedFileOfToken key={token} token={token} />
  )
}
