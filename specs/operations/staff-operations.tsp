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
  @doc("サロンのスタッフ台帳と勤務スケジュールを管理するAPI操作群です。実装済みの操作は、台帳の一覧・登録・1件の取得・更新・削除です。顧客に見せる項目は、スタッフプロフィールの操作(/api/v1/staff-profiles)が認証なしで返します。台帳は雇用の情報と個人の連絡先を含むので、これらは admin と、そのサロンの owner だけが実行できます(manager と staff には403を返します)。権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合は404を返します。")
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

  @doc("顧客に見せるスタッフのプロフィールを返すAPI操作群です。ここに定義した操作はすべて実装済みで、指名するスタッフを選ぶ前の閲覧のために、認証なしで呼び出せます。対象は、在籍して勤務している(isActive が true)、削除されていないスタッフで、所属サロンが削除されていないものです。それ以外のスタッフは、存在しないスタッフと同じ扱いにします。本名、連絡先、雇用の情報は返しません。プロフィールの項目は、スタッフ台帳の操作で更新します。")
  @route("/api/v1/staff-profiles")
  @tag("Staff")
  namespace StaffProfileOperations {
    interface StaffProfile {
      @doc("絞り込み条件とページネーションを指定して、スタッフのプロフィールを一覧取得します。サロンをまたいで探せます。1つのサロンのスタッフは salonId で絞り込みます。登録日時の古い順に並びます。cursorがスタッフを指していない場合は400を返します。")
      @summary("List staff profiles")
      @useAuth(NoAuth)
      @get
      list(...StaffProfileSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<StaffProfileResponse>;
          }
        | ProblemResponse<400>
        | PublicErrors;

      @doc("IDを指定してスタッフのプロフィールを1件取得します。在籍していない、削除済み、または所属サロンが削除済みのスタッフには404を返します。")
      @summary("Get a staff profile")
      @useAuth(NoAuth)
      @get
      get(@path id: StaffId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffProfileResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | PublicErrors;
    }
  }
}
