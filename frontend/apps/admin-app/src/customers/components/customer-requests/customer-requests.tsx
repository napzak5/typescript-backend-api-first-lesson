import { Alert, Button, Card, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import styles from './customer-requests.module.css'

const { requests: words } = adminCustomerMessages.exports

/** The export of the data held of the customer */
type DataExportProps = {
  /** The data of the customer is on its way */
  exporting?: boolean | undefined
  /** Why no file was saved, in the language of the page; another press may save one */
  message?: LocalizedText | undefined
  /** The button that exports the data was pressed */
  onExport: () => void
}

export type CustomerRequestsProps = {
  /** The account answers what the customer asks of the data held of them: the owner, a manager, the operator of the platform */
  answerable: boolean
  /**
   * The export of the data; none for a customer who left the ledger, whose
   * data the API does not export
   */
  dataExport?: DataExportProps | undefined
  /** The request to have the data erased (`CustomerErasure`), after the export */
  children: ReactNode
}

/**
 * What the salon answers when the customer asks about the personal data
 * held of them: everything held of the customer, saved as one JSON file to
 * hand to them, and their request to have it erased. That the one who
 * asks is the customer, the salon makes sure of first. A member of the
 * staff is told who answers.
 */
export const CustomerRequests = ({
  answerable,
  dataExport,
  children,
}: CustomerRequestsProps) => {
  const say = useSay()

  return (
    <Card title={say(words.title)}>
      {answerable ? (
        <div className={styles['requests']}>
          {dataExport !== undefined && (
            <Card title={say(words.disclosure)} headingLevel={3}>
              <div className={styles['export']}>
                <p>{say(words.disclosureAbout)}</p>
                {dataExport.message !== undefined && (
                  <Alert tone='danger'>{say(dataExport.message)}</Alert>
                )}
                <Button
                  pending={dataExport.exporting ?? false}
                  onClick={dataExport.onExport}
                >
                  {say(words.exportData)}
                </Button>
              </div>
            </Card>
          )}
          {children}
        </div>
      ) : (
        <p>{say(words.answeredByOthers)}</p>
      )}
    </Card>
  )
}
