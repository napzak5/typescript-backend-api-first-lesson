import { Alert, Button, Card } from '@beauty-salon-frontend/ui'
import { EXPORTED_BY_OTHERS } from '../../customer-export'
import styles from './customer-requests.module.css'

export type CustomerRequestsProps = {
  /** The account answers what the customer asks of the data held of them: the owner, a manager, the operator of the platform */
  answerable: boolean
  /** The data of the customer is on its way */
  exporting?: boolean | undefined
  /** Why no file was saved; another press may save one */
  message?: string | undefined
  /** The button that exports the data was pressed */
  onExport: () => void
}

/**
 * What the salon answers when the customer asks for the personal data held
 * of them: everything held of the customer, saved as one JSON file to hand
 * to them. That the one who asks is the customer, the salon makes sure of
 * first. A member of the staff is told who answers.
 */
export const CustomerRequests = ({
  answerable,
  exporting = false,
  message,
  onExport,
}: CustomerRequestsProps) => (
  <Card title='ご本人からの請求'>
    {answerable ? (
      <div className={styles['requests']}>
        <p>
          お客様ご本人から、保有している個人データの開示を求められたときは、ご本人であることを確かめてから、データを出力してお渡しします。台帳、アカウント、好み設定、カルテとアレルギー、予約、売上、ポイント、レビュー、施術記録、台帳の版を、1
          つの JSON ファイルにします。
        </p>
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        <Button pending={exporting} onClick={onExport}>
          データを出力する
        </Button>
      </div>
    ) : (
      <p>{EXPORTED_BY_OTHERS}</p>
    )}
  </Card>
)
