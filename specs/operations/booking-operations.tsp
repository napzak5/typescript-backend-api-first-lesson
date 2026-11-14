import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/booking.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("顧客の予約と、その施術明細・ステータスを管理するAPI操作群です。ステータスは confirm・cancel・complete のアクションで変更します。")
  @route("/api/v1/bookings")
  @tag("Bookings")
  namespace BookingOperations {
    interface BookingCrud {
      @doc("サロン・顧客・スタッフ・ステータス・来店日の条件で予約を一覧取得し、受付状況を俯瞰します。")
      @summary("List bookings")
      @get
      list(...BookingSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("新しい予約を施術明細とともに作成し、施術枠を確保します。作成した予約のステータスはpendingです。salonId・customerId・staffId・serviceIdが存在しない場合や、スタッフ・サービスがsalonIdのサロンのものではない場合は400を、担当スタッフの既存の予約と時間が重なる場合は409を返します。")
      @summary("Create booking")
      @post
      create(@body request: BookingCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("予約の詳細を施術明細とともに取得し、日時・担当者・料金を確認します。")
      @summary("Get booking")
      @get
      get(@path id: BookingId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("予約の指定した項目だけを更新し、顧客要望やメモの変更に対応します。日時と担当スタッフの変更はreschedule、ステータスの変更は各アクションで行います。")
      @summary("Update booking")
      @patch
      update(@path id: BookingId, @body request: BookingUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("誤登録などで不要になった予約を、施術明細・ステータス履歴・レビューを含めて物理削除します。売上または施術記録が紐づく予約は削除できず、409を返します。")
      @summary("Delete booking")
      @delete
      delete(@path id: BookingId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("draftまたはpendingの予約を確定(confirmed)し、顧客への案内やリソース確保を開始します。それ以外のステータスの予約には409を返します。")
      @summary("Confirm booking")
      @route("/{id}/confirm")
      @post
      confirm(@path id: BookingId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("draft・pending・confirmedの予約をキャンセル(cancelled)し、理由を記録して施術枠を開放します。キャンセル日時・キャンセルした利用者・キャンセル料はシステムが設定します。それ以外のステータスの予約には409を返します。")
      @summary("Cancel booking")
      @route("/{id}/cancel")
      @post
      cancel(@path id: BookingId, @body request: BookingCancelRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("confirmedまたはin_progressの予約の施術完了(completed)を登録し、実績データや売上計上に利用します。予約のすべての施術明細も完了にします。それ以外のステータスの予約には409を返します。")
      @summary("Complete booking")
      @route("/{id}/complete")
      @post
      complete(@path id: BookingId, @body request: BookingCompleteRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("draft・pending・confirmedの予約の開始日時と担当スタッフを変更します。施術明細の日時は同じ時間だけずらし、変更前の担当スタッフが担当していた施術明細は新しい担当スタッフに付け替えます。staffIdが予約のサロンのスタッフではない場合は400を、それ以外のステータスの予約や、変更後の時間が担当スタッフの既存の予約と重なる場合は409を返します。")
      @summary("Reschedule booking")
      @route("/{id}/reschedule")
      @post
      reschedule(@path id: BookingId, @body request: BookingRescheduleRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("予約に含まれる施術明細を追加・取得・削除するAPI操作群です。明細を変更すると予約の日時と金額を算出し直します。")
  @route("/api/v1/bookings/{bookingId}/services")
  @tag("Bookings")
  namespace BookingServiceOperations {
    interface BookingServiceCrud {
      @doc("draft・pending・confirmedの予約に施術明細を追加します。予約が存在しない場合は404を、serviceIdやstaffIdが予約のサロンのものではない場合は400を、それ以外のステータスの予約や、担当スタッフの既存の予約と時間が重なる場合は409を返します。")
      @summary("Add booking service")
      @post
      create(
        @path bookingId: BookingId,
        @body request: BookingServiceCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<BookingServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("予約の施術明細を1件取得します。")
      @summary("Get booking service")
      @get
      get(@path bookingId: BookingId, @path id: BookingServiceId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("draft・pending・confirmedの予約から施術明細を削除します。それ以外のステータスの予約や、予約に残る最後の施術明細を削除しようとした場合は409を返します。")
      @summary("Remove booking service")
      @delete
      delete(@path bookingId: BookingId, @path id: BookingServiceId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }

  @doc("各サロンの予約可能時間帯を予約・スタッフのスケジュール・営業時間から算出し、オンライン予約枠表示やスタッフ提案に使用するAPI操作群です。")
  @route("/api/v1/salons/{salonId}/available-slots")
  @tag("Bookings")
  namespace AvailabilityOperations {
    interface AvailableSlotCrud {
      @doc("指定日の予約可能枠を取得し、空き枠一覧や予約フォームに反映します。サロンが存在しない場合は404を、serviceIdやstaffIdがサロンのものではない場合は400を返します。")
      @summary("List available slots")
      @get
      list(@path salonId: SalonId, ...AvailableSlotSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<AvailableSlotResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("希望する日時・スタッフの組み合わせが予約可能か即時判定し、ダブルブッキングを防ぎます。サロンが存在しない場合は404を、serviceIdやstaffIdがサロンのものではない場合は400を返します。")
      @summary("Check availability")
      @route("/check")
      @post
      check(@path salonId: SalonId, @body request: AvailableSlotCheckRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AvailableSlotCheckResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
