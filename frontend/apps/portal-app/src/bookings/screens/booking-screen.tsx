import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  Checkbox,
  DescriptionList,
  Form,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  TextArea,
  TextField,
  UnreadNotice,
  useNotifications,
  useSaidForm,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  portalBookingMessages,
  portalProfileMessages,
  portalSalonMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  createOwnProfile,
  OWN_PROFILE,
  type ProfileRead,
  readOwnProfile,
} from '../../profile/api/profile-api'
import { afterProfile, readProfile } from '../../profile/utils/profile-flow'
import { readSalon, readStaff } from '../../salons/api/salons-api'
import { dateAt } from '../../salons/utils/salon-format'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import { book, readService, readSlots } from '../api/bookings-api'
import {
  BookingForm,
  type TimesOfDay,
} from '../components/booking-form/booking-form'
import {
  type Choice,
  choiceIn,
  isBookable,
  queryOf,
  staffFor,
  timesOf,
} from '../utils/booking-choice'
import { afterBooking, readBooking } from '../utils/booking-flow'
import { priceLineOf } from '../utils/booking-format'
import { OWN_BOOKING_LISTS } from '../utils/own-bookings'

const { booking: words, names } = portalBookingMessages
const { controls } = portalProfileMessages

type OfServiceProps = {
  salon: ModelsSalonResponse
  service: ModelsServiceResponse
}

/**
 * Who the customer is. An account that has just been registered has not
 * said so, and the API books for a customer: the screen asks for what a
 * salon needs to know of somebody who comes, and no more.
 */
const ProfileStep = () => {
  const say = useSay()
  const queryClient = useQueryClient()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const creation = useMutation({
    mutationFn: createOwnProfile,
    onSuccess: (outcome) => {
      if (outcome.type === 'created') {
        const read: ProfileRead = { type: 'found', profile: outcome.profile }
        queryClient.setQueryData(OWN_PROFILE, read)
        return
      }
      setSays(afterProfile(outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readProfile(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    creation.mutate(read.value)
  }

  return (
    <Card title={say(portalBookingMessages.profile.title)}>
      <p>{say(portalBookingMessages.profile.description)}</p>
      <Form
        submitLabel={say(portalBookingMessages.profile.submit)}
        message={said.message}
        errors={says.errors}
        pending={creation.isPending}
        onSubmit={submit}
      >
        <TextField
          label={say(controls.lastName)}
          name='lastName'
          autoComplete='family-name'
          required
          error={said.errors['lastName']}
        />
        <TextField
          label={say(controls.firstName)}
          name='firstName'
          autoComplete='given-name'
          required
          error={said.errors['firstName']}
        />
        <TextField
          label={say(controls.phoneNumber)}
          name='phoneNumber'
          type='tel'
          autoComplete='tel'
          required
          description={say(controls.phoneNumberDescription)}
          error={said.errors['phoneNumber']}
        />
        <Checkbox label={say(controls.allowEmail)} name='allowEmail' />
        <Checkbox label={say(controls.allowSms)} name='allowSms' />
        <Checkbox label={say(controls.allowMarketing)} name='allowMarketing' />
      </Form>
    </Card>
  )
}

type TimeStepProps = OfServiceProps & {
  staff: readonly ModelsStaffProfileResponse[]
}

/**
 * With whom, on which day and at which time. The staff and the day are in
 * the address, so a reload shows the times of the same day; they are
 * replaced there, so the way back leads out of the screen and not through
 * every day that was looked at.
 */
const TimeStep = ({ salon, service, staff }: TimeStepProps) => {
  const [query, setQuery] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const say = useSay()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const today = dateAt(new Date(), salon.timezone)
  const choice = choiceIn(query, today, staff)
  const slots = useQuery({
    queryKey: ['salons', salon.id, 'slots', service.id, queryOf(choice)],
    queryFn: () =>
      readSlots({
        salonId: salon.id,
        serviceId: service.id,
        ...choice,
        duration: undefined,
      }),
    // A time is free until somebody books it: the times of a day are read
    // whenever they are shown, and never shown from memory
    staleTime: 0,
    gcTime: 0,
  })
  const times =
    slots.data?.type === 'found'
      ? timesOf(slots.data.slots, salon.timezone)
      : []
  const booking = useMutation({
    mutationFn: book,
    onSuccess: (outcome) => {
      if (outcome.type === 'booked') {
        queryClient.setQueryData(['own', 'bookings', outcome.booking.id], {
          type: 'found',
          booking: outcome.booking,
        })
        queryClient.removeQueries({ queryKey: OWN_BOOKING_LISTS })
        notify({ tone: 'success', message: words.booked })
        void navigate(`/bookings/${outcome.booking.id}`)
        return
      }
      setSays(afterBooking(outcome))
      if (outcome.type === 'refused') {
        void slots.refetch()
      }
      if (outcome.type === 'noProfile') {
        void queryClient.invalidateQueries({ queryKey: OWN_PROFILE })
      }
    },
  })

  const choose = (next: Choice): void => {
    // What was said about a time of another day is said no longer
    setSays(NOTHING_TO_SAY)
    setQuery(queryOf(next), { replace: true })
  }

  const submit = (values: FormData): void => {
    const read = readBooking(values, {
      salonId: salon.id,
      serviceId: service.id,
      staffId: choice.staffId,
      times,
    })
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    booking.mutate(read.value)
  }

  return (
    <Card title={say(words.time)}>
      <BookingForm
        staff={staff}
        choice={choice}
        today={today}
        onChoose={choose}
        times={match(slots.data)
          .returnType<TimesOfDay>()
          .with(undefined, () => ({ type: 'loading' }))
          .with({ type: 'found' }, () => ({ type: 'listed', times }))
          .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
            type: 'unread',
            reason,
            retrying: slots.isFetching,
          }))
          .exhaustive()}
        onRetry={() => void slots.refetch()}
        submitLabel={say(words.submit)}
        message={says.message}
        errors={says.errors}
        pending={booking.isPending}
        onSubmit={submit}
      >
        <TextArea
          label={say(words.request)}
          name='customerRequest'
          rows={4}
          description={say(words.requestDescription)}
          error={said.errors['customerRequest']}
        />
      </BookingForm>
    </Card>
  )
}

/** What is booked, and below it the step the customer is at. */
const BookingSteps = ({ salon, service }: OfServiceProps) => {
  const say = useSay()
  const staff = useQuery({
    queryKey: ['salons', salon.id, 'staff'],
    queryFn: () => readStaff(salon.id),
  })
  const profile = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
  })
  const focusHeading = useScreenHeadingFocus()
  const step = profile.data?.type
  const stepBefore = useRef(step)

  // The form of the profile went with the button that sent it, and the
  // times took its place: the focus goes to the heading of the screen, in
  // the commit that shows them
  useLayoutEffect(() => {
    if (stepBefore.current === 'none' && step === 'found') {
      focusHeading()
    }
    stepBefore.current = step
  }, [step, focusHeading])

  return (
    <>
      <Card title={say(words.summary)}>
        <DescriptionList
          items={[
            {
              term: say(portalBookingMessages.summary.salon),
              description: salon.name,
            },
            {
              term: say(portalBookingMessages.summary.service),
              description: service.name,
            },
            {
              term: say(words.duration),
              description: say(formats.durationOf(service.duration)),
            },
            {
              term: say(portalBookingMessages.summary.price),
              description: say(priceLineOf(service, salon.currency)),
            },
          ]}
        />
      </Card>
      {match([staff.data, profile.data])
        .with([undefined, P._], [P._, undefined], () => (
          <LoadingIndicator label={say(words.loading)} />
        ))
        .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.staff, reason))}
            onRetry={() => void staff.refetch()}
            pending={staff.isFetching}
          />
        ))
        .with([P._, { type: P.union(...UNREAD_TYPES) }], ([, reason]) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.profile, reason))}
            onRetry={() => void profile.refetch()}
            pending={profile.isFetching}
          />
        ))
        .with([{ type: 'found' }, { type: 'none' }], () => <ProfileStep />)
        .with([{ type: 'found' }, { type: 'found' }], ([found]) => (
          <TimeStep
            salon={salon}
            service={service}
            staff={staffFor(service, found.staff)}
          />
        ))
        .exhaustive()}
    </>
  )
}

