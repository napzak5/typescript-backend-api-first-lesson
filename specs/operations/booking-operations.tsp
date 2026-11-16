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
  @doc("サロンの予約台帳を管理するAPI操作群です。予約と、その施術明細・ステータスを扱います。ステータスは confirm・cancel・start・complete・no-show のアクションで、日時と担当スタッフは reschedule で変更します。操作は admin と、予約のサロンのスタッフ(owner / manager / staff)が実行できます。削除だけは、サロンでは owner と manager に限ります。レスポンスはサロン内のメモを含むので、顧客本人(customer)には403を返します。ほかのサロンの予約は、存在しない予約と区別しません。")
  @route("/api/v1/bookings")
  @tag("Bookings")
  namespace BookingOperations {
    interface BookingCrud {
      @doc("サロン・顧客・スタッフ・ステータス・来店日の条件で予約を一覧取得し、受付状況を俯瞰します。開始日時の早い順に並びます。サロンのスタッフには所属サロンの予約だけを返し、salonIdにほかのサロンを指定した場合は403を返します。cursorが、操作者に見える予約を指していない場合は400を返します。")
      @summary("List bookings")
      @get
      list(...BookingSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("新しい予約を施術明細とともに作成し、施術枠を確保します。作成した予約のステータスはpendingです。サロンのスタッフがsalonIdにほかのサロンを指定した場合は403を、salonId・customerId・staffId・serviceIdが存在しない(削除済みを含む)場合や、スタッフ・サービスがsalonIdのサロンのものではない場合は400を返します。施術明細を担当するスタッフが、同時に受けられる数(maxConcurrentBookings)を超えてほかの予約と重なる場合は409を返します。重なりは、スタッフの準備時間と片付け時間(bufferTimeBefore・bufferTimeAfter)を加えて確かめ、cancelledとno_showの予約は数えません。サロンのタイムゾーン(timezone)が名前として認識できないものである場合も、来店日を決められないので409を返します。営業時間、勤務スケジュール、スタッフ・サービス・顧客の有効・無効は確かめません。")
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

      @doc("予約の詳細を施術明細とともに取得し、日時・担当者・料金を確認します。ほかのサロンの予約には404を返します。")
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

      @doc("予約の指定した項目だけを更新し、顧客要望やメモの変更に対応します。どのステータスの予約も更新できます(来店のあとでメモを書き足せます)。日時と担当スタッフの変更はreschedule、ステータスの変更は各アクションで行います。項目を1つも指定しない場合は400を、ほかのサロンの予約には404を返します。")
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

      @doc("誤登録などで不要になった予約を、施術明細・ステータス履歴を含めて物理削除します。どのステータスの予約も削除でき、completed・cancelled・no_showの予約を削除した場合は、顧客の来店回数・無断キャンセル回数・キャンセル回数と初回・最終来店日を、顧客の予約から数え直します。adminと、予約のサロンのowner・managerが実行でき、サロンのstaffには403を返します。売上、施術記録またはレビューが紐づく予約は削除できず、409を返します。ほかのサロンの予約には404を返します。")
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

      @doc("draftまたはpendingの予約を確定(confirmed)します。予約は作成の時点から施術枠を占有しているので、確定で変わるのはステータスだけです。それ以外のステータスの予約には409を、ほかのサロンの予約には404を返します。")
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

      @doc("draft・pending・confirmedの予約をキャンセル(cancelled)し、理由を記録して施術枠を開放します。キャンセル日時とキャンセルした利用者はシステムが設定します。キャンセル料は、料金を決める規則が未定義のため、常に0です。顧客のキャンセル回数(cancellationCount)を、顧客の予約から数え直します。それ以外のステータスの予約には409を、ほかのサロンの予約には404を返します。")
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

      @doc("confirmedの予約の施術を開始(in_progress)し、実際の施術開始日時(actualStartTime)に現在の日時を記録します。それ以外のステータスの予約には409を、ほかのサロンの予約には404を返します。")
      @summary("Start booking")
      @route("/{id}/start")
      @post
      start(@path id: BookingId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("confirmedまたはin_progressの予約の施術完了(completed)を登録します。予約のすべての施術明細も完了にし、顧客の来店回数(visitCount)と初回・最終来店日を、顧客の予約から数え直します。actualStartTime・actualEndTimeは、nullでない値を記録し、nullの場合は記録済みの値を残します。リクエストの終了日時が開始日時より後でない場合は400を、それ以外のステータスの予約や、終了日時が記録済みの開始日時より後でない場合は409を、ほかのサロンの予約には404を返します。")
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

      @doc("pendingまたはconfirmedの予約に、顧客が来店しなかったこと(no_show)を記録し、施術枠を開放します。顧客の無断キャンセル回数(noShowCount)を、顧客の予約から数え直します。予約の開始日時を過ぎるまでは記録できず、409を返します(来ないと分かった予約はキャンセルします)。それ以外のステータスの予約には409を、ほかのサロンの予約には404を返します。")
      @summary("Record no-show")
      @route("/{id}/no-show")
      @post
      noShow(@path id: BookingId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<BookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("draft・pending・confirmedの予約の開始日時と担当スタッフを変更します。施術明細の日時は同じ時間だけずらし、変更前の担当スタッフが担当していた施術明細は新しい担当スタッフに付け替えます。所要時間・金額・ステータスは変わりません。来店日(bookingDate)は、新しい開始日時をサロンのタイムゾーンで表した日付にします。それ以外のステータスの予約には409を、staffIdが予約のサロンのスタッフではない(削除済みを含む)場合は400を返します。変更後の施術明細を担当するスタッフが、同時に受けられる数(maxConcurrentBookings)を超えてほかの予約と重なる場合と、サロンのタイムゾーンが名前として認識できない場合は409を返します。重なりは作成と同じ規則で確かめ、この予約自身の変更前の施術明細は数えません。ほかのサロンの予約には404を返します。")
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
      @doc("終わっていない予約(ステータスが draft・pending・confirmed・in_progress の予約)に施術明細を追加し、予約の日時と金額を算出し直します。admin と、予約のサロンの owner / manager / staff が実行できます。明細の時間と金額は、追加の時点のサービスの写しです。明細は、いまの最後の明細の次に並びます。ほかのサロンの予約には404を、serviceIdやstaffIdが予約のサロンのものではない(削除済みを含む)場合は400を返します。completed・cancelled・no_show の予約、すでに20件の明細がある予約、追加後の明細が最も早い明細の開始から24時間以内に収まらない場合、明細のスタッフが同時に受けられる数(maxConcurrentBookings)を超えてほかの予約と重なる場合、サロンのタイムゾーンが名前として認識できない場合、金額が上限を超える場合は409を返します。重なりは作成と同じ規則で確かめ、この予約自身のほかの明細は数えません。")
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

      @doc("予約の施術明細を1件取得します。admin と、予約のサロンの owner / manager / staff が実行できます。ほかのサロンの予約と、その予約のものではない明細には404を返します。")
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

      @doc("終わっていない予約(ステータスが draft・pending・confirmed・in_progress の予約)から施術明細を削除し、予約の日時と金額を、残る明細から算出し直します。admin と、予約のサロンの owner / manager / staff が実行できます。明細の担当スタッフや開始日時を変えるには、新しい明細を追加してから古い明細を削除します。ほかのサロンの予約と、その予約のものではない明細には404を、completed・cancelled・no_show の予約、予約に残る最後の明細、サロンのタイムゾーンが名前として認識できない場合は409を返します。")
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

  @doc("各サロンの空き枠を予約・スタッフのスケジュール・営業時間から算出するAPI操作群です。一覧は顧客が予約できる枠を返し、確認は予約台帳が受け付けるかどうか(スタッフの占有)を答えます。")
  @route("/api/v1/salons/{salonId}/available-slots")
  @tag("Bookings")
  namespace AvailabilityOperations {
    interface AvailableSlotCrud {
      @doc("指定日に、サービスを予約できる枠(1人のスタッフがそのサービスを始められる開始日時)を算出して返します。サインインしているユーザーなら誰でも実行できます。枠は、サロンの営業時間帯(営業日カレンダーにその日付の行があればその時刻、なければ曜日別の営業時間から休憩を除いたもの)と、スタッフの勤務時間帯(休憩を除く)の重なりの中に、時間帯の始まりから30分ごとに作ります。施術の全体が時間帯に収まり、スタッフが占有されておらず(予約台帳と同じ規則。前後の空け時間と同時に受けられる数を含む)、現在より後に始まる枠だけを返します。施術時間は duration、指定がなければサービスの duration です。次の場合は、その枠を返しません(エラーにはしません)。サロンが予約受付中でない(isActive が false)。サービスが予約できない(isActive が false、serviceStatus が active 以外、allowOnlineBooking が false、availability がその日の曜日に合わない、bookingRequirements に advance_booking_required があり当日である、その日の明細が maxBookingsPerDay に達している)。スタッフが予約を受けない(isActive または canReceiveBookings が false、level が requiredStaffLevel に満たない、その日に勤務しない)。並びは startTime の昇順、同じ日時は staffId の昇順です。サロンが存在しない場合は404を、serviceIdやstaffIdがサロンのものではない(削除済みを含む)場合は400を、サロンのタイムゾーンを名前として読めない場合は409を返します。")
      @summary("List available slots")
      @get
      list(@path salonId: SalonId, ...AvailableSlotSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<AvailableSlotResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("スタッフが、希望する日時からサービスの施術時間のあいだ、占有されていないかを答えます。予約台帳への作成・日時の変更・明細の追加が、スタッフの占有を理由に409になるかどうかを、何も書かずに確かめる操作で、admin と、そのサロンの owner / manager / staff が実行できます。確かめるのは占有だけです。営業時間、勤務スケジュール、サービスやスタッフの受付の設定、過去の日時かどうかは確かめません(予約台帳が確かめないものは確かめません)。答えはその時点のもので、あとの作成が409になることはあります。サロンが存在しない場合は404を、serviceIdやstaffIdがサロンのものではない(削除済みを含む)場合は400を返します。")
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

  @doc("顧客本人が、自分の予約を入れ、読み、日時を変え、キャンセルするAPI操作群です。実行できるのは customer ロールのユーザーだけで、admin とサロンのスタッフには403を返します(予約台帳を使います)。権限は最初に確認します。プロフィール(自分の顧客レコード)をまだ作っていない場合と、顧客レコードが削除された場合は404を返します。サロンが予約台帳に入れた自分の予約も対象です。ほかの顧客の予約は、存在しない予約と区別しません。サロン内のメモは、レスポンスに含みません。")
  @route("/api/v1/customers/me/bookings")
  @tag("Bookings")
  namespace CustomerBookingOperations {
    interface CustomerBookings {
      @doc("ログインしている顧客の予約を、開始日時の早い順に一覧取得します。どのステータスの予約も、どのサロンの予約も含みます。cursorが、自分の予約を指していない場合は400を返します。")
      @summary("List the signed-in customer's bookings")
      @get
      list(...CustomerBookingSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<CustomerBookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("空き枠を1つ指定して、予約を入れます。作成した予約のステータスはpendingで、サロンが確定します。入れられるのは、空き枠の一覧(GET /api/v1/salons/{salonId}/available-slots)が、その時点で返す枠だけです。staffIdとstartTimeが、そのサービスの、その日(サロンのタイムゾーンでのstartTimeの日付)の空き枠でない場合は409を返します(サロンの営業時間、スタッフの勤務、サロン・サービス・スタッフの受付の設定、現在より後であること、スタッフの占有を、空き枠の一覧と同じ規則で確かめます)。施術時間と料金は、サービスの登録内容から決まります。顧客レコードが予約を受け付けられない状態(isActive が false、customerStatus が inactive か blacklisted)の場合と、自分のほかの予約(cancelledとno_showを除く)と時間が重なる場合も409を返します。salonId・serviceId・staffIdが存在しない(削除済みを含む)場合や、サービス・スタッフがsalonIdのサロンのものではない場合は400を、サロンのタイムゾーンを名前として読めない場合は409を返します。")
      @summary("Book an available slot as the signed-in customer")
      @post
      create(@body request: CustomerBookingCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<CustomerBookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ログインしている顧客の予約を1件、施術明細とともに取得します。ほかの顧客の予約には404を返します。")
      @summary("Get one of the signed-in customer's bookings")
      @get
      get(@path id: BookingId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerBookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ログインしている顧客の、draft・pending・confirmedの予約をキャンセル(cancelled)します。キャンセルできるのは、予約の開始日時より前だけです。開始日時を過ぎた予約と、それ以外のステータスの予約には409を返します(来店しなかった予約は、サロンが記録します)。キャンセル料は、料金を決める規則が未定義のため、常に0です。キャンセルした予約は、スタッフの時間を確保しません。顧客のキャンセル回数(cancellationCount)を、顧客の予約から数え直します。ほかの顧客の予約には404を返します。")
      @summary("Cancel one of the signed-in customer's bookings")
      @route("/{id}/cancel")
      @post
      cancel(@path id: BookingId, @body request: BookingCancelRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerBookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ログインしている顧客の、draft・pending・confirmedの予約の開始日時と担当スタッフを変更します。変更できるのは、予約の開始日時より前で、施術明細が1件、その担当が予約の担当スタッフである予約だけです(サロンが施術明細を足した予約は、サロンが予約台帳で変更します)。移せる先は、予約のサービスの空き枠だけです。空き枠は、予約を入れるときと同じ規則で、予約の施術時間について確かめ、この予約自身は、ないものとして数えます。staffIdとstartTimeが空き枠でない場合、顧客レコードが予約を受け付けられない状態の場合、自分のほかの予約(cancelledとno_showを除く)と時間が重なる場合、開始日時を過ぎた予約、それ以外のステータスの予約、施術明細が上の形でない予約には409を返します。staffIdが予約のサロンのスタッフではない(削除済みを含む)場合は400を、サロンのタイムゾーンを名前として読めない場合は409を返します。所要時間と金額は変わりません。confirmedの予約は、サロンがもう一度確定するまでpendingに戻ります。担当も開始日時も変わらないリクエストは、何も変更せずに予約を返します。ほかの顧客の予約には404を返します。")
      @summary("Reschedule one of the signed-in customer's bookings")
      @route("/{id}/reschedule")
      @post
      reschedule(@path id: BookingId, @body request: BookingRescheduleRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerBookingResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
