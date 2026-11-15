-- Generated setup.sql from Drizzle ORM schema
-- This file contains the complete database schema including:
-- - All enum types
-- - All tables with columns, constraints, and defaults
-- - All foreign key relationships
-- - All indexes
-- Source: backend/packages/database/src/schema.ts

CREATE TYPE "public"."account_status" AS ENUM('active', 'unverified', 'inactive', 'locked', 'suspended', 'deleted');
CREATE TYPE "public"."allergy_severity" AS ENUM('mild', 'moderate', 'severe', 'life_threatening');
CREATE TYPE "public"."allergy_type" AS ENUM('chemical', 'fragrance', 'metal', 'latex', 'plant', 'other');
CREATE TYPE "public"."booking_requirement" AS ENUM('consultation_required', 'patch_test_required', 'advance_booking_required', 'deposit_required');
CREATE TYPE "public"."booking_status" AS ENUM('draft', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'vip', 'blacklisted');
CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE "public"."hair_thickness" AS ENUM('thin', 'medium', 'thick');
CREATE TYPE "public"."hair_type" AS ENUM('straight', 'wavy', 'curly', 'coily');
CREATE TYPE "public"."inventory_transaction_type" AS ENUM('purchase', 'sale', 'use', 'adjustment', 'return', 'disposal', 'transfer');
CREATE TYPE "public"."membership_tier" AS ENUM('regular', 'silver', 'gold', 'platinum', 'vip');
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'line');
CREATE TYPE "public"."notification_type" AS ENUM('booking_reminder', 'booking_confirmation', 'booking_change', 'promotion', 'birthday', 'points_expiry', 'review_request');
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'credit_card', 'debit_card', 'e_money', 'qr_payment', 'bank_transfer', 'point');
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partial_refund');
CREATE TYPE "public"."point_transaction_type" AS ENUM('earned', 'used', 'expired', 'adjusted', 'transferred');
CREATE TYPE "public"."pricing_strategy" AS ENUM('fixed', 'variable', 'tiered', 'dynamic', 'consultation_based');
CREATE TYPE "public"."salon_role" AS ENUM('owner', 'manager', 'staff');
CREATE TYPE "public"."scalp_condition" AS ENUM('normal', 'dry', 'oily', 'sensitive', 'dandruff');
CREATE TYPE "public"."service_availability" AS ENUM('always', 'weekdays_only', 'weekends_only', 'by_appointment_only', 'seasonal');
CREATE TYPE "public"."service_category" AS ENUM('cut', 'color', 'perm', 'treatment', 'spa', 'styling', 'extension', 'other');
CREATE TYPE "public"."service_option_type" AS ENUM('addon', 'upgrade', 'duration_extension', 'product_choice');
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive', 'coming_soon', 'discontinued');
CREATE TYPE "public"."staff_level" AS ENUM('junior', 'stylist', 'senior', 'expert', 'director');
CREATE TYPE "public"."two_factor_status" AS ENUM('disabled', 'pending', 'enabled');
CREATE TYPE "public"."user_role" AS ENUM('customer', 'staff', 'manager', 'admin', 'owner');
CREATE TABLE "booking_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookingId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"staffId" uuid,
	"startTime" timestamp with time zone NOT NULL,
	"endTime" timestamp with time zone NOT NULL,
	"duration" integer NOT NULL,
	"price" integer NOT NULL,
	"discountAmount" integer DEFAULT 0 NOT NULL,
	"finalPrice" integer NOT NULL,
	"selectedOptions" jsonb,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp with time zone,
	"notes" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_services_order_unique" UNIQUE("bookingId","sortOrder"),
	CONSTRAINT "booking_services_completed_has_time" CHECK ("isCompleted" = ("completedAt" IS NOT NULL)),
	CONSTRAINT "booking_services_discount_within_price" CHECK (("discountAmount" >= 0) AND ("discountAmount" <= price)),
	CONSTRAINT "booking_services_duration_is_the_span" CHECK (((duration * 60))::numeric = EXTRACT(epoch FROM ("endTime" - "startTime"))),
	CONSTRAINT "booking_services_end_after_start" CHECK ("startTime" < "endTime"),
	CONSTRAINT "booking_services_final_price_is_the_difference" CHECK ("finalPrice" = (price - "discountAmount")),
	CONSTRAINT "booking_services_sort_order_not_negative" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "booking_status_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookingId" uuid NOT NULL,
	"fromStatus" "booking_status",
	"toStatus" "booking_status" NOT NULL,
	"changedBy" uuid,
	"reason" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookingNumber" varchar(50) NOT NULL,
	"salonId" uuid NOT NULL,
	"customerId" uuid NOT NULL,
	"staffId" uuid NOT NULL,
	"bookingDate" date NOT NULL,
	"startTime" timestamp with time zone NOT NULL,
	"endTime" timestamp with time zone NOT NULL,
	"duration" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"subtotal" integer NOT NULL,
	"discountAmount" integer DEFAULT 0 NOT NULL,
	"taxAmount" integer DEFAULT 0 NOT NULL,
	"totalAmount" integer NOT NULL,
	"depositAmount" integer,
	"pointsUsed" integer,
	"pointsEarned" integer,
	"customerRequest" text,
	"internalNotes" text,
	"reminderSent" boolean DEFAULT false NOT NULL,
	"reminderSentAt" timestamp with time zone,
	"cancelledAt" timestamp with time zone,
	"cancelledBy" uuid,
	"cancellationReason" text,
	"cancellationFee" integer,
	"completedAt" timestamp with time zone,
	"actualStartTime" timestamp with time zone,
	"actualEndTime" timestamp with time zone,
	"source" varchar(50),
	"ipAddress" varchar(50),
	"userAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_number_unique" UNIQUE("bookingNumber"),
	CONSTRAINT "bookings_actual_end_after_start" CHECK (("actualStartTime" IS NULL) OR ("actualEndTime" IS NULL) OR ("actualStartTime" < "actualEndTime")),
	CONSTRAINT "bookings_amounts_not_negative" CHECK ((subtotal >= 0) AND ("discountAmount" >= 0) AND ("taxAmount" >= 0) AND ("totalAmount" >= 0) AND (("depositAmount" IS NULL) OR ("depositAmount" >= 0)) AND (("pointsUsed" IS NULL) OR ("pointsUsed" >= 0)) AND (("pointsEarned" IS NULL) OR ("pointsEarned" >= 0)) AND (("cancellationFee" IS NULL) OR ("cancellationFee" >= 0))),
	CONSTRAINT "bookings_cancellation_only_when_cancelled" CHECK ((status = 'cancelled'::booking_status) OR (("cancelledBy" IS NULL) AND ("cancellationReason" IS NULL) AND ("cancellationFee" IS NULL))),
	CONSTRAINT "bookings_cancelled_has_time" CHECK ((status = 'cancelled'::booking_status) = ("cancelledAt" IS NOT NULL)),
	CONSTRAINT "bookings_completed_has_time" CHECK ((status = 'completed'::booking_status) = ("completedAt" IS NOT NULL)),
	CONSTRAINT "bookings_discount_within_subtotal" CHECK ("discountAmount" <= subtotal),
	CONSTRAINT "bookings_duration_is_the_span" CHECK (((duration * 60))::numeric = EXTRACT(epoch FROM ("endTime" - "startTime"))),
	CONSTRAINT "bookings_end_after_start" CHECK ("startTime" < "endTime"),
	CONSTRAINT "bookings_in_progress_has_start" CHECK ((status <> 'in_progress'::booking_status) OR ("actualStartTime" IS NOT NULL)),
	CONSTRAINT "bookings_total_is_the_sum" CHECK ("totalAmount" = ((subtotal - "discountAmount") + "taxAmount"))
);

