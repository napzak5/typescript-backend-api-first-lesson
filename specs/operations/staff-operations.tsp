import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/staff.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("サロンのスタッフ台帳と勤務スケジュールを管理するAPI操作群です。実装済みの操作は、台帳の一覧・登録・1件の取得・更新・削除です。台帳は雇用の情報と個人の連絡先を含むので、これらは admin と、そのサロンの owner だけが実行できます(manager と staff には403を返します)。権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合は404を返します。")
  @route("/api/v1/salons/{salonId}/staff")
  @tag("Staff")
  namespace StaffOperations {
    interface StaffCrud {
      @doc("サロンのスタッフを、ページネーションを指定して一覧取得します。登録日時の古い順に並びます。削除済みのスタッフは含みません。cursorがそのサロンのスタッフを指していない場合は400を返します。")
      @summary("List staff members")
      @get
      list(@path salonId: SalonId, ...StaffSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<StaffResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("サロンにスタッフを登録します。メールアドレスが同じサロンの削除されていないスタッフと重複する場合と、スタッフコードが同じサロンのスタッフ(削除済みを含む)と重複する場合は409を返します。")
      @summary("Create staff member")
      @post
      create(@path salonId: SalonId, @body request: StaffCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<StaffResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定してスタッフを1件取得します。削除済みのスタッフは404を返します。")
      @summary("Get staff member")
      @get
      get(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定した項目だけを更新します。メールアドレスが同じサロンの削除されていないほかのスタッフと重複する場合と、スタッフコードが同じサロンのほかのスタッフ(削除済みを含む)と重複する場合は409を返します。自分自身のスタッフ情報の isActive を false にする場合も409を返します。")
      @summary("Update staff member")
      @patch
      update(
        @path salonId: SalonId,
        @path id: StaffId,
        @body request: StaffUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("スタッフを論理削除します。削除後は一覧・取得の対象外になり、メールアドレスは別のスタッフの登録に使えるようになります。このスタッフに紐づくログインアカウントは、サロンへの権限を失います。自分自身のスタッフ情報は削除できず、409を返します。")
      @summary("Delete staff member")
      @delete
      delete(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("指定日のスタッフ空き状況を取得し、予約枠の提案や調整に活用します。指定日に適用される勤務スケジュールの行を返します。その日付の単日の行があれば単日の行を、なければその曜日の毎週繰り返す行を返します。適用される行がない場合は空配列を返します。")
      @summary("Get staff availability")
      @route("/{id}/availability")
      @get
      getAvailability(
        @path salonId: SalonId,
        @path id: StaffId,

        @doc("空き状況を確認する日付")
        @query
        date: plainDate,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffSchedule[]>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("スタッフの稼働予定を更新し、シフト変更や臨時休みを反映します。スタッフの勤務スケジュール全体を、指定した行の一覧で置き換えます。")
      @summary("Update staff availability")
      @route("/{id}/availability")
      @put
      updateAvailability(
        @path salonId: SalonId,
        @path id: StaffId,
        @body request: StaffSchedule[],
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffSchedule[]>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("複数サロン横断でスタッフを検索し、指名予約やヘルプ要員の調整に用いるAPI操作群です。")
  @route("/api/v1/staff")
  @tag("Staff")
  namespace GlobalStaffOperations {
    interface GlobalStaff {
      @doc("専門分野や地域条件で全サロンのスタッフを横断検索し、顧客の指名ニーズに応えます。削除済みのスタッフは含みません。")
      @summary("Search staff across all salons")
      @route("/search")
      @get
      search(...StaffGlobalSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<StaffResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;
    }
  }
}