const BookingPage = () => {
  const say = useSay()
  const { salonId = '', serviceId = '' } = useParams()
  const salon = useQuery({
    queryKey: ['salons', salonId, 'salon'],
    queryFn: () => readSalon(salonId),
  })
  const service = useQuery({
    queryKey: ['salons', salonId, 'services', serviceId],
    queryFn: () => readService(salonId, serviceId),
  })

  return match([salon.data, service.data])
    .with([undefined, P._], [P._, undefined], () => (
      <>
        <PageHeader title={say(words.title)} />
        <LoadingIndicator label={say(words.loadingService)} />
      </>
    ))
    .with([{ type: 'notFound' }, P._], [P._, { type: 'notFound' }], () => (
      <>
        <PageHeader
          title={say(words.serviceNotFound)}
          description={say(words.serviceNotFoundDescription)}
        />
        <ButtonLink href='/'>
          {say(portalSalonMessages.search.title)}
        </ButtonLink>
      </>
    ))
    .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
      <>
        <PageHeader title={say(words.title)} />
        <UnreadNotice
          message={say(unreadMessageOf(names.salon, reason))}
          onRetry={() => void salon.refetch()}
          pending={salon.isFetching}
        />
      </>
    ))
    .with([P._, { type: P.union(...UNREAD_TYPES) }], ([, reason]) => (
      <>
        <PageHeader title={say(words.title)} />
        <UnreadNotice
          message={say(unreadMessageOf(names.menu, reason))}
          onRetry={() => void service.refetch()}
          pending={service.isFetching}
        />
      </>
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([foundSalon, found]) => (
      <>
        <PageHeader
          title={say(words.title)}
          actions={
            <ButtonLink href={`/salons/${foundSalon.salon.id}`}>
              {say(words.backToSalon)}
            </ButtonLink>
          }
        />
        {isBookable(foundSalon.salon, found.service) ? (
          <BookingSteps salon={foundSalon.salon} service={found.service} />
        ) : (
          <Alert tone='warning'>
            {say(words.notOnline(found.service.name))}
          </Alert>
        )}
      </>
    ))
    .exhaustive()
}

/**
 * Where a customer books a service of a salon. Somebody who is not signed
 * in signs in here, at the address of what they chose, and goes on with it.
 */
export const BookingScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(words.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <BookingPage />
    </RequireSession>
  )
}
