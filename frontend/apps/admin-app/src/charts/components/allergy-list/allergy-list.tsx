import type { ModelsCustomerAllergyResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  COUNTED,
  countOf,
  Dialog,
  Link,
  LoadingIndicator,
  type More,
  Note,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import {
  allergyTypeNameOf,
  severityNameOf,
  severityToneOf,
} from '../../utils/allergies'
import styles from './allergy-list.module.css'

const { list, removal, words } = adminChartMessages.allergies

/** What the card shows below its heading */
export type AllergiesShown =
  | { type: 'reading' }
  | { type: 'unread'; message: LocalizedText; retrying: boolean }
  | {
      type: 'listed'
      allergies: readonly ModelsCustomerAllergyResponse[]
      /** How many the customer has; `null` when the API did not count */
      total: number | null
      more: More
    }

export type AllergyListProps = {
  shown: AllergiesShown
  /** The allergies that could not be read are to be read again */
  onRetry: () => void
  /** Asks for the allergies that come next */
  onMore: () => void
  /** The screen that records an allergy */
  entryHref: string
  /** The screen that changes an allergy */
  changeHrefOf: (allergy: ModelsCustomerAllergyResponse) => string
  /** The account may remove an allergy: the owner, a manager, the operator of the platform */
  removable: boolean
  /** What changed meanwhile, or what the API refused: said under the heading */
  refusal?: LocalizedText | undefined
  /** The heading, which takes the focus when the dialog closes on what it changed */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The allergy the dialog asks about removing; `undefined` while the dialog is closed */
  removing: ModelsCustomerAllergyResponse | undefined
  /** The button that removes an allergy was pressed: the dialog is to be opened */
  onOpen: (allergy: ModelsCustomerAllergyResponse) => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `removing` to `undefined` here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove, and may be tried again; it is said in the dialog */
  message?: LocalizedText | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal of the allergy the dialog asks about was confirmed */
  onRemove: (allergy: ModelsCustomerAllergyResponse) => void
}

/**
 * The allergies of a customer, as a member of the staff makes sure of them
 * before a treatment: the heaviest first, the severity in a word and, for
 * the two heaviest, in a colour too. Each is changed on a screen of its
 * own. One recorded by mistake is removed after a dialog that asks first,
 * by those who may; a member of the staff is told who does it.
 */
export const AllergyList = ({
  shown,
  onRetry,
  onMore,
  entryHref,
  changeHrefOf,
  removable,
  refusal,
  headingRef,
  removing,
  onOpen,
  onClose,
  message,
  pending = false,
  onRemove,
}: AllergyListProps) => {
  const say = useSay()

  return (
    <Card
      title={say(words.allergies)}
      headingRef={headingRef}
      actions={<ButtonLink href={entryHref}>{say(list.record)}</ButtonLink>}
    >
      <div className={styles['allergies']}>
        {refusal !== undefined && <Alert tone='warning'>{say(refusal)}</Alert>}
        {match(shown)
          .with({ type: 'reading' }, () => (
            <LoadingIndicator
              label={say(adminChartMessages.loading.allergies)}
            />
          ))
          .with({ type: 'unread' }, ({ message: unread, retrying }) => (
            <UnreadNotice
              message={say(unread)}
              onRetry={onRetry}
              pending={retrying}
            />
          ))
          .with({ type: 'listed' }, ({ allergies, total, more }) => (
            <PagedTable
              caption={say(list.caption)}
              captionHidden
              columns={[
                {
                  key: 'allergenName',
                  header: say(words.allergen),
                  wrap: 'words',
                  cell: ({ allergenName }) => allergenName,
                },
                {
                  key: 'severityType',
                  header: say(words.severity),
                  cell: ({ severityType }) => (
                    <Badge tone={severityToneOf(severityType)}>
                      {say(severityNameOf(severityType))}
                    </Badge>
                  ),
                },
                {
                  key: 'allergyType',
                  header: say(words.type),
                  cell: ({ allergyType }) =>
                    say(allergyTypeNameOf(allergyType)),
                },
                {
                  key: 'symptoms',
                  header: say(words.symptoms),
                  wrap: 'lines',
                  cell: ({ symptoms }) => symptoms,
                },
                {
                  key: 'notes',
                  header: say(words.notes),
                  wrap: 'lines',
                  cell: ({ notes }) => notes,
                },
                {
                  key: 'confirmedDate',
                  header: say(words.confirmedDate),
                  cell: ({ confirmedDate }) =>
                    say(
                      confirmedDate === null
                        ? list.unknownDate
                        : dayNameOf(confirmedDate),
                    ),
                },
                {
                  key: 'actions',
                  header: say(list.actions),
                  cell: (allergy) => (
                    <span className={styles['actions']}>
                      <Link
                        href={changeHrefOf(allergy)}
                        aria-label={say(list.changeOf(allergy.allergenName))}
                      >
                        {say(list.change)}
                      </Link>
                      {removable && (
                        <Button
                          size='small'
                          variant='danger'
                          aria-label={say(list.removeOf(allergy.allergenName))}
                          onClick={() => onOpen(allergy)}
                        >
                          {say(list.remove)}
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
              rows={allergies}
              rowKey={({ id }) => id}
              emptyMessage={say(list.none)}
              count={say(countOf(total, allergies.length, COUNTED.items))}
              more={more}
              onMore={onMore}
            />
          ))
          .exhaustive()}
        {!removable && <Note>{say(list.removedByOthers)}</Note>}
      </div>
      {removable && (
        <Dialog
          open={removing !== undefined}
          onClose={onClose}
          title={say(removal.title(removing?.allergenName ?? ''))}
          description={say(removal.description)}
          actions={
            <>
              <Button onClick={onClose}>{say(removal.back)}</Button>
              {removing !== undefined && (
                <Button
                  variant='danger'
                  pending={pending}
                  onClick={() => onRemove(removing)}
                >
                  {say(removal.submit)}
                </Button>
              )}
            </>
          }
        >
          {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
        </Dialog>
      )}
    </Card>
  )
}
