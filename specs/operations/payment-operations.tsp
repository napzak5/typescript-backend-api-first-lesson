import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/payment.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("来店ごとの会計(売上)と明細を登録・更新・検索し、支払い・取消・レシート発行・請求額の試算を行うAPI操作群です。")
  @route("/api/v1/sales")
  @tag("Sales")
  namespace SaleOperations {
    interface SaleCrud {
      @doc("絞り込み条件とページネーションを指定して売上を一覧取得します。顧客の支払い履歴は customerId で絞り込みます。")
      @summary("List sales")
      @get
      list(...SaleSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("来店1回分の会計を売上として登録します。売上番号・売上日・小計・値引額・消費税額・合計金額はシステムが設定し、paymentStatus は pending で登録します。予約に対する会計は bookingId を指定します。salonId のサロンが存在しない場合や、customerId・staffId・bookingId・明細の staffId に存在しないIDまたは salonId のサロンのものではないIDを指定した場合は400を返します。")
      @summary("Create a sale")
      @post
      create(@body request: SaleCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して売上を1件取得します。明細と決済取引を含みます。")
      @summary("Get a sale")
      @get
      get(@path id: SaleId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定した項目だけを更新します。details を指定した場合は明細全体を置き換え、小計・値引額・消費税額・合計金額を再計算します。取消済みの売上は409を、paymentStatus が pending ではない売上に details を指定した場合も409を返します。customerId・staffId・bookingId・明細の staffId に存在しないIDまたは売上のサロンのものではないIDを指定した場合は400を返します。")
      @summary("Update a sale")
      @patch
      update(@path id: SaleId, @body request: SaleUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("売上を取り消します。isVoid を true にし、voidedAt と voidReason を記録します。取消済みの売上、または返金していない支払い(status が completed または partial_refund の決済取引)がある売上は409を返します。")
      @summary("Void a sale")
      @route("/{id}/void")
      @post
      voidSale(@path id: SaleId, @body request: SaleVoidRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("売上に対する1回の支払いを処理し、決済取引として記録します。取消済みの売上と、paymentStatus が pending または failed ではない売上は409を返します。paymentMethodId に売上のサロンの有効な支払い方法ではないIDを指定した場合や、amount が未払い残額を超える場合は400を返します。決済代行会社が支払いを拒否した場合も、status が failed の決済取引を記録して返します。売上の paymentStatus は、完了した支払いの合計が totalAmount に達すると completed に、支払いが失敗すると failed になります。")
      @summary("Process a payment for a sale")
      @route("/{id}/process")
      @post
      process(@path id: SaleId, @body request: SaleProcessRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PaymentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("売上のレシートを、明細と決済取引を含めて取得します。")
      @summary("Get the receipt of a sale")
      @route("/{id}/receipt")
      @get
      getReceipt(@path id: SaleId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SaleReceiptResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("選択したサービスと割引コード・利用ポイントから、売上を登録する前に請求金額を試算します。存在しないIDを指定した場合は400を返します。")
      @summary("Calculate the amount of a sale")
      @route("/calculate")
      @post
      calculate(@body request: SaleCalculateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SaleCalculateResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("売上に対する決済取引を返金するAPI操作群です。決済取引の記録は売上の支払い処理で行います。")
  @route("/api/v1/payments")
  @tag("Payments")
  namespace PaymentOperations {
    interface PaymentCrud {
      @doc("決済取引を返金します。返金できるのは status が completed の決済取引だけで、それ以外(返金済みを含む)は409を返します。1つの決済取引に対する返金は1回だけです。refundAmount が amount を超える場合は400を返します。返金後の決済取引の status は全額返金なら refunded、部分返金なら partial_refund になり、売上の paymentStatus も同じように更新されます。")
      @summary("Refund a payment")
      @route("/{id}/refund")
      @post
      refund(@path id: PaymentId, @body request: PaymentRefundRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PaymentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("売上を集計したレポートを取得・出力するAPI操作群です。salonId のサロンが存在しない場合は400を返します。")
  @route("/api/v1/sales-reports")
  @tag("Sales Reports")
  namespace SalesReportOperations {
    interface SalesReportCrud {
      @doc("期間内の売上を集計したレポートを取得します。")
      @summary("Get a sales report")
      @get
      get(...SalesReportGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesReportResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("指定した日の売上サマリーを取得します。")
      @summary("Get daily sales")
      @route("/daily")
      @get
      getDaily(
        @doc("集計対象のサロン ID")
        @query
        salonId: SalonId,

        @doc("集計対象日")
        @query
        date: plainDate,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<DailySalesResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上をスタッフ別に集計します。")
      @summary("Get sales by staff")
      @route("/by-staff")
      @get
      getByStaff(
        @doc("集計対象のサロン ID")
        @query
        salonId: SalonId,

        ...DateRangeFilter,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesByStaffResponse[]>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上をサービスカテゴリ別に集計します。")
      @summary("Get sales by service category")
      @route("/by-category")
      @get
      getByCategory(
        @doc("集計対象のサロン ID")
        @query
        salonId: SalonId,

        ...DateRangeFilter,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesByCategoryResponse[]>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上推移を、日・週・月のいずれかの単位で集計します。")
      @summary("Get sales trends")
      @route("/trends")
      @get
      getTrends(
        @doc("集計対象のサロン ID")
        @query
        salonId: SalonId,

        @doc("集計の単位(daily: 日／weekly: 週／monthly: 月)")
        @query
        period: "daily" | "weekly" | "monthly",

        ...DateRangeFilter,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesTrendsResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上レポートを指定した形式のファイルに出力し、ダウンロードURLを返します。")
      @summary("Export a sales report")
      @route("/export")
      @post
      export(@body request: SalesReportExportRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesReportExportResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("顧客ポイントの付与・利用・調整・失効と、残高・履歴の参照を行うAPI操作群です。ポイントの増減はすべてポイント取引として記録し、取引ごとに残高を保持します。")
  @route("/api/v1/points")
  @tag("Points")
  namespace PointOperations {
    interface PointCrud {
      @doc("顧客の現在のポイント残高を取得します。最新のポイント取引の残高を返し、取引のない顧客は0を返します。")
      @summary("Get the point balance of a customer")
      @route("/customer/{customerId}/balance")
      @get
      getBalance(@path customerId: CustomerId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointBalanceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客のポイント取引の履歴を、発生日時の新しい順に一覧取得します。")
      @summary("List the point transactions of a customer")
      @route("/customer/{customerId}/transactions")
      @get
      listTransactions(
        @path customerId: CustomerId,
        ...PointTransactionSearchRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<PointTransactionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客にポイントを付与し、種別 earned のポイント取引を登録します。customerId の顧客が存在しない場合は400を返します。")
      @summary("Earn points")
      @route("/earn")
      @post
      earn(@body request: PointEarnRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointTransactionResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客のポイントを利用し、種別 used のポイント取引を登録します。customerId の顧客が存在しない場合は400を、残高が不足する場合は409を返します。")
      @summary("Use points")
      @route("/use")
      @post
      use(@body request: PointUseRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointTransactionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客のポイントを手動で増減し、種別 adjusted のポイント取引を登録します。customerId の顧客が存在しない場合や points が0の場合は400を、調整後の残高が負になる場合は409を返します。")
      @summary("Adjust points")
      @route("/adjust")
      @post
      adjust(@body request: PointAdjustRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointTransactionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("処理日から days 日以内に有効期限を迎える、顧客の獲得ポイントを集計します。")
      @summary("Get the expiring points of a customer")
      @route("/customer/{customerId}/expiring")
      @get
      getExpiring(
        @path customerId: CustomerId,

        @doc("集計する期間の日数 (1〜365)")
        @query
        @minValue(1)
        @maxValue(365)
        days?: int32 = 30,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointExpiringResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("有効期限を過ぎたポイントを失効させ、対象の顧客ごとに種別 expired のポイント取引を登録します。customerId に存在しない顧客を指定した場合は400を返します。")
      @summary("Expire points")
      @route("/expire")
      @post
      expire(@body request: PointExpireRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PointExpireResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
