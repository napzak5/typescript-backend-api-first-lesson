import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  carriedNameOf,
  expiryNameOf,
  leadTimeNameOf,
  levelNameOf,
  lotsNameOf,
  priceNameOf,
  usesNameOf,
} from '../../utils/product-format'
import styles from './product-record.module.css'

const { record, words } = adminProductMessages

export type ProductRecordProps = {
  product: ModelsProductResponse
  currency: string
}

/**
 * Everything the ledger keeps of a product: what it is and what it is
 * for, its prices, the levels its stock is kept at, where it comes from,
 * and how it is managed. The addresses of its image and its safety data
 * sheet are shown as they are written: they lead out of the application.
 */
export const ProductRecord = ({ product, currency }: ProductRecordProps) => {
  const say = useSay()
  /** A value that may not be recorded, in the language of the page */
  const sayIfAny = (value: LocalizedText | null): string | null =>
    value === null ? null : say(value)

  return (
    <div className={styles['record']}>
      <Card title={say(words.product)}>
        <DescriptionList
          items={[
            { term: say(words.productCode), description: product.productCode },
            { term: say(words.name), description: product.name },
            {
              term: say(words.description),
              description: <WrittenText>{product.description}</WrittenText>,
            },
            {
              term: say(words.category),
              description: product.category,
            },
            { term: say(words.brand), description: product.brand },
            { term: say(words.unit), description: product.unit },
            { term: say(words.uses), description: say(usesNameOf(product)) },
            {
              term: say(words.status),
              description: say(carriedNameOf(product.isActive)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.prices)}>
        <DescriptionList
          items={[
            {
              term: say(words.purchasePrice),
              description: sayIfAny(
                priceNameOf(product.purchasePrice, currency),
              ),
            },
            {
              term: say(words.retailPrice),
              description: sayIfAny(priceNameOf(product.retailPrice, currency)),
            },
            {
              term: say(words.salonPrice),
              description: sayIfAny(priceNameOf(product.salonPrice, currency)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.levels)}>
        <DescriptionList
          items={[
            {
              term: say(words.minimumStock),
              description: say(levelNameOf(product.minimumStock, product.unit)),
            },
            {
              term: say(words.reorderPoint),
              description: say(levelNameOf(product.reorderPoint, product.unit)),
            },
            {
              term: say(words.maximumStock),
              description: say(levelNameOf(product.maximumStock, product.unit)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.purchasing)}>
        <DescriptionList
          items={[
            { term: say(words.supplier), description: product.supplier },
            {
              term: say(words.supplierProductCode),
              description: product.supplierProductCode,
            },
            {
              term: say(words.leadTimeDays),
              description: sayIfAny(leadTimeNameOf(product.leadTimeDays)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.management)}>
        <DescriptionList
          items={[
            { term: say(words.barcode), description: product.barcode },
            {
              term: say(record.lots),
              description: say(lotsNameOf(product.requiresLotTracking)),
            },
            {
              term: say(record.expiry),
              description: sayIfAny(expiryNameOf(product.expiryMonths)),
            },
            {
              term: say(words.storageConditions),
              description: (
                <WrittenText>{product.storageConditions}</WrittenText>
              ),
            },
            {
              term: say(words.imageUrl),
              description: product.imageUrl,
            },
            {
              term: say(words.safetyDataSheet),
              description: product.safetyDataSheet,
            },
          ]}
        />
      </Card>
    </div>
  )
}
