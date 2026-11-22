import { Alert, Button, Card } from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { ANSWERED_BY_OTHERS } from '../../utils/customer-export'
import styles from './customer-requests.module.css'

/** The export of the data held of the customer */
type DataExportProps = {
  /** The data of the customer is on its way */
  exporting?: boolean | undefined
  /** Why no file was saved; another press may save one */
  message?: string | undefined
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
}: CustomerRequestsProps) => (
  <Card title='ご本人からの請求'>
    {answerable ? (
      <div className={styles['requests']}>
        {dataExport !== undefined && (
          <Card title='データの開示' headingLevel={3}>
            <div className={styles['export']}>
              <p>
                お客様ご本人から、保有している個人データの開示を求められたときは、ご本人であることを確かめてから、データを出力してお渡しします。台帳、アカウント、好み設定、カルテとアレルギー、予約、売上、ポイント、レビュー、施術記録、台帳の版を、1
                つの JSON ファイルにします。
              </p>
              {dataExport.message !== undefined && (
                <Alert tone='danger'>{dataExport.message}</Alert>
              )}
              <Button
                pending={dataExport.exporting ?? false}
                onClick={dataExport.onExport}
              >
                データを出力する
              </Button>
            </div>
          </Card>
        )}
        {children}
      </div>
    ) : (
      <p>{ANSWERED_BY_OTHERS}</p>
    )}
  </Card>
)
