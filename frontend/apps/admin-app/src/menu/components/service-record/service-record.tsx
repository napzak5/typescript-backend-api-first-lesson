import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  BulletList,
  Card,
  DescriptionList,
  inJapanese,
  Link,
  NONE,
  Table,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { levelNameOf } from '../../../staff/utils/staff-format'
import { minutesNameOf } from '../../../treatments/utils/treatment-format'
import {
  availabilityNameOf,
  categoriesById,
  categoryPathOf,
  optionTypeNameOf,
  priceLineOf,
  pricingNameOf,
  requirementNameOf,
  serviceStateOf,
} from '../../utils/menu-format'
import styles from './service-record.module.css'

export type ServiceRecordProps = {
  service: ModelsServiceResponse
  /** The categories of the salon, which the category of the service is named among */
  categories: readonly ModelsServiceCategoryResponse[]
  /** The services of the salon, which those of a package are named among */
  services: readonly ModelsServiceResponse[]
  currency: string
  /** The address of a service */
  serviceHref: (serviceId: string) => string
}

/** What is said of a service of a package that is not on the menu any more */
const UNLISTED_SERVICE = 'メニューにないサービス'

/**
 * Everything the menu keeps of a service: what it is and costs, how it is
 * booked, the services of a package, each leading to its own, and the
 * options, the switched off among them.
 */
export const ServiceRecord = ({
  service,
  categories,
  services,
  currency,
  serviceHref,
}: ServiceRecordProps) => {
  const byId = categoriesById(categories)
  const category =
    service.categoryId === null ? undefined : byId.get(service.categoryId)

  return (
    <div className={styles['record']}>
      <Card title='サービス'>
        <DescriptionList
          items={[
            { term: '名前', description: service.name },
            {
              term: 'カテゴリー',
              description:
                category === undefined
                  ? '未分類'
                  : categoryPathOf(category, byId),
            },
            { term: '状態', description: serviceStateOf(service) },
            { term: '所要時間', description: minutesNameOf(service.duration) },
            { term: '料金', description: priceLineOf(service, currency) },
            {
              term: '価格の決め方',
              description: pricingNameOf(service.pricingStrategy),
            },
            {
              term: '提供日',
              description: availabilityNameOf(service.availability),
            },
            { term: '表示順', description: String(service.sortOrder) },
            {
              term: '短い紹介',
              description: service.shortDescription,
            },
            {
              term: '説明',
              description: <WrittenText>{service.description}</WrittenText>,
            },
            {
              term: 'タグ',
              description: <TagList label={'タグ'} items={service.tags} />,
            },
            {
              term: '写真の URL',
              description: service.imageUrl,
            },
            {
              term: 'ほかの写真の URL',
              description:
                service.imageUrls.length === 0 ? (
                  inJapanese(NONE)
                ) : (
                  <ul className={styles['addresses']}>
                    {service.imageUrls.map((address) => (
                      <li key={address}>{address}</li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </Card>
      <Card title='予約'>
        <DescriptionList
          items={[
            {
              term: 'オンライン予約',
              description: service.allowOnlineBooking ? '受ける' : '受けない',
            },
            {
              term: '予約の条件',
              description: (
                <TagList
                  label={'予約の条件'}
                  items={service.bookingRequirements.map(requirementNameOf)}
                />
              ),
            },
            {
              term: 'カウンセリング',
              description: service.requiresConsultation ? '必要' : '不要',
            },
            {
              term: '担当できるスタッフ',
              description:
                service.requiredStaffLevel === null
                  ? 'だれでも'
                  : `${levelNameOf(service.requiredStaffLevel)}以上`,
            },
            {
              term: '1 日の予約の上限',
              description:
                service.maxBookingsPerDay === null
                  ? '上限なし'
                  : `${service.maxBookingsPerDay} 件`,
            },
          ]}
        />
      </Card>
      {service.isPackage && (
        <Card title='パッケージのサービス'>
          <BulletList>
            {service.packageServiceIds.map((id) => {
              const packaged = services.find((one) => one.id === id)

              return (
                <li key={id}>
                  {packaged === undefined ? (
                    UNLISTED_SERVICE
                  ) : (
                    <Link href={serviceHref(id)}>{packaged.name}</Link>
                  )}
                </li>
              )
            })}
          </BulletList>
        </Card>
      )}
      <Table
        caption='オプション'
        columns={[
          { key: 'name', header: '名前', cell: ({ name }) => name },
          {
            key: 'optionType',
            header: '種類',
            cell: ({ optionType }) => optionTypeNameOf(optionType),
          },
          {
            key: 'additionalTime',
            header: '追加の時間',
            cell: ({ additionalTime }) => minutesNameOf(additionalTime),
            align: 'end',
          },
          {
            key: 'additionalPrice',
            header: '追加の料金',
            cell: ({ additionalPrice }) =>
              inJapanese(amountOf(additionalPrice, currency)),
            align: 'end',
          },
          {
            key: 'maxQuantity',
            header: '選べる数',
            cell: ({ maxQuantity }) => `${maxQuantity} まで`,
            align: 'end',
          },
          {
            key: 'isRequired',
            header: '必須',
            cell: ({ isRequired }) => (isRequired ? '必須' : '任意'),
          },
          {
            key: 'isActive',
            header: '状態',
            cell: ({ isActive }) => (isActive ? '有効' : '無効'),
          },
        ]}
        rows={service.options}
        rowKey={({ name, sortOrder }) => `${sortOrder}-${name}`}
        emptyMessage='オプションはありません'
      />
    </div>
  )
}
