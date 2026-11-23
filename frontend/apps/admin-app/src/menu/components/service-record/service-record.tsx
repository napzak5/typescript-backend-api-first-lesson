import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  BulletList,
  Card,
  DescriptionList,
  Link,
  NONE,
  Table,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  availabilityNameOf,
  categoriesById,
  categoryLineOf,
  onlineBookingOf,
  optionTypeNameOf,
  priceLineOf,
  pricingNameOf,
  requirementNameOf,
  serviceStateOf,
  switchNameOf,
} from '../../utils/menu-format'
import styles from './service-record.module.css'

const {
  services: { record: WORDS },
  words: { levelOrAbove, upTo },
} = adminMenuMessages

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
  const say = useSay()
  const byId = categoriesById(categories)
  const category =
    service.categoryId === null ? undefined : byId.get(service.categoryId)

  return (
    <div className={styles['record']}>
      <Card title={say(WORDS.service)}>
        <DescriptionList
          items={[
            { term: say(WORDS.name), description: service.name },
            {
              term: say(WORDS.category),
              description: say(categoryLineOf(category, byId)),
            },
            {
              term: say(WORDS.status),
              description: say(serviceStateOf(service)),
            },
            {
              term: say(WORDS.duration),
              description: say(formats.minutesOf(service.duration)),
            },
            {
              term: say(WORDS.price),
              description: say(priceLineOf(service, currency)),
            },
            {
              term: say(WORDS.pricing),
              description: say(pricingNameOf(service.pricingStrategy)),
            },
            {
              term: say(WORDS.availability),
              description: say(availabilityNameOf(service.availability)),
            },
            {
              term: say(WORDS.displayOrder),
              description: say(formats.numberOf(service.sortOrder)),
            },
            {
              term: say(WORDS.shortDescription),
              description: service.shortDescription,
            },
            {
              term: say(WORDS.description),
              description: <WrittenText>{service.description}</WrittenText>,
            },
            {
              term: say(WORDS.tags),
              description: (
                <TagList label={say(WORDS.tags)} items={service.tags} />
              ),
            },
            {
              term: say(WORDS.photo),
              description: service.imageUrl,
            },
            {
              term: say(WORDS.otherPhotos),
              description:
                service.imageUrls.length === 0 ? (
                  say(NONE)
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
      <Card title={say(WORDS.booking)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.onlineBooking),
              description: say(onlineBookingOf(service.allowOnlineBooking)),
            },
            {
              term: say(WORDS.requirements),
              description: (
                <TagList
                  label={say(WORDS.requirements)}
                  items={service.bookingRequirements.map((requirement) =>
                    say(requirementNameOf(requirement)),
                  )}
                />
              ),
            },
            {
              term: say(WORDS.consultation),
              description: say(
                service.requiresConsultation ? WORDS.needed : WORDS.notNeeded,
              ),
            },
            {
              term: say(WORDS.staffLevel),
              description: say(
                service.requiredStaffLevel === null
                  ? WORDS.anybody
                  : levelOrAbove(
                      termMessages.staffLevel[service.requiredStaffLevel],
                    ),
              ),
            },
            {
              term: say(WORDS.mostBookings),
              description: say(
                service.maxBookingsPerDay === null
                  ? WORDS.noLimit
                  : WORDS.bookingsOf(service.maxBookingsPerDay),
              ),
            },
          ]}
        />
      </Card>
      {service.isPackage && (
        <Card title={say(WORDS.packaged)}>
          <BulletList>
            {service.packageServiceIds.map((id) => {
              const packaged = services.find((one) => one.id === id)

              return (
                <li key={id}>
                  {packaged === undefined ? (
                    say(WORDS.unlisted)
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
        caption={say(WORDS.options)}
        columns={[
          { key: 'name', header: say(WORDS.name), cell: ({ name }) => name },
          {
            key: 'optionType',
            header: say(WORDS.optionType),
            cell: ({ optionType }) => say(optionTypeNameOf(optionType)),
          },
          {
            key: 'additionalTime',
            header: say(WORDS.additionalTime),
            cell: ({ additionalTime }) =>
              say(formats.minutesOf(additionalTime)),
            align: 'end',
          },
          {
            key: 'additionalPrice',
            header: say(WORDS.additionalPrice),
            cell: ({ additionalPrice }) =>
              say(amountOf(additionalPrice, currency)),
            align: 'end',
          },
          {
            key: 'maxQuantity',
            header: say(WORDS.maxQuantity),
            cell: ({ maxQuantity }) => say(upTo(maxQuantity)),
            align: 'end',
          },
          {
            key: 'isRequired',
            header: say(WORDS.required),
            cell: ({ isRequired }) =>
              say(isRequired ? WORDS.required : WORDS.optional),
          },
          {
            key: 'isActive',
            header: say(WORDS.status),
            cell: ({ isActive }) => say(switchNameOf(isActive)),
          },
        ]}
        rows={service.options}
        rowKey={({ name, sortOrder }) => `${sortOrder}-${name}`}
        emptyMessage={say(WORDS.noOptions)}
      />
    </div>
  )
}
