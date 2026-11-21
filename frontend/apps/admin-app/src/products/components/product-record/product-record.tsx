import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import { Card, DescriptionList, WrittenText } from '@beauty-salon-frontend/ui'
import {
  carriedNameOf,
  expiryNameOf,
  leadTimeNameOf,
  levelNameOf,
  lotsNameOf,
  priceNameOf,
  usesNameOf,
} from '../../product-format'
import styles from './product-record.module.css'

export type ProductRecordProps = {
  product: ModelsProductResponse
  currency: string
}

const writtenOrNone = (text: string | null) =>
  text === null ? null : <WrittenText>{text}</WrittenText>

const addressOrNone = (address: string | null) =>
  address === null ? null : address

/**
 * Everything the ledger keeps of a product: what it is and what it is
 * for, its prices, the levels its stock is kept at, where it comes from,
 * and how it is managed. The addresses of its image and its safety data
 * sheet are shown as they are written: they lead out of the application.
 */
export const ProductRecord = ({ product, currency }: ProductRecordProps) => (
  <div className={styles['record']}>
    <Card title='商品'>
      <DescriptionList
        items={[
          { term: '商品コード', description: product.productCode },
          { term: '商品名', description: product.name },
          { term: '説明', description: writtenOrNone(product.description) },
          {
            term: 'カテゴリー',
            description: product.category,
          },
          { term: 'ブランド', description: product.brand },
          { term: '単位', description: product.unit },
          { term: '用途', description: usesNameOf(product) },
          { term: '状態', description: carriedNameOf(product.isActive) },
        ]}
      />
    </Card>
    <Card title='価格'>
      <DescriptionList
        items={[
          {
            term: '仕入価格',
            description: priceNameOf(product.purchasePrice, currency),
          },
          {
            term: '定価',
            description: priceNameOf(product.retailPrice, currency),
          },
          {
            term: '販売価格',
            description: priceNameOf(product.salonPrice, currency),
          },
        ]}
      />
    </Card>
    <Card title='在庫の水準'>
      <DescriptionList
        items={[
          {
            term: '最低在庫数',
            description: levelNameOf(product.minimumStock, product.unit),
          },
          {
            term: '発注点',
            description: levelNameOf(product.reorderPoint, product.unit),
          },
          {
            term: '最大在庫数',
            description: levelNameOf(product.maximumStock, product.unit),
          },
        ]}
      />
    </Card>
    <Card title='仕入れ'>
      <DescriptionList
        items={[
          { term: '仕入先', description: product.supplier },
          {
            term: '仕入先の商品コード',
            description: product.supplierProductCode,
          },
          {
            term: '納品までの日数',
            description: leadTimeNameOf(product.leadTimeDays),
          },
        ]}
      />
    </Card>
    <Card title='管理'>
      <DescriptionList
        items={[
          { term: 'バーコード', description: product.barcode },
          {
            term: 'ロット番号',
            description: lotsNameOf(product.requiresLotTracking),
          },
          {
            term: '使用期限の目安',
            description: expiryNameOf(product.expiryMonths),
          },
          {
            term: '保管条件',
            description: writtenOrNone(product.storageConditions),
          },
          {
            term: '商品画像の URL',
            description: addressOrNone(product.imageUrl),
          },
          {
            term: '安全データシートの URL',
            description: addressOrNone(product.safetyDataSheet),
          },
        ]}
      />
    </Card>
  </div>
)
