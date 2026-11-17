# Beauty Salon Backend Architecture Overview

This document explains the system as a whole: what exists, how the packages
depend on each other, where the types come from, and what happens to a request
from the moment the server starts. Read it first.

It does not say how to write code. For that, see:

- [CLAUDE.md](../CLAUDE.md): the rules, the conventions and the commands. It
  is the canonical statement, and this document does not repeat it.
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
  (Japanese): how to write backend code in each layer, with the Salon files as
  the reference.

## Table of Contents

1. [What Is Implemented](#what-is-implemented)
2. [Architecture Principles](#architecture-principles)
3. [Directory Structure](#directory-structure)
4. [Layers and Package Dependencies](#layers-and-package-dependencies)
5. [Type Generation Pipeline](#type-generation-pipeline)
6. [Database](#database)
7. [Request Flow](#request-flow)
8. [Errors](#errors)
9. [Configuration, Logging and Probes](#configuration-logging-and-probes)
10. [Tests, CI and Images](#tests-ci-and-images)
11. [Frontend](#frontend)
12. [References](#references)

## What Is Implemented

The API contract and the database schema cover far more than the code does.
Before relying on anything, check this table.

| Area | State |
|------|-------|
| Salon API (`/api/v1/salons`) | Implemented in every layer: list, create, get, update, delete. It is the reference implementation for every other domain. List and get are public; create, update and delete need a signed-in user with the permission. |
| Service categories of a salon (`/api/v1/salons/{salonId}/service-categories`) | Implemented in every layer: list, create, get, update, delete, the five operations of `ServiceCategoryCrud`. They are the example of data that belongs to a salon: the routes are below the salon, and a category that is not of the salon in the path is answered with 404. List and get are public; create, update and delete need a signed-in user with the permission. See [Service Menu](./service-menu.md) (Japanese). |
| Services of a salon (`/api/v1/salons/{salonId}/services`) | Implemented in every layer: list, create, get, update, bulk update, delete, the six operations of `ServiceCrud`. A service carries its options (the rows of `service_options`) in its requests and responses, and a package names the services it combines. The bulk update changes all the services it names or none of them. A delete keeps the row and marks it with `deletedAt`, and is refused with 409 while a package contains the service. List and get are public; create, update, bulk update and delete need a signed-in user with the permission. `isActive`, `serviceStatus`, `availability`, `bookingRequirements` and `maxBookingsPerDay` are stored and returned, and the list can filter by `isActive`; the list of available slots reads them, and with it the booking a customer makes by themself, while the booking ledger takes any service of the salon. See [Service Menu](./service-menu.md) (Japanese). |
| Customer ledger (`/api/v1/customers`) | Implemented in every layer: list, create, get, update, delete, five of the 19 operations of `CustomerCrud`. A customer belongs to no salon: the ledger is one for the whole platform, and its routes are not below a salon. No operation is public: list, create, get and update need a signed-in administrator or member of a salon (owner, manager or staff of any salon), delete an administrator, an owner or a manager. A delete keeps the row and marks it with `deletedAt`. Two more are the preferences of a customer (two rows below). The other 12 operations of `CustomerCrud` are not implemented: batch get, bulk create, bulk update, bulk delete, restore, merge, audit history, versions, the two exports, statistics and the data deletion request. A signed-in customer reaches no route of the ledger; their own record is the profile of the next row. `isActive` and `customerStatus` are stored and returned, and the list can filter by `customerStatus`; nothing else reads them: which customers can book is not decided yet. Nothing maintains the points, the lifetime value or the visit counters. See [Customer Ledger](./customers.md) (Japanese). |
| Customer profile (`/api/v1/customers/me`) | Implemented in every layer: get, create, update, three of the five operations of `CustomerProfile`; the other two are the preferences of the next row. The profile is the customer record of the signed-in account. The route names no record: the account alone says which one, so a customer reaches no other. Only a customer account has a profile; an administrator and a member of a salon are answered with 403. A registered user has no record until they create the profile. The creation takes over the customer that the ledger has under the account's email address, unless that customer belongs to another account (409), and needs an account that has confirmed its address (409); without such a customer it adds one to the ledger. The response leaves out what the staff keep to themselves (notes, tags, status, the referrer, the lifetime value, the counts of no-shows and cancellations), and the requests write only what is the customer's own: the name, the contact details, the birth date, the preferences and the three consents. A delete of the customer in the ledger takes the profile from the account, which may then create a new one. See [Customer Ledger](./customers.md) (Japanese). |
| Customer preferences (`/api/v1/customers/{id}/preferences`, `/api/v1/customers/me/preferences`) | Implemented in every layer: get and update for whoever keeps the ledger (`getPreferences` and `updatePreferences` of `CustomerCrud`) and for the customer (the operations of the same names of `CustomerProfile`). The preferences are one record per customer (a row of `customer_preferences`): the staff member the customer prefers, the staff members they avoid, the times of day they like to come, a style preference, how they like to be talked to and special requests. There is no create and no delete: a customer without a row has empty preferences, a get answers 200 with them, and the first update creates the row. The permissions are those of the ledger and of the profile. A staff member that an update names has to be one who is not deleted, of a salon that is not deleted, of whichever salon (400). The preferred staff member is not among the avoided ones in the preferences as they are stored after the update (400), which the update checks while it holds a lock on the row of the customer. The ID of a staff member who is deleted later stays in the preferences. Nothing reads the preferences yet: how a booking uses them is not decided. See [Customer Ledger](./customers.md#好み設定) (Japanese). |
| Staff ledger of a salon (`/api/v1/salons/{salonId}/staff`) | Implemented in every layer: list, create, get, update, delete, the five operations of `StaffCrud`. The ledger is what a salon keeps about its staff as their employer: names and contact details, the terms of employment (base salary, commission rate, employment type, hire date) and how a staff member takes bookings. Nothing of it is public, reading included: every operation needs an administrator or the owner of the salon in the path; a manager and a staff member are answered with 403. Deactivating (`isActive: false`) or deleting a staff member takes the salon from the login account that is linked to it, from its next request on, so nobody deactivates or deletes the staff member their own account belongs to (409). The email is unique among the staff members of one salon who are not deleted, the staff code among all staff members of the salon. A delete keeps the row and marks it with `deletedAt`. A staff member gets a login account by invitation (next row), and the salon reads that account, changes its role and unlinks it (the row after). See [Staff Ledger](./staff.md) (Japanese). |
| Staff invitations (`/api/v1/salons/{salonId}/staff/{id}/invitation`, `/api/v1/auth/staff-invitation`) | Implemented in every layer: get, create and delete, the three operations of `StaffInvitations`, and `verifyStaffInvitation`, `acceptStaffInvitation` and `joinStaffInvitation` of `AuthCrud`. An invitation is how a staff member of the ledger gets a login account. A staff member holds at most one (a row of `staff_invitations`), so the path names no invitation ID. An administrator or the owner of the salon in the path invites to a role (`SalonRoleType`: owner, manager or staff; only an administrator gives the role of an owner), and a new invitation replaces the one the staff member holds. The link is mailed to the address of the ledger, and the answer does not tell whether that address has an account. A staff member who has an account or is not active is not invited (409), and an invitation that was mailed less than 60 seconds ago is not replaced (409). The token works once, for 7 days, and only while the staff member is active, not deleted, without an account and still has the address the invitation went to. Whoever holds it reads the invitation (`verify`), which also names the route that takes the token next, and accepts it with a password of their own (`accept`), both without an access token. Accepting creates the account, active and with its address verified, and links it to the staff member (`users.staffId` and `staff.userId`). An address that has an account is refused (409), with two exceptions. A registration that never confirmed the address becomes the account. And an account with the role of an owner, a manager or staff that reaches no salon (a staff member who changed salons, an account that was unlinked) signs in and joins (`join`, with its access token and the mailed token): the account is linked, gets the role of the invitation and keeps its password and its sessions. The token never stands in for the password of an account that exists. See [Staff Ledger](./staff.md#スタッフのログインアカウント) (Japanese). |
| Staff accounts (`/api/v1/salons/{salonId}/staff/{id}/account`) | Implemented in every layer: get, update and delete, the three operations of `StaffAccounts`. The account of a staff member is the user that names the staff member in `users.staffId` and is not deleted. A staff member has at most one, so the path names no user ID. An administrator or the owner of the salon in the path reads it (`StaffAccountResponse`: the address, the role, the status, the two-factor status and the last login; nothing that authenticates), changes its role (`PATCH`; only an administrator gives the role of an owner, and the owner of the salon may take it from another owner) and unlinks it (`DELETE`: `users.staffId` and `staff.userId` become null, the account and the staff member stay, and the account keeps its role and reaches no salon). Nobody changes the role of their own account or unlinks it (409). A change takes effect with the next request of the account; no session is revoked. A check constraint keeps the role of a user that names a staff member to owner, manager or staff (`users_staff_needs_salon_role`). Not implemented: a staff member leaving a salon on their own, turning a customer account into a staff account, an account that belongs to several salons. See [Staff Ledger](./staff.md#紐づいたアカウントの管理) (Japanese). |
| Staff schedules (`/api/v1/salons/{salonId}/staff/{id}/schedules`) | Implemented in every layer: list and update, the two operations of `StaffSchedules`. A schedule says when a staff member works. It is a list of entries (`StaffSchedule`, the rows of `staff_schedules`): weekly ones, at most one per day of the week, and ones for a single date, at most one per date, which replace the weekly entry on that date. An entry is a working day, with its hours and at most one break inside them, or a day off, without times. The update is a `PUT` whose body is the whole schedule: it replaces every row, in one transaction. With `?date=` the list answers with the one entry that applies to that date, or with none. Nothing of it is public: an administrator, the owner and the managers of the salon in the path read and write, and a staff member of the salon reads their own schedule. The schedule of a staff member who is not active can be read and written, that of a deleted one is answered with 404. Nothing reads the schedules to work out free slots yet. See [Staff Ledger](./staff.md#勤務スケジュール) (Japanese). |
| Staff profiles (`/api/v1/staff-profiles`) | Implemented in every layer: list and get, the two operations of `StaffProfile`, and get and update of the own profile, the two operations of `StaffOwnProfile`. A profile is what customers are shown of a row of the staff ledger, in a model of its own (`StaffProfileResponse`): the display name, the level, the position, the specialties, the biography, the photo, the years of experience, the certifications and whether the staff member takes bookings. The names, the contact details and the terms of employment are not in it. The two operations of `StaffProfile` are public and read only. Shown are the staff members who are active and not deleted, of salons that are not deleted; any other is answered with 404, like an ID that no staff member has. The list goes across salons, in the order of registration, and filters by salon, by specialty and by the city of the salon. With the two operations of `StaffOwnProfile` (`/api/v1/staff-profiles/me`), a signed-in staff member who reaches a salon (`owner`, `manager` or `staff`) reads the profile of the staff member the account belongs to and changes the five properties that describe them: the specialties, the biography, the photo, the years of experience and the certifications. The display name, the level, the position and whether the staff member takes bookings stay with the salon, in the ledger. See [Staff Ledger](./staff.md#顧客に見せるプロフィール) (Japanese). |
| Authentication (`/api/v1/auth`, `/api/v1/admin/auth`) | Implemented: `login`, `refresh`, `logout`, `logout-all` and `me`, on server-side sessions with opaque bearer tokens, and registration of customer accounts, email verification and password reset, each through a single-use token sent by mail, and password change, and verifying, accepting and joining the invitation of a staff member, which creates the accounts of owners, managers and staff or links one that exists, and two-factor authentication with the one-time passwords of an authenticator app (TOTP) and backup codes, and the list of the signed-in user's sessions with the revocation of one of them, and under `/api/v1/admin/auth` the administrator operations: read a user, unlock an account, reset two-factor authentication. That is every operation in `specs/operations/auth-operations.tsp`: the 19 of `AuthCrud`, the 2 of `SessionCrud` and the 3 of `AdminAuthCrud`. See [Authentication and Authorization](./authentication.md). |
| Authorization | Implemented for the Salon API (create, update, delete), for the service categories of a salon (create, update, delete), for the services of a salon (create, update, bulk update, delete), for the customer ledger and a customer's own profile (every operation), for the staff ledger of a salon, the schedules of its staff, their invitations and their accounts and a staff member's own profile (every operation) and for the administrator operations. An implemented operation that the contract does not mark `@useAuth(NoAuth)` needs a valid access token, and its use case decides whether the signed-in user may do what is asked. |
| System endpoints (`/api/system`) | Implemented: `alive`, `ready` and `health`. |
| Booking ledger (`/api/v1/bookings`) | Implemented in every layer: list, create, get, update, delete, the five actions that change the status of a booking (confirm, cancel, start, complete, no-show) and reschedule, the eleven operations of `BookingCrud`, and add, get and remove of the service lines of a booking that exists, the three operations of `BookingServiceCrud` (`/api/v1/bookings/{bookingId}/services`). A booking belongs to a salon, but its routes are not below one: the salon is named by the body of a create, by the query of a list and by the stored row of every operation on one booking. No operation is public: an administrator reaches the bookings of every salon, a member of a salon (owner, manager or staff) those of that salon, and a customer account none (403); the booking of another salon is not found. A delete is for administrators, the owner and the managers, and not for the staff of the salon (403). A create request names the salon, the customer, the staff member in charge and the service lines (a service, who provides it, when it begins). The end, the duration and the amounts of a line are those of its service at that moment, those of the booking follow from its lines, the booking number (`BK-XXXX-XXXX`) is issued by the system, and `bookingDate` is the day of the start in the time zone of the salon. The request is held to what keeps the ledger sound: everything it names exists and is of that salon (400), and no staff member is occupied by more bookings at a time than `maxConcurrentBookings`, counting the minutes the staff member keeps free before and after a line (409). It is not held to the opening hours, the schedules of the staff or to what is active: those are for the bookings that customers enter themselves, which do not exist. A booking is entered as `pending`; an action leads on from the statuses it is defined for and is refused from any other (409), a no-show cannot be noted before the booking has begun, a cancellation costs nothing (no rule defines a fee), and completing a booking completes its service lines. Every change of status is a row of the status history, and the visits, cancellations and no-shows of the customer are counted again from their bookings. An update writes what a salon notes of a booking (the deposit, the request of the customer, the internal notes, the source), whatever the status. A reschedule moves a booking that is `draft`, `pending` or `confirmed` to another time and staff member in charge: every line moves by as much, the lines of the staff member who was in charge go to the new one, and the move is held to what a create is held to (400 for a staff member who is not of the salon, 409 for one who is occupied). A service line is added to a booking and removed from it as long as the booking is not finished (`draft`, `pending`, `confirmed` or `in_progress`; 409 from any other status): a line that is added is a copy of its service at that moment and is held to what a create is held to, a booking keeps between one and twenty lines (409), and its day, its times and its amounts are computed again from the lines it then has, at the tax rate the salon then has. The staff of the salon remove a line, although they do not delete a booking. A delete removes the booking with its lines, its status history and its reviews, counts the customer again, and is refused while a sale or a treatment record refers to the booking (409). A customer, a staff member, a service and a salon are not deleted while a booking that is not finished refers to them (409). See [Booking Ledger](./bookings.md) (Japanese). |
| Available slots (`/api/v1/salons/{salonId}/available-slots`) | Implemented in every layer: the list of the times at which a staff member can begin a service on a date, for every signed-in user, and the check of whether a staff member is occupied at a time, for administrators and the members of the salon. Nothing is stored: a slot is worked out from the hours of the salon (the row of its calendar for the date, or else the weekly hours of that day of the week), the schedules of the staff and the bookings there are, every 30 minutes from the beginning of each stretch in which the salon is open and the staff member works, all in the time zone of the salon. The list applies what the salon set for the bookings of its customers (whether the salon, the service and the staff member take bookings, on which days of the week the service is offered, how often it is booked a day, the level it asks for), and a day on which nothing can be booked is an empty list, not an error. The check asks only what the ledger asks, whether the staff member is occupied, and names the bookings in the way. Neither holds a slot. See [Booking Ledger](./bookings.md#空き枠) (Japanese) |
| A customer's own bookings (`/api/v1/customers/me/bookings`) | Implemented in every layer: list, create, get, cancel and reschedule, for a customer account with a profile (403 for every other role, 404 without a profile). A customer books a slot: a service with a staff member of a salon at a time, and the server takes it only if the list of available slots offers that time at that moment, so everything the list applies holds for the booking as well. The booking is the ledger's: one service line, the times and the amounts from the service, `pending` until the salon confirms it. A customer whose record is not active, or set to inactive or blacklisted, does not book by themself, and nobody books a time at which they have another booking, at whatever salon (409). The customer reads their bookings at every salon, also those a salon entered for them, without what the salon notes and records, and cancels one that is a draft, pending or confirmed until the moment it begins (409 from then on). The booking of another customer is not found. Requests that arrive at the same moment for one slot, for the last booking a service takes that day or from one customer for one time write one booking. A customer moves a booking that is a draft, pending or confirmed, until the moment it begins, to another time, another staff member or both, if that is a slot the list offers for the service of the booking and for the time the booking takes, the booking itself not counted; a booking with more than one service line, or with a line that is not with the staff member in charge, is moved by the salon (409). A confirmed booking that its customer moves is pending again until the salon confirms it. See [Booking Ledger](./bookings.md#顧客が自分で入れる予約) (Japanese) |
| Sales ledger (`/api/v1/sales`) | Implemented in every layer: list, create, get, update and void, the receipt of a sale and the calculation of one, seven of the eight operations of `SaleCrud` (the eighth, `process`, is in the row of the payments below). A sale belongs to a salon, but its routes are not below one, like those of the bookings: the salon is named by the body of a create and of a calculation, by the query of a list and by the stored row of a get, an update, a void and a receipt. No operation is public: an administrator reaches the sales of every salon, the owner, the managers and the staff of a salon those of their salon, and a customer account none (403); the sale of another salon is answered like one that does not exist (404). The void alone is not for the staff of the salon (403). A sale is the bill of one visit as the till charged it. A create request states the lines with their amounts; the schema checks that a line agrees with itself (the discount within quantity times unit price, the total their difference plus the tax), that only a line of a service or of a product names a record, and that the lines have places of their own. The repository locks the booking, the salon, the customer and the staff members the sale names, in that order, and `planSale` reports what is not there or not of the salon (400), sums the sale up, takes `saleDate` from the time zone of the salon (409 when it is not known) and refuses a booking that has a sale that is not void (409). The sale number is `SL-XXXX-XXXX`, issued like a booking number. Prices, tax rates and commissions are compared with nothing, and nothing else is written: not the booking, the customer or the stock. A get and a list return a sale with its lines and its payments as they were at one moment, the list latest first and with the void sales. An update writes the properties a request names and holds the sale as it is afterwards to the rules of a create; new lines replace all the lines, and only while the payment status is `pending`. A void keeps the sale with the time and the reason, is refused while a payment of the sale was not refunded (409), and frees the booking for another sale. Both hold the row of the sale before any other row. A receipt is not stored: it is made from the sale at every request, under the sale number, and only for a sale that is not void and received its total (409). A calculation writes nothing: it counts the lines of a booking at the amounts they copied and added services at the prices of the menu, adds the tax of the salon once to their sum, and names the kinds of payment method that take the total in one payment; what is not of the salon is answered with 400. See [Sales Ledger](./sales.md) (Japanese). |
| Payment methods (`/api/v1/salons/{salonId}/payment-methods`) | Implemented in every layer: list, create, get, update and delete, the five operations of `PaymentMethodCrud`. A payment method is one way of paying that a salon accepts (cash, a card terminal, a QR payment): a method, a display name, the fee rate, the limits of the amount of one payment, whether it is taken online and at the salon, and whether it is in use. The routes are below the salon and none is public: an administrator and the owner, the managers and the staff of the salon read the payment methods, an administrator, the owner and the managers set them up, and a customer account reaches none (403), because a response states what the salon pays its processor. Both permissions are decided from the salon of the path alone, before anything else of the request is looked at; the payment method of another salon is answered like one that does not exist (404). The method is fixed once a payment method is created. The lower limit of the amount is not above the upper one: a request that names both is refused by the schema, and an update that names one of them is checked against the stored row, which the repository holds while it checks and writes (400). A delete removes the row, unless a payment refers to it (409: it is deactivated instead). The settings of a payment processor (`processorConfig`) are in no model of the API. A payment is held to whether its payment method is in use and to the limits of the amount; the fee and the online and offline flags are stored and decide nothing. See [Payments](./payments.md) (Japanese). |
| Payments of a sale (`POST /api/v1/sales/{id}/process`, `POST /api/v1/payments/{id}/refund`) | Implemented in every layer: `process` of `SaleCrud` and `refund` of `PaymentCrud`. No payment processor is connected, so a payment records what the till took and is written as `completed`; a refund turns a completed payment into `refunded` or `partial_refund`, once. An administrator and the owner, the managers and the staff of the salon of the sale record a payment; an administrator, the owner and the managers refund one (403 for the staff); a customer account does neither. A payment is held to its payment method (in use and of the salon of the sale, within its limits, card details only with a card) and to what is left to pay (400); a void sale, a sale with a refund and a sale with nothing left to pay take none (409). Both hold the sale `FOR UPDATE` first, as the update and the void do, and write the payment and the payment status of the sale, which is counted from its payments, in one transaction. See [Payments](./payments.md) (Japanese). |
| Sales reports (`/api/v1/sales-reports`) | Implemented in every layer: the report of a period, the sales of a day, by staff member, by category, the trends, and the export of the sales of each day of a period as a CSV file in the response (nothing is stored): the six operations of `SalesReportCrud`. An administrator reads the reports of every salon, the owner and the managers those of their salon; the staff of a salon and a customer account are refused (403). The query names the salon, the first and the last day of the sales, both required, at most 366 days (400 otherwise). A report is counted from the sales that are not void, their lines and their payments at every request, in one read-only `REPEATABLE READ` transaction, and is stored nowhere; the summary tables (`daily_summaries`, `staff_performances`) are not used. See [Sales Reports](./sales-reports.md) (Japanese). |
| Points (`/api/v1/points`) | Implemented in every layer: the balance of a customer, their history of point transactions (latest first, by cursor, between two moments), their points about to expire, and earning, using, adjusting and expiring points: the seven operations of `PointCrud`. The ledger is one for the whole platform, as the customer ledger is. An administrator and the owner, the managers and the staff of any salon read, earn and use points; the staff do not adjust them; a customer account is refused (403). Every movement writes a transaction with the balance after it and sets the balance of the customer (`loyaltyPoints`) to it, in one `READ COMMITTED` transaction that holds the sale or the booking it names and then the customer; the balance stays between 0 and 2,147,483,647 (409). A movement may name a sale or a booking of the customer within the reach of the actor: points are not earned on or used for a void sale or a draft, cancelled or no-show booking, and a record is earned on once and used for once (409, and a partial unique index). The points of a sale and a payment by points move no balance. What is left of an earning is counted from the transactions of the customer in the order they were written, a decrease taking the earliest expiry date first; the points about to expire include those past their expiry date that are not yet expired. The expiry is the administrators' alone (403 for the members of a salon): it writes one `expired` transaction per customer, each in a `READ COMMITTED` transaction of its own that holds the customer `FOR NO KEY UPDATE` before it reads their transactions, so a second run writes nothing. See [Points](./points.md) (Japanese). |
| Reviews (`/api/v1/reviews`, `/api/v1/review-reports`, `/api/v1/salons/{salonId}/reviews/summary`, `/api/v1/staff/{staffId}/reviews/summary`) | Implemented in every layer: every operation of `ReviewCrud` (the list, the create, the get, the update, the delete, the mark as helpful, the report and the response of a salon), `list` and `dismiss` of `ReviewReportCrud`, `getSummary` of `SalonReviewSummary` and `getStaffSummary` of `StaffReviewSummary`. Reading is public: no token is needed or looked at. A review is written by a customer account with a profile alone (403 for an administrator and the members of a salon), for a booking of that customer that is completed (409 otherwise), once per booking (409), at the salon of the booking that is not deleted, naming no staff member or one who took the booking (400). The transaction that writes a review holds the booking `FOR SHARE` and the salon `FOR NO KEY UPDATE` in `READ COMMITTED` and counts the `rating` (the average of the overall ratings, two decimals) and the `reviewCount` of the salon again, so the reviews of a salon are written one after the other. Its author changes a review (`update`; 403 for everyone else), and its author or an administrator removes it (`delete`, physically; 403 for the members of a salon); both hold the review `FOR UPDATE` and then the salon, and count the salon again, writing it only when a figure changes. A booking with a review is not deleted (409) until the review is. A customer marks a review of another customer as helpful (`markHelpful`; 403 for an administrator, the members of a salon and the author), once: the mark is a row of `review_helpful_votes`, a second one answers the count as it is, and the `helpfulCount` of the review is counted again from the rows, with the review held `FOR NO KEY UPDATE`. A customer reports a review of another customer, and the owner or a manager of a salon one of their salon (`report`; 403 for an administrator, staff, the author and another salon), once per account (409): the report is a row of `review_reports`, the review is not hidden, and its `reportCount` is the number of pending reports, counted again with the review held `FOR NO KEY UPDATE`. The administrators list the reports oldest first and dismiss them (`ReviewReportCrud`), which counts the review again. The owner or a manager of the salon of a review writes one response to it, replaces it or takes it down (`respond`; 403 for staff, customers and another salon), and an administrator only takes one down: the response is a column of the review, written with its time only when it differs from the stored one, with the review held `FOR NO KEY UPDATE`, and the `updatedAt` of the review stays. See [Reviews](./reviews.md) (Japanese). |
| Products (`/api/v1/salons/{salonId}/products`) | Implemented in every layer: list, create, get, update and delete, the five operations of `ProductCrud`. A product is what a salon sells at its counter or uses in its treatments: a code, a name, the prices, the unit, the stock levels, the supplier and whether it is sold, used in treatments and in use. The routes are below the salon and none is public: an administrator and the owner, the managers and the staff of the salon read them, an administrator, the owner and the managers keep them, and a customer account reaches none. The stock levels lie in order, the product code is unique among the products of the salon that are not deleted, and a delete marks the product and is refused while it has stock. See [Products](./products.md) (Japanese). |
| Stock (`/api/v1/inventory`) | Implemented in every layer: list, create, get, update and delete of the stock rows, the lists of the low stock and of what expires soon, the stock movements of a row and their history, the stock count and the value report: every operation of `InventoryCrud`. A stock row is one lot of one product of a salon: how much there is, where it is kept and when it expires. The routes are not below a salon and none is public: an administrator and the owner, the managers and the staff of a salon read them, an administrator, the owner and the managers keep them, and a customer account reaches none. A product kept by lots names the lot of each row and a product that is not has one row; a row is created without stock, only a stock movement or a stock count moves its stock, and a row that counts stock is not deleted. The staff record purchases, sales, uses and returns; an adjustment, a disposal and a transfer are for an administrator, the owner and the managers. A stock count sets the rows it names to what was counted, all of them or none, recording an adjustment of each difference, and the value report sums the stock at purchase prices by category; both are for an administrator, the owner and the managers. See [Inventory](./inventory.md) (Japanese). |
| Purchase orders (`/api/v1/purchase-orders`) | Implemented in every layer: list, create, get, update, approve, cancel and receive of the purchase orders of a salon, and the suggestions of what to reorder. An order names stock rows of its salon; its items copy their products, and the server works out the amounts. The routes are not below a salon and none is public: an administrator and the members of a salon draft and move on the orders of the salon, an administrator, the owner and the managers approve and cancel them, and a customer account reaches none. A receipt records a purchase of each item that arrived and delivers the order; the suggestions are worked out from the stock, the open orders and the levels of each product. See [Purchase Orders](./purchase-orders.md) (Japanese). |
| Inventory alerts (`/api/v1/inventory-alerts`) | Implemented in every layer: the list, the acknowledgement and the summary of the alerts of the stock of a salon. An alert is not stored: it is worked out of the products, the stock rows and their movements whenever it is read (the stock of a product at or below its minimum or above its maximum, a stock row that expires within 30 days or has expired). Only the acknowledgements are stored, and one holds while what it was given for lasts. The routes are not below a salon and none is public: an administrator and the owner, the managers and the staff of a salon read and acknowledge them, and a customer account reaches none. See [Inventory Alerts](./inventory-alerts.md) (Japanese). |
| Treatment records (`/api/v1/treatments`) | Implemented in every layer: list, create, get, update and delete, five of the seven operations of `TreatmentRecordCrud`. A treatment record is what a salon notes of the treatment of a booking: the services given, the techniques, the condition of the scalp and the hair, the colour formula, the materials used with their amounts and lots, what is recommended for the next visit, the satisfaction of the customer and the notes of the staff. The routes are not below a salon, whose record it is through its booking, and none is public: an administrator and the owner, the managers and the staff of the salon of the booking read and write them, an administrator, the owner and the managers remove one, and a customer account reaches none. A booking that is in progress or completed takes one record; its customer is that of the booking, and its staff member, services and products are of the salon of the booking. Recording the materials does not move the stock. The photos (`addPhotos`) and the statistics (`getStatistics`) are not implemented: no route serves them (404), and a record returns the photos the table holds. See [Treatments](./treatments.md) (Japanese). |
| Attachments, roles and permissions, medical charts | Specified in TypeSpec only. No table exists for them yet. |
| Email | Implemented for the mails of the authentication flows and the invitation of a staff member (confirm the address, reset the password, accept an invitation, and the notices: the password was changed, two-factor authentication was enabled, disabled or turned off by an administrator, the backup codes were replaced, a backup code was used to sign in): plain text over SMTP. Docker Compose starts Mailpit, which catches them locally. See [Email](./email.md) (Japanese). |
| File storage | Not implemented. Docker Compose starts no service for it. |
| Frontend | Three application shells and shared packages. The API client is generated, but no application calls the API yet. See [Frontend](#frontend). |

## Architecture Principles

[CLAUDE.md](../CLAUDE.md) lists the principles as rules. This is how they
shape the system, and why:

- **API-first.** The TypeSpec files in `specs/` are the contract. The OpenAPI
  document, the backend types and the frontend client are generated from them,
  and CI rejects generated files that are out of date, so the API cannot drift
  from its definition.
- **Database-driven models.** The database decides the stored shape.
  `schema.ts` is generated from the database, the domain types are inferred
  from `schema.ts`, and API property names and nullability follow the columns.
  Nobody maintains a second description of a table.
- **One direction of dependency.** Each package depends only on packages
  below it (see [Layers and Package Dependencies](#layers-and-package-dependencies)).
  The domain declares the repository interface; the infrastructure implements
  it.
- **Validation in the use case.** A handler passes the request body on as
  `unknown`. The use case validates it with a Zod schema that is checked
  against the generated request type. Input becomes trusted in one place, and
  that place is unit-tested without HTTP.
- **Authorization in the use case.** The HTTP layer only establishes who is
  asking: `authenticated` turns the bearer token into an `Actor` or answers
  401. The use case of a protected operation takes the actor as its first
  argument and decides whether that actor may do what is asked, so a
  permission rule is a pure function that is unit-tested like any other
  rule. See [Authentication and Authorization](./authentication.md).
- **Errors are values.** Every operation that can fail returns a
  `Result<T, E>`, so its signature states how it can fail. Application code
  does not throw, and it contains exactly two `try`/`catch`:
  `Result.fromPromise` and `Result.fromThrowable` in
  `backend/packages/utility/src/result/result.ts`, which turn what code
  outside the application throws (in practice the database driver, and
  `node:crypto` when a stored secret cannot be decrypted) into a `Result`.
  Whatever still escapes a route, such as an unreadable body
  or a defect, is forwarded by Express to the error-handling middleware at
  the end of the chain.
- **Sum types, matched exhaustively.** Results, errors and other states are
  discriminated unions handled with ts-pattern, so adding a case fails the
  build until every match handles it.
- **Separate write and read mappers.** A request and a response of the same
  resource have different shapes. Property names never change between the API
  and the database; the mappers only convert representations (`numeric` to
  number, `timestamptz` to ISO 8601) and check `jsonb` values against the API
  model.
- **Nothing is passed through a global.** Dependencies are built once at
  start-up and handed down as arguments, and only the server's entry point
  reads the environment. The integration tests call the same `createApp` with
  a database schema of their own, so they test the application that runs in
  production.

## Directory Structure

```
.
├── specs/                   TypeSpec definitions (models/, operations/) and the
│                            generated OpenAPI document (tsp-output/)
├── backend/
│   ├── packages/
│   │   ├── utility/         Result type and type helpers
│   │   ├── generated/       API types generated from the OpenAPI document
│   │   ├── config/          Environment files and parseAppConfig
│   │   ├── database/        Drizzle schema, SQL, migration and seed scripts
│   │   ├── domain/          Models, validation schemas, mappers, use cases,
│   │   │                    repository and service interfaces, errors
│   │   ├── infrastructure/  Database connection, repository implementations,
│   │   │                    password hashing, tokens, one-time passwords,
│   │   │                    mail over SMTP, logger
│   │   └── api/             Express application: middleware, routes,
│   │                        authentication, error responses
│   └── apps/
│       └── server/          The process that runs the API
├── frontend/
│   ├── packages/            Shared packages, including the generated API client
│   └── apps/                admin-app, portal-app, dashboard-app
├── shared-config/           Shared tsconfig files
├── scripts/                 Repository scripts, run with node
├── docs/
├── Dockerfile.backend, Dockerfile.frontend, docker-compose.yml
└── Makefile, package.json   Every command (see CLAUDE.md)
```

Inside a backend package the code is grouped by kind, then by domain. The
Salon files show the pattern:

```
domain/src/
├── models/salon.ts                    ID, API and database types
├── schemas/salon.schema.ts            Zod schema of each request
├── schemas/rules.ts                   nonBlankText, lowerCaseEmail, phoneNumber, MAX_INTEGER,
│                                      noRepeatedEntries, atLeastOneProperty (the schemas of
│                                      more than one domain)
├── mappers/write/salon.mapper.ts      API request → rows
├── mappers/read/salon.mapper.ts       Rows → API response
├── mappers/read/columns.ts            numericSchema, timestampSchema (every read mapper)
├── repositories/salon.repository.ts   ISalonRepository
├── business-logic/salon/              One *.usecase.ts per operation;
│                                      _shared/authorization.ts decides who may
└── shared/                            DomainError, parseWith

infrastructure/src/
├── database/                          Connection, ping, attempt, log-safe failure description,
│                                      the LIKE pattern of a keyword (containing)
├── logging/logger.ts                  createLogger
└── repositories/salon.repository.impl.ts

api/src/
├── index.ts                           createApp
├── settings.ts                        AppSettings
├── middleware/                        Request logging, rate limit, error handlers
├── routes/salon/                      One *.handler.ts per operation, index.ts (router)
├── routes/system/index.ts             alive, ready, health
└── shared/                            Problem details, response helpers, API version,
                                       authentication (authenticated), JsonBody, the links
                                       of a page (pageLinks), the converters of query
                                       parameters, the signed-in user of a request
```

Authentication has the same layout, with what only it needs added:

```
domain/src/
├── models/auth.ts                     IDs, API and database types, Actor and ActorScope
├── schemas/auth.schema.ts             Zod schema of each request
├── mappers/read/user.mapper.ts        Row of users → API response
├── mappers/read/session.mapper.ts     Rows of sessions → API response
├── repositories/user.repository.ts    IUserRepository
├── repositories/session.repository.ts ISessionRepository
├── services/                          IPasswordHasher, ITokenIssuer, ITwoFactorAuthenticator,
│                                      IMailer
└── business-logic/auth/               One *.usecase.ts per operation, AuthenticateUseCase;
                                       _shared/ holds what they share: dependencies, the actor,
                                       session policy, password check and blocklist, the limit
                                       on guesses, the check of the second factor, the set-up
                                       of two-factor authentication, the answer for a session
                                       whose user is gone, mailed tokens, the texts of the mails,
                                       who may administer accounts (authorization.ts)

infrastructure/src/
├── repositories/user.repository.impl.ts, session.repository.impl.ts, account.ts
├── security/                          Argon2PasswordHasher, RandomTokenIssuer, TotpAuthenticator
└── mail/smtp-mailer.ts                SmtpMailer

api/src/
├── routes/auth/                       One *.handler.ts per operation of AuthCrud and
│                                      SessionCrud, index.ts (router); the three operations
│                                      of the invitation of a staff member are in
│                                      routes/staff-invitation/
└── routes/admin-auth/                 One *.handler.ts per operation of AdminAuthCrud,
                                       index.ts (router)
```

So have the service categories of a salon. What differs comes from the salon
they belong to:

```
domain/src/
├── models/service-category.ts         CategoryId, API and database types
├── models/salon.ts                    parseSalonIdOfPath: the salon that the path names
├── schemas/service-category.schema.ts Zod schema of each request
├── mappers/read/service-category.mapper.ts
│                                      Rows → API response. There is no write mapper:
│                                      no column needs converting
├── repositories/service-category.repository.ts
│                                      IServiceCategoryRepository; every method takes
│                                      the salon ID
├── business-logic/_shared/existing-salon.ts
│                                      requireSalon: not found when the salon does not exist
└── business-logic/service-category/   One *.usecase.ts per operation; _shared/ holds the
                                       dependencies, who may (authorization.ts) and the
                                       rule for the parent of a category (hierarchy.ts,
                                       parent.ts)

infrastructure/src/
└── repositories/service-category.repository.impl.ts

api/src/
└── routes/service-category/           One *.handler.ts per operation of ServiceCategoryCrud,
                                       index.ts (router, mounted below /salons/:salonId)
```

The services of a salon are laid out like its service categories. What
differs comes from their options, their packages and the bulk update:

```
domain/src/
├── models/service.ts                  ServiceId, API and database types, a service with
│                                      its options (ServiceWithOptions)
├── schemas/service.schema.ts          Zod schema of each request
├── mappers/write/service.mapper.ts    API request → rows of two tables, the service and
│                                      its options. No column needs converting
├── mappers/read/service.mapper.ts     Rows → API response
├── repositories/service.repository.ts IServiceRepository; what became of a write is a
│                                      sum type (ServiceCreation, ServiceUpdate,
│                                      ServiceBulkUpdate, ServiceDeletion)
└── business-logic/service/            One *.usecase.ts per operation; _shared/ holds the
                                       dependencies, who may (authorization.ts), the rules
                                       that tie two properties together (rules.ts) and the
                                       error for each refusal of the repository
                                       (refusals.ts)

infrastructure/src/
└── repositories/service.repository.impl.ts

api/src/
└── routes/service/                    One *.handler.ts per operation of ServiceCrud,
                                       index.ts (router, mounted below /salons/:salonId)
```

The customer ledger has the layout of Salon. A customer belongs to no salon,
so nothing of it takes a salon ID:

```
domain/src/
├── models/customer.ts                 CustomerId, API and database types
├── schemas/customer.schema.ts         Zod schema of each request, and of the stored
│                                      preferences
├── mappers/write/customer.mapper.ts   API request → row. Nothing is converted: the
│                                      request is the row
├── mappers/read/customer.mapper.ts    Row → API response
├── mappers/write/customer-profile.mapper.ts
│                                      Request of a customer for their own profile → the
│                                      new row, and the changes of a row that is taken over
├── mappers/read/customer-profile.mapper.ts
│                                      Row → the profile; names every property it shows
├── repositories/customer.repository.ts
│                                      ICustomerRepository; what became of a create, an
│                                      update or the creation of a profile is a sum type
│                                      (CustomerCreation, CustomerUpdate,
│                                      CustomerProfileCreation)
└── business-logic/customer/           One *.usecase.ts per operation, of the ledger and
                                       of the profile (*-customer-profile.usecase.ts);
                                       _shared/ holds the dependencies (the repository
                                       and the clock), who may (authorization.ts), whose
                                       profile a request is about (profile.ts), the rules
                                       that need the current time or another customer
                                       (rules.ts) and the reading of a keyword as a phone
                                       number (search.ts)

infrastructure/src/
└── repositories/customer.repository.impl.ts

api/src/
└── routes/customer/                   One *.handler.ts per operation of the ledger and
                                       of the profile, index.ts (router, mounted at
                                       /customers; /me is registered before /:id)
```

The preferences of a customer have files of their own in every layer:

```
domain/src/
├── models/customer-preferences.ts     API and database types. The database type is the
│                                      six columns that are the preferences;
│                                      noCustomerPreferences() is what a customer
│                                      without a row has
├── schemas/customer-preferences.schema.ts
│                                      Zod schema of the update request, and of the two
│                                      stored jsonb columns
├── mappers/read/customer-preferences.mapper.ts
│                                      Columns → API response. There is no write mapper:
│                                      the request is the change
├── repositories/customer-preferences.repository.ts
│                                      ICustomerPreferencesRepository; what became of an
│                                      update is a sum type (CustomerPreferencesUpdate)
└── business-logic/customer-preferences/
                                       One *.usecase.ts per operation, of the ledger and
                                       of the customer (*-own-customer-preferences.usecase.ts);
                                       _shared/ holds the dependencies, the flow that
                                       both share (preferences-of.ts), the rule that ties
                                       the preferred staff member to the avoided ones
                                       (rules.ts) and the errors of a refused change
                                       (refusals.ts)

infrastructure/src/
└── repositories/customer-preferences.repository.impl.ts

api/src/
└── routes/customer-preferences/       One *.handler.ts per operation, index.ts (two
                                       routers, mounted at /customers/me/preferences and
                                       at /customers/:id/preferences, before /customers)
```

The staff ledger belongs to a salon and has the layout of the service
categories, with a write mapper:

```
domain/src/
├── models/staff.ts                    StaffId, API and database types
├── schemas/staff.schema.ts            Zod schema of each request
├── mappers/write/staff.mapper.ts      API request → row; converts the commission rate
│                                      (a number in the API, numeric in the database)
├── mappers/read/staff.mapper.ts       Row → API response; leaves out awards and deletedAt
├── repositories/staff.repository.ts   IStaffRepository; every method takes the salon ID
└── business-logic/staff/              One *.usecase.ts per implemented operation;
                                       _shared/ holds the dependencies, who may and
                                       whether a staff member is the actor's own
                                       (authorization.ts), and the refusals (refusals.ts)

infrastructure/src/
└── repositories/staff.repository.impl.ts

api/src/
└── routes/staff/                      One *.handler.ts per implemented operation of
                                       StaffCrud, index.ts (router, mounted below
                                       /salons/:salonId)
```

The schedules of the staff are rows below a staff member, read and
replaced as a whole:

```
domain/src/
├── models/staff-schedule.ts           API and database types; no ID type, because an
│                                      entry is addressed by its staff member
├── schemas/staff-schedule.schema.ts   Zod schema of the update (the rules of an entry,
│                                      then no day twice) and of the list query
├── mappers/write/staff-schedule.mapper.ts
│                                      Entries → rows without their staff member
├── mappers/read/staff-schedule.mapper.ts
│                                      Row → entry; names every property
├── repositories/staff-schedule.repository.ts
│                                      IStaffScheduleRepository: findByStaff, replace
└── business-logic/staff-schedule/     One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who may plan and who may read
                                       (authorization.ts) and which entry applies to a
                                       date (applicable-schedule.ts)

infrastructure/src/
└── repositories/staff-schedule.repository.impl.ts
                                       The order of the rows; the replacement in one
                                       transaction that locks the staff member

api/src/
└── routes/staff-schedule/             One *.handler.ts per operation of StaffSchedules,
                                       index.ts (router, mounted below
                                       /salons/:salonId/staff/:id)
```

The invitations of the staff are one row per staff member, which a mailed
token gives access to:

```
domain/src/
├── models/staff-invitation.ts         API and database types, and the roles an
│                                      invitation gives (SalonRole); no ID type, because
│                                      no route names an invitation
├── schemas/staff-invitation.schema.ts Zod schema of the create request (the role); the
│                                      three requests that carry the token are in
│                                      auth.schema.ts
├── mappers/read/staff-invitation.mapper.ts
│                                      Row → response, without the hash of the token
├── repositories/staff-invitation.repository.ts
│                                      IStaffInvitationRepository: findByStaff, issue,
│                                      revoke, findUsable, accept, join; every outcome
│                                      is a sum type
└── business-logic/staff-invitation/   One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who may invite, who may give
                                       which role and who may join (authorization.ts)
                                       and the refusals (refusals.ts)

infrastructure/src/
└── repositories/staff-invitation.repository.impl.ts
                                       Every write in a transaction that locks the
                                       staff member; the account by one INSERT … ON
                                       CONFLICT … DO UPDATE … WHERE; a joining locks
                                       the staff member joined, the one left and the
                                       user

api/src/
└── routes/staff-invitation/           One *.handler.ts per operation; index.ts has two
                                       routers: one mounted below
                                       /salons/:salonId/staff/:id, and one at
                                       /auth/staff-invitation for the holder of a token
```

The accounts of the staff are the users that name a staff member. The salon
reads one, changes its role and unlinks it:

```
domain/src/
├── models/staff-account.ts            API types, and the columns of a user the salon
│                                      is shown (DbStaffAccount); no ID type, because
│                                      no route names an account
├── schemas/staff-account.schema.ts    Zod schema of the update request (the role)
├── mappers/read/staff-account.mapper.ts
│                                      Columns → response; names every property
├── repositories/staff-account.repository.ts
│                                      IStaffAccountRepository: findByStaff, update,
│                                      unlink; every outcome is a sum type
└── business-logic/staff-account/      One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who may keep the accounts
                                       (authorization.ts) and the refusals (refusals.ts)

infrastructure/src/
├── repositories/staff-account.repository.impl.ts
│                                      The columns it selects; the update and the
│                                      unlinking in a transaction that locks the
│                                      staff member
└── repositories/staff-member.ts       The staff member of a salon: the condition the
                                       repositories below a staff member share

api/src/
└── routes/staff-account/              One *.handler.ts per operation of StaffAccounts,
                                       index.ts (router, mounted below
                                       /salons/:salonId/staff/:id)
```

The staff profiles read the table of the ledger. The list and the get are
public, so they decide no permission. The own profile writes five columns
of the row the account belongs to; the request names them as they are
stored, so there is no write mapper:

```
domain/src/
├── models/staff-profile.ts            API types, and DbStaffProfile: the columns of a
│                                      staff row that customers are shown
├── schemas/staff-profile.schema.ts    Zod schemas of the list request and of the
│                                      update of the own profile
├── mappers/read/staff-profile.mapper.ts
│                                      Row → API response; names every property
├── repositories/staff-profile.repository.ts
│                                      IStaffProfileRepository: findById, list, update
└── business-logic/staff-profile/      One *.usecase.ts per operation; the list and the
                                       get take no actor, the two of the own profile do
                                       (_shared/own-profile.ts says whose profile it is)

infrastructure/src/
└── repositories/staff-profile.repository.impl.ts
                                       Selects the profile columns only; who is shown,
                                       and whose profile is written

api/src/
└── routes/staff-profile/              One *.handler.ts per operation of StaffProfile
                                       and of StaffOwnProfile, index.ts (router, mounted
                                       at /staff-profiles; `authenticated` wraps the two
                                       handlers of /me only)
```

The booking ledger is a salon's, but its routes are not below a salon. A
create request states little, and the rows that are written are worked out
from what it refers to, so there is no write mapper:

```
domain/src/
├── models/booking.ts                  BookingId, API and database types; BookingWrite
│                                      (the rows of one booking) and BookingReach (the
│                                      bookings an actor reaches: those of the ledger,
│                                      LedgerReach, or a customer's own, CustomerReach)
├── schemas/booking.schema.ts          Zod schemas of the create and the list request
├── mappers/read/booking.mapper.ts     A booking and its lines → API response
├── repositories/booking.repository.ts IBookingRepository; what became of a create is
│                                      a sum type (BookingCreation)
├── services/booking-number-issuer.ts  IBookingNumberIssuer
└── business-logic/booking/            One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, whom the ledger is for
                                       (authorization.ts), the rows a request becomes
                                       (plan.ts), when a staff member is occupied
                                       (occupancy.ts), the format of a booking number
                                       (booking-number.ts) and the errors of a refused
                                       create (refusals.ts)

infrastructure/src/
├── repositories/booking.repository.impl.ts
│                                      The create in one transaction that locks what
│                                      the request refers to; the queries of the get
│                                      and of the list are limited to a reach
└── security/random-booking-number-issuer.ts
                                       RandomBookingNumberIssuer: picks the symbols of
                                       a number with the CSPRNG

api/src/
└── routes/booking/                    One *.handler.ts per operation, index.ts (router,
                                       mounted at /bookings)
```

The sales ledger has the same shape. A create request states the amounts
as well, so the rows are checked more than worked out:

```
domain/src/
├── models/sale.ts                     SaleId, API and database types; SaleWrite (the
│                                      rows of one sale), SaleChange (what an update
│                                      writes) and SaleWithDetails (a sale, its lines
│                                      and its payments)
├── schemas/sale.schema.ts             Zod schemas of the create, the list, the update
│                                      and the void request; a line agrees with itself
├── mappers/read/sale.mapper.ts        A sale, its lines and its payments → API response
├── repositories/sale.repository.ts    ISaleRepository; what became of a create, of an
│                                      update and of a void is a sum type each
│                                      (SaleCreation, SaleUpdate, SaleVoiding)
├── services/sale-number-issuer.ts     ISaleNumberIssuer
├── business-logic/sale/               One *.usecase.ts per operation; _shared/ holds
│                                      the dependencies, whom the ledger is for
│                                      (authorization.ts), the rows a request becomes
│                                      (plan.ts), what an update writes and why a
│                                      change is refused (change.ts), why a sale has
│                                      no receipt (receipt.ts), what a calculation
│                                      comes to (calculation.ts), the format of a
│                                      sale number (sale-number.ts) and the errors of
│                                      a refusal (refusals.ts)
└── business-logic/_shared/            What bookings and sales share: the format of
                                       their numbers (record-number.ts), trying
                                       another number when one is taken (numbered.ts)
                                       and what lines come to (amounts.ts)

infrastructure/src/
├── repositories/sale.repository.impl.ts
│                                      The create in one transaction that locks what
│                                      the sale points at; the update and the void in
│                                      one that holds the sale first; the get, the
│                                      list and what a calculation refers to in a
│                                      read-only transaction of one snapshot
└── security/random-sale-number-issuer.ts
                                       RandomSaleNumberIssuer

api/src/
└── routes/sale/                       One *.handler.ts per operation, index.ts (router,
                                       mounted at /sales)
```

The payment methods of a salon are served below the salon, like the staff
ledger, with a permission to read them and another to set them up:

```
domain/src/
├── models/payment-method.ts           PaymentMethodId, API and database types; the
│                                      columns a request writes (DbNewPaymentMethod)
│                                      and those an update may change
│                                      (DbPaymentMethodChanges, without the method)
├── schemas/payment-method.schema.ts   Zod schemas of the create, the update and the
│                                      list request; limits that are both named are
│                                      in order
├── mappers/write/payment-method.mapper.ts
│                                      Request → columns; the fee as text
├── mappers/read/payment-method.mapper.ts
│                                      Row → response; names every property, so the
│                                      settings of a processor stay out
├── repositories/payment-method.repository.ts
│                                      IPaymentMethodRepository; what became of an
│                                      update and of a delete is a sum type each
│                                      (PaymentMethodUpdate, PaymentMethodRemoval)
└── business-logic/payment-method/     One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who reads and who sets up
                                       (authorization.ts) and the order of the two
                                       limits (limits.ts)

infrastructure/src/
└── repositories/payment-method.repository.impl.ts
                                       The update and the delete in a transaction
                                       that holds the row first

api/src/
└── routes/payment-method/             One *.handler.ts per operation, index.ts (router,
                                       mounted below /salons/:salonId)
```

The products of a salon are served below the salon, like the payment
methods, with three stock levels in order and a delete that marks a row:

```
domain/src/
├── models/product.ts                  ProductId, API and database types; the
│                                      columns a request writes (DbNewProduct)
│                                      and those an update may change
│                                      (DbProductChanges)
├── schemas/product.schema.ts          Zod schemas of the create, the update and the
│                                      list request; the stock levels a request
│                                      names are in order
├── mappers/write/product.mapper.ts    Request → columns; the stock levels as text
├── mappers/read/product.mapper.ts     Row → response; the stock levels as numbers,
│                                      without the time it was deleted
├── repositories/product.repository.ts IProductRepository; what became of an update
│                                      and of a delete is a sum type each
│                                      (ProductUpdate, ProductRemoval)
└── business-logic/product/            One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who reads and who keeps
                                       (authorization.ts) and the order of the
                                       stock levels (stock-levels.ts)

infrastructure/src/
└── repositories/product.repository.impl.ts
                                       The update and the delete in a transaction
                                       that holds the row first; the delete looks
                                       for stock and marks the row deleted

api/src/
└── routes/product/                    One *.handler.ts per operation, index.ts (router,
                                       mounted below /salons/:salonId)
```

The stock rows of a salon are not served below the salon, like the sales,
with a rule that the product of a row decides and a delete that removes a
row:

```
domain/src/
├── models/inventory.ts                InventoryId, API and database types; the
│                                      columns a create writes (DbNewInventory)
│                                      and those an update may change
│                                      (DbInventoryChanges)
├── schemas/inventory.schema.ts        Zod schemas of the create, the update, the
│                                      three lists, a stock movement, the
│                                      history, a stock count and the value
│                                      report; only a movement and a count
│                                      state the stock
├── mappers/write/inventory.mapper.ts  Request → columns, as they are
├── mappers/write/inventory-transaction.mapper.ts
│                                      Movement → columns, with the total cost
├── mappers/read/inventory.mapper.ts   Row → response; the stock figures as numbers
├── mappers/read/inventory-transaction.mapper.ts
│                                      Movement → response; the quantity and the
│                                      balances as numbers
├── mappers/read/inventory-report.mapper.ts
│                                      Count and value → responses; the yen only
│                                      while a number holds them exactly
├── repositories/inventory.repository.ts
│                                      IInventoryRepository; what became of a create,
│                                      an update, a delete, a movement and a count
│                                      is a sum type each (InventoryCreation,
│                                      InventoryUpdate, InventoryRemoval,
│                                      InventoryMovementRecording,
│                                      InventoryStockCount)
└── business-logic/inventory/          One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who reads, who keeps and
                                       who records which movement (authorization.ts),
                                       the lot rule (lots.ts), the last day that
                                       expires soon (expiry.ts), the rules of the
                                       kinds of movement and the total cost
                                       (movements.ts), the page (page.ts) and the
                                       refusal of a salon that is not there
                                       (refusals.ts)

infrastructure/src/
└── repositories/inventory.repository.impl.ts
                                       A create and a change of the lot hold the
                                       product while they decide; a delete holds
                                       the row, looks at its stock and removes it;
                                       a movement holds the row, moves its stock
                                       and records the balances

api/src/
└── routes/inventory/                  One *.handler.ts per operation, index.ts (router,
                                       mounted at /inventory)
```

The payments of a sale are written below the sale, and the payment status
of the sale is counted from them:

```
domain/src/
├── models/payment.ts                  PaymentId, API types of the two requests;
│                                      what a payment and a refund write
│                                      (PaymentWrite, RefundWrite)
├── schemas/payment.schema.ts          Zod schemas of the payment and the refund
│                                      request
├── mappers/read/payment.mapper.ts     Row → response; the sale mapper uses it for
│                                      the payments of a sale
├── repositories/payment.repository.ts IPaymentRepository; what became of a payment
│                                      and of a refund is a sum type each
│                                      (PaymentRecording, PaymentRefunding)
├── services/payment-number-issuer.ts  IPaymentNumberIssuer
└── business-logic/payment/            One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, the payment status of a
                                       sale, what a payment and a refund write and
                                       why they are refused (plan.ts), the format of
                                       a payment number (payment-number.ts) and the
                                       errors of a refusal (refusals.ts)

infrastructure/src/
├── repositories/payment.repository.impl.ts
│                                      A payment and a refund in one transaction
│                                      that holds the sale first
├── repositories/held-sale.ts          The lock on a sale, shared with the update
│                                      and the void of a sale
└── security/random-payment-number-issuer.ts
                                       RandomPaymentNumberIssuer

api/src/
├── routes/sale/process-sale.handler.ts
│                                      The record of a payment, below /sales
└── routes/payment/                    The refund; index.ts (router, mounted at
                                       /payments)
```

The sales reports write nothing and have no table of their own: the
repository reads sums of the sales ledger, and pure functions build a
report from them:

```
domain/src/
├── models/sales-report.ts             API types of the reports and of their queries
├── schemas/sales-report.schema.ts     Zod schemas of the queries; the period is in
│                                      order and at most 366 days long
├── repositories/sales-report.repository.ts
│                                      ISalesReportRepository; the sums it reads
│                                      (SalesFigures: by day, by kind of payment
│                                      method, by kind of category, by staff member)
└── business-logic/sales-report/       One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, whom the reports are for
                                       (authorization.ts), the reach and the salon
                                       before the sums are read (figures.ts), what
                                       a report says of the sums (report.ts) and
                                       the days, weeks and months (calendar.ts)

infrastructure/src/
└── repositories/sales-report.repository.impl.ts
                                       The sums in one read-only transaction of one
                                       snapshot, without a lock

api/src/
└── routes/sales-report/               One *.handler.ts per operation, index.ts (router,
                                       mounted at /sales-reports)
```

The points ledger has one table of transactions and the balance of the
customer; a pure function plans every movement from what the repository
holds:

```
domain/src/
├── models/point.ts                    API types of the transactions, the balance and
│                                      the requests; DbPointTransaction
├── schemas/point.schema.ts            Zod schemas of the requests and of the query of
│                                      the history; a record is a kind and an ID together
├── mappers/read/point.mapper.ts       PointReadMapper: a stored transaction as the API
│                                      returns it
├── repositories/point.repository.ts   IPointRepository; what recording a movement can
│                                      come to (PointRecording)
└── business-logic/point/              One *.usecase.ts per operation; _shared/ holds
                                       the dependencies, who reads and who moves points
                                       (authorization.ts), the plan of a movement from
                                       the balance and the record it names (plan.ts),
                                       the refusals (refusals.ts), what earning,
                                       using and adjusting share (record.ts), and
                                       what is left of the earnings and the plan of
                                       an expiry (lots.ts)

infrastructure/src/
└── repositories/point.repository.impl.ts
                                       A movement in one READ COMMITTED transaction:
                                       the record FOR SHARE, the customer FOR NO KEY
                                       UPDATE, the row and loyaltyPoints at
                                       clock_timestamp(); the history in one read-only
                                       snapshot

api/src/
└── routes/point/                      One *.handler.ts per operation, _shared/ (types,
                                       links, query), index.ts (router, mounted at
                                       /points)
```

The reviews have a table, two columns of the salon that are counted from
it, a table of the customers who marked a review as helpful, from which
its helpful count is counted, and a table of the reports of the reviews,
from which its report count is counted; a pure function plans a review
from what the repository holds:

```
domain/src/
├── models/review.ts                   API types of a review, the requests and the
│                                      summary; DbReview, ReviewWrite, ReviewTally
├── schemas/review.schema.ts           Zod schemas of the create, the update and the
│                                      query of the list; a staff rating needs a
│                                      staff member
├── mappers/read/review.mapper.ts      ReviewReadMapper: a stored review and a tally as
│                                      the API returns them
├── repositories/review.repository.ts  IReviewRepository; what writing, changing and
│                                      removing a review can come to (ReviewCreation,
│                                      ReviewChange, ReviewRemoval, ReviewMark,
│                                      ReviewReporting)
├── business-logic/review/             One *.usecase.ts per operation; _shared/ holds
│                                      the dependencies, who writes, who reports and
│                                      who responds to a review (authorization.ts),
│                                      the plan of a review from the booking it
│                                      names (plan.ts), of
│                                      a change and a removal from the review held
│                                      (change.ts), of a mark as helpful (helpful.ts),
│                                      of a report (report.ts), of a response
│                                      (response.ts) and the refusals
│                                      (refusals.ts)
└── business-logic/review-report/      The administrators' list and dismissal of the
                                       reports; _shared/ holds who handles them
                                       (authorization.ts) and the plan of a
                                       dismissal (dismissal.ts)

infrastructure/src/
├── repositories/review.repository.impl.ts
│                                      A review in one READ COMMITTED transaction:
│                                      the booking FOR SHARE, the salon FOR NO KEY
│                                      UPDATE, the row at clock_timestamp() and the
│                                      rating and the review count of the salon counted
│                                      again; a change and a removal hold the review
│                                      FOR UPDATE, then the salon; a mark and a report
│                                      hold the review FOR NO KEY UPDATE and count its
│                                      marks or its pending reports again; the list in
│                                      one read-only snapshot
└── repositories/review-report.repository.impl.ts
                                       The reports oldest first; a dismissal holds the
                                       review of the report FOR NO KEY UPDATE and
                                       counts its pending reports again
                                       (review-report-count.ts)

api/src/
├── routes/review/                     One *.handler.ts per operation, _shared/ (types,
│                                      links, query), index.ts (three routers, mounted
│                                      at /reviews, /salons/:salonId/reviews and
│                                      /staff/:staffId/reviews)
└── routes/review-report/              The list and the dismissal, mounted at
                                       /review-reports
```

## Layers and Package Dependencies

An arrow means "depends on":

```
           apps/server                reads the environment, builds everything, runs it
                │
                ▼
               api                    HTTP: middleware, routes, error responses
        ┌───────┴─────────┐
        ▼                 │
 infrastructure           │           I/O: database connection, repositories,
  ┌─────┴─────────┐       │           password hashing, tokens, one-time passwords, mail, logger
  │               ▼       ▼
  │                domain             rules: use cases, schemas, mappers,
  │     ┌─────────────┴───────┐       repository and service interfaces
  ▼     ▼                     ▼
  database                generated   stored shape (from PostgreSQL),
                                      API shape (from TypeSpec)
```

(`api` also takes its response types from `generated`. `utility` and `config`
are left out; the table below is complete.)

The two packages at the bottom are the two sources of truth, and both are
generated. The domain sits on both: it infers its database types from
`database` and takes its API types from `generated`, so a change to a table or
to the contract surfaces as a type error in the mappers.

Use cases and domain logic live in one package, `domain`. It imports nothing
that performs I/O: from `database` it imports types only, and it reaches the
database through repository interfaces (`ISalonRepository`,
`IServiceCategoryRepository`, `IServiceRepository`, `ICustomerRepository`,
`IUserRepository`, `ISessionRepository`), which `infrastructure` implements.
Password hashing, token generation, the one-time passwords of two-factor
authentication and mail are behind interfaces in the same way
(`IPasswordHasher`, `ITokenIssuer`, `ITwoFactorAuthenticator`, `IMailer`),
and the current time is a dependency (`clock`), so the authentication use
cases are unit-tested without a database, a real hash, an authenticator app
or a mail server.

| Package (`@beauty-salon-backend/…`) | Contains | Workspace packages it depends on |
|-------------------------------------|----------|----------------------------------|
| `utility` | `Result`, `DeepRequired`, `Omit` | none |
| `generated` | `api-types.ts` (`paths`, `components`, `operations`) and `schema.ts` (a Zod schema per enum) | none |
| `config` | `loadEnvFile`, `parseAppConfig` | `utility` |
| `database` | `schema.ts`, `relations.ts`, `sql/`, the `db:*` scripts, seeds | `config`, `utility` |
| `domain` | Models, schemas, mappers, use cases, repository and service interfaces, `DomainError` | `database` (types), `generated`, `utility` |
| `infrastructure` | `connectDatabase`, `pingDatabase`, the repositories (one class per repository interface of the domain: `SalonRepository`, `BookingRepository` and so on), `Argon2PasswordHasher`, `RandomTokenIssuer`, `RandomBookingNumberIssuer`, `RandomSaleNumberIssuer`, `RandomPaymentNumberIssuer`, `TotpAuthenticator`, `SmtpMailer`, `createLogger` | `database`, `domain`, `utility` |
| `api` | `createApp`, middleware, routes, authentication of a request, problem details | `domain`, `generated`, `infrastructure`, `utility`; `database` in tests |
| `server` (application) | Entry point and `startServer` | `api`, `config`, `domain`, `infrastructure`, `utility` |

`api` does not depend on `config`: it receives plain values (`AppSettings`),
and the server maps the parsed configuration onto them.

### How Packages Are Built and Resolved

Each backend package has a single entry point with two targets:

```json
"exports": {
  ".": {
    "@beauty-salon-backend/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

- `pnpm dev:backend`, the database scripts (`pnpm db:migrate` and the others) and the Vitest
  configurations of the packages that import other workspace packages resolve
  with the custom condition `@beauty-salon-backend/source`, so development,
  database commands and tests run the workspace packages from source and need
  no build.
- Everything else resolves to `dist`: the built server, and `pnpm typecheck`,
  which is why a build must come first.
- The packages are built by rslib. The server application is built by `tsc`
  alone.

## Type Generation Pipeline

```
specs/**/*.tsp
   │  pnpm generate:spec      tsp compile
   ▼
specs/tsp-output/@typespec/openapi3/generated/openapi.yaml
   │
   ├─ pnpm generate:backend   openapi-typescript
   │    ▼
   │  backend/packages/generated/src/api-types.ts   paths, components, operations
   │  backend/packages/generated/src/schema.ts      a Zod schema per enum
   │
   └─ pnpm generate:api       orval
        ▼
      frontend/packages/api-client/src/generated/   React Query hooks and models
```

`pnpm generate` runs all three steps. The generated files are committed.
`pnpm check:generated` regenerates them and fails when the result differs from
what is committed, so a TypeSpec change and its generated files always travel
together.

The backend consumes the generated types in two places per domain:

- `backend/packages/domain/src/models/salon.ts` names the request and response
  models, for example
  `components['schemas']['Models.SalonCreateRequest']`. The Zod schemas in
  `backend/packages/domain/src/schemas/salon.schema.ts` are checked against
  these types with `satisfies`.
- `backend/packages/api/src/routes/salon/_shared/types.ts` takes the response
  body of each operation from `operations`, for example
  `operations['SalonCrud_create']`.

Authentication does the same in `backend/packages/domain/src/models/auth.ts`,
`backend/packages/domain/src/schemas/auth.schema.ts`,
`backend/packages/api/src/routes/auth/_shared/types.ts` and
`backend/packages/api/src/routes/admin-auth/_shared/types.ts`, the
service categories in
`backend/packages/domain/src/models/service-category.ts`,
`backend/packages/domain/src/schemas/service-category.schema.ts` and
`backend/packages/api/src/routes/service-category/_shared/types.ts`, the
services in `backend/packages/domain/src/models/service.ts`,
`backend/packages/domain/src/schemas/service.schema.ts` and
`backend/packages/api/src/routes/service/_shared/types.ts`, the
customers in `backend/packages/domain/src/models/customer.ts`,
`backend/packages/domain/src/schemas/customer.schema.ts` and
`backend/packages/api/src/routes/customer/_shared/types.ts`, the
staff in `backend/packages/domain/src/models/staff.ts`,
`backend/packages/domain/src/schemas/staff.schema.ts` and
`backend/packages/api/src/routes/staff/_shared/types.ts`, the staff
profiles in `backend/packages/domain/src/models/staff-profile.ts`,
`backend/packages/domain/src/schemas/staff-profile.schema.ts` and
`backend/packages/api/src/routes/staff-profile/_shared/types.ts`, the
staff schedules in `backend/packages/domain/src/models/staff-schedule.ts`,
`backend/packages/domain/src/schemas/staff-schedule.schema.ts` and
`backend/packages/api/src/routes/staff-schedule/_shared/types.ts`, the
staff invitations in `backend/packages/domain/src/models/staff-invitation.ts`,
`backend/packages/domain/src/schemas/staff-invitation.schema.ts` and
`backend/packages/api/src/routes/staff-invitation/_shared/types.ts`, and the
staff accounts in `backend/packages/domain/src/models/staff-account.ts`,
`backend/packages/domain/src/schemas/staff-account.schema.ts` and
`backend/packages/api/src/routes/staff-account/_shared/types.ts`.

Model naming and nullability rules are in
[TypeSpec API Type Rules](./typespec-api-type-rules.md); the pipeline in
detail is in [Type Generation System](./type-generation-system.md).

## Database

PostgreSQL is the source of truth for the stored shape, and the files follow
it:

```
sql/migrations/*.sql ── pnpm db:migrate ──▶ database
                                              │ pnpm db:introspect
                                              ▼
                              src/schema.ts, src/relations.ts
                                              │ pnpm db:generate-sql
                                              ▼
                                        sql/setup.sql
```

(All paths are inside `backend/packages/database`.)

- A change starts as a SQL migration. `pnpm db:migrate` applies each migration
  once and records it in `migration_history.applied_migrations`. An empty
  database is created from `sql/setup.sql`, which already contains every
  migration.
- drizzle-kit only reads the database (`db:introspect`) and exports
  `setup.sql` from `schema.ts` (`db:generate-sql`). It neither generates nor
  runs migrations. Column names are camelCase in the database itself, so the
  schema needs no name mapping.
- `pnpm check:db-schema` fails when `schema.ts`, `relations.ts` or `setup.sql`
  do not match the database. `pnpm check:api-db` compares the OpenAPI document
  with the schema: property names, nullability and enum values must agree for
  every model that is backed by a table. No difference is tolerated.

The workflow step by step is in [CLAUDE.md](../CLAUDE.md) and the
[README](../README.md); how the domain types are derived from the schema is in
[DB-Driven Domain Model](./db-driven-domain-model.md).

## Request Flow

### Start-up

`backend/apps/server/src/index.ts` is the composition root: the only code that
reads the environment or ends the process.

1. `loadEnvFile()` reads `.env`, or `.env.<NODE_ENV>` when there is no `.env`,
   into the environment. Variables that are already set win.
2. `parseAppConfig(process.env)` validates all variables and returns a
   `Result`. On an error the server logs every issue and exits.
3. `createLogger(...)` creates the pino logger.
4. `startServer(config, logger)` in `backend/apps/server/src/server.ts`
   connects to the database and pings it, creates the mailer (`SmtpMailer`,
   from `config.mail`) and the authenticator of two-factor authentication
   (`TotpAuthenticator`, from `config.twoFactor.encryptionKey`), builds the
   application with
   `createApp({ database, logger, mailer, twoFactorAuthenticator, settings })`,
   and listens. It
   returns a `Result`: the server does not start when the database is
   unreachable or the port cannot be bound. The SMTP server is not contacted
   at start-up; the mailer connects when a mail goes out.
5. On `SIGTERM` or `SIGINT` the server stops accepting connections, lets
   requests in flight finish (for up to 10 seconds), waits for the mails
   that are still being delivered, closes the mailer and the database
   connections and exits with status 0.

### Middleware Order

`createApp` in `backend/packages/api/src/index.ts` creates the repositories,
the password hasher, the token issuer and the clock (`clock`, the current
time of the authentication and the customer use cases) once, takes the
mailer and the authenticator of two-factor authentication as dependencies
(`AppDependencies.mailer`, `AppDependencies.twoFactorAuthenticator`), and
mounts everything in this order. The order is part of the design:

1. `requestLogging`: gives every request its ID (`req.id`) and logger
   (`req.log`), first, so that everything after it can log and answer with
   the ID.
2. `helmet` and `cors`: security headers, and the allowed origins.
3. The system router at `/api/system`: before the rate limit, so that probes
   are never throttled.
4. `rateLimiting`: requests per client address and window.
5. `compression`, `requireJsonBody` and `express.json`: a body that is not
   JSON is rejected with 415, and a body over 100 kB with 413.
6. The authentication router at `/api/v1/auth`, the router of the
   administrator operations at `/api/v1/admin/auth`, the router of the
   acceptance of staff invitations at `/api/v1/auth/staff-invitation`,
   the Salon router at
   `/api/v1/salons`, the router of the service categories at
   `/api/v1/salons/:salonId/service-categories`, the router of the
   services at `/api/v1/salons/:salonId/services`, the router of the staff
   ledger at `/api/v1/salons/:salonId/staff`, the router of the staff
   invitations at `/api/v1/salons/:salonId/staff/:id/invitation`, the
   router of the staff accounts at
   `/api/v1/salons/:salonId/staff/:id/account`, the router of the staff
   schedules at `/api/v1/salons/:salonId/staff/:id/schedules`, the router
   of the staff profiles at `/api/v1/staff-profiles` and the router of the
   customer ledger at `/api/v1/customers`. Each receives
   `authenticated`, which `createAuthenticated` builds once from the
   authentication dependencies. The router of the staff profiles wraps
   the two handlers of the own profile (`/me`) with it; its list and its
   get are public. The one at
   `/api/v1/auth/staff-invitation` wraps one of its three handlers with
   it, the joining; the other two are public.
7. `notFoundHandler` and `errorHandler`: turn what is left over into problem
   details.

Authentication is not a middleware in this chain. A router wraps the handlers
that need a signed-in user with `authenticated`
(`backend/packages/api/src/shared/authentication.ts`), and only a wrapped
handler receives an `Actor`, so a handler that was not wrapped cannot call a
use case that asks for one.

### A Salon Request

Creating a salon, from the route to the database and back:

```
POST /api/v1/salons
  │
  ▼ api             authenticated                  shared/authentication.ts
  │                   AuthenticateUseCase: Authorization header → Actor,
  │                   or 401 and the handler does not run
  ▼ api             createSalonHandler             routes/salon/create-salon.handler.ts
  │                   passes the actor, and req.body as `unknown`, to the use case
  ▼ domain          CreateSalonUseCase.execute     business-logic/salon/create-salon.usecase.ts
  │                   1. mayCreateSalon(actor)                        authorize, or `forbidden`
  │                   2. parseWith(salonCreateRequestSchema, …)       validate
  │                   3. SalonWriteMapper.fromCreateRequest           API request → rows
  │                   4. salonRepository.create(salon, openingHours)
  ▼ infrastructure  SalonRepository.create         repositories/salon.repository.impl.ts
  │                   one transaction: the salon row and its opening_hours rows
  ▼ domain            5. SalonReadMapper.toApiSalon                   rows → API response
  ▼ api             match(result)
                      success → 201, Location header, { data, meta, links }
                      error   → sendProblem → problem details
```

Each step returns a `Result`, and a failed step is returned as it is, so the
handler receives either the API model or a `DomainError` and matches on it
exhaustively. A handler has no `try`/`catch`: Express 5 forwards a rejected
promise to the error handler.

The five operations follow the same path:

| Operation | Route | Who may | Use case | Success |
|-----------|-------|---------|----------|---------|
| List | `GET /api/v1/salons` | Anyone | `ListSalonsUseCase` | 200, a page: `{ data, meta, links }` with `meta.nextCursor` |
| Create | `POST /api/v1/salons` | `admin` | `CreateSalonUseCase` | 201 with a `Location` header |
| Get | `GET /api/v1/salons/{id}` | Anyone | `GetSalonUseCase` | 200 |
| Update | `PATCH /api/v1/salons/{id}` | `admin`, or the `owner` or a `manager` of that salon | `UpdateSalonUseCase` | 200. An absent property is left alone, `null` clears a nullable column |
| Delete | `DELETE /api/v1/salons/{id}` | `admin`, or the `owner` of that salon | `DeleteSalonUseCase` | 204. The row is kept and marked with `deletedAt`. 409 while a booking of the salon is not finished |

Five things differ from create:

- **Public operations.** List and get are marked `@useAuth(NoAuth)` in the
  contract. Their handlers are not wrapped with `authenticated`, and their
  use cases take no actor.
- **Permission for one salon.** Update and delete decide from the actor and
  the ID in the path (`mayUpdateSalon`, `mayDeleteSalon` in
  `business-logic/salon/_shared/authorization.ts`), after the ID is parsed
  and before the body is validated or the salon is looked up.
- **Path parameter.** The use case receives `req.params.id` as it is and
  turns it into a `SalonId` (a branded UUID) with `parseSalonId`.
- **Query string.** A query string carries text only, so the list handler
  first gives the parameters their types (`decodeSalonSearchQuery` in
  `routes/salon/_shared/query.ts`, built from the converters in
  `shared/query-parameters.ts`). The rules for the values are still the
  use case's.
- **Pagination.** Lists use keyset pagination; the salon list is newest
  first. `cursor` is the ID of the last salon of the previous page, returned
  as `meta.nextCursor`.

### A Request Below a Salon

The service categories belong to a salon, so their routes are below it:
`/api/v1/salons/{salonId}/service-categories`. A request takes the same path
through the layers, with one use case per operation
(`business-logic/service-category/`). What the salon adds:

- **The salon of the path.** The router is mounted with `:salonId` in its
  path and is created with `Router({ mergeParams: true })`, so its handlers
  read `req.params.salonId` and pass it on as it is. The use case turns it
  into a `SalonId` with `parseSalonIdOfPath` (`models/salon.ts`).
- **Permission from the path.** Create, update and delete decide from the
  actor and the salon in the path alone (`mayManageServiceCategories` in
  `business-logic/service-category/_shared/authorization.ts`), before the
  body is validated and before anything is looked up. List and get are
  public.
- **The salon must exist.** Every operation calls `requireSalon`
  (`business-logic/_shared/existing-salon.ts`), which returns `notFound` for
  a salon that does not exist or is deleted.
- **Nothing of another salon.** Every method of
  `IServiceCategoryRepository` takes the salon ID, so a category of another
  salon is answered like one that does not exist: 404.
- **No write mapper.** The properties of the request are the columns, and
  none needs converting, so the repository stores the validated request.
- **Order of the list.** The list is in the order a menu shows the
  categories: by `displayOrder`, then by ID.

The services of a salon (`/api/v1/salons/{salonId}/services`,
`business-logic/service/`) are built the same way: the salon of the path,
the permission from the path (`mayManageServices`), `requireSalon`, a
repository whose every method takes the salon ID, and a list in the order of
a menu, by `sortOrder`, then by ID. They add what the categories do not
have:

- **A write mapper for two tables.** A request holds the service and its
  options. No column needs converting, but `ServiceWriteMapper`
  (`mappers/write/service.mapper.ts`) tells the row of `services` from the
  rows of `service_options`, and says for an update whether the options are
  kept or replaced.
- **Rules that tie two properties together.** A discounted price is not
  above the price; a package names at least two member services, and a
  service that is not a package names none. An update names only some
  properties, so such a rule has to hold for the service as it will be
  stored. `serviceRuleIssues`
  (`business-logic/service/_shared/rules.ts`) is a pure function: the create
  use case calls it on the request, and the repository calls it inside the
  transaction of an update, on the stored row with the changes applied.
- **More than one refusal.** The repository answers a write with a sum type
  (`ServiceCreation`, `ServiceUpdate`, `ServiceBulkUpdate`,
  `ServiceDeletion` in `repositories/service.repository.ts`): what was
  stored, or why nothing was. `toRefusalError`
  (`business-logic/service/_shared/refusals.ts`) is the one place that turns
  a refusal of a create or an update into the error the client gets.
- **A bulk update.** `PATCH /bulk` applies the same changes to as many as
  100 services in one transaction, to all of them or to none. The router
  registers `/bulk` before `/:id`, which would otherwise take `bulk` for the
  ID of a service.
- **A soft delete.** A delete sets `deletedAt` and the row stays. A deleted
  service is answered like one that does not exist, but the cursor of the
  list may still name it: the page starts after the place the row holds. A
  service that a package contains is not deleted; the answer is `conflict`,
  409.

The rules of the service categories and of the services are in
[Service Menu](./service-menu.md), who may change them in
[Authentication and Authorization](./authentication.md) (both Japanese).

### A Customer Request

A customer belongs to no salon, and the customer ledger is not public. Its
routes are flat (`/api/v1/customers`), every handler is wrapped with
`authenticated`, and a request takes the same path through the layers, with
one use case per operation (`business-logic/customer/`). What that changes:

- **Permission first, from the actor alone.** Who may is decided from the
  actor and nothing in the request (`mayHandleCustomers`, and
  `mayDeleteCustomers` for a delete, in
  `business-logic/customer/_shared/authorization.ts`), so every use case
  decides it before the ID, the query and the body are looked at. An actor
  who may not is answered with 403 whatever else is wrong with the request.
  (The update and the delete of a salon decide after the ID is parsed,
  because the permission depends on the salon; the routes below a salon
  decide from the `salonId` of the path.)
- **A query the use case answers.** The list handler gives the query
  parameters their types (`decodeCustomerSearchQuery` in
  `routes/customer/_shared/query.ts`) and passes the outcome on as it is:
  `ListCustomersUseCase.execute(actor, query)` takes the decoded query as a
  `Result`. A query that cannot be decoded is an error of the request, and
  the use case returns it only to an actor who may list customers.
- **The current time.** A birth date is not in the future, so the create and
  the update use case read the time from `clock` in
  `CustomerUseCaseDependencies`. `createApp` builds one `clock` and hands it
  to the authentication and the customer use cases.
- **Two unique values.** The email is unique among the customers that are
  not deleted (a partial unique index), the referral code among all
  customers, deleted ones included (a unique constraint). The repository
  tells the two apart by the name of the violated constraint and returns
  `alreadyExists` for either: 409.
- **A write mapper that converts nothing.** The properties of the request
  are the columns, and every column has the representation of the API.
  `CustomerWriteMapper` (`mappers/write/customer.mapper.ts`) returns the
  request as the row: it is where the compiler checks that the two agree.
- **Times at the precision of a response.** The list filters by the time of
  registration (`registeredFrom`, `registeredTo`). The schema compares the
  two as times, not as text (`schemas/customer.schema.ts`), and the
  repository compares them with `createdAt` cut to milliseconds
  (`date_trunc('milliseconds', …)` in
  `repositories/customer.repository.impl.ts`): the column keeps
  microseconds, and a response shows milliseconds.

The list is newest first, and a delete keeps the row and marks it with
`deletedAt`, as for a salon.

A customer's own profile (`/api/v1/customers/me`) is served by the same
router, repository and dependencies, with use cases, mappers and models of
its own. What differs from the ledger:

- **The account says which record.** The route has no ID. The scope of a
  customer account carries `customerId`, which is null until the account has
  a profile, and `profileAccessOf`
  (`business-logic/customer/_shared/profile.ts`) turns the scope into one of
  three cases: the account's own record, a customer account without one, or
  not a customer account. The use cases match on it before the body is read:
  403 for an account that is no customer account, 404 for a get or an update
  without a profile, 409 for a second creation.
- **Models that show and take less.** `CustomerProfileResponse` leaves out
  what the staff keep to themselves, and the two requests have only the
  properties a customer states about themselves; the schemas are
  `pick`ed from the schema of the ledger, so the rules are the same.
  `CustomerProfileReadMapper` names each property it returns, so a column
  that is added to `customers` does not reach the customer by itself.
- **A creation that links two tables.** `createProfile` of the repository
  runs one transaction: it locks the account's row, reads from it what the
  decision depends on (the role, the confirmed email, the customer it may
  already have), locks the customer that the ledger has under that email,
  and either changes that row or inserts a new one, and writes the link on
  both sides (`users.customerId`, `customers.userId`). What became of it is
  the sum type `CustomerProfileCreation`. The mapper hands over both
  outcomes, the new row and the changes of a row that is taken over, because
  only the repository learns which applies.
- **A delete that unlinks.** The delete of the ledger clears
  `users.customerId` of the account that has the customer, in the
  transaction that marks the row.

The preferences of a customer (`/api/v1/customers/{id}/preferences` and
`/api/v1/customers/me/preferences`) have a repository, use cases and routers
of their own (`business-logic/customer-preferences/`). What differs from the
ledger and the profile:

- **Every customer has them.** A customer without a row of
  `customer_preferences` has the empty preferences
  (`noCustomerPreferences` in `models/customer-preferences.ts`): a read
  answers 200 with them and stores nothing, and the first change creates the
  row. There is no create and no delete, and a response does not tell
  whether a row is stored.
- **Two doors, one flow.** The use cases of the ledger decide with
  `mayHandleCustomers` and parse the ID of the path; those of the customer
  decide with `profileAccessOf` and take the customer from the actor. Both
  then call `readPreferencesOf` or `changePreferencesOf`
  (`_shared/preferences-of.ts`). The two routers are mounted at their full
  paths before the router of the customers, `me` first.
- **A change that is checked against what is stored.** The preferred staff
  member is not among the avoided ones, and a change may name only one of
  the two. `update` of the repository runs one transaction: it locks the
  row of the customer (`FOR UPDATE`), looks up the staff members the change
  names, reads the stored row, applies `customerPreferencesRuleIssues` to
  the preferences as they would be, and writes. What became of it is the
  sum type `CustomerPreferencesUpdate`; `toRefusalError` turns a refusal
  into the validation error that names the property. The staff members are
  not locked: the ID of one who is deleted afterwards stays, as it does
  whenever a staff member is deleted later.

The rules of the customer ledger, of the profile and of the preferences are
in [Customer Ledger](./customers.md), who may use them in
[Authentication and Authorization](./authentication.md) (both Japanese).

### A Staff Request

The staff ledger belongs to a salon, so a request takes the path of a
request below a salon: the salon of the path, the permission from the path,
`requireSalon`, and a repository whose every method takes the salon ID
(`business-logic/staff/`). What differs from the service menu:

- **Nothing is public.** Every handler is wrapped with `authenticated`,
  the list and the get included. `mayKeepStaffLedger`
  (`business-logic/staff/_shared/authorization.ts`) lets in an administrator
  and the owner of the salon in the path, and nobody else: the ledger holds
  pay and private contact details, and its operations change what an
  account may do.
- **A query the use case answers.** As for the customer list, the handler
  decodes the query (`decodeStaffSearchQuery` in
  `routes/staff/_shared/query.ts`) and `ListStaffUseCase.execute(actor,
  salon, query)` takes the outcome as a `Result`, so an actor who may not
  read the ledger is told that and nothing about the query.
- **The staff member an account belongs to.** The scope of a salon actor
  carries the ID of the staff member that gives the account its salon.
  `isOwnStaffRecord` compares it with the staff member of the request: an
  update that sets `isActive` to false, and a delete, are refused with
  `conflict` (409) when they are the same, after the request is validated
  and before anything is looked up.
- **No code for the effect on accounts.** The scope of an actor is rebuilt
  for every request from `users.staffId` and the staff row, which has to be
  active and not deleted (`staffOfUser` in
  `infrastructure/src/repositories/account.ts`). Deactivating or deleting a
  staff member therefore takes the salon from the linked account at its
  next request, and reactivating gives it back, without the staff use cases
  touching `users`.
- **A write mapper that converts one column.** `commissionRate` is a number
  in the API and `numeric(5,2)` in the database, which the driver reads and
  writes as a string. `StaffWriteMapper` (`mappers/write/staff.mapper.ts`)
  converts it, and for an update only when the request names it.
- **Two unique values with different scopes.** The email is unique among
  the staff members of one salon who are not deleted (a partial unique
  index on the salon and the email), the staff code among all staff
  members of the salon, deleted ones included (a unique constraint). The
  repository tells them apart by the name of the violated constraint and
  returns `alreadyExists` for either: 409. Nothing is compared across
  salons, so a salon learns nothing about the staff of another.
- **Writes in one statement.** The update and the delete carry "of this
  salon and not deleted" in their WHERE clause, so a staff member who is
  deleted at the same moment is changed before the delete or not found
  after it.

The list is in the order of registration, oldest first, so a new staff
member comes last, and a delete keeps the row and marks it with
`deletedAt`. The rules are in [Staff Ledger](./staff.md), who may keep the
ledger in [Authentication and Authorization](./authentication.md) (both
Japanese).

### A Staff Schedule Request

The schedules of the staff (`business-logic/staff-schedule/`) are rows that
belong to a staff member of a salon. A request takes the path of a staff
request, with these differences:

- **A router below a record.** The router is mounted at
  `/salons/:salonId/staff/:id/schedules` with `Router({ mergeParams: true })`
  and has two routes, `GET /` and `PUT /`; its handlers read `salonId` and
  `id` from the path. A schedule has no ID of its own.
- **A replacement, not a partial update.** The body of the `PUT` is the
  array of all entries (`StaffScheduleUpdateRequest`), and what is not in
  it is gone; an empty array leaves no schedule. The model of an entry
  (`StaffSchedule`) is the same in the request and in the response, so what
  a `GET` returned can be sent back.
- **A permission in two steps.** The use case first decides from the salon
  of the path (`mayPlanSchedules`: an administrator, the owner or a manager
  of that salon; `mayReadSchedules` adds its staff). Then it reads the ID
  of the staff member, and for a read asks whose schedule it is
  (`mayReadScheduleOf`: a staff member reads their own). Both refusals are
  403 and come before the query, the body and any lookup, so a staff member
  learns nothing about a colleague's ID.
- **Rules of an entry and rules between entries.** The schema checks each
  entry by itself (weekly or for a single date, working day or day off,
  the order of the four times), then that no day of the week and no date
  comes twice. The issues of an entry carry `continue: true`, so one answer
  reports both kinds. The CHECK constraints and the two partial unique
  indexes of `staff_schedules` keep the same rules for whatever writes
  rows.
- **One transaction that locks the staff member.** `replace` selects the
  row of the staff member `FOR UPDATE` (of this salon, not deleted), deletes
  the rows of the schedule, inserts the new ones and reads them back in the
  order of the list. Two replacements that arrive at the same moment are
  carried out one after the other, so the rows of two requests never mix,
  and a replacement that meets a delete of the staff member is done before
  it or answered with 404.
- **One order, decided by the repository.** Weekly entries from Monday to
  Sunday (the order of the enum values of `dayOfWeek`), then the entries for
  single dates, oldest first. The response of the `PUT` has it too, not the
  order of the request.
- **Which entry applies to a date is a pure function.** With `?date=` the
  use case reads the whole schedule and hands it to `scheduleOn`
  (`_shared/applicable-schedule.ts`): the entry of that date, or else the
  weekly entry of its day of the week, or nothing. The booking domain will
  ask the same question with the same function.
- **A query the use case reads.** The handler passes `req.query` as it is;
  the schema is strict and has one property, so nothing needs decoding,
  and a query that is refused is refused after the permission.

The rules are in [Staff Ledger](./staff.md#勤務スケジュール) (Japanese).

### A Staff Invitation Request

The invitations of the staff (`business-logic/staff-invitation/`) give a
staff member of the ledger a login account. A request of whoever invites
takes the path of a staff schedule request, and a request of whoever was
invited the path of a password reset. These are the differences:

- **One record below a record.** The router of the salon is mounted at
  `/salons/:salonId/staff/:id/invitation` with `Router({ mergeParams: true })`
  and has three routes, `GET /`, `POST /` and `DELETE /`. A staff member
  holds at most one invitation (the unique constraint
  `staff_invitations_staff_unique`), so no route names an invitation ID, and
  a `POST` replaces the invitation the staff member holds.
- **Two routers, because there are two kinds of callers.** Whoever was
  invited has no account yet, or has one that reaches no salon.
  `createStaffInvitationAcceptanceRouter` is mounted at
  `/auth/staff-invitation` and has three routes, `POST /verify`,
  `POST /accept` and `POST /join`, which are operations of `AuthCrud` in the
  contract. The first two are not wrapped with `authenticated`; the third
  is, because it links the account of whoever is signed in. All three take
  the mailed token in the body, and every response carries
  `Cache-Control: no-store` (`shared/never-stored.ts`).
- **A permission that needs the body.** The use case first decides from the
  salon of the path (`mayInviteStaff`: whoever keeps the staff ledger, an
  administrator or the owner of that salon). The create then validates the
  body and asks `mayGiveRole`: only an administrator gives the role of an
  owner. Both refusals are 403, and the second one comes before the salon
  and the staff member are looked up.
- **A request that does not name the address.** The body of the create has
  the role only. The mail goes to the address the ledger has for the staff
  member, which the repository reads in the transaction that stores the
  invitation, and the answer is the same whether or not that address has an
  account: whoever may invite could otherwise ask that of any address.
- **A mailed token.** The token is made and checked like that of a password
  reset (`business-logic/auth/_shared/mailed-token.ts`, `STAFF_INVITATION`):
  random, only its hash stored (`staff_invitations.tokenHash`), single use,
  valid for 7 days, and no second mail within 60 seconds of the invitation
  the staff member holds (409).
- **Outcomes as sum types.** The repository does not answer with a row or
  `null`: `issue` resolves to `issued` | `staffNotFound` | `linked` |
  `inactive` | `mailedMomentsAgo`, `findUsable` to `usable` | `unusable` |
  `accountExists` | `accountMayJoin`, and so on
  (`domain/src/repositories/staff-invitation.repository.ts`). The use case
  matches each with `.exhaustive()` and names the refusal
  (`_shared/refusals.ts`).
- **One answer for a token that does not work.** A token that is unknown,
  has ended, was used or taken back, or whose staff member is inactive,
  deleted, linked to an account or has another address by now, gets the
  same 400 (`invitationRefused`). An invitation is usable exactly while it
  could be issued, and one query says so (`usableInvitation` in
  `infrastructure/src/repositories/staff-invitation.repository.impl.ts`).
- **Writes that lock the staff member.** `issue`, `revoke`, `accept` and
  `join` select the row of the staff member `FOR UPDATE` first, as the update and
  the delete of the ledger do, and then read again what they decide from.
  Of an acceptance and a taking back that arrive together, exactly one
  succeeds.
- **An account created by one statement.** `accept` inserts the user with
  `ON CONFLICT (email) WHERE "deletedAt" is null DO UPDATE … WHERE`: an
  address without an account gets one, a registration that never confirmed
  the address (and has no customer and no staff member) becomes the account,
  and any other account stays as it is, which the use case answers with 409.
  The same transaction deletes the sessions of an account it took over,
  writes `staff.userId` and deletes the invitation. A registration that
  arrives at the same moment cannot overwrite the account.
- **The order of the acceptance.** Body (400), token (400), an account at
  the address (409), the password against the blocklist (400), and only then
  the hash of the password and the write, which looks at the token and the
  address once more.
- **An account that joins.** `verify` answers with one link, the route that
  takes the token next: `accept` when the address has no account, `join`
  when it has one with the role of an owner, a manager or staff that reaches
  no salon (`isWithoutSalon` in `business-logic/auth/_shared/actor.ts`, the
  condition of the scope `none`), and 409 for any other account. `join`
  needs both the mailed token and a session of that account, so the token
  never stands in for a password. The use case refuses a customer and an
  administrator (403), validates the body (400) and refuses an account that
  reaches a salon (409). The repository decides the rest once it holds its
  locks: the staff member joined and the one the account leaves, in the
  order of their IDs, and then the user. It resolves to `joined` |
  `unusable` | `otherAddress` | `accountNotFree`. A joining sets
  `users.staffId`, the role of the invitation and `staff.userId`, clears
  `userId` of the staff member the account left unless that one is deleted,
  and deletes the invitation. The password and the sessions stay.

The rules are in [Staff Ledger](./staff.md#スタッフのログインアカウント), who may invite in
[Authentication and Authorization](./authentication.md) (both Japanese).

### A Staff Account Request

The accounts of the staff (`business-logic/staff-account/`) are what a salon
does with the account of a staff member once it is linked: read it, change
its role, unlink it. A request takes the path of a request of whoever
invites. These are the differences:

- **No table of its own.** The account is the row of `users` that names the
  staff member in `staffId` and is not deleted. The router is mounted at
  `/salons/:salonId/staff/:id/account` and has three routes, `GET /`,
  `PATCH /` and `DELETE /`; a staff member has at most one account (the
  unique index `users_staff_unique`), so no route names a user ID. The
  repository selects eight columns (`accountColumns`) and the mapper names
  each, so nothing that authenticates reaches a response.
- **An enum that is narrower than its column.** `role` of the response and
  of the update request is `SalonRoleType` (owner, manager, staff), and the
  column is `user_role`, which has customer and admin as well. A check
  constraint (`users_staff_needs_salon_role`) keeps the role of a user that
  names a staff member to those three, and the rules of the two models say
  so to `pnpm check:api-db` (`narrowed`).
- **Two permissions, and a rule about the actor.** `mayKeepStaffAccounts`
  decides from the salon of the path. The update then validates the body and
  asks `mayGiveRole` (403), as the invitation does. After that, nobody
  changes the role of their own account or unlinks it (`isOwnStaffRecord`,
  409). All of it comes before the salon and the staff member are looked up.
- **Outcomes as sum types.** `findByStaff` resolves to `found` |
  `staffNotFound` | `none`, `update` to `updated` | `staffNotFound` |
  `none`, `unlink` to `unlinked` | `staffNotFound` | `none`
  (`domain/src/repositories/staff-account.repository.ts`): a staff member
  the salon does not have and a staff member without an account are
  different 404s.
- **Writes that lock the staff member.** The update and the unlinking select
  the row of the staff member `FOR UPDATE` first, as the invitations do. The
  unlinking sets `users.staffId` and `staff.userId` to null in that
  transaction.
- **Nothing is revoked.** The scope of an actor is derived on every request,
  so a new role and an unlinking take effect with the next request of the
  account, with the access token it has.

The rules are in [Staff Ledger](./staff.md#紐づいたアカウントの管理) (Japanese).

### A Staff Profile Request

The staff profiles (`business-logic/staff-profile/`) show customers a part
of the same rows, and anyone may read them. A request is a public read,
like the list and the get of a salon, with these differences:

- **A model of its own, not the ledger's.** `StaffProfileResponse` has the
  11 properties customers are shown. The repository selects those columns
  and no other (`profileColumns` in
  `infrastructure/src/repositories/staff-profile.repository.impl.ts`), so
  pay and contact details never leave the database for this route, and
  `StaffProfileReadMapper` names each property.
- **A read mapper that returns a plain value.** None of the 11 columns
  needs converting (no timestamp, no `numeric`), so nothing can fail and
  the mapper returns the response, not a `Result`.
- **Who is shown is decided in one place.** The repository joins the salon
  and keeps the staff members who are active and not deleted, of salons
  that are not deleted (`shown` in the same file). The get answers any
  other with `notFound`, like an ID that no staff member has.
- **A flat route with filters.** The profiles are not below a salon,
  because customers look for staff across salons: `salonId`, `specialty`
  (an element of `specialties`, compared exactly) and `city` (the city of
  the salon) narrow the list, and `total` counts what they leave.
- **A cursor that only says where.** The cursor names a staff member, and
  any row of `staff` will do: one who is not shown any more, or one the
  filters leave out, still has a place in the order. Only a cursor that
  names no staff member is refused (400).
- **A query the handler answers.** Nobody is refused, so the list handler
  answers a query it cannot decode itself and hands a decoded one to
  `ListStaffProfilesUseCase.execute(query)`.

The own profile (`GET` and `PATCH /api/v1/staff-profiles/me`) is the part
that needs a signed-in user, and the one request of the profiles that
writes:

- **The account says whose profile.** The route names no ID. The two
  handlers are wrapped with `authenticated`, and `ownProfileOf(actor)`
  (`business-logic/staff-profile/_shared/own-profile.ts`) turns the scope
  of the actor into the staff member the account belongs to. Everyone
  whose scope is not `salon` is refused (403) before the body is read.
  `/me` is registered before `/:id`, which would take it for an ID
  otherwise.
- **A request picked from the ledger's.** `staffProfileUpdateRequestSchema`
  picks the five properties that describe the staff member from the
  schema of the ledger, so their rules are the same. Any other property,
  the display name included, is an unknown one (400).
- **One statement that writes only who is shown.** The repository updates
  the row with the condition of `shown` in the same statement
  (`UPDATE … FROM salons`) and returns the profile columns. A staff
  member who stopped being shown after the actor was authenticated
  matches no row: nothing is written and the use case answers `notFound`.

The rules are in [Staff Ledger](./staff.md#顧客に見せるプロフィール) (Japanese).

### A Booking Request

The booking ledger is a salon's and is not public, but the path of a request
names no salon (`/api/v1/bookings`, `business-logic/booking/`). What differs
from a request below a salon:

- **The permission in two steps.** `bookingReachOf`
  (`_shared/authorization.ts`) decides from the actor alone, before the
  request is read, which bookings the actor reaches: those of every salon
  (an administrator), those of one salon (its owner, managers and staff) or
  none (a customer account, an account without a scope: 403). Which salon
  the request is about is known later. A create reads it from the body and
  a list from the query, and `isWithin` then refuses a salon outside the
  reach (403). A get has no salon to compare: the repository takes the
  reach as a condition of the query (`findById(id, reach)`), so the booking
  of another salon is not found (404). The list takes the reach the same
  way, also for the booking a cursor names.
- **A request that states little.** A create request says whom the booking
  is for and which services begin when. `planBooking` (`_shared/plan.ts`),
  a pure function, works out the rows: the end, the duration and the
  amounts of a line from its service, the span and the sums of the booking
  from its lines, the tax that is added once for the booking, and
  `bookingDate` from the start in the time zone of the salon (`inTimeZone`
  in `schemas/rules.ts`). Its result is a sum type: the rows to write and
  whom they occupy when, the issues of references that are not there, or a
  salon whose time zone is not known.
- **One transaction that locks what it reads.** `create` of the repository
  locks the salon, the customer and the services of the request
  `FOR SHARE` and the staff members it names `FOR UPDATE`, in the order of
  their IDs; calls `planBooking` with those rows; reads the lines that
  other bookings have for each staff member around the wanted times and
  asks `isOccupiedBeyondCapacity` (`_shared/occupancy.ts`); and inserts the
  booking, its lines and the first row of `booking_status_histories`. The
  bookings of one staff member are therefore written one after the other.
  The transaction states `READ COMMITTED`, the level at which a statement
  that waited for a lock sees what was committed meanwhile; with one
  snapshot for the whole transaction, two requests for the same staff
  member and time would both be written.
- **A number from outside.** The use case asks `IBookingNumberIssuer` for a
  number and hands it to the repository, which inserts with
  `ON CONFLICT DO NOTHING` on the unique constraint of the number and
  answers `bookingNumberTaken` when no row was written. The use case then
  tries another number, three times in all.
- **Refusals as values.** What became of a create is the sum type
  `BookingCreation`; `toRefusalError` (`_shared/refusals.ts`) turns a
  refusal into the error a client gets: a validation error that names the
  properties (400), or a conflict for a time zone that is not known and for
  staff members who are occupied (409).
- **A status that is changed where it is read.** The five actions on the
  status share one path (`_shared/change-status.ts`): the reach of the
  actor, the ID, the request of the action, then `changeStatus` of the
  repository. It locks the booking `FOR UPDATE` and reads its status, its
  times and the clock of the database at the moment the booking is held
  (`clock_timestamp()` of the row a subquery locks, not `now()`, which is
  the moment the transaction began) in that one statement, and hands
  them to `planStatusChange` (`_shared/status.ts`), a pure function that
  holds the transitions and says what to write or why not
  (`StatusChangeRefusal`: the status does not allow the action, the
  booking has not begun, the actual times are out of order). The booking,
  its lines when it is completed, and a row of the status history are
  written in the same transaction; when the booking arrives at
  `completed`, `cancelled` or `no_show`, the customer is locked and their
  visits, cancellations and no-shows are counted again from their
  bookings. Two actions on one booking therefore run one after the other,
  and the second meets the status the first one left.
- **Every other writer holds the booking first.** `update`, `reschedule`
  and `delete` of the repository begin as `changeStatus` does: they lock
  the booking `FOR UPDATE` within the reach of the actor, so the booking of
  another salon is not found and the changes of one booking run one after
  the other. What they write as the time of the change is
  `clock_timestamp()` in a statement after the one that locks. `update`
  writes the properties the request names (`DbBookingNotes`) and nothing
  else. `reschedule` hands the booking and its lines to `moveBooking`
  (`_shared/reschedule.ts`), a pure function that refuses a status from
  which a booking is not moved and otherwise shifts the booking and every
  line by as much and hands the lines of the staff member who was in charge
  to the new one; it then locks the salon `FOR SHARE` and the staff members
  of the moved lines `FOR UPDATE` in the order of their IDs, has
  `planReschedule` tell the day of the visit and whom the booking occupies
  when, and asks `isOccupiedBeyondCapacity` as the create does, leaving out
  the lines the booking had before. `delete` looks for a sale, a treatment
  record and a review that refer to the booking and answers `referredTo`
  (409) when there is one; otherwise it deletes the row, with which the
  lines and the status history go by their foreign keys, and
  counts the customer again when the status of the booking was one that is
  counted. A delete has a reach of its own, `bookingRemovalReachOf`: the
  staff of a salon reach no booking to remove (403).
- **What a booking that is not finished refers to is not deleted.** The
  deletes of a customer, a staff member, a service and a salon are each one
  `READ COMMITTED` transaction that locks the row it deletes `FOR UPDATE`
  and, in the next statement, looks for a booking that refers to the row
  and is `draft`, `pending`, `confirmed` or `in_progress`
  (`UNFINISHED_STATUSES`, the statuses an action leads on from;
  `repositories/unfinished-bookings.ts`). If there is one, nothing is
  written and the repository answers `bookingsUnfinished` (409). A create
  and a reschedule hold the rows they refer to until they have written, so
  the delete waits for them and then reads their booking, and a create or
  a reschedule that comes later finds the row deleted (400). The delete
  reads the bookings and never locks them: whoever writes a booking locks
  it before what it refers to.
- **A customer books a slot, not a row.** A customer's own bookings
  (`/api/v1/customers/me/bookings`, `business-logic/customer-booking/`,
  `routes/customer-booking/`) are rows of the same ledger behind a reach of
  another kind: `BookingReach` is a `LedgerReach` (every salon, or one) or a
  `CustomerReach` (the bookings of one customer), and the methods that only
  the ledger has take a `LedgerReach`. `ownBookingsOf` decides from the
  actor who has such bookings: a customer account with a profile. `book` of
  the repository locks the salon, the customer, the service and the staff
  member in the order of the create, reads what a slot depends on after the
  locks, and lets the pure `planCustomerBooking` decide with the `slotsOf`
  of the list of available slots, so a customer books what that list offers
  and nothing else; the rows are those `planBooking` makes. The cancel of a
  customer is the action `cancelAsCustomer` of `planStatusChange`, refused
  from the moment the booking begins. A customer moves a booking with
  `rebook`, which holds the booking first and then locks and reads as
  `book` does, without counting the booking itself; `moveCustomerBooking`
  and `planCustomerMove` are the move of the ledger held to the slots of
  the list, and a confirmed booking is pending again.
  `CustomerBookingReadMapper` names every property a customer is shown.

The rules are in [Booking Ledger](./bookings.md) (Japanese).

### A Sale Request

The sales ledger (`/api/v1/sales`, `business-logic/sale/`) takes the path of
a booking request: the reach of the actor first (`saleReachOf`, which
answers with the `LedgerReach` of the bookings), `isWithin` once the request
names a salon, and the reach as a condition of the queries of the get, of
the list, of the update, of the void and of the receipt. What differs:

- **A request that states the amounts.** A sale is what the till charged, so
  a create request carries the unit price, the discount, the tax and the
  total of every line. The schema (`schemas/sale.schema.ts`) checks that a
  line agrees with itself, as bigints, and reports what is wrong with a line
  as an issue the checks after it still run on, so a request learns of
  everything at once. `planSale` (`_shared/plan.ts`), a pure function, checks
  what the request refers to, sums the sale up from its lines and takes
  `saleDate` from the time zone of the salon. Its result is a sum type: the
  rows to write, the issues of references that are not there, a salon whose
  time zone is not known, or a booking that is billed. No price of a
  service or a product, no tax rate and no commission is compared with the
  request.
- **Locks in the order of every writer.** `create` of the repository holds
  the booking of the sale `FOR UPDATE` and looks, in a statement of its own,
  for a sale of that booking that is not void: the sales of one booking are
  written one after the other. It then locks the salon, the customer and
  the staff members `FOR KEY SHARE`, the staff members in the order of their
  IDs. That is the lock the foreign keys of the insert take anyway; taken
  first, it is taken in the order in which a booking locks its rows, so a
  sale and a booking that name the same staff members do not wait for each
  other for ever. The services and the products of the lines are read
  without a lock, because a line has no foreign key to them and keeps the
  name and the amounts of the request.
- **Reads of one moment.** A sale is returned with its payments. The get and
  the list read both in a read-only transaction with one snapshot
  (`REPEATABLE READ`), so a sale is never returned with a payment that
  arrived between two statements.
- **One sale for a booking, twice.** The transaction refuses a second sale
  of a booking (409), and a partial unique index (`sales_booking_live_unique`)
  says the same of the table.
- **A change holds the sale first.** `update` and `voidSale` of the
  repository lock the row of the sale `FOR UPDATE` within the reach of the
  actor, so the changes of one sale run one after the other and each meets
  what the one before it left. The foreign key of a payment does not get
  past that lock: a void waits for a payment that is being written and
  then counts it (`refusalOfVoid`: a payment that is `completed` or
  `partial_refund` stands in the way, 409). An update looks up and locks
  only what the request names, in the order of the create, and
  `planSaleChange` (`_shared/change.ts`) holds the sale as it is afterwards
  to the rules of a create: no points without a customer, the booking of
  the customer of the sale, one sale for a booking with the sale itself
  not counted. New lines replace all the lines, and only while the
  payment status is `pending`; `saleDate` is taken again only with a new
  `saleTime`; a void sale is not changed. The order of the locks is sale,
  booking, salon, customer, service, staff, payment method: nothing that
  holds one of the later rows goes on to hold a sale. The void is not for the staff of the
  salon (`saleVoidReachOf`).
- **What is made and not stored.** A receipt (`GetSaleReceiptUseCase`) is
  made from the sale that the get returns, under its sale number, at the
  time of the clock the router is given; `refusalOfReceipt`
  (`_shared/receipt.ts`) refuses a void sale and a sale that did not
  receive its total (409). A calculation (`CalculateSaleUseCase`) reads the
  salon, the lines of the booking, the services and the payment methods in
  one read-only transaction (`findCalculationReferences`), and
  `planCalculation` (`_shared/calculation.ts`), a pure function, reports
  what is not of the salon (400) and sums the lines up with `amountsOf`
  (`business-logic/_shared/amounts.ts`), the function that sums a booking
  up, so the tax of the salon is added once to the sum. Neither writes
  anything or waits for a lock.

The rules are in [Sales Ledger](./sales.md) (Japanese).

### A Payment Method Request

The payment methods of a salon (`/api/v1/salons/{salonId}/payment-methods`,
`business-logic/payment-method/`) take the path of a request below a salon,
as the staff ledger does: the salon of the path is parsed, the permission is
decided from that salon alone, the ID, the query or the body is looked at,
`requireSalon` answers 404 for a salon that is not there, and every query
of the repository names the salon. What differs:

- **Two permissions.** `mayReadPaymentMethods` lets an administrator and
  the owner, the managers and the staff of the salon list and get;
  `mayKeepPaymentMethods` lets an administrator, the owner and the managers
  create, update and delete (`_shared/authorization.ts`). A customer
  account has neither.
- **A rule of two properties, checked where the row is held.** The lower
  limit of the amount is not above the upper one. A request that names
  both limits is refused by the schema (`limitsInOrder`). An update that
  names one of them cannot be judged by itself, so `update` of the
  repository holds the row `FOR UPDATE` in a `READ COMMITTED` transaction,
  applies `limitsAfter` and `limitsAreInOrder` (`_shared/limits.ts`, pure
  functions) to the limits as they would be afterwards, and answers
  `limitsOutOfOrder` instead of writing. The use case reports it as a
  broken rule of the limit the request names (400). Two updates that
  arrive together, one of each limit, are written one after the other, and
  the second is checked against what the first wrote.
- **A column that is written once, and one that is never served.**
  `method` is in the create request and in no update request; the schemas
  are strict, so an update that names it is refused (400).
  `processorConfig` is in no model: no request can state it, and the read
  mapper names every property of a response.
- **A delete that looks for payments.** `delete` holds the row `FOR UPDATE`,
  which is the lock the foreign key of a payment waits for, looks for a
  row of `payment_transactions` in the statement after it and answers
  `inUse` (409) or deletes the row. A payment that was being written with
  the payment method has been written, or has not, by the time the delete
  looks. The writers hold the row of the payment method and no other row.

The rules are in [Payments](./payments.md) (Japanese).

### A Product Request

The products of a salon (`/api/v1/salons/{salonId}/products`,
`business-logic/product/`) take the path of a request below a salon, as the
payment methods do, with a permission to read (`mayReadProducts`: an
administrator, the owner, the managers and the staff of the salon) and one
to keep (`mayKeepProducts`: an administrator, the owner and the managers),
both decided from the salon of the path alone. What differs:

- **A rule of three properties.** `minimumStock`, `reorderPoint` and
  `maximumStock` lie in that order among those that are set. The pure
  functions of `_shared/stock-levels.ts` find the pairs out of order
  (`brokenOrders`) and say under which property each is reported
  (`stockLevelIssues`): the upper level of the pair, or the one level of it
  that the request names. The schema checks the levels a request names;
  `update` of the repository holds the row `FOR UPDATE` in a
  `READ COMMITTED` transaction, applies the change to the stored levels
  (`stockLevelsAfter`) and answers `stockLevelsOutOfOrder` instead of
  writing.
- **A code that is unique among the rows that are not deleted.** A partial
  unique index (`products_code_salon_unique`) keeps the product code of a
  salon unique, so the code of a deleted product can be given again. The
  repository turns its violation into `alreadyExists` (409), also when two
  requests write one code at the same moment.
- **A delete that marks the row and looks for stock.** `delete` holds the
  row `FOR UPDATE`, which is the lock the foreign key of a row of
  `inventory` waits for, looks for such a row in the statement after it and
  answers `inStock` (409) or writes `deletedAt` and `updatedAt`. A deleted
  product is found by no operation.

The rules are in [Products](./products.md) (Japanese).

### A Stock Request

The stock rows of a salon (`/api/v1/inventory`, `business-logic/inventory/`)
are not served below a salon, as the sales are not, and are reached in the
same two steps: the actor alone decides which salons they read
(`inventoryReachOf`: an administrator every salon, the owner, the managers
and the staff their salon) and keep (`inventoryKeeperReachOf`: an
administrator, the owner and the managers), and `isWithin` then compares
the `salonId` of the body or of the query. What differs from the products:

- **A rule that another table decides.** A product kept by lots
  (`requiresLotTracking`) names the lot of each of its rows, and a product
  that is not names none. The pure function `lotNumberRefusal` of
  `_shared/lots.ts` says why a lot does not fit; the repository applies it
  with the product held `FOR KEY SHARE`, which waits for a change or a
  delete of the product and is waited for by them, and answers
  `lotNumberRefused` instead of writing.
- **A uniqueness that counts a missing value.** The salon, the product and
  the lot of a row are unique, and a product that is not kept by lots has
  one row: `inventory_unique` keeps the rows with a lot, and the partial
  unique index `inventory_unique_without_lot` those without one. Both are
  `alreadyExists` (409).
- **Figures that only a ledger writes.** A row is created with no stock,
  and only a stock movement, a stock count and the receipt of a purchase
  order, which record each difference and each arrival as a movement,
  move it. For a movement, the repository
  holds the row
  `FOR UPDATE`, refuses a stock below what is reserved or above
  99,999,999.99 (409), moves the row and records the movement with the
  balances before and after, so the stock of a row is the balance after
  its latest movement. Who records a movement depends on its kind, so the
  reach is decided once more after the body is read (`movementReachOf`).
  A delete holds the row `FOR UPDATE`, answers `inStock` (409) while it
  counts stock, and removes it.
- **Many rows at one moment.** A stock count holds the rows it names
  `FOR UPDATE` in the order of their IDs, so two counts that share rows
  never wait for each other, refuses the whole count for a row that is not
  of the salon or for a count below what is reserved, and writes every
  row and every adjustment at the `statement_timestamp()` of its update,
  once every row is held.
- **A day of the salon.** What expires soon is counted from today at the
  salon: `lastExpiringDayOf` of `_shared/expiry.ts` works it out from the
  `clock` of the dependencies and the salon's time zone.

The rules are in [Inventory](./inventory.md) (Japanese).

### A Purchase Order Request

The purchase orders of a salon (`/api/v1/purchase-orders`,
`business-logic/purchase-order/`) are reached as the stock is: the actor
alone decides which salons they order for (`purchaseOrderReachOf`, the
readers of the stock) and approve and cancel for
(`purchaseOrderApproverReachOf`, the keepers of the stock), and `isWithin`
then compares the `salonId` of the body or of the query. What differs:

- **Items that copy another domain.** An item names a stock row of the
  salon; the repository holds the rows and their products `FOR KEY SHARE`
  and copies the code, the name and the unit of each product into its
  item, so an order says what was ordered after the product changes. A
  row that is removed leaves the item without it (`ON DELETE SET NULL`).
- **Amounts the server works out.** An item comes to its quantity times
  its unit price, rounded half up, worked out exactly as a `bigint`
  (`_shared/amounts.ts`); the schema refuses an item or an order that
  comes to more than an `integer` holds, and CHECK constraints hold the
  same sums in the database.
- **A status that moves one step at a time.** The pure functions of
  `_shared/status.ts` say why an update, an approval or a cancellation is
  refused from where an order stands; the repository applies them to the
  order held `FOR UPDATE`, so two changes of one order take turns, and
  answers the refusal (409) instead of writing. An approval and a
  cancellation are timed at the `statement_timestamp()` of the change.
- **A receipt that moves the stock.** A receipt takes an ordered or
  shipped order: the repository holds the order `FOR UPDATE`, plans a
  `purchase` movement of each item named at the unit price of the item
  (`_shared/goods-receipt.ts`), holds the stock rows `FOR UPDATE` in the
  order of their IDs, refuses a row that would go above 99,999,999.99
  (409), and delivers the order, moves the rows and records the
  movements at one moment. The items it does not name are not received.
- **Suggestions worked out in the database.** The reorder suggestions sum
  the stock of each product of the salon over its rows and what the open
  orders bring of it, in one read-only snapshot, and list each active
  product that comes to its reorder point or less, with the quantity up
  to its maximum.
- **A number of its own.** The order number is `PO-XXXX-XXXX` from the
  CSPRNG, unique across the salons, and the create is tried again under
  another number when the one it drew is taken.

The rules are in [Purchase Orders](./purchase-orders.md) (Japanese).

### A Payment Request

Recording a payment of a sale (`POST /api/v1/sales/{id}/process`) and
refunding one (`POST /api/v1/payments/{id}/refund`), both in
`business-logic/payment/`, take the path of a sale: the reach of the actor
is decided first (`saleReachOf`, or `saleVoidReachOf` for a refund, which
is not the staff's), then the ID and the body are looked at, and the
repository looks the sale up within the reach. What differs:

- **No payment processor.** A payment is the record of money the till took,
  so it is written as `completed`, and the columns of a processor and of a
  failure stay null. A refund writes `refunded` or `partial_refund` with
  the time, the amount and the reason, once per payment.
- **A value of the sale that is counted from the rows below it.** The
  payment status of a sale is never stated: `paymentStatusOf`
  (`_shared/plan.ts`) counts it from the payments of the sale, what was
  received and what was given back, and the transaction that writes a
  payment or a refund writes it as well. `refusalOfPayment`, `planPayment`
  and `planRefund` decide from the same rows what is refused (409 for the
  sale or the payment, 400 for the request) and what is written.
- **The sale is held first.** `record` and `refund` of the repository hold
  the row of the sale `FOR UPDATE` (`heldSaleOf` in
  `repositories/held-sale.ts`, which the update and the void of a sale use
  too) and read its payments in the statement after it, so the payments of
  one sale are written one after the other and never receive more than the
  sale charges. A payment then reads its payment method `FOR SHARE`:
  payments by one payment method do not wait for one another, and a change
  or the removal of the payment method and a payment wait for each other.
  A refund reads the sale of the payment without a lock, holds the sale and
  reads the payment again.
- **A number issued by the system.** The payment number (`PT-XXXX-XXXX`) is
  issued like a sale number and tried again when it is taken.

The rules are in [Payments](./payments.md) (Japanese).

### A Sales Report Request

The five reports of the sales of a salon (`/api/v1/sales-reports`,
`business-logic/sales-report/`) are `GET`s whose query names the salon, as
the list of the sales ledger does: the reach of the actor is decided first
(`salesReportReachOf`), then the query is parsed, the salon of the query is
compared with the reach (403), and the repository answers null for a salon
that is not there, which the use case reports as a broken rule of the
query (400). What differs:

- **A reach of its own.** The reports show what the whole salon earned and
  what each staff member brought in, so they are for an administrator and
  the owner and the managers of the salon. The staff, who keep the sales
  ledger, are refused (403).
- **Counted at every request, stored nowhere.** `findFigures` reads the
  sums of the sales of the period that are not void (by day, by kind of
  payment method, by kind of category, by staff member) in one read-only
  `REPEATABLE READ` transaction without a lock, so every sum is of the same
  sales and nothing waits for a writer. `reportOf`, `dailyOf`,
  `staffRowsOf`, `categoryRowsOf` and `trendsOf` (`_shared/report.ts`) are
  pure functions that add the sums up, divide them and put them in order;
  the days, the weeks beginning on a Monday and the months are counted in
  UTC by `_shared/calendar.ts`, whatever the time zone of the server. The
  summary tables (`daily_summaries`, `staff_performances`) are not read:
  every change of a sale or a payment would have to change them too.
- **A bounded period.** The query has no default; the period is in order
  and at most 366 days long (`salesReportGetRequestSchema`), which bounds
  what one request reads.

The rules are in [Sales Reports](./sales-reports.md) (Japanese).

### A Points Request

Earning, using and adjusting points (`POST /api/v1/points/earn`, `/use`,
`/adjust`, `business-logic/point/`) take the path of a write, with the
customer named in the body: the reach of the actor is decided first
(`pointReachOf`, or `pointAdjustReachOf` for an adjustment, which leaves
out the staff), then the body is parsed, and the repository records the
movement. What differs:

- **A ledger of the whole platform.** Points are a customer's, so any
  member of a salon reaches every customer; what the reach limits is the
  sales and the bookings a movement may name. A record outside it is, to
  that actor, a record that is not there (400).
- **A plan from what is held.** `PointRepository.record` holds the sale or
  the booking the movement names `FOR SHARE`, then the customer
  `FOR NO KEY UPDATE`, in one `READ COMMITTED` transaction, and hands what
  it read to `planPoints` (`_shared/plan.ts`), a pure function that answers
  the row to write or why there is none: the record is not the customer's,
  a void sale or a closed booking, a record earned on or used for already,
  a balance below 0 or above 2,147,483,647. The movements of one customer
  are written one after the other, each from the balance the one before
  left, and a void of the sale or a change of the booking that is under
  way is waited for. The row and `loyaltyPoints` are written at
  `clock_timestamp()`, so the latest transaction is the one whose balance
  the customer has.
- **A backstop in the table.** A partial unique index allows one earning
  and one use per record; the CHECK constraints say what a row of each
  type can be. The migration that added them opened the ledger of every
  customer with an adjustment to the balance they had.

The balance is `loyaltyPoints`; the history is read in one read-only
`REPEATABLE READ` transaction, ordered by `createdAt` and `id`. The rules
are in [Points](./points.md) (Japanese).

### A Review Request

Writing a review (`POST /api/v1/reviews`, `business-logic/review/`) takes
the path of a write: the actor is decided first (`reviewerOf`: a customer
account with a profile, 403 for everyone else), then the body is parsed
and its `customerId` is held to that of the actor (403), and the
repository writes the review. What differs:

- **Public to read.** The list, the get and the two summaries are mounted
  without `authenticated`; no token is looked at. The reviews of a deleted
  salon are not listed and not found; those of deleted staff members and
  customers stay.
- **A plan from what is held.** `ReviewRepository.create` reads that the
  customer is not deleted, holds the booking `FOR SHARE` and its salon
  `FOR NO KEY UPDATE` in one `READ COMMITTED` transaction, and hands what
  it read to `planReview` (`_shared/plan.ts`), a pure function that answers
  the row to write or why there is none: the booking is not the
  customer's, the salon is not that of the booking or is deleted, the staff
  member did not take the booking or is deleted (400), the booking is not
  completed or has a review (409).
- **Counted in the same transaction.** The row is written at
  `clock_timestamp()`, and the `rating` and the `reviewCount` of the salon
  are counted again from its reviews before the transaction commits. The
  reviews of one salon are written one after the other, each counting the
  one before; a second review of a booking finds the first (409), and the
  unique constraint on `bookingId` says the same.
- **A change and a removal hold the review first.** `PATCH` and `DELETE`
  of `/api/v1/reviews/{id}` hold the review `FOR UPDATE` and then its
  salon `FOR NO KEY UPDATE`, and hand what they read to `planReviewChange`
  and `planReviewRemoval` (`_shared/change.ts`): the author alone changes
  a review, and the author or an administrator (`reviewRemoverOf`)
  removes it (403 otherwise; 404 for a review of a deleted salon). The
  salon is counted again in the same transaction and written only when a
  figure changes; the salon is the last row each write waits for, so they
  do not deadlock.
- **A mark holds the review alone.** `POST /api/v1/reviews/{id}/helpful`
  holds the review `FOR NO KEY UPDATE`, reads whether its salon is
  deleted without holding it, and hands what it read to `planHelpfulMark`
  (`_shared/helpful.ts`), which refuses the author (403). The mark is a
  row of `review_helpful_votes`, written once per customer (`ON CONFLICT
  DO NOTHING`), and the `helpfulCount` of the review is counted again
  from those rows by a later statement, which sees every mark the review
  waited for. A change and a removal of the review and a mark wait for
  each other; a mark waits for no write of the salon.
- **A report holds the review alone too.** `POST /api/v1/reviews/{id}/report`
  holds the review as a mark does and hands what it read to
  `planReviewReport` (`_shared/report.ts`): a customer reports the review
  of another customer, and the owner or a manager of a salon a review of
  their salon (403 otherwise). The report is a row of `review_reports`,
  written once per account (`ON CONFLICT DO NOTHING`; 409 when one was
  there), and the `reportCount` of the review, the number of its pending
  reports, is counted again by a later statement. The administrators'
  dismissal (`POST /api/v1/review-reports/{id}/dismiss`) holds the review
  of the report first too, so the reports of a review are written and
  counted one after the other.
- **A response holds the review alone too.** `POST /api/v1/reviews/{id}/respond`
  holds the review as a mark does and hands what it read to
  `planReviewResponse` (`_shared/response.ts`): the owner or a manager
  of a salon responds to a review of their salon, and an administrator
  takes a response down (`mayRespondWith`, before the review is read).
  The response and its time are written by a later statement only when
  the response differs from the stored one, so the responses to a review
  are written one after the other and the last one stays.

The summaries are counted at every request, the average rounded to two
decimals as the `rating` of the salon is. The rules are in
[Reviews](./reviews.md) (Japanese).

### An Authentication Request

The authentication operations take the same path through the layers. Every
response under `/api/v1/auth` and `/api/v1/admin/auth` carries
`Cache-Control: no-store`.

| Operation | Route | Access token | Use case | Success |
|-----------|-------|--------------|----------|---------|
| Login | `POST /api/v1/auth/login` | Not needed | `LoginUseCase` | 200 with a new access token and refresh token |
| Refresh | `POST /api/v1/auth/refresh` | Not needed; the body carries the refresh token | `RefreshSessionUseCase` | 200 with both tokens replaced |
| Logout | `POST /api/v1/auth/logout` | Needed | `LogoutUseCase` | 204 |
| Logout everywhere | `POST /api/v1/auth/logout-all` | Needed | `LogoutAllUseCase` | 204 |
| Current user | `GET /api/v1/auth/me` | Needed | `GetCurrentUserUseCase` | 200 |
| Register | `POST /api/v1/auth/register` | Not needed | `RegisterUseCase` | 204 |
| Send the verification mail again | `POST /api/v1/auth/verify-email/send` | Not needed | `SendEmailVerificationUseCase` | 204 |
| Confirm the email address | `POST /api/v1/auth/verify-email/confirm` | Not needed; the body carries the mailed token | `ConfirmEmailVerificationUseCase` | 204 |
| Request a password reset | `POST /api/v1/auth/forgot-password` | Not needed | `ForgotPasswordUseCase` | 204 |
| Check a reset token | `POST /api/v1/auth/reset-password/verify` | Not needed; the body carries the mailed token | `VerifyResetTokenUseCase` | 204 |
| Reset the password | `POST /api/v1/auth/reset-password` | Not needed; the body carries the mailed token | `ResetPasswordUseCase` | 204 |
| Change the password | `POST /api/v1/auth/change-password` | Needed | `ChangePasswordUseCase` | 204 |
| Read the invitation of a staff member | `POST /api/v1/auth/staff-invitation/verify` | Not needed; the body carries the mailed token | `VerifyStaffInvitationUseCase` | 200 with the invitation and the route that takes the token next |
| Accept the invitation of a staff member | `POST /api/v1/auth/staff-invitation/accept` | Not needed; the body carries the mailed token | `AcceptStaffInvitationUseCase` | 204; the account of the staff member exists |
| Join the invitation of a staff member | `POST /api/v1/auth/staff-invitation/join` | Needed, of the account the invitation was mailed to; the body carries the mailed token | `JoinStaffInvitationUseCase` | 204; the account is linked to the staff member |
| Start the set-up of two-factor authentication | `POST /api/v1/auth/2fa/enable` | Needed | `EnableTwoFactorUseCase` | 200 with the secret for the authenticator app and the backup codes |
| Confirm the set-up | `POST /api/v1/auth/2fa/verify` | Needed | `VerifyTwoFactorUseCase` | 204 |
| Disable two-factor authentication | `POST /api/v1/auth/2fa/disable` | Needed | `DisableTwoFactorUseCase` | 204 |
| Replace the backup codes | `POST /api/v1/auth/2fa/backup-codes` | Needed | `GenerateBackupCodesUseCase` | 200 with the new backup codes |
| List the sessions | `GET /api/v1/auth/sessions` | Needed | `ListSessionsUseCase` | 200, a page of the user's own sessions: `{ data, meta, links }` |
| Revoke a session | `DELETE /api/v1/auth/sessions/{sessionId}` | Needed | `RevokeSessionUseCase` | 204 |
| Read a user | `GET /api/v1/admin/auth/users/{userId}` | Needed, of an `admin` | `GetUserUseCase` | 200 |
| Unlock an account | `POST /api/v1/admin/auth/unlock/{userId}` | Needed, of an `admin` | `UnlockAccountUseCase` | 200 with the user |
| Reset the two-factor authentication of a user | `POST /api/v1/admin/auth/reset-two-factor/{userId}` | Needed, of an `admin` | `ResetTwoFactorUseCase` | 200 with the user |

The session list reads its query string the way the salon list does
(`decodeSessionSearchQuery` in `routes/auth/_shared/query.ts`), and both
lists build the links of a page with `pageLinks` (`shared/page-links.ts`).
The three administrator operations have a router of their own
(`routes/admin-auth/`), and their use cases start with the permission rule
`mayAdministerAccounts` (`business-logic/auth/_shared/authorization.ts`):
a signed-in user who is not an `admin` is answered with 403. The three
operations of the invitation of a staff member have a router of their own
as well (`routes/staff-invitation/`, mounted at
`/api/v1/auth/staff-invitation`), and their use cases are in
`business-logic/staff-invitation/`; see
[A Staff Invitation Request](#a-staff-invitation-request).

The use cases that send a mail hand it to `IMailer.deliver` and do not wait
for the delivery, so the response does not depend on it. Login asks an
account that has two-factor authentication enabled for a code as well
(`twoFactorCode` in the body) and answers 401 with the code `1007` until it
gets one it accepts. The use cases reach the one-time passwords through the
port `ITwoFactorAuthenticator`; its implementation `TotpAuthenticator` uses
`node:crypto` only (TOTP of RFC 6238) and returns each secret encrypted
(AES-256-GCM) under a key derived from `TWO_FACTOR_ENCRYPTION_KEY`, which is
the form the database keeps. How sessions, tokens, passwords, the lockout, registration,
the mailed tokens, two-factor authentication, the session list and the
administrator operations work is in
[Authentication and Authorization](./authentication.md); how the mails are
sent is in [Email](./email.md).

## Errors

Every error response is RFC 9457 problem details with the media type
`application/problem+json`, whatever raised it. `sendProblem` in `backend/packages/api/src/shared/responses.ts` is the only
place that sends one, and `toProblemDetails` in
`backend/packages/api/src/shared/problem-details.ts` maps each kind of error
to its status and code. The one exception is a probe that answers 503: it
returns the body the contract defines for it, not problem details.

| Kind | Raised by | Status |
|------|-----------|--------|
| `validation` | A use case, when the input breaks a rule of its Zod schema; an authentication use case, also for a rule the schema cannot check (a new password on the blocklist or equal to the current one, a current password that is wrong, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user); a service category use case, for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon; a service use case, for a service that would break a rule tying two of its properties together (a discounted price above the price, member services that do not fit `isPackage`), for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; a customer use case, for a birth date before 1900 or in the future, for a referrer that does not exist, is deleted or is the customer itself, and for a cursor that names no customer; a list handler, when a query parameter cannot be read as its type (the handler of the customer list hands that error to its use case, which returns it only to an actor who may list customers) | 400 |
| `unauthenticated` | `AuthenticateUseCase`, when the request carries no access token that works; the login and refresh use cases, when the credentials are not accepted, which for login includes a missing or refused code of two-factor authentication; the current-user, change-password and two-factor use cases, when the user of the session no longer exists | 401, with a `WWW-Authenticate: Bearer` header |
| `forbidden` | A use case, when the signed-in user may not do what is asked | 403 |
| `notFound` | A use case, when what the ID in the path names is not there: a salon or a user that does not exist or is deleted, a service category that does not exist or is not of the salon in the path, a service that does not exist, is deleted or is not of the salon in the path, a customer that does not exist or is deleted, the profile of a customer account that has none, a session that is not one of the signed-in user's own sessions that have not ended | 404 |
| `alreadyExists` | The repository, when a write violates a unique index or constraint: the `email` of a salon among the salons that are not deleted, the `email` of a customer among the customers that are not deleted, the `referralCode` of a customer among all customers | 409 |
| `conflict` | A two-factor use case or the use case of an administrator operation, when the state of the account does not allow the operation: enabling what is enabled, confirming when no set-up is under way, disabling, resetting or replacing backup codes when it is not enabled, unlocking an account that is not locked; the use case that deletes a service, when a package contains the service; the use case that creates a customer's profile, when the account has one, has not confirmed its email address, or the customer with its email address belongs to another account; the customer repository, when a customer with that email address is added to the ledger at the moment the profile is created | 409 |
| `database` | The repository, when a query fails; the read mapper, when a stored row does not match the API model | 500 |
| `routeNotFound` | `notFoundHandler` | 404 |
| `malformedBody`, `badRequest` | `errorHandler`, from what the body parser or Express raised | 400 |
| `unsupportedMediaType` | `requireJsonBody`, `errorHandler` | 415 |
| `bodyTooLarge` | `errorHandler` | 413 |
| `rateLimited` | `rateLimiting` | 429 |
| `unexpected` | `errorHandler`, for anything it does not recognize | 500 |

The first seven are the `DomainError` union
(`backend/packages/domain/src/shared/errors.ts`); the others are the
`HttpError` union of the API layer. `unauthenticated` carries a `reason`,
which decides the code of the problem (`1001` to `1004`, and `1007` when a
login still needs a code of two-factor authentication) and the challenge in
the header (`toBearerChallenge`); the table of them is in
[Authentication and Authorization](./authentication.md). A 500 response never
carries the cause.
The cause is logged instead: `sendProblem` logs a `database` error, and
`errorHandler` logs an unexpected one with its stack.

## Configuration, Logging and Probes

The [README](../README.md) describes these for whoever operates the server
(section "Operating the API Server", including the table of variables). This
is where each one lives in the code:

| Concern | Where | Notes |
|---------|-------|-------|
| Configuration | `backend/packages/config/src/app-config.ts` | `parseAppConfig` validates 22 variables, all required, and returns `Result<AppConfig, ConfigIssue[]>`. When `NODE_ENV` is `staging` or `production` it also refuses `SMTP_TLS=none` and a `PUBLIC_APP_URL` that does not start with `https://`. Application code receives values and does not read the environment. |
| Environment files | `backend/packages/config/src/env-loader.ts` | One file per environment at the repository root: `.env.localhost`, `.env.development`, `.env.test`, `.env.staging`, `.env.production`. `.env.template` and `.env.example` are templates, and `.env.test.ci` is what CI uses as `.env.test`. A deployment sets the variables directly and needs no file. |
| Logging | `backend/packages/infrastructure/src/logging/logger.ts`, `backend/packages/api/src/middleware/request-logging.ts` | Structured logs (pino) on standard output: one line per request, one line per failure. The line of a request that was authenticated carries the ID of the signed-in user as `userId`: `authenticated` notes it (`backend/packages/api/src/shared/signed-in-user.ts`) and the middleware puts it on the line when the request completes. The line of a request that was not authenticated has no `userId`. Headers, bodies and the values bound to a SQL statement are never logged, and so no token is. There is no `console` call in application code. |
| Request ID | `backend/packages/api/src/middleware/request-logging.ts` | The caller's `X-Request-Id` or a new UUID. It is on every log line of the request, in the response header, and in the body as `meta.correlationId` (`correlationId` in an error). |
| Mail | `backend/packages/domain/src/services/mailer.ts`, `backend/packages/infrastructure/src/mail/smtp-mailer.ts` | The use cases know the port `IMailer`; `SmtpMailer` (nodemailer) sends through the SMTP server of `config.mail`. `deliver` returns at once. A delivery is logged with the subject of the message, never its recipient or text, and a failed one is not retried. See [Email](./email.md). |
| Probes | `backend/packages/api/src/routes/system/index.ts` | `GET /api/system/alive` (the process answers), `GET /api/system/ready` (200 while the database answers, otherwise 503), `GET /api/system/health` (the same check with details). Not rate limited and not written to the request log. The SMTP server is not probed. |
| Shutdown | `backend/apps/server/src/server.ts` | See [Start-up](#start-up). |

What protects the API today: security headers, the origin allow-list, the
rate limit, the body size limit, strict validation that rejects unknown
properties, and bearer-token authentication with a permission check on the
operations that change a salon, its service categories or its services, on
every operation of the customer ledger, of a customer's own profile, of
the staff ledger of a salon, of the schedules, the invitations and the
accounts of its staff and of a staff member's own profile, and on the
administrator operations.
The system endpoints, the salon list, a
single salon, the service categories and the services of a salon, the list
and the get of the staff profiles and the authentication operations a
signed-out user needs
(register, login, refresh, email verification, password reset) are open to
anyone who can reach the server.
See [Authentication and Authorization](./authentication.md).

## Tests, CI and Images

| Command | What runs | Where the tests are |
|---------|-----------|---------------------|
| `pnpm test` | Unit tests (Vitest), no external services | Next to the code: in `__tests__` directories, or as `*.test.ts(x)` files beside the module |
| `pnpm test:integration` | Tests against a real PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a testcontainers container. The tests of the infrastructure package send mail to a real SMTP server instead: a Mailpit container they start through testcontainers | `backend/packages/api/src/__tests__` (the HTTP API through the production `createApp`, one database per test), `backend/apps/server/src/__tests__` (start-up and shutdown), `backend/packages/database/src/scripts/__tests__` (the migration runner), `backend/packages/infrastructure/src/mail/__tests__` (mail delivery) |

There is no separate end-to-end suite: the API integration tests drive the
production application over HTTP, and the server tests start the real server.
Requirements and patterns are in
[Testing Requirements](./testing-requirements.md) and the
[API Testing Guide](./api-testing-guide.md).

The workflows in `.github/workflows`:

- `ci.yml` runs on every pull request and on pushes to `main` and `develop`:
  the toolchain-version, generated-file, API–database and schema-file checks,
  lint, format check, build, type check, knip, the unit tests, the integration
  tests (once against an external PostgreSQL and once through
  testcontainers), a build for each environment, and a dependency audit. On a
  push to `main`, once the checks have passed, it calls `publish-images.yml`
  for staging. `make ci-check` runs the same checks locally, except
  `pnpm check:db-schema`, which recreates the database and therefore has a
  target of its own, `make db-check`. Locally the build is the production
  build only.
- `docker-validation.yml` runs on pull requests that touch the images' inputs.
  It builds every image and smoke-tests the containers. The backend container
  must become ready against a real database and exit with status 0 when
  stopped.
- `publish-images.yml` builds the images and pushes them to GitHub Container
  Registry, tagged for one environment: for staging when `ci.yml` calls it, or
  for the environment chosen in a manual run. The frontend images are built
  with the `VITE_*` values of that environment.

Nothing in the repository rolls an image out to a host or runs
`pnpm db:migrate` during a deployment. `Dockerfile.backend` builds the API
server image; `Dockerfile.frontend` builds one static-file image per
application, selected with the `APP` build argument. See
[Release Workflow](./release-workflow.md).

## Frontend

`frontend/apps` holds three Vite + React applications: `portal-app`,
`admin-app` and `dashboard-app` (ports 3001 to 3003 under `pnpm dev`). Each is
a shell so far. `frontend/packages` holds what they share (UI components,
theme, configuration, assets) and the API client that orval generates
into `frontend/packages/api-client`. The client and its fetch function
(`frontend/packages/io`) are tested, but no application imports the client yet.
Nothing in the frontend signs in, stores a token or sends an `Authorization`
header, and the pages that the links in the mails point at (`/verify-email`
and `/reset-password` under `PUBLIC_APP_URL`) do not exist yet.
See [Frontend API Integration](./frontend-api-integration.md).

## References

- [CLAUDE.md](../CLAUDE.md): rules, conventions, commands, the Salon reference
- [README](../README.md): setup, scripts, operating the server
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
- [Domain Implementation Reference](./domain-implementation-reference.md)
- [Authentication and Authorization](./authentication.md) (Japanese)
- [Service Menu](./service-menu.md) (Japanese)
- [Customer Ledger](./customers.md) (Japanese)
- [Staff Ledger](./staff.md) (Japanese)
- [Booking Ledger](./bookings.md) (Japanese)
- [Sales Ledger](./sales.md) (Japanese)
- [Payments](./payments.md) (Japanese)
- [Email](./email.md) (Japanese)
- [Type Generation System](./type-generation-system.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [DB-Driven Domain Model](./db-driven-domain-model.md)
- [API-DB Type Constraints Mapping](./api-db-type-constraints-mapping.md)
- [Testing Requirements](./testing-requirements.md)
- [Development Workflow](./development-workflow.md)
- [Release Workflow](./release-workflow.md)
