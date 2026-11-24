import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsStaffProfileResponse,
  ModelsStaffProfileUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Card,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProfileMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  OWN_PROFILE,
  type ProfileRead,
  readOwnProfile,
  saveOwnProfile,
  UNAVAILABLE,
} from '../api/profile-api'
import { ProfileForm } from '../components/profile-form/profile-form'
import { ProfileRecord } from '../components/profile-record/profile-record'
import { afterProfileSave, readProfileChange } from '../utils/profile-form'

const { form: FORM } = adminProfileMessages

/** The page of the salon in the application of the customers, where they read the profile. */
const customerViewOf = (salonId: string): string =>
  `${import.meta.env.VITE_PORTAL_APP_URL}/salons/${salonId}`

type LoadedProps = { profile: ModelsStaffProfileResponse }

/** The profile the form was opened with, and how many times it was saved since the screen opened */
type Opened = { profile: ModelsStaffProfileResponse; saves: number }

/**
 * The profile as the customers are shown it, and the form that changes
 * what the member writes of themselves. What was saved is shown at once:
 * the form opens again with it, and the heading of the profile takes the
 * focus. The form keeps what it was opened with while the profile is read
 * anew, so what is being written stays.
 */
const Loaded = ({ profile }: LoadedProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const say = useSay()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [opened, setOpened] = useState<Opened>({ profile, saves: 0 })
  const heading = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (opened.saves > 0) {
      heading.current?.focus()
    }
  }, [opened.saves])

  const save = useMutation({
    mutationFn: (request: ModelsStaffProfileUpdateRequest) =>
      saveOwnProfile(request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'saved' }, ({ profile: saved }) => {
          const read: ProfileRead = { type: 'found', profile: saved }
          queryClient.setQueryData(OWN_PROFILE, read)
          notify({ tone: 'success', message: FORM.saved })
          setOpened(({ saves }) => ({ profile: saved, saves: saves + 1 }))
        })
        // The member was made inactive or removed, or the account unlinked, meanwhile
        .with({ type: 'unavailable' }, () =>
          queryClient.setQueryData(OWN_PROFILE, UNAVAILABLE),
        )
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterProfileSave(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readProfileChange(values, opened.profile))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        setSaid(NOTHING_TO_SAY)
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        save.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <ProfileRecord
        profile={profile}
        customerView={customerViewOf(profile.salonId)}
        headingRef={heading}
      />
      <Card title={say(FORM.title)}>
        <ProfileForm
          key={opened.saves}
          profile={opened.profile}
          message={said.message}
          errors={said.errors}
          pending={save.isPending}
          onSubmit={submit}
        />
      </Card>
    </>
  )
}

/** The profile of the member the account is linked to, read whenever the screen opens. */
const ProfilePart = () => {
  const say = useSay()
  const read = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
    staleTime: 0,
  })

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label={say(adminProfileMessages.loading)} />
    ))
    .with({ type: 'unavailable' }, () => (
      <p>{say(adminProfileMessages.unavailable)}</p>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (unread) => (
      <UnreadNotice
        message={say(
          unreadMessageOf(adminProfileMessages.names.profile, unread),
        )}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .with({ type: 'found' }, ({ profile }) => <Loaded profile={profile} />)
    .exhaustive()
}

/**
 * The profile the customers are shown of the member of the staff the
 * signed-in account is linked to, and what the member writes of
 * themselves in it. An administrator is a member of no salon.
 */
export const OwnProfileScreen = () => {
  const session = useSession()
  const say = useSay()
  const administrator =
    session.type === 'signedIn' && session.user.role === 'admin'

  return (
    <>
      <PageHeader
        title={say(adminProfileMessages.title)}
        description={say(adminProfileMessages.description)}
      />
      {administrator ? (
        <p>{say(adminProfileMessages.administrator)}</p>
      ) : (
        <ProfilePart />
      )}
    </>
  )
}
