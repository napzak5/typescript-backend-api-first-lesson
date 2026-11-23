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
  inJapanese,
  Link,
  LoadingIndicator,
  type More,
  Note,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import {
  allergyTypeNameOf,
  REMOVED_BY_OTHERS,
  severityNameOf,
  severityToneOf,
} from '../../utils/allergies'
import styles from './allergy-list.module.css'

/** What the card shows below its heading */
export type AllergiesShown =
  | { type: 'reading' }
  | { type: 'unread'; message: string; retrying: boolean }
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
  refusal?: string | undefined
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
  message?: string | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal was confirmed */
  onRemove: () => void
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
}: AllergyListProps) => (
  <Card
    title='アレルギー'
    headingRef={headingRef}
    actions={<ButtonLink href={entryHref}>アレルギーを記録する</ButtonLink>}
  >
    <div className={styles['allergies']}>
      {refusal !== undefined && <Alert tone='warning'>{refusal}</Alert>}
      {match(shown)
        .with({ type: 'reading' }, () => (
          <LoadingIndicator label='アレルギーを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ message: unread, retrying }) => (
          <UnreadNotice message={unread} onRetry={onRetry} pending={retrying} />
        ))
        .with({ type: 'listed' }, ({ allergies, total, more }) => (
          <PagedTable
            caption='アレルギーの一覧'
            captionHidden
            columns={[
              {
                key: 'allergenName',
                header: 'アレルゲン',
                wrap: 'words',
                cell: ({ allergenName }) => allergenName,
              },
              {
                key: 'severityType',
                header: '重篤度',
                cell: ({ severityType }) => (
                  <Badge tone={severityToneOf(severityType)}>
                    {severityNameOf(severityType)}
                  </Badge>
                ),
              },
              {
                key: 'allergyType',
                header: '種類',
                cell: ({ allergyType }) => allergyTypeNameOf(allergyType),
              },
              {
                key: 'symptoms',
                header: '症状',
                wrap: 'lines',
                cell: ({ symptoms }) => symptoms,
              },
              {
                key: 'notes',
                header: '施術のときの注意',
                wrap: 'lines',
                cell: ({ notes }) => notes,
              },
              {
                key: 'confirmedDate',
                header: '確かめた日',
                cell: ({ confirmedDate }) =>
                  confirmedDate === null ? '不明' : dayNameOf(confirmedDate),
              },
              {
                key: 'actions',
                header: '操作',
                cell: (allergy) => (
                  <span className={styles['actions']}>
                    <Link
                      href={changeHrefOf(allergy)}
                      aria-label={`${allergy.allergenName}の記録を直す`}
                    >
                      直す
                    </Link>
                    {removable && (
                      <Button
                        size='small'
                        variant='danger'
                        aria-label={`${allergy.allergenName}の記録を削除する`}
                        onClick={() => onOpen(allergy)}
                      >
                        削除
                      </Button>
                    )}
                  </span>
                ),
              },
            ]}
            rows={allergies}
            rowKey={({ id }) => id}
            emptyMessage='アレルギーの記録はありません'
            count={inJapanese(countOf(total, allergies.length, COUNTED.items))}
            more={more}
            onMore={onMore}
          />
        ))
        .exhaustive()}
      {!removable && <Note>{REMOVED_BY_OTHERS}</Note>}
    </div>
    {removable && (
      <Dialog
        open={removing !== undefined}
        onClose={onClose}
        title={`${removing?.allergenName ?? ''}の記録を削除しますか？`}
        description='間違えて記録したアレルギーを、カルテから削除します。削除した記録は、元に戻せません。'
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              削除する
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    )}
  </Card>
)
