# Beauty Salon Reservation System

A modern, type-safe beauty salon reservation system built with TypeScript, TypeSpec API-First development, and Clean Architecture principles.

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Operating the API Server](#-operating-the-api-server)
- [Testing](#-testing)
- [Documentation](#-documentation)

## 🧱 Architecture

This project follows Clean Architecture principles with API-First development using TypeSpec for type generation.

### Core Principles

1. **API-First Development**: TypeSpec → OpenAPI → TypeScript types
2. **Clean Architecture**: Business logic isolated from infrastructure
3. **Type Safety**: Sum types and exhaustive pattern matching with ts-pattern
4. **Exception-Free**: Result types for error handling
5. **Testability**: Integration testing with testcontainers

### System Layers

```
┌─────────────────────────────────────────┐
│           API Layer (Express)           │ ← HTTP handlers, routing
├─────────────────────────────────────────┤
│      Use Case Layer (Business Logic)    │ ← Orchestration, workflows
├─────────────────────────────────────────┤
│        Domain Layer (Pure Logic)        │ ← Business rules, entities
├─────────────────────────────────────────┤
│   Infrastructure Layer (External I/O)   │ ← Database access, mail, logging
└─────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/architecture-overview.md](docs/architecture-overview.md).

### Implementation Status

| Area | Status |
|------|--------|
| Salon API (`/api/v1/salons`) | Implemented in every layer; the reference for the other domains. List and get are public; create, update and delete need a signed-in user who is allowed to |
| Service categories of a salon (`/api/v1/salons/{salonId}/service-categories`) | Implemented in every layer; the example of data that belongs to a salon. List and get are public; create, update and delete need a signed-in user who is allowed to. See [docs/service-menu.md](docs/service-menu.md) |
| Services of a salon (`/api/v1/salons/{salonId}/services`) | Implemented in every layer, with their options and packages: list, create, get, update, bulk update and delete. List and get are public; create, update, bulk update and delete need a signed-in user who is allowed to. The booking ledger takes any service of the salon; a customer books by themself only what the list of available slots offers, which is a service that is active, on sale and booked online. See [docs/service-menu.md](docs/service-menu.md) |
| Staff ledger of a salon (`/api/v1/salons/{salonId}/staff`) | Implemented in every layer: list, create, get, update and delete of the staff members of a salon, with what the salon keeps about them as their employer (contact details, position, pay, whether they take bookings). Nothing is public: every operation needs a signed-in administrator or the owner of that salon. Deactivating or deleting a staff member takes the salon away from the login account that belongs to it, and nobody does either to their own record. A staff member gets a login account by invitation (two rows below). See [docs/staff.md](docs/staff.md) |
| Staff schedules (`/api/v1/salons/{salonId}/staff/{id}/schedules`) | Implemented in every layer: list and update of when a staff member works. A schedule is a list of entries: weekly ones (one per day of the week) and ones for a single date, which replace the weekly entry on that date; an entry says that the staff member works, from when to when and with which break, or has the day off. An update replaces the whole schedule. With `?date=` the list answers which entry applies to a date. Nothing is public: an administrator, the owner and the managers of the salon read and write every schedule of the salon, and a staff member reads their own. The list of available slots reads the schedules to work out what a customer can book; what a salon enters in its booking ledger is not held to them. See [docs/staff.md](docs/staff.md) |
| Staff invitations (`/api/v1/salons/{salonId}/staff/{id}/invitation`, `/api/v1/auth/staff-invitation`) | Implemented in every layer: how a staff member gets a login account. An administrator or the owner of the salon invites a staff member of the ledger to a role (owner, manager or staff; only an administrator gives the role of an owner), reads the invitation the staff member holds and takes it back. The link goes by mail to the address the ledger has; it works once, for 7 days, and only while the staff member is active and has no account. Whoever holds the token reads the invitation and accepts it with a password of their own (`verify` and `accept`, without an access token), which creates the account, verified and linked to the staff member. An account that exists for that address, has the role of a salon and reaches no salon (of a staff member who left another salon, for example) joins the invitation signed in instead (`join`) and keeps its password. See [docs/staff.md](docs/staff.md) |
| Staff accounts (`/api/v1/salons/{salonId}/staff/{id}/account`) | Implemented in every layer: get, update and delete of the login account that is linked to a staff member. An administrator or the owner of the salon reads what the salon is shown of the account (the address, the role, the status, whether two-factor authentication is on, the last login), changes its role (only an administrator gives the role of an owner) and unlinks it from the staff member, which takes the salon away from the account and deletes nothing. Nobody changes the role of their own account or unlinks it. See [docs/staff.md](docs/staff.md) |
| Staff profiles (`/api/v1/staff-profiles`) | Implemented in every layer: list and get of what customers are shown of a staff member (the display name, the level, the position, the specialties, the biography, the photo, the years of experience, the certifications and whether the staff member takes bookings). Public and read only; the names, the contact details and the terms of employment of the ledger are not in it. Shown are the staff members who are active and not deleted, of salons that are not deleted. The list goes across salons and filters by salon, by specialty and by the city of the salon. A signed-in staff member who reaches a salon reads their own profile and changes the part that describes them (the specialties, the biography, the photo, the years of experience and the certifications) at `/api/v1/staff-profiles/me`; the display name, the level, the position and whether they take bookings stay with the salon, in the ledger. See [docs/staff.md](docs/staff.md) |
| Customer ledger (`/api/v1/customers`) | Implemented in every layer: list, create, get, update and delete of the customers, who belong to no salon and are kept in one ledger for the platform. Nothing is public: every operation needs a signed-in administrator or member of a salon (owner, manager or staff), and a delete an administrator, an owner or a manager. The batch get and the bulk create, update and delete take up to 100 customers, all or none. The statistics of a customer count their bookings and sales at one salon in a period, for an administrator and the members of that salon. The preferences of a customer are two rows below. Every write of the ledger keeps a version of the customer: an administrator, an owner or a manager reads the history and each version, also of a deleted customer, and restores a deleted customer. They also merge a customer registered twice into one, who gets the bookings, sales, treatment records, reviews, points, preferences, chart and allergies of the other. They export the customers who match the filters of the list as a CSV file of up to 10,000 customers, and everything held of one customer as a JSON file, to answer a request for the personal data held. They take, read and cancel the request of a customer to erase their data, which an administrator carries out once its 14 days of grace are over: the bookings, sales and points stay for the books, without what says who the customer was. Every operation of the customer contract is implemented. See [docs/customers.md](docs/customers.md) |
| Customer profile (`/api/v1/customers/me`) | Implemented in every layer: a signed-in customer account gets, creates and updates its own customer record, and reaches no other. Creating the profile takes over the record that the ledger already has under the account's confirmed email address, with its visits and points. The customer writes the name, the contact details, the birth date, the preferences and the consents; the membership tier and the points are shown, and what the staff keep to themselves is not. The customer books and reads their own bookings at `/api/v1/customers/me/bookings` (below). See [docs/customers.md](docs/customers.md) |
| Customer preferences (`/api/v1/customers/{id}/preferences`, `/api/v1/customers/me/preferences`) | Implemented in every layer: get and update of what a customer prefers: the staff member they want to be served by and the staff members they avoid, the times of day they like to come, how they like their hair (the length, colours, styles to avoid, pictures) and the service, and special requests. Whoever keeps the ledger reads and changes the preferences of any customer; a customer account with a profile reads and changes its own. A customer who has stated nothing has empty preferences (200, not 404), and the first change stores them. A staff member that a change names has to exist, in whichever salon, and the preferred one cannot be among the avoided ones (400). The server decides nothing by the preferences: a screen preselects the preferred staff member and leaves out the avoided ones. See [docs/customers.md](docs/customers.md#好み設定) |
| Authentication (`/api/v1/auth`, `/api/v1/admin/auth`) | Implemented, every operation of the contract: `login`, `refresh`, `logout`, `logout-all` and `me`, on server-side sessions with bearer tokens; registration of customer accounts, email verification, password reset and password change, with the links sent by mail; verifying, accepting and joining the invitation of a staff member, which is how the accounts of owners, managers and staff are created and linked; two-factor authentication with the codes of an authenticator app (TOTP) and backup codes; the list of the signed-in user's sessions and revoking one of them; and, for administrators, reading a user's account, unlocking it and resetting its two-factor authentication |
| Authorization | Decided in the use case of every implemented operation that needs a signed-in user, from the role of the user, one of the five fixed values of `users.role` (`admin`, `owner`, `manager`, `staff`, `customer`), and, for the account of a staff member, the salon of that staff member. There are no roles to define and no permissions to grant to a user. See [docs/authentication.md](docs/authentication.md) |
| System endpoints (`/api/system/alive`, `ready`, `health`) | Implemented |
| Booking ledger (`/api/v1/bookings`) | Implemented in every layer: list, create, get, update and delete of the bookings of a salon with their service lines, the five actions that change the status of a booking (confirm, cancel, start, complete, no-show), the reschedule that moves a booking to another time or staff member in charge, and add, get and remove of the service lines of a booking that exists (`/api/v1/bookings/{bookingId}/services`). Nothing is public: every operation needs a signed-in administrator or member of the salon of the booking (owner, manager or staff; the delete of a booking is not for the staff), and a customer account does not reach the ledger. A request names the salon, the customer, the staff member in charge and the services with the time each begins; the end times, the durations and the amounts are taken from the services, the booking number is issued by the system, and the day of the visit is the day in the time zone of the salon. What a salon enters or moves is held to what keeps the ledger sound (everything it names exists and is of that salon, and no staff member is occupied by more bookings at a time than they take), not to the opening hours, the schedules or what is active. An action is taken from the statuses it leads on from and refused from any other (409); each change of status is noted in the status history, and the visits, cancellations and no-shows of the customer are counted again from their bookings. A booking is moved while the visit has not begun (`draft`, `pending`, `confirmed`), what a salon noted of it is corrected whatever its status, and a delete removes it for good unless a sale, a treatment record or a review refers to it (409). A service line is added to a booking and removed from it until the booking is finished; a line that is added is held to what a new booking is held to, a booking keeps at least one line, and its times and amounts are computed again from the lines it then has. A customer, a staff member, a service or a salon is not deleted while a booking that is not finished refers to it (409). A customer account does not reach the ledger; it has the bookings of its own, below. See [docs/bookings.md](docs/bookings.md) |
| Available slots (`/api/v1/salons/{salonId}/available-slots`) | Implemented in every layer: the list of the times at which a staff member can begin a service on a date, for every signed-in user, and the check of whether a staff member is occupied at a time, for administrators and the members of the salon. Nothing is stored: a slot is worked out from the hours of the salon (the row of its calendar for the date, or else the weekly hours of that day of the week), the schedules of the staff and the bookings there are, every 30 minutes from the beginning of each stretch in which the salon is open and the staff member works, all in the time zone of the salon. The list applies what the salon set for the bookings of its customers (whether the salon, the service and the staff member take bookings, on which days of the week the service is offered, how often it is booked a day, the level it asks for), and a day on which nothing can be booked is an empty list, not an error. The check asks only what the ledger asks, whether the staff member is occupied, and names the bookings in the way. Neither holds a slot. See [docs/bookings.md](docs/bookings.md#空き枠) |
| A customer's own bookings (`/api/v1/customers/me/bookings`) | Implemented in every layer: list, create, get, cancel and reschedule, for a customer account with a profile (403 for every other role, 404 without a profile). A customer books a slot: a service with a staff member of a salon at a time, and the server takes it only if the list of available slots offers that time at that moment, so everything the list applies holds for the booking as well. The booking is the ledger's: one service line, the times and the amounts from the service, `pending` until the salon confirms it. A customer whose record is not active, or set to inactive or blacklisted, does not book by themself, and nobody books a time at which they have another booking, at whatever salon (409). The customer reads their bookings at every salon, also those a salon entered for them, without what the salon notes and records, and cancels one that is a draft, pending or confirmed until the moment it begins (409 from then on). The booking of another customer is not found. Requests that arrive at the same moment for one slot, for the last booking a service takes that day or from one customer for one time write one booking. A customer moves a booking that is a draft, pending or confirmed, until the moment it begins, to another time, another staff member or both, if that is a slot the list offers for the service of the booking and for the time the booking takes, the booking itself not counted; a booking with more than one service line, or with a line that is not with the staff member in charge, is moved by the salon (409). A confirmed booking that its customer moves is pending again until the salon confirms it. See [docs/bookings.md](docs/bookings.md#顧客が自分で入れる予約) |
| Sales ledger (`/api/v1/sales`) | Implemented in every layer: list, create, get, update and void of the sales of a salon with their lines and the payments made for them, the receipt of a sale and the calculation of a sale before it is entered. Nothing is public: every operation needs a signed-in administrator or member of the salon of the sale (owner, manager or staff; the void is not the staff's), and a customer account does not reach the ledger. A sale is the bill of one visit as the till charged it: the request states the lines and their amounts, and the server checks that every line agrees with itself (quantity times unit price, less the discount, plus the tax), that the salon, the customer, the staff members, the booking, the services and the products the sale names exist and are of that salon, and that a booking is billed once (409). The server sums the sale up from its lines, gives it a number (`SL-XXXX-XXXX`) and takes the day of the sale from the time zone of the salon. Prices, tax rates and commissions are compared with nothing. An update writes the properties a request names and holds the sale as it is afterwards to the rules of a create; new lines replace all the lines, and only while the payment status is `pending`. A void keeps the sale in the ledger with the time and the reason, is refused while a payment of the sale was not refunded (409), and frees the booking for another sale. The payment status of a sale is counted from the payments recorded for it (see the row of the payments below). A receipt is made again at every request from the sale as it is, under the sale number, and only for a sale that is not void and received its total (409). A calculation writes nothing: it counts the lines of a booking at the amounts they copied and added services at the prices of the menu, adds the tax of the salon once to their sum, and names the kinds of payment method that take the total. See [docs/sales.md](docs/sales.md) |
| Payment methods (`/api/v1/salons/{salonId}/payment-methods`) | Implemented in every layer: list, create, get, update and delete of what a salon accepts as payment (cash, credit and debit cards, electronic money, QR payments, bank transfers, points), each with a display name, the fee rate, the limits of the amount of one payment, whether it is taken online and at the salon, and whether it is in use. Nothing is public: an administrator and the owner, the managers and the staff of the salon read them, an administrator, the owner and the managers set them up, and a customer account does not reach them. The method of a payment method is fixed once it is created, its lower limit of the amount is never above the upper one (400), and a payment method that a payment refers to is not deleted (409) but deactivated. A payment is held to whether its payment method is in use and to the limits of the amount; the fee and the online and offline flags are stored and decide nothing. See [docs/payments.md](docs/payments.md) |
| Payments of a sale (`POST /api/v1/sales/{id}/process`, `POST /api/v1/payments/{id}/refund`) | Implemented in every layer: recording a payment that was taken for a sale, and refunding a payment. No payment processor is connected, so a payment is the record of what the till took: an administrator or a member of the salon of the sale (owner, manager or staff) records the payment method, the amount and, for a card, optionally its last four digits and its brand, and the server issues the payment number (`PT-XXXX-XXXX`). A sale is paid in parts, and no more than what is left is taken (400); a void sale, a sale with a refund and a sale with nothing left take no payment (409). A refund is for an administrator, the owner and the managers, once per completed payment, in full or in part. The payment status of the sale (`pending`, `processing`, `completed`, `partial_refund`, `refunded`) is counted from its payments in the transaction that writes one. Neither moves the points of the customer. See [docs/payments.md](docs/payments.md) |
| Sales reports (`/api/v1/sales-reports`) | Implemented in every layer: the report of a period of a salon (the totals of the sales, the tax, the discounts and the refunds, by kind of payment method, by kind of category and the five staff members who sold most), the sales of a day, the sales by staff member, by category and their trends by day, week or month. An administrator reads every salon, the owner and the managers their salon; the staff and customers are refused. The query names the salon and the first and the last day of the sales, both required, at most 366 days. A report is counted from the sales that are not void at every request and stored nowhere. The export answers the sales of each day of a period as a CSV file. See [docs/sales-reports.md](docs/sales-reports.md) |
| Points (`/api/v1/points`) | Implemented in every layer: the balance of a customer, their history of point transactions, their points about to expire, and earning, using, adjusting and expiring points. The ledger is one for the whole platform, as the customer ledger is. An administrator and the owner, the managers and the staff of any salon read, earn and use points; adjusting is not the staff's, and expiring is the administrators' alone; customers are refused. Every movement writes a transaction with the balance after it, and the balance of the customer is that of their latest transaction, between 0 and 2,147,483,647. A movement may name a sale or a booking of the customer: points are not earned on or used for a void sale or a cancelled booking, and a record is earned on once and used for once. The points of a sale (`pointsUsed`, `pointsEarned`) and a payment by points move no balance. A use takes the points whose expiry date is nearest first; points past their expiry date stay usable until an administrator expires them, which writes one transaction per customer and nothing on a second run. See [docs/points.md](docs/points.md) |
| Reviews (`/api/v1/reviews`, `/api/v1/review-reports`, `/api/v1/salons/{salonId}/reviews/summary`, `/api/v1/staff/{staffId}/reviews/summary`) | Implemented in every layer, every operation of the review contract: the list, the get, the create, the change, the removal, the mark as helpful, the report and the response of a salon to the reviews of the customers, the list and the dismissal of the reports, and the summaries of the reviews of a salon and of a staff member. Reading is public. A review is written by the customer of a completed booking only, once per booking, naming no staff member or one who took the booking; administrators and the members of a salon do not write one (403). The rating and the review count of a salon are counted from its reviews in the transaction that writes one, and a booking with a review is not deleted (409). The author changes a review, and the author or an administrator removes one (the members of a salon do not, 403); both count the salon again, writing it only when a figure changes, and a removed review frees its booking to be deleted or reviewed again. A customer marks a review of another customer as helpful once (a second mark answers the count as it is; administrators, the members of a salon and the author are refused, 403), and the helpful count of a review is the number of customers who marked it, counted again in the transaction that marks it. A customer, or the owner or a manager of the salon of the review, reports a review once (a second report answers 409, also once the first was dismissed; administrators, staff, the author and other salons are refused, 403), the review stays readable, and its report count is the number of pending reports; the administrators list the reports oldest first and dismiss one, or remove the review, which takes its reports with it. The owner or a manager of the salon of a review writes one response to it, replaces it or takes it down, and an administrator takes one down (a string from an administrator, staff, customers and other salons is refused, 403); the same response again writes nothing, and the review is not changed otherwise. See [docs/reviews.md](docs/reviews.md) |
| Products of a salon (`/api/v1/salons/{salonId}/products`) | Implemented in every layer: list, create, get, update and delete of what a salon sells at its counter and uses in its treatments, with the prices, the unit, the stock levels (the minimum, the reorder point and the maximum), the supplier and whether it is sold, used in treatments and in use. Nothing is public: an administrator and the owner, the managers and the staff of the salon read them, an administrator, the owner and the managers keep them, and a customer account does not reach them. The stock levels lie in order (400), the product code is unique among the products of the salon that are not deleted (409), and a delete marks the product deleted and is refused while the product has stock (409). See [docs/products.md](docs/products.md) |
| Stock of a salon (`/api/v1/inventory`) | Implemented in every layer: list, create, get, update and delete of the stock rows, one for each lot of a product of a salon, with where it is kept and when it expires, and two lists to work from: the low stock (the rows of the active products whose stock at the salon is at or below their minimum or a threshold) and what expires soon (the rows with stock that expire within some days of today at the salon, the expired ones included). An administrator and the owner, the managers and the staff of a salon read it, an administrator, the owner and the managers keep it, and a customer account does not reach it. A product kept by lots names the lot of each row; a product that is not has one row. A row is created without stock, only a stock movement or a stock count moves it (a purchase, a sale, a use, a return, an adjustment, a disposal or a transfer, each from the stock the one before it left, with the history of a row latest first), and a row that counts stock is not deleted (409). A stock count sets the rows it names to what was counted, all of them or none, recording an adjustment of each difference, and the value report sums the stock at purchase prices by category; both are for an administrator, the owner and the managers. See [docs/inventory.md](docs/inventory.md) |
| Purchase orders of a salon (`/api/v1/purchase-orders`) | Implemented in every layer: list, create, get, update, approve, cancel, the receipt of the goods and the suggestions of what to reorder. An order names stock rows of its salon with a quantity and a unit price for each; the items copy the code, the name and the unit of their products, and the server works out what each item and the order come to. Every member of a salon drafts an order and moves it on one step at a time (sent for approval, placed with the supplier, shipped); an administrator, the owner and the managers approve and cancel it, a delivered or cancelled order does not change, and a customer account does not reach it. A member receives the goods of an ordered or shipped order once: each item that arrived is recorded as a purchase into its stock row at the unit price of the item, and the order is delivered. The suggestions name each active product of the salon whose stock and what is on order come to its reorder point or less, with the quantity that brings it up to its maximum. See [docs/purchase-orders.md](docs/purchase-orders.md) |
| Inventory alerts of a salon (`/api/v1/inventory-alerts`) | Implemented in every layer: the list, the acknowledgement and the summary of the alerts of the stock of a salon. An alert is worked out whenever it is read, not stored: the stock of an active product at the salon at or below its minimum (critical when there is none) or above its maximum, and a stock row with stock that expires within 30 days of today at the salon or has expired. An administrator and the owner, the managers and the staff of a salon read and acknowledge them, and a customer account does not reach them. An acknowledgement records the alert as it is and holds while that lasts: once the stock left the alert or ran out, the threshold changed or the expiry date of the row changed, the alert is to be acknowledged again. See [docs/inventory-alerts.md](docs/inventory-alerts.md) |
| Treatment records (`/api/v1/treatments`) | Implemented in every layer, every operation of `TreatmentRecordCrud`: list, create, get, update and delete of what a salon notes of the treatment of a booking (the services given, the techniques, the condition of the scalp and the hair, the colour formula, the materials used with their amounts and lots, what is recommended for the next visit, the satisfaction of the customer and the notes of the staff), the addition and the removal of their photos, and the statistics. An administrator and the owner, the managers and the staff of the salon of the booking read and write them, an administrator, the owner and the managers remove one, and a customer account reaches none, not even the records of its own visits. A booking that is in progress or completed takes one record (409 otherwise, and for a second one); its customer is that of the booking, and its staff member, services and products are of the salon of the booking (400). Recording the materials does not move the stock. A photo is the address of a file stored elsewhere, at most 20 a record and one of an address, and a public photo needs the consent of the customer. The statistics count the records of a salon in a period by the kinds of their services and by their services. See [docs/treatments.md](docs/treatments.md) |
| Medical charts (`/api/v1/medical-charts`) | Implemented in every layer, every operation of `MedicalChartCrud`: list, create, get by customer and update of the charts, and list, add, update and remove of the allergies of a customer. A chart is what the staff check before a treatment, one for a customer: the treatments had before at other salons, the medical conditions to heed, the products the customer prefers and those to avoid, and notes. An administrator and the owner, the managers and the staff of any salon read and write them, as they keep the customer ledger; a customer account reaches none, not even its own. A previous treatment is not after today, and the chart of a deleted customer is shown nowhere. An allergy is one for an allergen of a customer (409 for a second), with one level of severity, and the allergies are listed severest first; the staff add and change them, and an administrator, an owner or a manager removes one. See [docs/medical-charts.md](docs/medical-charts.md) |
| Attachments (`/api/v1/attachments`) | Implemented in every layer, every operation of `AttachmentCrud`: the files a salon keeps, such as the photos of a treatment and its documents (JPEG, PNG, WebP and PDF of up to 10 MiB). The server never carries a file. It issues a URL that is signed for one upload of the announced type and size and works for 15 minutes, which the client sends the file to; the upload is completed once the server has looked at the size and the first bytes of what is stored, and a file that is not what was announced ends the attachment (409). The uploaded attachments are listed newest first, a download URL works for 5 minutes and saves the file under its name or shows it in the browser, a delete removes the file and then the attachment, and a purge removes the uploads that were never completed and the deleted rows. An administrator and the owner, the managers and the staff of the salon reach the attachments of the salon, a file of no salon is the administrators', the owner, the managers and whoever uploaded it delete one, only an administrator purges, and a customer account reaches none. See [docs/attachments.md](docs/attachments.md) |
| Share links (`/api/v1/attachments/{attachmentId}/share-links`, `/api/v1/attachments/share-links/{shareLinkId}`, `/api/v1/share`) | Implemented in every layer, every operation of `ShareLinkCrud` and `SharedFileCrud`: a link that shows one uploaded attachment to somebody without an account, until a time at most 30 days ahead, with an optional limit of downloads and an optional password. An administrator and the owner and the managers of the salon create, list, read and revoke the links; the staff do not. The token of a link is answered once, when the link is created, and only its SHA-256 is stored. A viewer sends the token, and the password if there is one, in the body of `POST /api/v1/share/file` and `POST /api/v1/share/download-url`, never in a URL; five wrong passwords in a row lock a link for 15 minutes, and a token that opens nothing is answered 404 whatever the reason. See [docs/attachments.md](docs/attachments.md#共有リンク) (Japanese) |
| The other domains | None: every operation of the contract is implemented |
| Email | Implemented for the mails of the authentication flows: plain text over SMTP. Locally they are caught by Mailpit. See [docs/email.md](docs/email.md) |
| File storage | An S3-compatible object storage holds the files of the attachments. Locally it is SeaweedFS, started by Docker Compose; which storage production uses, its bucket, its credentials and the CORS rules of the bucket are part of preparing production. See [docs/attachments.md](docs/attachments.md) |
| Frontend apps | Application shells; no screen calls the API or signs in yet. The pages that the links in the mails point at do not exist yet. What the screens will be built from is there: design tokens, shared components in CSS Modules with their Storybook, tests that start from the stories, and the session (the tokens kept in the browser, sent with every request and renewed when they expire). See [docs/frontend-api-integration.md](docs/frontend-api-integration.md) |

## 🚀 Quick Start

### Prerequisites

- Node.js 26.13.1 (`.node-version`)
- pnpm 12.21.0 (`package.json#packageManager`)
- PostgreSQL 18, either through Docker (`make infra-up`) or any instance that
  `DATABASE_URL` in `.env.localhost` points to
- An SMTP server for the mails the backend sends. `make infra-up` starts
  Mailpit, which catches them, and the `SMTP_*` variables in `.env.localhost`
  point to it
- An S3-compatible object storage for the files of the attachments.
  `make infra-up` starts SeaweedFS with a bucket, and the `STORAGE_*`
  variables in `.env.localhost` point to it

### Installation

```bash
pnpm install       # Install dependencies and the pre-commit hook
make infra-up      # Start PostgreSQL, Mailpit (the local mail catcher) and SeaweedFS (the local file storage) in Docker
pnpm db:fresh      # Create the schema from sql/setup.sql
pnpm db:seed       # Insert sample data, including accounts to sign in with (optional)
pnpm dev           # Backend on :3000, frontend apps on :3001-3003
```

Generated files are checked in, so `pnpm generate` is only needed after a
TypeSpec change. `make help` lists every Makefile target.

Registration (`POST /api/v1/auth/register`) creates customer accounts only,
and such an account can sign in once the link in the mail it was sent has
been confirmed; locally that mail is shown by Mailpit at
<http://localhost:8025>. The accounts of owners, managers and staff are created
by inviting a staff member of a salon's ledger, who accepts the invitation
through a link sent by mail; no operation creates the account of an
administrator. Locally the seed provides accounts of every role.
Every seeded account has the same password, which is published in the
repository
(`SEED_PASSWORD` in `backend/packages/database/src/seeds/seed-data/users.ts`);
`pnpm db:seed` therefore refuses to run when `NODE_ENV` is `production`. The
accounts and their roles are listed in
[docs/authentication.md](docs/authentication.md).

## 📁 Project Structure

```
.
├── specs/                      # TypeSpec API definitions
│   ├── models/                # Data model definitions
│   └── operations/            # API operation definitions
│
├── backend/                    # Backend monorepo
│   ├── packages/
│   │   ├── domain/           # Business logic layer
│   │   ├── infrastructure/  # Database access, mail (SMTP), password hashing, tokens, one-time passwords, logging
│   │   ├── api/              # HTTP layer
│   │   ├── database/         # Database schema, migrations, seeds
│   │   ├── generated/        # Auto-generated types
│   │   ├── config/           # Configuration
│   │   └── utility/          # Result type and shared helpers
│   └── apps/
│       └── server/           # Express application
│
├── frontend/                   # Frontend applications
│   ├── packages/             # Shared frontend packages
│   └── apps/                 # Frontend applications
│
├── shared-config/              # Shared TypeScript configuration
├── scripts/                    # Repository scripts (run with node)
└── docs/                      # Documentation
```

## 🔧 Development

### Type Generation Pipeline

1. Define API contracts in TypeSpec (`specs/`)
2. Run `pnpm generate` (or `pnpm generate:watch` while editing), which
   - compiles TypeSpec to OpenAPI (`pnpm generate:spec`)
   - generates the frontend API client (`pnpm generate:api`)
   - generates the backend types and Zod schemas (`pnpm generate:backend`)
3. Commit the generated files together with the TypeSpec change;
   `pnpm check:generated` fails in CI when they drift

### Database Workflow

The database is the source of truth for the Drizzle schema:

1. Write a SQL migration in `backend/packages/database/sql/migrations/`,
   named `YYYYMMDDHHMM_description.sql`
2. `pnpm db:migrate` applies it, once
3. `pnpm db:introspect` regenerates `schema.ts` and `relations.ts`
4. `pnpm db:generate-sql` regenerates `sql/setup.sql`
5. Commit all of them; `pnpm check:db-schema` fails in CI when they drift,
   and the integration tests fail when `setup.sql` lacks a migration

`pnpm db:migrate` is the one command for every database and safe to run on
each deployment. It creates an empty database from `sql/setup.sql`, which
already contains every migration; on any other database it applies the
migrations that are missing, in the order of their names and each in its own
transaction. What has been applied is recorded in
`migration_history.applied_migrations`, and concurrent runs wait for each
other. A migration that has been applied anywhere is never edited: write a new
one. While writing a migration, `pnpm db:migrate <file>` runs it without
recording it.

### API ↔ Database Consistency

API property names, nullability and enum values follow the database columns.
`pnpm check:api-db` compares the generated OpenAPI document with the Drizzle
schema and fails in CI on any difference. Every API model that is backed by a
table is covered, in all domains; the rules are in
`backend/packages/database/src/scripts/api-consistency-rules.ts`.

### Available Scripts

```bash
# Development
pnpm dev                     # Backend and every frontend app in watch mode
pnpm dev:backend             # Backend only, reloading on source changes
pnpm dev:watch:admin-app     # Admin app with its packages in watch mode
pnpm dev:watch:portal-app    # Portal app with its packages in watch mode
pnpm dev:watch:dashboard-app # Dashboard app with its packages in watch mode
pnpm generate                # TypeSpec → OpenAPI → backend types + API client
pnpm generate:watch          # Regenerate on every TypeSpec change
pnpm --filter @beauty-salon-frontend/ui run storybook  # Component catalogue on :6006

# Building
pnpm build                   # Production build of every package
pnpm build:dev               # Also build:test, build:stg, build:prod
pnpm build:backend           # Backend only
pnpm build:frontend          # Frontend packages and apps
pnpm start:backend           # Run the built backend
pnpm preview:frontend        # Serve the built frontend apps

# Testing
pnpm test                    # Unit tests
pnpm test:integration        # Tests against PostgreSQL and an SMTP server (see Testing)

# Code Quality
pnpm lint                    # Biome lint
pnpm format:check            # Check formatting (Biome and TypeSpec)
pnpm format:fix              # Apply formatting, import sorting and safe fixes
pnpm typecheck               # Type check (run a build first)
pnpm knip                    # Unused files, exports and dependencies
pnpm check:generated         # Generated files match the TypeSpec
pnpm check:db-schema         # schema.ts and setup.sql match the database
pnpm check:api-db            # API models agree with the database schema
make ci-check                # The CI checks, in the same order (all but check:db-schema)

# Database
pnpm db:fresh                # Drop everything and recreate the schema
pnpm db:migrate              # Create the schema or apply the missing migrations
pnpm db:seed                 # Insert sample data into a database without data (--reset: empty it first; --if-empty: skip one with data); not in production
pnpm db:truncate             # Delete all rows, keep the schema
pnpm db:introspect           # Regenerate schema.ts from the database
pnpm db:generate-sql         # Regenerate sql/setup.sql from schema.ts

# Maintenance
pnpm clean                   # Remove build outputs
pnpm fresh                   # Remove build outputs and node_modules, reinstall
pnpm update:check            # List dependencies with newer releases
```

## 🚦 Operating the API Server

### Configuration

The server reads its configuration from environment variables. The file
`.env.<NODE_ENV>` (or `.env` when it exists) fills in what the process
environment does not set, so a deployment sets the variables directly and
needs no file. Every variable below is required; the server validates all of
them at start-up and exits with the list of what is missing or malformed.

| Variable | Meaning |
|----------|---------|
| `NODE_ENV` | `production`, `staging`, `development`, `test` or `localhost` |
| `HOST`, `PORT` | Address and port to listen on. The files for a developer's machine (`.env.localhost`, `.env.development`, `.env.test`) listen on `127.0.0.1`, this machine only; the files given to a container listen on `0.0.0.0` |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the server (0 = clients connect directly). The rate limit counts by client address, which is only right when this matches the deployment |
| `DATABASE_URL` | `postgres://` connection URL |
| `DATABASE_POOL_MAX` | Largest number of pooled connections |
| `DATABASE_CONNECTION_TIMEOUT` | Connection timeout in milliseconds |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API from a browser |
| `CORS_CREDENTIALS`, `CORS_MAX_AGE` | Whether credentials are allowed; preflight cache time in seconds |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Requests allowed per client address in each window (counted per server instance) |
| `SMTP_HOST`, `SMTP_PORT` | Host and port of the SMTP server that carries the mails |
| `SMTP_TLS` | How the SMTP connection is encrypted: `implicit` (TLS from the start, port 465), `starttls` (upgraded with STARTTLS, port 587) or `none` (plain text, for a local mail catcher) |
| `SMTP_USER`, `SMTP_PASSWORD` | Credentials for the SMTP server; the server always signs in |
| `MAIL_FROM` | Sender of every mail: an address, or `Name <address>` |
| `PUBLIC_APP_URL` | Origin of the web application that the links in mails point at |
| `TWO_FACTOR_ENCRYPTION_KEY` | Key under which the secrets of authenticator apps (two-factor authentication) are encrypted in the database: 32 characters or more, random and kept secret. Changing it makes every stored secret unusable: the codes of the authenticator apps are no longer accepted |
| `STORAGE_ENDPOINT` | Origin at which the server reaches the S3-compatible object storage that holds the files of the attachments |
| `STORAGE_PUBLIC_ENDPOINT` | Origin at which a browser reaches the same storage: the signed upload and download URLs name it. It differs from `STORAGE_ENDPOINT` only when the server reaches the storage by a name of its own network |
| `STORAGE_REGION`, `STORAGE_BUCKET` | Region the URLs are signed for, and the bucket of the files, which must exist: the server does not create it |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Credentials for the storage; the URLs are signed with the secret, so it is kept secret |
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `LOG_FORMAT` | `json` (one object per line) or `pretty` (for a terminal) |

When `NODE_ENV` is `staging` or `production`, the server also refuses to
start with `SMTP_TLS=none` or with a `PUBLIC_APP_URL` that does not start with
`https://`: the mails carry tokens. Nor does it start with a
`STORAGE_ENDPOINT` or a `STORAGE_PUBLIC_ENDPOINT` that does not start with
`https://`: the files are those of customers, and their URLs carry
signatures. The server does not connect to the storage when it starts, so a
storage that is down or set up wrongly shows as 500 responses of the
attachment routes, not as a failed start. The accepted values of every
variable are in [docs/env-configuration.md](docs/env-configuration.md), how
mail is sent is in [docs/email.md](docs/email.md), and how the files are kept
is in [docs/attachments.md](docs/attachments.md).

### Logs and Request IDs

The server writes structured logs (pino) to standard output: one line per
request with method, URL, status and duration, and one line for every
failure with its cause. The line of a request that was authenticated also
names the signed-in user (`userId`), which tells afterwards who did what.
Request headers and bodies, and the values bound to
a failed SQL statement, are never logged. Every mail leaves one line,
`Mail delivered` or `Failed to deliver mail`, with the subject of the message
and without its recipient or text.

Every request has an ID: the caller's `X-Request-Id` if it sent one,
otherwise a new UUID. The ID is on every log line of the request, in the
`X-Request-Id` response header, and in the body as `meta.correlationId`
(or `correlationId` of an error), so a reported error leads straight to its
log lines.

### Errors

Every error response is RFC 9457 problem details (`application/problem+json`),
including the ones raised before a route runs: unknown route (404), malformed JSON (400), a body that
is not JSON (415) or over 100 kB (413), too many requests (429) and
unexpected failures (500, without internal details). A request without a
valid access token to an operation that needs one is answered with 401 and a
`WWW-Authenticate: Bearer` header, and a signed-in user who lacks the
permission with 403. The probes below are the one exception: a probe that
fails answers 503 with its own body.

### Probes and Shutdown

| Endpoint | Purpose |
|----------|---------|
| `GET /api/system/alive` | Liveness: the process answers |
| `GET /api/system/ready` | Readiness: 200 while the database answers, otherwise 503 with `{ "ready": false, "reason": "database" }` |
| `GET /api/system/health` | The same check with details per dependency |

The probes are not rate limited and not written to the request log. On
`SIGTERM` or `SIGINT` the server stops accepting connections, lets requests
in flight finish (for up to 10 seconds), waits for the mails that are still
being delivered, closes the database connections and exits with status 0. It
does not start at all when the database is unreachable. The SMTP server is
not checked, at start-up or by the probes: the server connects to it only
when a mail goes out, and a mail that cannot be delivered is logged and
dropped.

## 🧪 Testing

- **Unit tests** (`pnpm test`): pure logic, no external services (Vitest)
- **Integration tests** (`pnpm test:integration`): the HTTP API, the
  server's start-up and shutdown, and the migration runner against a real
  PostgreSQL, with a database of its own for every test. They start a
  PostgreSQL container through testcontainers, or use an existing instance
  when `TEST_DATABASE_URL` is set (its user needs the right to create
  databases):

  ```bash
  TEST_DATABASE_URL=postgres://<user>:<password>@localhost:5432/<database> pnpm test:integration
  ```

  The integration tests of the infrastructure package send mail to a Mailpit
  container and files to a SeaweedFS container, which they also start through
  testcontainers.

See [docs/testing-requirements.md](docs/testing-requirements.md) for testing guidelines.

## 📚 Documentation

The full index is [docs/README.md](docs/README.md).

### Core Documentation

- [Development Guidelines](CLAUDE.md) - The conventions every change follows
- [Architecture Overview](docs/architecture-overview.md) - System design and architecture
- [Development Workflow](docs/development-workflow.md) - Set-up, the daily loop, checks
- [AI Agent Guidelines](AGENTS.md) - Instructions and roles for AI coding agents

### Development Guides

- [TypeScript Configuration](docs/typescript-configuration.md)
- [Type Safety Principles](docs/type-safety-principles.md)
- [Sum Types & Pattern Matching](docs/sum-types-pattern-matching.md)
- [Backend Architecture](docs/backend-architecture-guidelines.md)
- [Multi-Agent Collaboration](docs/multi-agent-collaboration-framework.md) - AI agent design validation protocol

### Implementation Guides

- [Domain Implementation Reference](docs/domain-implementation-reference.md) - Complete reference for implementing new domains
- [API Route Modular Structure](docs/api-route-modular-structure.md) - Guide for modular route organization
- [Uniform Implementation](docs/uniform-implementation-guide.md)
- [Authentication and Authorization](docs/authentication.md) - Sessions, passwords, registration, the accounts of staff members by invitation, two-factor authentication, permissions, seeded accounts (日本語)
- [Service Menu](docs/service-menu.md) - The service categories of a salon: who may change them, the list, the validation rules, parent and child categories, what a delete does. The services of a salon: the rules for each property, options, packages, bulk update, what a delete does (日本語)
- [Customer Ledger](docs/customers.md) - The customers, in one ledger for the platform: what is implemented, who may do what, the order of the checks, the list and its search, the rules for each property, a customer's own profile and how it takes over a record of the ledger, what a delete does, requests that arrive at the same moment (日本語)
- [Staff Ledger](docs/staff.md) - The staff members of a salon: what is implemented, who may do what, the order of the checks, what nobody does to their own record, what a change does to the login account of a staff member, the list, the rules for each property, what a delete does, the profile that customers are shown (which properties, which staff members, the filters of its list), a staff member's own profile (which properties the staff member writes and which the salon decides), the working schedules (weekly entries and entries for a single date, the rules of an entry, which entry applies to a date, who may read and plan them), the login accounts of the staff by invitation (who may invite to which role, how long an invitation works, what accepting it creates, how an account that exists joins one), the accounts that are linked to the staff (what the salon is shown, changing the role, unlinking), requests that arrive at the same moment (日本語)
- [Booking Ledger](docs/bookings.md) - The bookings of a salon: what is implemented, what a salon may enter and what is not checked, who may do what, the order of the checks, the rules of a create request, what the system derives (times, amounts, the tax, the booking number, the day of the visit), when a staff member is occupied, the status actions and what each writes, what a customer has of visits, cancellations and no-shows, the update, the reschedule and the delete, the service lines that are added to a booking and removed from it, the list and its filters, requests that arrive at the same moment, the constraints of the tables, the seed (日本語)
- [Sales Ledger](docs/sales.md) - The sales of a salon: what is implemented, what the server checks and what it leaves to the till, who may do what, the order of the checks, the rules of a create request, what the system derives (the sums, the sale number, the day of the sale), one sale for a booking, the update and the void of a sale, the receipt of a sale and the calculation of one, the list and its filters, requests that arrive at the same moment, the constraints of the database (日本語)
- [Payments](docs/payments.md) - The payment methods of a salon and the payments of a sale: what is implemented, who reads them and who sets them up, the order of the checks, the rules of a request, why the method is fixed, the limits of the amount, deleting and deactivating, the list and its filters, recording a payment and refunding one, the payment status of a sale, requests that arrive at the same moment, the constraints of the database (日本語)
- [Sales Reports](docs/sales-reports.md) - The reports of the sales of a salon: what is implemented, who reads them, the order of the checks, the rules of the query (no default period, at most 366 days), which sales, lines and payments are counted and how, the payment methods and the categories by kind, the staff member of a line, the weeks and the months of the trends, rounding, the one snapshot a report is read in, why the summary tables are not used (日本語)
- [Points](docs/points.md) - The points ledger of the customers: what is implemented, who reads and moves points, the order of the checks, the balance and the latest transaction, the rules of a request, the record a movement names (once per record, no void sale, no closed booking), the history, the expiry date (what is left of an earning, the points about to expire, the expiry), how it stands to sales and payments, requests that arrive at the same time, the constraints, the migration that opens the ledger, the seed (日本語)
- [Reviews](docs/reviews.md) - The reviews of the customers: what is implemented, who reads them (anyone) and who writes one (the customer of the visit), the order of the checks, the rules of a review (a completed booking, once per booking, a staff member who took it), who changes a review (its author) and who removes one (its author or an administrator), who marks one as helpful (a customer, once, not their own), who reports one (a customer or the salon, once) and who handles the reports (an administrator), who responds to one (the owner or a manager of its salon; an administrator takes a response down), the list and its orders, the summaries, the rating and the review count of a salon, why a booking with a review is not deleted, requests that arrive at the same time, the constraints, the migrations that count the salons, the helpful counts and the report counts again, the seed (日本語)
- [Products](docs/products.md) - The products of a salon: what is implemented, who reads them and who keeps them, the order of the checks, the rules of a request, the product code (unique among the products of the salon that are not deleted), the stock levels in order, a delete that marks the product and is refused while it has stock, the list and its filters, requests that arrive at the same moment, the constraints, the seed (日本語)
- [Inventory](docs/inventory.md) - The stock of a salon: what is implemented, who reads it and who keeps it, the order of the checks, the rules of a request, the lot number (named for a product kept by lots, unique among the rows of the product), a stock row created without stock, a delete refused while the row counts stock, the list, the low stock and what expires soon, the stock movements (the kinds and their signs, who records which, the total cost, the stock kept between what is reserved and the most a row holds, the history and the opening adjustment), the stock count (all rows or none, an adjustment of each difference, one moment for the count), the value report (by category, rounded once a category is summed), requests that arrive at the same moment, the constraints, the seed (日本語)
- [Purchase Orders](docs/purchase-orders.md) - The purchase orders of a salon: what is implemented, the items copied from their stock rows, who drafts, approves, cancels and receives, the order of the checks, the rules of a request, the amounts the server works out, the order number, the statuses and what moves them, the list, the receipt of the goods, the reorder suggestions, requests that arrive at the same moment, the constraints, the seed (日本語)
- [Attachments](docs/attachments.md) - The files a salon keeps: what is implemented, the upload through a signed URL and its completion, which files are taken, who may do what, the order of the checks, the download URL, the delete and the purge, the storage and its settings, SeaweedFS for local development (日本語)
- [Email](docs/email.md) - Which mails are sent, SMTP settings, Mailpit for local development (日本語)
- [Testing Requirements](docs/testing-requirements.md)
- [API Testing Guide](docs/api-testing-guide.md)
- [Type Generation System](docs/type-generation-system.md)
- [Database Commands](backend/packages/database/docs/database-commands.md)

## 🔑 Key Technologies

### Backend
- **TypeScript** - Type-safe JavaScript
- **TypeSpec** - API-first type generation
- **Express** - Web framework
- **Drizzle ORM** - Type-safe database access
- **PostgreSQL** - Relational database
- **ts-pattern** - Pattern matching
- **Zod** - Runtime validation
- **pino** - Structured logging
- **nodemailer** - Mail over SMTP
- **Vitest**, **testcontainers** - Unit and integration testing
- **Biome**, **knip** - Lint, format, unused-code detection

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **orval** - API client generated from the OpenAPI document
- **CSS Modules** - Styling, over design tokens, with CSS Grid for layout
- **Storybook** - Component catalogue; the component tests render its stories
- **axe-core** - Accessibility checks in the tests
