import type {
  ModelsSalonRoleType,
  ModelsStaffInvitationResponse,
} from '@beauty-salon-frontend/api-client'
import { PASSWORD_RULE, RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  Button,
  ButtonLink,
  DescriptionList,
  Form,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  PasswordField,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import { EVERY_ROLE } from '../../session/utils/roles'
import {
  acceptInvitation,
  checkInvitation,
  joinInvitation,
  TOKEN_REFUSED,
} from '../api/account-api'
import { useMailedToken } from '../hooks/mailed-token'
import {
  afterRefusal,
  messageAfter,
  readNewPassword,
} from '../utils/account-flow'
import { CheckingLink, LinkNotChecked, LinkUnusable } from './mailed-link'

const TITLE = 'スタッフアカウントへの招待'

const ROLE: Record<ModelsSalonRoleType, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

/** The salons of the system are in Japan: a moment is said in their time */
const moment = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tokyo',
})

const ACCOUNT_EXISTS: { type: 'accountExists' } = { type: 'accountExists' }

/** How an invitation ended that this screen dealt with. */
type Ended = 'created' | 'joined' | 'linkRefused' | 'accountExists'

type InvitationProps = { invitation: ModelsStaffInvitationResponse }

/** What the invitation gives, and until when. */
const termsOf = (invitation: ModelsStaffInvitationResponse) => [
  { term: '役割', description: ROLE[invitation.role] },
  {
    term: '招待の期限',
    description: moment.format(new Date(invitation.expiresAt)),
  },
]

type StepProps = InvitationProps & {
  token: string
  onEnd: (ended: Ended) => void
}

/** The invited person has no account: a password makes one. */
const CreateAccount = ({ token, invitation, onEnd }: StepProps) => {
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const acceptance = useMutation({
    mutationFn: (password: string) => acceptInvitation(token, password),
    onSuccess: (outcome) => {
      match(outcome)
        .with({ type: 'accepted' }, () => onEnd('created'))
        .with({ type: 'tokenRefused' }, () => onEnd('linkRefused'))
        .with({ type: 'accountExists' }, () => onEnd('accountExists'))
        .with(
          { type: P.union('invalid', 'tooManyAttempts', 'failed') },
          (refusal) => setSays(afterRefusal(refusal)),
        )
        .exhaustive()
    },
  })

  const submit = (values: FormData): void => {
    const read = readNewPassword(values, 'password')
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    acceptance.mutate(read.value)
  }

  return (
    <>
      <PageHeader
        title={TITLE}
        description='パスワードを決めると、店舗向けの画面にサインインするアカウントができます。'
      />
      {/* Whom it is for is the first control of the form */}
      <DescriptionList items={termsOf(invitation)} />
      <Form
        submitLabel='アカウントを作る'
        message={says.message}
        errors={says.errors}
        pending={acceptance.isPending}
        onSubmit={submit}
      >
        {/* Not sent: it is here for a password manager, which stores the
            password under the address it finds beside it */}
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='username'
          readOnly
          value={invitation.email}
        />
        <PasswordField
          label='パスワード'
          name='password'
          autoComplete='new-password'
          required
          description={PASSWORD_RULE}
          error={says.errors['password']}
        />
      </Form>
    </>
  )
}