CREATE TABLE "customer_allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customerId" uuid NOT NULL,
	"allergyType" "allergy_type" NOT NULL,
	"allergenName" varchar(255) NOT NULL,
	"severity" integer DEFAULT 3 NOT NULL,
	"symptoms" text,
	"notes" text,
	"confirmedDate" date,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"severityType" "allergy_severity"
);

CREATE TABLE "customer_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customerId" uuid NOT NULL,
	"transactionType" "point_transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"balance" integer NOT NULL,
	"description" text,
	"referenceType" varchar(50),
	"referenceId" uuid,
	"expiryDate" date,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "customer_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customerId" uuid NOT NULL,
	"preferredStaffId" uuid,
	"preferredTimeSlots" jsonb NOT NULL,
	"avoidStaffIds" uuid[] NOT NULL,
	"stylePreferences" jsonb,
	"communicationStyle" varchar(100),
	"specialRequests" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_preferences_unique" UNIQUE("customerId"),
	CONSTRAINT "customer_preferences_preferred_staff_not_avoided" CHECK ("preferredStaffId" <> ALL ("avoidStaffIds")),
	CONSTRAINT "customer_preferences_style_is_an_object" CHECK (jsonb_typeof("stylePreferences") = 'object'::text),
	CONSTRAINT "customer_preferences_time_slots_is_an_array" CHECK (jsonb_typeof("preferredTimeSlots") = 'array'::text)
);

CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"firstName" varchar(100) NOT NULL,
	"lastName" varchar(100) NOT NULL,
	"firstNameKana" varchar(100),
	"lastNameKana" varchar(100),
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"alternativePhone" varchar(20),
	"postalCode" varchar(10),
	"prefecture" varchar(50),
	"city" varchar(100),
	"address" varchar(255),
	"building" varchar(255),
	"birthDate" date,
	"gender" varchar(20),
	"occupation" varchar(100),
	"membershipTier" "membership_tier" DEFAULT 'regular' NOT NULL,
	"loyaltyPoints" integer DEFAULT 0 NOT NULL,
	"lifetimeValue" integer DEFAULT 0 NOT NULL,
	"preferences" jsonb,
	"notes" text,
	"internalNotes" text,
	"tags" text[] NOT NULL,
	"referredBy" uuid,
	"referralCode" varchar(50),
	"allowMarketing" boolean DEFAULT true NOT NULL,
	"allowSms" boolean DEFAULT true NOT NULL,
	"allowEmail" boolean DEFAULT true NOT NULL,
	"firstVisitDate" date,
	"lastVisitDate" date,
	"visitCount" integer DEFAULT 0 NOT NULL,
	"noShowCount" integer DEFAULT 0 NOT NULL,
	"cancellationCount" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"hairType" "hair_type",
	"hairThickness" "hair_thickness",
	"scalpCondition" "scalp_condition",
	"customerStatus" "customer_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "customers_referral_code_unique" UNIQUE("referralCode"),
	CONSTRAINT "customers_counts_not_negative" CHECK (("visitCount" >= 0) AND ("noShowCount" >= 0) AND ("cancellationCount" >= 0)),
	CONSTRAINT "customers_email_lower_case" CHECK ((email)::text = lower((email)::text)),
	CONSTRAINT "customers_gender_known" CHECK ((gender)::text = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])),
	CONSTRAINT "customers_not_referred_by_itself" CHECK ("referredBy" <> id),
	CONSTRAINT "customers_preferences_is_an_object" CHECK (jsonb_typeof(preferences) = 'object'::text),
	CONSTRAINT "customers_visit_days_go_with_visits" CHECK ((("visitCount" = 0) = ("firstVisitDate" IS NULL)) AND (("firstVisitDate" IS NULL) = ("lastVisitDate" IS NULL)) AND (("firstVisitDate" IS NULL) OR ("firstVisitDate" <= "lastVisitDate")))
);

CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"summaryDate" date NOT NULL,
	"totalBookings" integer DEFAULT 0 NOT NULL,
	"completedBookings" integer DEFAULT 0 NOT NULL,
	"cancelledBookings" integer DEFAULT 0 NOT NULL,
	"noShowBookings" integer DEFAULT 0 NOT NULL,
	"uniqueCustomers" integer DEFAULT 0 NOT NULL,
	"newCustomers" integer DEFAULT 0 NOT NULL,
	"returningCustomers" integer DEFAULT 0 NOT NULL,
	"totalSales" integer DEFAULT 0 NOT NULL,
	"serviceSales" integer DEFAULT 0 NOT NULL,
	"productSales" integer DEFAULT 0 NOT NULL,
	"averageTicket" integer DEFAULT 0 NOT NULL,
	"activeStaff" integer DEFAULT 0 NOT NULL,
	"totalServiceHours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"utilizationRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"topService" jsonb,
	"topStaff" jsonb,
	"topProduct" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_summaries_unique" UNIQUE("salonId","summaryDate")
);

CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"currentStock" numeric(10, 2) NOT NULL,
	"availableStock" numeric(10, 2) NOT NULL,
	"reservedStock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lotNumber" varchar(100),
	"expiryDate" date,
	"location" varchar(100),
	"shelf" varchar(50),
	"lastCountedAt" timestamp with time zone,
	"lastCountedBy" uuid,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_unique" UNIQUE("salonId","productId","lotNumber")
);

CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"inventoryId" uuid,
	"transactionType" "inventory_transaction_type" NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"balanceBefore" numeric(10, 2) NOT NULL,
	"balanceAfter" numeric(10, 2) NOT NULL,
	"unitCost" integer,
	"totalCost" integer,
	"referenceType" varchar(50),
	"referenceId" uuid,
	"lotNumber" varchar(100),
	"expiryDate" date,
	"reason" text,
	"performedBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "membership_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"tier" "membership_tier" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"requiredPoints" integer DEFAULT 0 NOT NULL,
	"requiredAmount" integer DEFAULT 0 NOT NULL,
	"discountRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"pointMultiplier" numeric(3, 1) DEFAULT '1.0' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb,
	"color" varchar(7),
	"iconUrl" varchar(500),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_tiers_unique" UNIQUE("salonId","tier")
);

CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipientId" uuid NOT NULL,
	"recipientType" varchar(20) NOT NULL,
	"notificationType" "notification_type" NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"templateId" varchar(100),
	"variables" jsonb,
	"status" varchar(20) NOT NULL,
	"sentAt" timestamp with time zone,
	"deliveredAt" timestamp with time zone,
	"failedAt" timestamp with time zone,
	"errorMessage" text,
	"referenceType" varchar(50),
	"referenceId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"notificationChannel" "notification_channel" NOT NULL
);

CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"dayOfWeek" "day_of_week" NOT NULL,
	"date" date NOT NULL,
	"openTime" time,
	"closeTime" time,
	"isHoliday" boolean DEFAULT false NOT NULL,
	"holidayName" varchar(100),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"displayName" varchar(100) NOT NULL,
	"description" text,
	"processorName" varchar(100),
	"processorConfig" jsonb,
	"fee" numeric(5, 2) DEFAULT '0',
	"minimumAmount" integer,
	"maximumAmount" integer,
	"isOnlineEnabled" boolean DEFAULT false NOT NULL,
	"isOfflineEnabled" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saleId" uuid NOT NULL,
	"paymentMethodId" uuid NOT NULL,
	"transactionNumber" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" NOT NULL,
	"processorTransactionId" varchar(255),
	"processorResponse" jsonb,
	"cardLastFour" varchar(4),
	"cardBrand" varchar(50),
	"errorCode" varchar(100),
	"errorMessage" text,
	"processedAt" timestamp with time zone,
	"failedAt" timestamp with time zone,
	"refundedAt" timestamp with time zone,
	"refundAmount" integer,
	"refundReason" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_transaction_number_unique" UNIQUE("transactionNumber")
);

CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"productCode" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"brand" varchar(100),
	"purchasePrice" integer,
	"retailPrice" integer,
	"salonPrice" integer,
	"unit" varchar(20) NOT NULL,
	"minimumStock" numeric(10, 2) DEFAULT '0',
	"maximumStock" numeric(10, 2),
	"reorderPoint" numeric(10, 2),
	"supplierId" uuid,
	"supplierProductCode" varchar(100),
	"leadTimeDays" integer,
	"imageUrl" varchar(500),
	"barcode" varchar(100),
	"isForSale" boolean DEFAULT false NOT NULL,
	"isForTreatment" boolean DEFAULT true NOT NULL,
	"requiresLotTracking" boolean DEFAULT false NOT NULL,
	"expiryMonths" integer,
	"storageConditions" text,
	"safetyDataSheet" varchar(500),
	"isActive" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_salon_unique" UNIQUE("salonId","productCode")
);

CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"customerId" uuid NOT NULL,
	"bookingId" uuid NOT NULL,
	"staffId" uuid,
	"overallRating" integer NOT NULL,
	"serviceRating" integer,
	"staffRating" integer,
	"atmosphereRating" integer,
	"cleanlinessRating" integer,
	"valueRating" integer,
	"title" varchar(255),
	"comment" text,
	"imageUrls" jsonb DEFAULT '[]'::jsonb,
	"isVerified" boolean DEFAULT false NOT NULL,
	"helpfulCount" integer DEFAULT 0 NOT NULL,
	"reportCount" integer DEFAULT 0 NOT NULL,
	"ownerResponse" text,
	"ownerRespondedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_unique" UNIQUE("bookingId")
);

CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saleNumber" varchar(50) NOT NULL,
	"salonId" uuid NOT NULL,
	"customerId" uuid,
	"staffId" uuid,
	"bookingId" uuid,
	"saleDate" date NOT NULL,
	"saleTime" timestamp with time zone NOT NULL,
	"subtotal" integer NOT NULL,
	"discountAmount" integer DEFAULT 0 NOT NULL,
	"taxAmount" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"pointsUsed" integer DEFAULT 0,
	"pointsEarned" integer DEFAULT 0,
	"paymentStatus" "payment_status" DEFAULT 'pending' NOT NULL,
	"isVoid" boolean DEFAULT false NOT NULL,
	"voidedAt" timestamp with time zone,
	"voidReason" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_number_unique" UNIQUE("saleNumber")
);

CREATE TABLE "sales_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saleId" uuid NOT NULL,
	"itemType" varchar(50) NOT NULL,
	"itemId" uuid,
	"itemName" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" integer NOT NULL,
	"discountAmount" integer DEFAULT 0 NOT NULL,
	"taxAmount" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"staffId" uuid,
	"commissionRate" numeric(5, 2),
	"commissionAmount" integer,
	"notes" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"nameKana" varchar(255),
	"description" text,
	"postalCode" varchar(10),
	"prefecture" varchar(50) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address" varchar(255) NOT NULL,
	"building" varchar(255),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"phoneNumber" varchar(20) NOT NULL,
	"alternativePhone" varchar(20),
	"email" varchar(255) NOT NULL,
	"websiteUrl" varchar(500),
	"logoUrl" varchar(500),
	"imageUrls" text[] NOT NULL,
	"features" text[] NOT NULL,
	"amenities" text[] NOT NULL,
	"businessHours" jsonb,
	"rating" numeric(3, 2),
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"timezone" varchar(50) DEFAULT 'Asia/Tokyo' NOT NULL,
	"currency" varchar(3) DEFAULT 'JPY' NOT NULL,
	"taxRate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"cancellationPolicy" jsonb,
	"bookingPolicy" jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"parentId" uuid,
	"category" "service_category" NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"iconUrl" varchar(500),
	"color" varchar(7),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "service_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serviceId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"additionalTime" integer DEFAULT 0 NOT NULL,
	"additionalPrice" integer DEFAULT 0 NOT NULL,
	"maxQuantity" integer DEFAULT 1 NOT NULL,
	"isRequired" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"optionType" "service_option_type" DEFAULT 'addon' NOT NULL,
	CONSTRAINT "service_options_additional_price_not_negative" CHECK ("additionalPrice" >= 0),
	CONSTRAINT "service_options_additional_time_not_negative" CHECK ("additionalTime" >= 0),
	CONSTRAINT "service_options_max_quantity_positive" CHECK ("maxQuantity" > 0)
);

CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"categoryId" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"shortDescription" varchar(500),
	"duration" integer NOT NULL,
	"price" integer NOT NULL,
	"discountPrice" integer,
	"taxIncluded" boolean DEFAULT true NOT NULL,
	"imageUrl" varchar(500),
	"imageUrls" text[] NOT NULL,
	"requiredStaffLevel" "staff_level",
	"maxBookingsPerDay" integer,
	"requiresConsultation" boolean DEFAULT false NOT NULL,
	"allowOnlineBooking" boolean DEFAULT true NOT NULL,
	"isPackage" boolean DEFAULT false NOT NULL,
	"packageServiceIds" uuid[] NOT NULL,
	"requiredProducts" jsonb DEFAULT '[]'::jsonb,
	"tags" text[] NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"pricingStrategy" "pricing_strategy" DEFAULT 'fixed' NOT NULL,
	"serviceStatus" "service_status" DEFAULT 'active' NOT NULL,
	"availability" "service_availability" DEFAULT 'always' NOT NULL,
	"bookingRequirements" "booking_requirement"[] NOT NULL,
	CONSTRAINT "services_discount_price_within_price" CHECK (("discountPrice" IS NULL) OR (("discountPrice" >= 0) AND ("discountPrice" <= price))),
	CONSTRAINT "services_duration_positive" CHECK (duration > 0),
	CONSTRAINT "services_max_bookings_per_day_positive" CHECK (("maxBookingsPerDay" IS NULL) OR ("maxBookingsPerDay" > 0)),
	CONSTRAINT "services_package_members" CHECK (("isPackage" AND ((cardinality("packageServiceIds") >= 2) AND (cardinality("packageServiceIds") <= 20))) OR ((NOT "isPackage") AND (cardinality("packageServiceIds") = 0))),
	CONSTRAINT "services_price_not_negative" CHECK (price >= 0)
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"refreshTokenHash" text NOT NULL,
	"ipAddress" varchar(50),
	"userAgent" text,
	"expiresAt" timestamp with time zone NOT NULL,
	"refreshExpiresAt" timestamp with time zone NOT NULL,
	"lastActivityAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refreshTokenHash"),
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("tokenHash")
);

CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salonId" uuid NOT NULL,
	"userId" uuid,
	"firstName" varchar(100) NOT NULL,
	"lastName" varchar(100) NOT NULL,
	"firstNameKana" varchar(100),
	"lastNameKana" varchar(100),
	"displayName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phoneNumber" varchar(20) NOT NULL,
	"alternativePhone" varchar(20),
	"staffCode" varchar(50),
	"level" "staff_level" DEFAULT 'stylist' NOT NULL,
	"position" varchar(100),
	"specialties" text[] NOT NULL,
	"bio" text,
	"imageUrl" varchar(500),
	"yearsOfExperience" integer DEFAULT 0,
	"certifications" text[] NOT NULL,
	"awards" jsonb DEFAULT '[]'::jsonb,
	"hireDate" date,
	"employmentType" varchar(50),
	"baseSalary" integer,
	"commissionRate" numeric(5, 2),
	"canReceiveBookings" boolean DEFAULT true NOT NULL,
	"maxConcurrentBookings" integer DEFAULT 1 NOT NULL,
	"bufferTimeBefore" integer DEFAULT 0 NOT NULL,
	"bufferTimeAfter" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_code_salon_unique" UNIQUE("salonId","staffCode"),
	CONSTRAINT "staff_base_salary_not_negative" CHECK ("baseSalary" >= 0),
	CONSTRAINT "staff_buffer_times_not_negative" CHECK (("bufferTimeBefore" >= 0) AND ("bufferTimeAfter" >= 0)),
	CONSTRAINT "staff_commission_rate_is_a_percentage" CHECK (("commissionRate" >= (0)::numeric) AND ("commissionRate" <= (100)::numeric)),
	CONSTRAINT "staff_email_lower_case" CHECK ((email)::text = lower((email)::text)),
	CONSTRAINT "staff_max_concurrent_bookings_positive" CHECK ("maxConcurrentBookings" >= 1),
	CONSTRAINT "staff_years_of_experience_not_negative" CHECK ("yearsOfExperience" >= 0)
);

CREATE TABLE "staff_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffId" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "salon_role" NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitations_staff_unique" UNIQUE("staffId"),
	CONSTRAINT "staff_invitations_token_hash_unique" UNIQUE("tokenHash"),
	CONSTRAINT "staff_invitations_email_lower_case" CHECK ((email)::text = lower((email)::text))
);

CREATE TABLE "staff_performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffId" uuid NOT NULL,
	"periodStart" date NOT NULL,
	"periodEnd" date NOT NULL,
	"periodType" varchar(20) NOT NULL,
	"totalBookings" integer DEFAULT 0 NOT NULL,
	"completedBookings" integer DEFAULT 0 NOT NULL,
	"cancelledBookings" integer DEFAULT 0 NOT NULL,
	"rebookingRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"totalRevenue" integer DEFAULT 0 NOT NULL,
	"serviceRevenue" integer DEFAULT 0 NOT NULL,
	"productRevenue" integer DEFAULT 0 NOT NULL,
	"averageTicket" integer DEFAULT 0 NOT NULL,
	"commission" integer DEFAULT 0 NOT NULL,
	"totalHoursWorked" numeric(10, 2) DEFAULT '0' NOT NULL,
	"totalServiceHours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"utilizationRate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"uniqueCustomers" integer DEFAULT 0 NOT NULL,
	"newCustomers" integer DEFAULT 0 NOT NULL,
	"returningCustomers" integer DEFAULT 0 NOT NULL,
	"averageRating" numeric(3, 2),
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_performances_unique" UNIQUE("staffId","periodStart","periodType")
);

CREATE TABLE "staff_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffId" uuid NOT NULL,
	"dayOfWeek" "day_of_week",
	"date" date,
	"startTime" time,
	"endTime" time,
	"breakStartTime" time,
	"breakEndTime" time,
	"isRecurring" boolean DEFAULT true NOT NULL,
	"isAvailable" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_schedules_break_has_both_times" CHECK (("breakStartTime" IS NULL) = ("breakEndTime" IS NULL)),
	CONSTRAINT "staff_schedules_break_inside_working_hours" CHECK (("startTime" < "breakStartTime") AND ("breakStartTime" < "breakEndTime") AND ("breakEndTime" < "endTime")),
	CONSTRAINT "staff_schedules_end_after_start" CHECK ("startTime" < "endTime"),
	CONSTRAINT "staff_schedules_times_when_available" CHECK (("isAvailable" AND ("startTime" IS NOT NULL) AND ("endTime" IS NOT NULL)) OR ((NOT "isAvailable") AND ("startTime" IS NULL) AND ("endTime" IS NULL) AND ("breakStartTime" IS NULL) AND ("breakEndTime" IS NULL))),
	CONSTRAINT "staff_schedules_weekly_or_single_day" CHECK (("isRecurring" AND ("dayOfWeek" IS NOT NULL) AND (date IS NULL)) OR ((NOT "isRecurring") AND ("dayOfWeek" IS NULL) AND (date IS NOT NULL)))
);

