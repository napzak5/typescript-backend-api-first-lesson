import { relations } from 'drizzle-orm/relations'
import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  inventory,
  inventoryAlertAcknowledgements,
  inventoryTransactions,
  medicalCharts,
  openingHours,
  paymentMethods,
  paymentTransactions,
  products,
  purchaseOrderItems,
  purchaseOrders,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  sales,
  salesDetails,
  salons,
  serviceCategories,
  serviceOptions,
  services,
  sessions,
  staff,
  staffInvitations,
  staffSchedules,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
  users,
} from './schema'

export const bookingServicesRelations = relations(
  bookingServices,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingServices.bookingId],
      references: [bookings.id],
    }),
    service: one(services, {
      fields: [bookingServices.serviceId],
      references: [services.id],
    }),
    staff: one(staff, {
      fields: [bookingServices.staffId],
      references: [staff.id],
    }),
  }),
)

export const bookingStatusHistoriesRelations = relations(
  bookingStatusHistories,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingStatusHistories.bookingId],
      references: [bookings.id],
    }),
  }),
)

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  bookingServices: many(bookingServices),
  bookingStatusHistories: many(bookingStatusHistories),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  reviews: many(reviews),
  sales: many(sales),
  salon: one(salons, {
    fields: [bookings.salonId],
    references: [salons.id],
  }),
  staff: one(staff, {
    fields: [bookings.staffId],
    references: [staff.id],
  }),
  treatmentRecords: many(treatmentRecords),
}))

export const customerAllergiesRelations = relations(
  customerAllergies,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerAllergies.customerId],
      references: [customers.id],
    }),
  }),
)

export const customerDeletionRequestsRelations = relations(
  customerDeletionRequests,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerDeletionRequests.customerId],
      references: [customers.id],
    }),
    user_cancelledBy: one(users, {
      fields: [customerDeletionRequests.cancelledBy],
      references: [users.id],
      relationName: 'customerDeletionRequests_cancelledBy_users_id',
    }),
    user_completedBy: one(users, {
      fields: [customerDeletionRequests.completedBy],
      references: [users.id],
      relationName: 'customerDeletionRequests_completedBy_users_id',
    }),
    user_requestedBy: one(users, {
      fields: [customerDeletionRequests.requestedBy],
      references: [users.id],
      relationName: 'customerDeletionRequests_requestedBy_users_id',
    }),
  }),
)

export const customerPointsRelations = relations(customerPoints, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPoints.customerId],
    references: [customers.id],
  }),
}))

export const customerPreferencesRelations = relations(
  customerPreferences,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerPreferences.customerId],
      references: [customers.id],
    }),
    staff: one(staff, {
      fields: [customerPreferences.preferredStaffId],
      references: [staff.id],
    }),
  }),
)

export const customerVersionsRelations = relations(
  customerVersions,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerVersions.customerId],
      references: [customers.id],
    }),
    user: one(users, {
      fields: [customerVersions.changedBy],
      references: [users.id],
    }),
  }),
)

export const customersRelations = relations(customers, ({ one, many }) => ({
  bookings: many(bookings),
  customer: one(customers, {
    fields: [customers.referredBy],
    references: [customers.id],
    relationName: 'customers_referredBy_customers_id',
  }),
  customerAllergies: many(customerAllergies),
  customerDeletionRequests: many(customerDeletionRequests),
  customerPoints: many(customerPoints),
  customerPreferences: many(customerPreferences),
  customerVersions: many(customerVersions),
  customers: many(customers, {
    relationName: 'customers_referredBy_customers_id',
  }),
  medicalCharts: many(medicalCharts),
  reviewHelpfulVotes: many(reviewHelpfulVotes),
  reviews: many(reviews),
  sales: many(sales),
  treatmentRecords: many(treatmentRecords),
  users: many(users),
}))

export const inventoryAlertAcknowledgementsRelations = relations(
  inventoryAlertAcknowledgements,
  ({ one }) => ({
    inventory: one(inventory, {
      fields: [inventoryAlertAcknowledgements.inventoryId],
      references: [inventory.id],
    }),
    product: one(products, {
      fields: [inventoryAlertAcknowledgements.productId],
      references: [products.id],
    }),
    salon: one(salons, {
      fields: [inventoryAlertAcknowledgements.salonId],
      references: [salons.id],
    }),
  }),
)

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  inventoryAlertAcknowledgements: many(inventoryAlertAcknowledgements),
  inventoryTransactions: many(inventoryTransactions),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  purchaseOrderItems: many(purchaseOrderItems),
  salon: one(salons, {
    fields: [inventory.salonId],
    references: [salons.id],
  }),
}))