/** The invited person has an account, and is signed in with one. */
const JoinWithAccount = ({ token, invitation, onEnd }: StepProps) => {
  const [message, setMessage] = useState<string | undefined>(undefined)
  const joining = useMutation({
    mutationFn: () => joinInvitation(token),
    onSuccess: (outcome) => {
      match(outcome)
        .with({ type: 'accepted' }, () => onEnd('joined'))
        .with({ type: 'tokenRefused' }, () => onEnd('linkRefused'))
        .with({ type: 'notForThisAccount' }, () =>
          setMessage(
            `サインインしているアカウントでは、この招待を受けられません。${invitation.email} のスタッフのアカウントでサインインし直してください。`,
          ),
        )
        // The sign-in screen takes the place of this one
        .with({ type: 'signedOut' }, () => setMessage(undefined))
        .with(
          { type: P.union('invalid', 'tooManyAttempts', 'failed') },
          (refusal) => setMessage(messageAfter(refusal)),
        )
        .exhaustive()
    },
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description='サインインしているアカウントで、この招待を受けます。パスワードは、いまのものをそのまま使います。'
      />
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      <DescriptionList
        items={[
          { term: 'メールアドレス', description: invitation.email },
          ...termsOf(invitation),
        ]}
      />
      <Button
        variant='primary'
        pending={joining.isPending}
        onClick={() => joining.mutate()}
      >
        招待を受ける
      </Button>
    </>
  )
}

const ToAdmin = () => (
  <ButtonLink href={import.meta.env.VITE_ADMIN_APP_URL}>
    店舗向けの画面を開く
  </ButtonLink>
)

const AcceptWithToken = ({ token }: { token: string }) => {
  // Asked once for this screen, and forgotten with it: the answer is about
  // a token that the next screen does not have
  const check = useQuery({
    queryKey: ['account', 'staff-invitation', token],
    queryFn: () => checkInvitation(token),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
  const [ended, setEnded] = useState<Ended | null>(null)

  if (ended === 'created') {
    return (
      <>
        <PageHeader
          title='アカウントを作りました'
          description='招待のメールアドレスと、いま決めたパスワードで、店舗向けの画面にサインインしてください。'
        />
        <ToAdmin />
      </>
    )
  }
  if (ended === 'joined') {
    return (
      <>
        <PageHeader
          title='招待を受けました'
          description='このアカウントで、店舗向けの画面を使えるようになりました。'
        />
        <ToAdmin />
      </>
    )
  }

  return match(
    ended === 'linkRefused'
      ? TOKEN_REFUSED
      : ended === 'accountExists'
        ? ACCOUNT_EXISTS
        : check.data,
  )
    .with(undefined, () => <CheckingLink title={TITLE} />)
    .with({ type: 'open', next: 'accept' }, ({ invitation }) => (
      <CreateAccount token={token} invitation={invitation} onEnd={setEnded} />
    ))
    .with({ type: 'open', next: 'join' }, ({ invitation }) => (
      // The API decides whose invitation it is: anybody is asked to sign in
      <RequireSession
        roles={EVERY_ROLE}
        signInNotice={`この招待は、${invitation.email} のスタッフのアカウントで受けられます。そのアカウントでサインインしてください。`}
        signInHelp={
          // The link of the mail still works after a new password was set
          <p>
            <Link to='/forgot-password'>パスワードを忘れた場合</Link>
          </p>
        }
      >
        <JoinWithAccount
          token={token}
          invitation={invitation}
          onEnd={setEnded}
        />
      </RequireSession>
    ))
    .with({ type: 'accountExists' }, () => (
      <LinkUnusable description='招待されたメールアドレスには、すでにアカウントがあり、この招待は使えません。招待を送ったサロンに、お問い合わせください。' />
    ))
    .with({ type: 'tokenRefused' }, () => (
      <LinkUnusable description='招待の期限（7 日）が過ぎたか、すでに使われたか、取り消されています。招待を送ったサロンに、もう一度招待するよう、お伝えください。' />
    ))
    .with(
      { type: P.union('invalid', 'tooManyAttempts', 'failed') },
      (refusal) => (
        <LinkNotChecked
          title={TITLE}
          refusal={refusal}
          onRetry={() => void check.refetch()}
        />
      ),
    )
    .exhaustive()
}

/**
 * Where the link of an invitation to the staff of a salon leads. The API
 * says which of two ways takes the invitation: somebody without an account
 * chooses a password, somebody with one signs in with it.
 */
export const AcceptStaffInvitationScreen = () => {
  const token = useMailedToken()

  return token === null ? (
    <LinkUnusable description='このページは、招待のメールのリンクから開いてください。' />
  ) : (
    <AcceptWithToken key={token} token={token} />
  )
}
