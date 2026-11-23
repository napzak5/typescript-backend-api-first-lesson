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
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalAccountMessages } from '@beauty-salon-shared/i18n/messages/portal'
import {
  frameMessages,
  sessionMessages,
  termMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
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

const { invitation: words } = portalAccountMessages
const { signInForm } = sessionMessages

const ROLE: Record<ModelsSalonRoleType, LocalizedText> = termMessages.salonRole

/** The salons of the system are in Japan: a moment is said in their time */
const TIME_ZONE = 'Asia/Tokyo'

const ACCOUNT_EXISTS: { type: 'accountExists' } = { type: 'accountExists' }

/** How an invitation ended that this screen dealt with. */
type Ended = 'created' | 'joined' | 'linkRefused' | 'accountExists'

type InvitationProps = { invitation: ModelsStaffInvitationResponse }

/** What the invitation gives, and until when, in the language of the page. */
const useTermsOf = (invitation: ModelsStaffInvitationResponse) => {
  const say = useSay()

  return [
    { term: say(words.role), description: say(ROLE[invitation.role]) },
    {
      term: say(words.expiresAt),
      description: say(formats.momentAt(invitation.expiresAt, TIME_ZONE)),
    },
  ]
}

type StepProps = InvitationProps & {
  token: string
  onEnd: (ended: Ended) => void
}

/** The invited person has no account: a password makes one. */
const CreateAccount = ({ token, invitation, onEnd }: StepProps) => {
  const say = useSay()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const terms = useTermsOf(invitation)
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
        title={say(words.title)}
        description={say(words.createDescription)}
      />
      {/* Whom it is for is the first control of the form */}
      <DescriptionList items={terms} />
      <Form
        submitLabel={say(words.create)}
        message={said.message}
        errors={says.errors}
        pending={acceptance.isPending}
        onSubmit={submit}
      >
        {/* Not sent: it is here for a password manager, which stores the
            password under the address it finds beside it */}
        <TextField
          label={say(signInForm.email)}
          name='email'
          type='email'
          autoComplete='username'
          readOnly
          value={invitation.email}
        />
        <PasswordField
          label={say(signInForm.password)}
          name='password'
          autoComplete='new-password'
          required
          description={say(PASSWORD_RULE)}
          error={said.errors['password']}
        />
      </Form>
    </>
  )
}

/** The invited person has an account, and is signed in with one. */
const JoinWithAccount = ({ token, invitation, onEnd }: StepProps) => {
  const say = useSay()
  const [message, setMessage] = useState<LocalizedText | undefined>(undefined)
  const terms = useTermsOf(invitation)
  const joining = useMutation({
    mutationFn: () => joinInvitation(token),
    onSuccess: (outcome) => {
      match(outcome)
        .with({ type: 'accepted' }, () => onEnd('joined'))
        .with({ type: 'tokenRefused' }, () => onEnd('linkRefused'))
        .with({ type: 'notForThisAccount' }, () =>
          setMessage(words.notForThisAccount(invitation.email)),
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
        title={say(words.title)}
        description={say(words.joinDescription)}
      />
      {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      <DescriptionList
        items={[
          { term: say(signInForm.email), description: invitation.email },
          ...terms,
        ]}
      />
      <Button
        variant='primary'
        pending={joining.isPending}
        onClick={() => joining.mutate()}
      >
        {say(words.join)}
      </Button>
    </>
  )
}

const ToAdmin = () => {
  const say = useSay()

  return (
    <ButtonLink href={import.meta.env.VITE_ADMIN_APP_URL}>
      {say(words.toAdmin)}
    </ButtonLink>
  )
}

const AcceptWithToken = ({ token }: { token: string }) => {
  // Asked once for this screen, and forgotten with it: the answer is about
  // a token that the next screen does not have
  const check = useQuery({
    queryKey: ['account', 'staff-invitation', token],
    queryFn: () => checkInvitation(token),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
  const say = useSay()
  const [ended, setEnded] = useState<Ended | null>(null)

  if (ended === 'created') {
    return (
      <>
        <PageHeader
          title={say(words.created)}
          description={say(words.createdDescription)}
        />
        <ToAdmin />
      </>
    )
  }
  if (ended === 'joined') {
    return (
      <>
        <PageHeader
          title={say(words.joined)}
          description={say(words.joinedDescription)}
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
    .with(undefined, () => <CheckingLink title={words.title} />)
    .with({ type: 'open', next: 'accept' }, ({ invitation }) => (
      <CreateAccount token={token} invitation={invitation} onEnd={setEnded} />
    ))
    .with({ type: 'open', next: 'join' }, ({ invitation }) => (
      // The API decides whose invitation it is: anybody is asked to sign in
      <RequireSession
        roles={EVERY_ROLE}
        signInNotice={say(words.signInNotice(invitation.email))}
        signInHelp={
          // The link of the mail still works after a new password was set
          <p>
            <Link to='/forgot-password'>
              {say(frameMessages.forgotPassword)}
            </Link>
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
      <LinkUnusable description={words.accountExists} />
    ))
    .with({ type: 'tokenRefused' }, () => (
      <LinkUnusable description={words.expired} />
    ))
    .with(
      { type: P.union('invalid', 'tooManyAttempts', 'failed') },
      (refusal) => (
        <LinkNotChecked
          title={words.title}
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
    <LinkUnusable description={words.noLink} />
  ) : (
    <AcceptWithToken key={token} token={token} />
  )
}