export const inventoryTransactionsRelations = relations(
  inventoryTransactions,
  ({ one }) => ({
    inventory: one(inventory, {
      fields: [inventoryTransactions.inventoryId],
      references: [inventory.id],
    }),
    product: one(products, {
      fields: [inventoryTransactions.productId],
      references: [products.id],
    }),
    salon: one(salons, {
      fields: [inventoryTransactions.salonId],
      references: [salons.id],
    }),
  }),
)

export const medicalChartsRelations = relations(medicalCharts, ({ one }) => ({
  customer: one(customers, {
    fields: [medicalCharts.customerId],
    references: [customers.id],
  }),
}))

export const openingHoursRelations = relations(openingHours, ({ one }) => ({
  salon: one(salons, {
    fields: [openingHours.salonId],
    references: [salons.id],
  }),
}))

export const paymentMethodsRelations = relations(
  paymentMethods,
  ({ one, many }) => ({
    paymentTransactions: many(paymentTransactions),
    salon: one(salons, {
      fields: [paymentMethods.salonId],
      references: [salons.id],
    }),
  }),
)

export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one }) => ({
    paymentMethod: one(paymentMethods, {
      fields: [paymentTransactions.paymentMethodId],
      references: [paymentMethods.id],
    }),
    sale: one(sales, {
      fields: [paymentTransactions.saleId],
      references: [sales.id],
    }),
  }),
)

export const productsRelations = relations(products, ({ one, many }) => ({
  inventories: many(inventory),
  inventoryAlertAcknowledgements: many(inventoryAlertAcknowledgements),
  inventoryTransactions: many(inventoryTransactions),
  salon: one(salons, {
    fields: [products.salonId],
    references: [salons.id],
  }),
  treatmentMaterials: many(treatmentMaterials),
}))

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    inventory: one(inventory, {
      fields: [purchaseOrderItems.inventoryId],
      references: [inventory.id],
    }),
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
  }),
)

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    purchaseOrderItems: many(purchaseOrderItems),
    salon: one(salons, {
      fields: [purchaseOrders.salonId],
      references: [salons.id],
    }),
  }),
)

export const reviewHelpfulVotesRelations = relations(
  reviewHelpfulVotes,
  ({ one }) => ({
    customer: one(customers, {
      fields: [reviewHelpfulVotes.customerId],
      references: [customers.id],
    }),
    review: one(reviews, {
      fields: [reviewHelpfulVotes.reviewId],
      references: [reviews.id],
    }),
  }),
)

export const reviewReportsRelations = relations(reviewReports, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewReports.reviewId],
    references: [reviews.id],
  }),
}))

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  customer: one(customers, {
    fields: [reviews.customerId],
    references: [customers.id],
  }),
  reviewHelpfulVotes: many(reviewHelpfulVotes),
  reviewReports: many(reviewReports),
  salon: one(salons, {
    fields: [reviews.salonId],
    references: [salons.id],
  }),
  staff: one(staff, {
    fields: [reviews.staffId],
    references: [staff.id],
  }),
}))

export const salesDetailsRelations = relations(salesDetails, ({ one }) => ({
  sale: one(sales, {
    fields: [salesDetails.saleId],
    references: [sales.id],
  }),
  staff: one(staff, {
    fields: [salesDetails.staffId],
    references: [staff.id],
  }),
}))

export const salesRelations = relations(sales, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [sales.bookingId],
    references: [bookings.id],
  }),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  paymentTransactions: many(paymentTransactions),
  salesDetails: many(salesDetails),
  salon: one(salons, {
    fields: [sales.salonId],
    references: [salons.id],
  }),
  staff: one(staff, {
    fields: [sales.staffId],
    references: [staff.id],
  }),
}))