CREATE TABLE "staff_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"proficiencyLevel" integer DEFAULT 3 NOT NULL,
	"certificateDate" date,
	"certificateUrl" varchar(500),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_skills_unique" UNIQUE("staffId","serviceId")
);

CREATE TABLE "treatment_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treatmentRecordId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"lotNumber" varchar(100),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "treatment_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treatmentRecordId" uuid NOT NULL,
	"photoType" varchar(20) NOT NULL,
	"photoUrl" varchar(500) NOT NULL,
	"thumbnailUrl" varchar(500),
	"angle" varchar(50),
	"description" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"customerConsent" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "treatment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookingId" uuid NOT NULL,
	"customerId" uuid NOT NULL,
	"staffId" uuid NOT NULL,
	"services" jsonb NOT NULL,
	"techniques" jsonb DEFAULT '[]'::jsonb,
	"consultationNotes" text,
	"scalpCondition" jsonb,
	"hairCondition" jsonb,
	"colorFormula" jsonb,
	"processingTime" integer,
	"beforePhotos" jsonb DEFAULT '[]'::jsonb,
	"afterPhotos" jsonb DEFAULT '[]'::jsonb,
	"resultNotes" text,
	"nextRecommendedDate" date,
	"nextRecommendedServices" jsonb DEFAULT '[]'::jsonb,
	"homeCareSuggestions" text,
	"customerSatisfaction" integer,
	"staffEvaluation" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_records_booking_unique" UNIQUE("bookingId")
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"passwordHash" text NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"emailVerificationTokenHash" varchar(255),
	"emailVerificationExpiry" timestamp with time zone,
	"passwordResetTokenHash" varchar(255),
	"passwordResetExpiry" timestamp with time zone,
	"lastPasswordChange" timestamp with time zone,
	"twoFactorSecret" text,
	"backupCodes" jsonb,
	"failedLoginAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp with time zone,
	"lastLoginAt" timestamp with time zone,
	"lastLoginIp" varchar(50),
	"customerId" uuid,
	"staffId" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"twoFactorStatus" "two_factor_status" DEFAULT 'disabled' NOT NULL,
	"twoFactorLastUsedStep" integer,
	CONSTRAINT "users_backup_codes_are_a_list" CHECK (jsonb_typeof("backupCodes") = 'array'::text),
	CONSTRAINT "users_backup_codes_match_status" CHECK (("twoFactorStatus" = 'disabled'::two_factor_status) = ("backupCodes" IS NULL)),
	CONSTRAINT "users_email_lower_case" CHECK ((email)::text = lower((email)::text)),
	CONSTRAINT "users_email_verification_token_complete" CHECK (("emailVerificationTokenHash" IS NULL) = ("emailVerificationExpiry" IS NULL)),
	CONSTRAINT "users_password_reset_token_complete" CHECK (("passwordResetTokenHash" IS NULL) = ("passwordResetExpiry" IS NULL)),
	CONSTRAINT "users_staff_needs_salon_role" CHECK (("staffId" IS NULL) OR (role = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'staff'::user_role]))),
	CONSTRAINT "users_two_factor_secret_matches_status" CHECK (("twoFactorStatus" = 'disabled'::two_factor_status) = ("twoFactorSecret" IS NULL)),
	CONSTRAINT "users_two_factor_step_needs_secret" CHECK (("twoFactorLastUsedStep" IS NULL) OR ("twoFactorSecret" IS NOT NULL))
);

ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "booking_status_histories" ADD CONSTRAINT "booking_status_histories_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "customer_allergies" ADD CONSTRAINT "customer_allergies_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_points" ADD CONSTRAINT "customer_points_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_staff_id_fk" FOREIGN KEY ("preferredStaffId") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_fk" FOREIGN KEY ("referredBy") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_id_fk" FOREIGN KEY ("inventoryId") REFERENCES "public"."inventory"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "membership_tiers" ADD CONSTRAINT "membership_tiers_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_method_id_fk" FOREIGN KEY ("paymentMethodId") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_sale_id_fk" FOREIGN KEY ("saleId") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales_details" ADD CONSTRAINT "sales_details_sale_id_fk" FOREIGN KEY ("saleId") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_details" ADD CONSTRAINT "sales_details_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parent_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff" ADD CONSTRAINT "staff_salon_id_fk" FOREIGN KEY ("salonId") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff_performances" ADD CONSTRAINT "staff_performances_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff_skills" ADD CONSTRAINT "staff_skills_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "treatment_materials" ADD CONSTRAINT "treatment_materials_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treatment_materials" ADD CONSTRAINT "treatment_materials_treatment_record_id_fk" FOREIGN KEY ("treatmentRecordId") REFERENCES "public"."treatment_records"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "treatment_photos" ADD CONSTRAINT "treatment_photos_treatment_record_id_fk" FOREIGN KEY ("treatmentRecordId") REFERENCES "public"."treatment_records"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "idx_booking_services_booking_id" ON "booking_services" USING btree ("bookingId" uuid_ops);
CREATE INDEX "idx_booking_services_service_id" ON "booking_services" USING btree ("serviceId" uuid_ops);
CREATE INDEX "idx_booking_services_staff_start" ON "booking_services" USING btree ("staffId" uuid_ops,"startTime" timestamptz_ops);
CREATE INDEX "idx_booking_status_histories_booking_id" ON "booking_status_histories" USING btree ("bookingId" uuid_ops);
CREATE INDEX "idx_booking_status_histories_created_at" ON "booking_status_histories" USING btree ("createdAt" timestamptz_ops);
CREATE INDEX "idx_bookings_booking_date" ON "bookings" USING btree ("bookingDate" date_ops);
CREATE INDEX "idx_bookings_booking_number" ON "bookings" USING btree ("bookingNumber" text_ops);
CREATE INDEX "idx_bookings_customer_id" ON "bookings" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_bookings_salon_start" ON "bookings" USING btree ("salonId" uuid_ops,"startTime" timestamptz_ops,"id" uuid_ops);
CREATE INDEX "idx_bookings_staff_id" ON "bookings" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_bookings_start_time" ON "bookings" USING btree ("startTime" timestamptz_ops);
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status" enum_ops);
CREATE INDEX "idx_customer_allergies_customer_id" ON "customer_allergies" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_customer_points_created_at" ON "customer_points" USING btree ("createdAt" timestamptz_ops);
CREATE INDEX "idx_customer_points_customer_id" ON "customer_points" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_customer_points_expiry_date" ON "customer_points" USING btree ("expiryDate" date_ops);
CREATE INDEX "idx_customers_customer_status" ON "customers" USING btree ("customerStatus" enum_ops);
CREATE INDEX "idx_customers_deleted_at" ON "customers" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_customers_email" ON "customers" USING btree ("email" text_ops);
CREATE INDEX "idx_customers_hair_type" ON "customers" USING btree ("hairType" enum_ops);
CREATE INDEX "idx_customers_membership_tier" ON "customers" USING btree ("membershipTier" enum_ops);
CREATE INDEX "idx_customers_phone_number" ON "customers" USING btree ("phoneNumber" text_ops);
CREATE UNIQUE INDEX "customers_email_unique" ON "customers" USING btree ("email" text_ops) WHERE ("deletedAt" IS NULL);
CREATE UNIQUE INDEX "customers_user_unique" ON "customers" USING btree ("userId" uuid_ops) WHERE ("deletedAt" IS NULL);
CREATE INDEX "idx_daily_summaries_salon_id" ON "daily_summaries" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_daily_summaries_summary_date" ON "daily_summaries" USING btree ("summaryDate" date_ops);
CREATE INDEX "idx_inventory_expiry_date" ON "inventory" USING btree ("expiryDate" date_ops);
CREATE INDEX "idx_inventory_lot_number" ON "inventory" USING btree ("lotNumber" text_ops);
CREATE INDEX "idx_inventory_product_id" ON "inventory" USING btree ("productId" uuid_ops);
CREATE INDEX "idx_inventory_salon_id" ON "inventory" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_inventory_transactions_created_at" ON "inventory_transactions" USING btree ("createdAt" timestamptz_ops);
CREATE INDEX "idx_inventory_transactions_inventory_id" ON "inventory_transactions" USING btree ("inventoryId" uuid_ops);
CREATE INDEX "idx_inventory_transactions_product_id" ON "inventory_transactions" USING btree ("productId" uuid_ops);
CREATE INDEX "idx_inventory_transactions_salon_id" ON "inventory_transactions" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_inventory_transactions_transaction_type" ON "inventory_transactions" USING btree ("transactionType" enum_ops);
CREATE INDEX "idx_membership_tiers_salon_id" ON "membership_tiers" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_notification_logs_created_at" ON "notification_logs" USING btree ("createdAt" timestamptz_ops);
CREATE INDEX "idx_notification_logs_notification_type" ON "notification_logs" USING btree ("notificationType" enum_ops);
CREATE INDEX "idx_notification_logs_recipient_id" ON "notification_logs" USING btree ("recipientId" uuid_ops);
CREATE INDEX "idx_opening_hours_date" ON "opening_hours" USING btree ("date" date_ops);
CREATE INDEX "idx_opening_hours_salon_id" ON "opening_hours" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_payment_methods_salon_id" ON "payment_methods" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_payment_transactions_payment_method_id" ON "payment_transactions" USING btree ("paymentMethodId" uuid_ops);
CREATE INDEX "idx_payment_transactions_sale_id" ON "payment_transactions" USING btree ("saleId" uuid_ops);
CREATE INDEX "idx_payment_transactions_status" ON "payment_transactions" USING btree ("status" enum_ops);
CREATE INDEX "idx_payment_transactions_transaction_number" ON "payment_transactions" USING btree ("transactionNumber" text_ops);
CREATE INDEX "idx_products_barcode" ON "products" USING btree ("barcode" text_ops);
CREATE INDEX "idx_products_deleted_at" ON "products" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_products_product_code" ON "products" USING btree ("productCode" text_ops);
CREATE INDEX "idx_products_salon_id" ON "products" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_reviews_booking_id" ON "reviews" USING btree ("bookingId" uuid_ops);
CREATE INDEX "idx_reviews_customer_id" ON "reviews" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_reviews_overall_rating" ON "reviews" USING btree ("overallRating" int4_ops);
CREATE INDEX "idx_reviews_salon_id" ON "reviews" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_reviews_staff_id" ON "reviews" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_sales_booking_id" ON "sales" USING btree ("bookingId" uuid_ops);
CREATE INDEX "idx_sales_customer_id" ON "sales" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_sales_sale_date" ON "sales" USING btree ("saleDate" date_ops);
CREATE INDEX "idx_sales_sale_number" ON "sales" USING btree ("saleNumber" text_ops);
CREATE INDEX "idx_sales_salon_id" ON "sales" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_sales_staff_id" ON "sales" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_sales_details_sale_id" ON "sales_details" USING btree ("saleId" uuid_ops);
CREATE INDEX "idx_sales_details_staff_id" ON "sales_details" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_salons_deleted_at" ON "salons" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_salons_email" ON "salons" USING btree ("email" text_ops);
CREATE INDEX "idx_salons_rating" ON "salons" USING btree ("rating" numeric_ops);
CREATE INDEX "idx_salons_review_count" ON "salons" USING btree ("reviewCount" int4_ops);
CREATE UNIQUE INDEX "salons_email_unique" ON "salons" USING btree ("email" text_ops) WHERE ("deletedAt" IS NULL);
CREATE INDEX "idx_service_categories_parent_id" ON "service_categories" USING btree ("parentId" uuid_ops);
CREATE INDEX "idx_service_categories_salon_id" ON "service_categories" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_service_options_service_id" ON "service_options" USING btree ("serviceId" uuid_ops);
CREATE INDEX "idx_services_availability" ON "services" USING btree ("availability" enum_ops);
CREATE INDEX "idx_services_category_id" ON "services" USING btree ("categoryId" uuid_ops);
CREATE INDEX "idx_services_deleted_at" ON "services" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_services_pricing_strategy" ON "services" USING btree ("pricingStrategy" enum_ops);
CREATE INDEX "idx_services_salon_id" ON "services" USING btree ("salonId" uuid_ops);
CREATE INDEX "idx_services_service_status" ON "services" USING btree ("serviceStatus" enum_ops);
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expiresAt" timestamptz_ops);
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("userId" uuid_ops);
CREATE INDEX "idx_staff_deleted_at" ON "staff" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_staff_email" ON "staff" USING btree ("email" text_ops);
CREATE INDEX "idx_staff_salon_id" ON "staff" USING btree ("salonId" uuid_ops);
CREATE UNIQUE INDEX "staff_email_salon_unique" ON "staff" USING btree ("salonId" uuid_ops,"email" text_ops) WHERE ("deletedAt" IS NULL);
CREATE UNIQUE INDEX "staff_user_unique" ON "staff" USING btree ("userId" uuid_ops) WHERE ("deletedAt" IS NULL);
CREATE INDEX "idx_staff_performances_period_start" ON "staff_performances" USING btree ("periodStart" date_ops);
CREATE INDEX "idx_staff_performances_period_type" ON "staff_performances" USING btree ("periodType" text_ops);
CREATE INDEX "idx_staff_performances_staff_id" ON "staff_performances" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_staff_schedules_date" ON "staff_schedules" USING btree ("date" date_ops);
CREATE INDEX "idx_staff_schedules_day_of_week" ON "staff_schedules" USING btree ("dayOfWeek" enum_ops);
CREATE INDEX "idx_staff_schedules_staff_id" ON "staff_schedules" USING btree ("staffId" uuid_ops);
CREATE UNIQUE INDEX "staff_schedules_single_day_unique" ON "staff_schedules" USING btree ("staffId" uuid_ops,"date" date_ops) WHERE (NOT "isRecurring");
CREATE UNIQUE INDEX "staff_schedules_weekly_unique" ON "staff_schedules" USING btree ("staffId" uuid_ops,"dayOfWeek" enum_ops) WHERE "isRecurring";
CREATE INDEX "idx_staff_skills_service_id" ON "staff_skills" USING btree ("serviceId" uuid_ops);
CREATE INDEX "idx_staff_skills_staff_id" ON "staff_skills" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_treatment_materials_product_id" ON "treatment_materials" USING btree ("productId" uuid_ops);
CREATE INDEX "idx_treatment_materials_treatment_record_id" ON "treatment_materials" USING btree ("treatmentRecordId" uuid_ops);
CREATE INDEX "idx_treatment_photos_photo_type" ON "treatment_photos" USING btree ("photoType" text_ops);
CREATE INDEX "idx_treatment_photos_treatment_record_id" ON "treatment_photos" USING btree ("treatmentRecordId" uuid_ops);
CREATE INDEX "idx_treatment_records_booking_id" ON "treatment_records" USING btree ("bookingId" uuid_ops);
CREATE INDEX "idx_treatment_records_customer_id" ON "treatment_records" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_treatment_records_staff_id" ON "treatment_records" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_users_customer_id" ON "users" USING btree ("customerId" uuid_ops);
CREATE INDEX "idx_users_deleted_at" ON "users" USING btree ("deletedAt" timestamptz_ops);
CREATE INDEX "idx_users_staff_id" ON "users" USING btree ("staffId" uuid_ops);
CREATE INDEX "idx_users_two_factor_status" ON "users" USING btree ("twoFactorStatus" enum_ops);
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email" text_ops) WHERE ("deletedAt" IS NULL);
CREATE UNIQUE INDEX "users_email_verification_token_hash_unique" ON "users" USING btree ("emailVerificationTokenHash" text_ops);
CREATE UNIQUE INDEX "users_password_reset_token_hash_unique" ON "users" USING btree ("passwordResetTokenHash" text_ops);
CREATE UNIQUE INDEX "users_staff_unique" ON "users" USING btree ("staffId" uuid_ops) WHERE ("deletedAt" IS NULL);