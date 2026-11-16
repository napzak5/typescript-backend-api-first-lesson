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
  @doc("来店ごとの会計(売上)と明細を登録・更新・検索し、支払い・取消・レシート発行・請求額の試算を行うAPI操作群です。ここに定義した操作はすべて実装済みで、定義と実装は一致しています。")
  @route("/api/v1/sales")
  @tag("Sales")
  namespace SaleOperations {
    interface SaleCrud {
      @doc("絞り込み条件とページネーションを指定して、売上を会計日時(saleTime)の新しい順に一覧取得します。取り消した売上も含みます。管理者はすべてのサロンの売上を、サロンのメンバーは自分のサロンの売上を取得できます。顧客の支払い履歴は customerId で絞り込みます。salonId に自分のサロン以外を指定した場合は403を、cursor が取得できる売上を指していない場合や、endDate が startDate より前の場合は400を返します。")
      @summary("List sales")
      @get
      list(...SaleSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("来店1回分の会計を売上として登録します。管理者と、salonId のサロンのメンバーが実行できます。売上番号・売上日・小計・値引額・消費税額・合計金額はシステムが設定し、paymentStatus は pending で登録します。予約に対する会計は bookingId を指定します。salonId のサロンが存在しない場合や、customerId・staffId・bookingId・明細の staffId・明細の itemId に存在しないIDまたは salonId のサロンのものではないIDを指定した場合、bookingId の予約の顧客が customerId と異なる場合、金額の合計が integer の上限を超える場合は400を返します。サロンのタイムゾーンが不明で売上日を決められない場合と、bookingId の予約に取り消していない売上がすでにある場合は409を返します。")
      @summary("Create a sale")
      @post
      create(@body request: SaleCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<SaleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して売上を1件取得します。明細と決済取引を含みます。管理者と、売上のサロンのメンバーが実行できます。ほかのサロンの売上は、存在しない売上と同じく404を返します。")
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

      @doc("指定した項目だけを更新します。管理者と、売上のサロンのメンバーが実行できます。details を指定した場合は明細全体を置き換え、小計・値引額・消費税額・合計金額を再計算します。saleTime を指定した場合は売上日も決め直します。更新後の売上が、登録と同じ規則を満たすことを確かめます。項目を1つも指定しない場合、customerId・staffId・bookingId・明細の staffId・明細の itemId に存在しないIDまたは売上のサロンのものではないIDを指定した場合、更新後の売上の予約の顧客が売上の顧客と異なる場合、顧客のいない売上にポイントが残る場合、金額の合計が integer の上限を超える場合は400を返します。取消済みの売上、paymentStatus が pending ではない売上に details を指定した場合、サロンのタイムゾーンが不明で売上日を決められない場合、bookingId の予約にほかの取り消していない売上がある場合は409を返します。")
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

      @doc("売上を取り消します。管理者と、売上のサロンのオーナー・マネージャーが実行できます。isVoid を true にし、voidedAt と voidReason を記録します。明細・金額・支払い状態は変えません。取り消した売上の予約は、もう一度会計できます。取消済みの売上、または返金していない支払い(status が completed または partial_refund の決済取引)がある売上は409を返します。")
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

      @doc("売上に対して受け取った1回の支払いを、status が completed の決済取引として記録します。管理者と、売上のサロンのメンバーが実行できます。決済代行会社とは接続していないので、支払いを受け取ったあとに呼び出します。支払いは分けて記録でき、amount は未払い残額(totalAmount から、これまでに受け取った金額を引いた額。返金しても増えない)以下で指定します。取消済みの売上、支払いが済んだ売上、返金のある売上は409を返します。paymentMethodId に売上のサロンの有効な支払い方法ではないIDを指定した場合、amount が未払い残額を超える場合、amount が支払い方法の minimumAmount 未満または maximumAmount 超の場合、区分が credit_card でも debit_card でもない支払い方法に cardLastFour または cardBrand を指定した場合は400を返します。売上の paymentStatus は、受け取った金額の合計が totalAmount に達すると completed に、達しなければ processing になります。")
      @summary("Record a payment for a sale")
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

      @doc("売上のレシートを、明細と決済取引を含めて作成します。管理者と、売上のサロンのメンバーが実行できます。レシートは記録せず、呼び出すたびに同じ売上から作り直します(再発行)。レシート番号は売上番号です。取消済みの売上と、受け取った金額(status が completed・partial_refund・refunded の決済取引の amount の合計)が totalAmount に達していない売上は409を返します。totalAmount が0の売上は、支払いがなくてもレシートを作成できます。ほかのサロンの売上は、存在しない売上と同じく404を返します。")
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
        | ProblemResponse<409>
        | CommonErrors;

      @doc("売上を登録する前に、予約のサービス明細と、加えるサービスから、請求金額を試算します。何も記録しません。管理者と、salonId のサロンのメンバーが実行できます。予約のサービス明細は明細に写した価格で、加えるサービスはいまのメニューの価格で数え、消費税はサロンのいまの税率で、税込みでない明細の割引後の金額の合計に対して1回だけ計算します(1円未満は切り捨て)。salonId のサロンが存在しない場合、bookingId に salonId のサロンの予約ではないIDを指定した場合、services に salonId のサロンの削除されていないサービスではないIDを指定した場合、予約のサービス明細と services を合わせて1件もない場合、金額の合計が integer の上限を超える場合は400を返します。")
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

  @doc("サロンが会計で使う支払い方法を登録・取得・更新・削除するAPI操作群です。ここに定義した操作はすべて実装済みで、定義と実装は一致しています。一覧と1件の取得は admin と、そのサロンの owner / manager / staff が実行できます。登録・更新・削除は admin と、そのサロンの owner / manager が実行できます。それ以外のアカウント(ほかのサロンのメンバー、顧客)には、パスの salonId だけで判断して403を返します。サロンが存在しない場合は404を返します。")
  @route("/api/v1/salons/{salonId}/payment-methods")
  @tag("Payment Methods")
  namespace PaymentMethodOperations {
    interface PaymentMethodCrud {
      @doc("サロンの支払い方法を、絞り込み条件とページネーションを指定して一覧取得します。表示順(sortOrder)の昇順、同じ表示順ならIDの昇順に並びます。cursorがそのサロンの支払い方法を指していない場合(削除された場合を含む)は400を返します。")
      @summary("List payment methods")
      @get
      list(@path salonId: SalonId, ...PaymentMethodSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<PaymentMethodResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("サロンに支払い方法を登録します。同じ支払い方法区分(method)の支払い方法をいくつでも登録できます。minimumAmount が maximumAmount を超える場合は400を返します。")
      @summary("Create payment method")
      @post
      create(
        @path salonId: SalonId,
        @body request: PaymentMethodCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<PaymentMethodResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの支払い方法を1件取得します。無効な支払い方法も取得できます。支払い方法がそのサロンのものでない場合は404を返します。")
      @summary("Get payment method")
      @get
      get(@path salonId: SalonId, @path id: PaymentMethodId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PaymentMethodResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("支払い方法の指定した項目だけを更新します。支払い方法区分(method)は変更できません。更新後の minimumAmount が maximumAmount を超える場合は400を返します(片方だけを指定した場合は、もう片方の現在の値と比べます)。支払い方法がそのサロンのものでない場合は404を返します。")
      @summary("Update payment method")
      @patch
      update(
        @path salonId: SalonId,
        @path id: PaymentMethodId,
        @body request: PaymentMethodUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PaymentMethodResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("支払い方法を削除します。決済取引が指している支払い方法は削除できず、409を返します(使わなくなった支払い方法は isActive を false にします)。支払い方法がそのサロンのものでない場合は404を返します。")
      @summary("Delete payment method")
      @delete
      delete(@path salonId: SalonId, @path id: PaymentMethodId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }

  @doc("売上に対する決済取引を返金するAPI操作群です。ここに定義した操作は実装済みで、定義と実装は一致しています。決済取引は売上の支払いの記録(SaleCrud の process)で作り、売上のレスポンスの payments で読みます。")
  @route("/api/v1/payments")
  @tag("Payments")
  namespace PaymentOperations {
    interface PaymentCrud {
      @doc("決済取引を返金します。管理者と、決済取引の売上のサロンのオーナー・マネージャーが実行できます。返金できるのは status が completed の決済取引だけで、それ以外(返金済みを含む)は409を返します。1つの決済取引に対する返金は1回だけです。refundAmount が amount を超える場合は400を返します。返金後の決済取引の status は全額返金なら refunded、部分返金なら partial_refund になります。売上の paymentStatus は、受け取った全額を返金していれば refunded に、そうでなければ partial_refund になります。決済取引が存在しない場合と、ほかのサロンの売上のものである場合は404を返します。")
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

  @doc("売上を集計したレポートを取得・出力するAPI操作群です。get、getDaily、getByStaff、getByCategory、getTrends は実装済みで、定義と実装は一致しています。export は定義だけで、実装はありません。どの操作も、管理者と、salonId のサロンのオーナー・マネージャーが実行できます(スタッフと顧客は403)。salonId に自分のサロン以外を指定した場合は403を、salonId のサロンが存在しない場合は400を返します。集計は、リクエストのたびに、取り消していない売上とその決済取引から行い、記録しません。日付は売上日(saleDate。会計日時のサロンのタイムゾーンでの日付)です。")
  @route("/api/v1/sales-reports")
  @tag("Sales Reports")
  namespace SalesReportOperations {
    interface SalesReportCrud {
      @doc("サロンの、取り消していない売上のうち、売上日が期間内のものを集計します。支払いが済んでいない売上も数え、返金は返金した決済取引の売上の売上日の側で数えます。endDate が startDate より前の場合と、期間が366日を超える場合は400を返します。")
      @summary("Get a sales report")
      @get
      get(...SalesReportGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesReportResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("サロンの、売上日が date の、取り消していない売上を集計します。")
      @summary("Get daily sales")
      @route("/daily")
      @get
      getDaily(...DailySalesGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<DailySalesResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上の明細を、担当スタッフ別に集計します。担当した明細の合計金額の多い順(同じならスタッフ ID の順)に、明細を担当したスタッフだけを返します。endDate が startDate より前の場合と、期間が366日を超える場合は400を返します。")
      @summary("Get sales by staff")
      @route("/by-staff")
      @get
      getByStaff(...SalesReportGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesByStaffResponse[]>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上のサービスの明細を、サービスのカテゴリーの区分別に集計します。金額の多い順(同じなら区分の名前の順)に、明細のある区分だけを返します。endDate が startDate より前の場合と、期間が366日を超える場合は400を返します。")
      @summary("Get sales by service category")
      @route("/by-category")
      @get
      getByCategory(...SalesReportGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalesByCategoryResponse[]>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("期間内の売上の推移を、日・週(月曜日始まり)・月のいずれかの単位で区切って集計します。endDate が startDate より前の場合と、期間が366日を超える場合は400を返します。")
      @summary("Get sales trends")
      @route("/trends")
      @get
      getTrends(...SalesTrendsGetRequest):
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