export const salonsRelations = relations(salons, ({ many }) => ({
  bookings: many(bookings),
  inventories: many(inventory),
  inventoryAlertAcknowledgements: many(inventoryAlertAcknowledgements),
  inventoryTransactions: many(inventoryTransactions),
  openingHours: many(openingHours),
  paymentMethods: many(paymentMethods),
  products: many(products),
  purchaseOrders: many(purchaseOrders),
  reviews: many(reviews),
  sales: many(sales),
  serviceCategories: many(serviceCategories),
  services: many(services),
  staff: many(staff),
}))

export const serviceCategoriesRelations = relations(
  serviceCategories,
  ({ one, many }) => ({
    salon: one(salons, {
      fields: [serviceCategories.salonId],
      references: [salons.id],
    }),
    serviceCategories: many(serviceCategories, {
      relationName: 'serviceCategories_parentId_serviceCategories_id',
    }),
    serviceCategory: one(serviceCategories, {
      fields: [serviceCategories.parentId],
      references: [serviceCategories.id],
      relationName: 'serviceCategories_parentId_serviceCategories_id',
    }),
    services: many(services),
  }),
)

export const serviceOptionsRelations = relations(serviceOptions, ({ one }) => ({
  service: one(services, {
    fields: [serviceOptions.serviceId],
    references: [services.id],
  }),
}))

export const servicesRelations = relations(services, ({ one, many }) => ({
  bookingServices: many(bookingServices),
  salon: one(salons, {
    fields: [services.salonId],
    references: [salons.id],
  }),
  serviceCategory: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  serviceOptions: many(serviceOptions),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const staffInvitationsRelations = relations(
  staffInvitations,
  ({ one }) => ({
    staff: one(staff, {
      fields: [staffInvitations.staffId],
      references: [staff.id],
    }),
  }),
)

export const staffRelations = relations(staff, ({ one, many }) => ({
  bookingServices: many(bookingServices),
  bookings: many(bookings),
  customerPreferences: many(customerPreferences),
  reviews: many(reviews),
  sales: many(sales),
  salesDetails: many(salesDetails),
  salon: one(salons, {
    fields: [staff.salonId],
    references: [salons.id],
  }),
  staffInvitations: many(staffInvitations),
  staffSchedules: many(staffSchedules),
  treatmentRecords: many(treatmentRecords),
  users: many(users),
}))

export const staffSchedulesRelations = relations(staffSchedules, ({ one }) => ({
  staff: one(staff, {
    fields: [staffSchedules.staffId],
    references: [staff.id],
  }),
}))

export const treatmentMaterialsRelations = relations(
  treatmentMaterials,
  ({ one }) => ({
    product: one(products, {
      fields: [treatmentMaterials.productId],
      references: [products.id],
    }),
    treatmentRecord: one(treatmentRecords, {
      fields: [treatmentMaterials.treatmentRecordId],
      references: [treatmentRecords.id],
    }),
  }),
)

export const treatmentPhotosRelations = relations(
  treatmentPhotos,
  ({ one }) => ({
    treatmentRecord: one(treatmentRecords, {
      fields: [treatmentPhotos.treatmentRecordId],
      references: [treatmentRecords.id],
    }),
  }),
)

export const treatmentRecordsRelations = relations(
  treatmentRecords,
  ({ one, many }) => ({
    booking: one(bookings, {
      fields: [treatmentRecords.bookingId],
      references: [bookings.id],
    }),
    customer: one(customers, {
      fields: [treatmentRecords.customerId],
      references: [customers.id],
    }),
    staff: one(staff, {
      fields: [treatmentRecords.staffId],
      references: [staff.id],
    }),
    treatmentMaterials: many(treatmentMaterials),
    treatmentPhotos: many(treatmentPhotos),
  }),
)

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers, {
    fields: [users.customerId],
    references: [customers.id],
  }),
  customerDeletionRequests_cancelledBy: many(customerDeletionRequests, {
    relationName: 'customerDeletionRequests_cancelledBy_users_id',
  }),
  customerDeletionRequests_completedBy: many(customerDeletionRequests, {
    relationName: 'customerDeletionRequests_completedBy_users_id',
  }),
  customerDeletionRequests_requestedBy: many(customerDeletionRequests, {
    relationName: 'customerDeletionRequests_requestedBy_users_id',
  }),
  customerVersions: many(customerVersions),
  sessions: many(sessions),
  staff: one(staff, {
    fields: [users.staffId],
    references: [staff.id],
  }),
}))
