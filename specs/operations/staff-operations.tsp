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
  @doc("サロンのスタッフ台帳を管理するAPI操作群です。ここに定義した操作はすべて実装済みです。顧客に見せる項目は、スタッフプロフィールの操作(/api/v1/staff-profiles)が認証なしで返します。台帳は雇用の情報と個人の連絡先を含むので、これらは admin と、そのサロンの owner だけが実行できます(manager と staff には403を返します)。権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合は404を返します。")
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

      @doc("スタッフを論理削除します。削除後は一覧・取得の対象外になり、メールアドレスは別のスタッフの登録に使えるようになります。このスタッフに紐づくログインアカウントは、サロンへの権限を失います。自分自身のスタッフ情報は削除できず、409を返します。終わっていない予約(ステータスが draft・pending・confirmed・in_progress の予約)の担当スタッフであるか、そのいずれかの施術明細を担当しているスタッフも削除できず、409を返します。先に予約を完了、キャンセル、または削除してください。予約の担当スタッフは、日時の変更でほかのスタッフに替えられます(そのスタッフが担当していた施術明細も付け替わります)。施術明細だけを担当しているときは、ほかのスタッフで明細を追加してから、そのスタッフの明細を削除します。")
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
    }
  }

  @doc("スタッフの勤務スケジュール(staff_schedules)を管理するAPI操作群です。ここに定義した操作はすべて実装済みです。スケジュールは、毎週の行と単日の行の一覧で、スタッフがいつ勤務するかを表します。読めるのは admin と、そのサロンの owner・manager、そして自分のスケジュールに限り staff です。置き換えられるのは admin と、そのサロンの owner・manager です。サロンに対する権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。staff がほかのスタッフのIDを指定した場合も403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合、スタッフが削除済みの場合は404を返します。顧客に見せる予約可能な枠は、予約の操作が返します。")
  @route("/api/v1/salons/{salonId}/staff/{id}/schedules")
  @tag("Staff")
  namespace StaffScheduleOperations {
    interface StaffSchedules {
      @doc("スタッフの勤務スケジュールの行を一覧取得します。毎週の行を月曜から日曜の順に、続けて単日の行を日付の古い順に返します。date を指定すると、その日付に適用される行だけ(0件か1件)を返します。行の数に上限があるため、ページネーションはありません。")
      @summary("List the schedules of a staff member")
      @get
      list(
        @path salonId: SalonId,
        @path id: StaffId,
        ...StaffScheduleSearchRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffSchedule[]>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("スタッフの勤務スケジュール全体を、指定した行の一覧で置き換えます。空の配列を指定すると、スケジュールは空になります。同じ曜日の毎週の行、同じ日付の単日の行は、それぞれ1つまでです。1つでも規則に反する行があれば、何も変更せずに400を返します。レスポンスは、保存後の行を一覧と同じ順で返します。")
      @summary("Replace the schedules of a staff member")
      @put
      update(
        @path salonId: SalonId,
        @path id: StaffId,
        @body request: StaffScheduleUpdateRequest,
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

  @doc("スタッフへの招待(staff_invitations)を管理するAPI操作群です。ここに定義した操作はすべて実装済みです。招待は、台帳のスタッフが自分のログインアカウントを作るためのもので、1人のスタッフが持てるのは1つまでです。招待すると、台帳のメールアドレスに、1回だけ使えるリンクをメールで送ります。受け取った本人が、認証の操作(/api/v1/auth/staff-invitation/accept)でパスワードを設定すると、招待のロールを持つアカウントが作られ、スタッフに紐づきます。すでにスタッフのアカウントを持つ人は、ログインして、招待に参加します(/api/v1/auth/staff-invitation/join)。実行できるのは、スタッフ台帳と同じく admin と、そのサロンの owner です。権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合、スタッフが削除済みの場合は404を返します。")
  @route("/api/v1/salons/{salonId}/staff/{id}/invitation")
  @tag("Staff")
  namespace StaffInvitationOperations {
    interface StaffInvitations {
      @doc("スタッフが持っている招待を取得します。有効期限を過ぎた招待も、置き換えるか取り消すまでは返します(expiresAt が過去の日時になります)。招待がない場合(招待していない、受け入れられた、取り消した)は404を返します。")
      @summary("Get the invitation of a staff member")
      @get
      get(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffInvitationResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("スタッフを招待し、台帳のメールアドレスに招待メールを送ります。すでに招待がある場合は、新しい招待で置き換えます(それまでのトークンは使えなくなります)。招待の有効期間は7日です。応答は、宛先のメールアドレスにアカウントがあるかどうかで変わりません。owner のロールを与えられるのは admin だけで、サロンの owner が指定すると403を返します。スタッフがすでにログインアカウントに紐づいている場合、スタッフが無効(isActive が false)の場合、前の招待メールから60秒たっていない場合は409を返します。")
      @summary("Invite a staff member")
      @post
      create(
        @path salonId: SalonId,
        @path id: StaffId,
        @body request: StaffInvitationCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<StaffInvitationResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("スタッフが持っている招待を取り消します。メールで送ったトークンは使えなくなります。招待がない場合は404を返します。")
      @summary("Revoke the invitation of a staff member")
      @delete
      delete(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }

  @doc("スタッフに紐づいているログインアカウントを扱うAPI操作群です。ここに定義した操作はすべて実装済みです。スタッフのアカウントは、そのスタッフを指している、削除されていないユーザーで、1人のスタッフが持てるのは1つまでです。アカウントは、招待の受け入れ(/api/v1/auth/staff-invitation/accept)か、すでにあるアカウントでの招待への参加(/api/v1/auth/staff-invitation/join)でスタッフに紐づきます。実行できるのは、スタッフ台帳と同じく admin と、そのサロンの owner です。権限はパスの salonId だけで判定し、権限のないユーザーには、IDや本文が不正でも、サロンが存在しなくても403を返します。サロンが存在しない場合と、スタッフがパスのサロンに属さない場合、スタッフが削除済みの場合、スタッフにアカウントがない場合は404を返します。無効(isActive が false)のスタッフのアカウントも扱えます。")
  @route("/api/v1/salons/{salonId}/staff/{id}/account")
  @tag("Staff")
  namespace StaffAccountOperations {
    interface StaffAccounts {
      @doc("スタッフに紐づいているアカウントを取得します。スタッフにアカウントがない場合(招待を受け入れていない、紐づけを外した)は404を返します。")
      @summary("Get the account of a staff member")
      @get
      get(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffAccountResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("スタッフに紐づいているアカウントのロールを変更します。変更は、そのアカウントの次のリクエストから有効で、セッションは無効にしません。いまと同じロールを指定した場合も200を返します。owner のロールを与えられるのは admin だけで、サロンの owner が指定すると403を返します。自分のアカウント(リクエストしたユーザーが紐づいているスタッフのアカウント)のロールを変えようとすると409を返します。")
      @summary("Change the role of the account of a staff member")
      @patch
      update(
        @path salonId: SalonId,
        @path id: StaffId,
        @body request: StaffAccountUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffAccountResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("スタッフとアカウントの紐づけを外します。アカウントとスタッフは残ります。アカウントは、次のリクエストからサロンへの権限を失い(ログインはできます)、スタッフは、また招待できるようになります。自分のアカウントの紐づけを外そうとすると409を返します。")
      @summary("Unlink the account of a staff member")
      @delete
      delete(@path salonId: SalonId, @path id: StaffId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }

  @doc("顧客に見せるスタッフのプロフィールを扱うAPI操作群です。ここに定義した操作はすべて実装済みです。一覧と1件の取得(StaffProfile)は、指名するスタッフを選ぶ前の閲覧のために、認証なしで呼び出せます。対象は、在籍して勤務している(isActive が true)、削除されていないスタッフで、所属サロンが削除されていないものです。それ以外のスタッフは、存在しないスタッフと同じ扱いにします。本名、連絡先、雇用の情報は返しません。プロフィールの項目は、スタッフ台帳の操作で更新します。スタッフ本人は、自分を紹介する項目を /me の操作(StaffOwnProfile)で更新できます。")
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

    @doc("ログインしているスタッフが、顧客に見せる自分のプロフィールを扱うAPI操作群です。どのスタッフかは、アカウントで決まります(パスにIDはありません)。実行できるのは、サロンに届いている owner・manager・staff のアカウント(在籍して勤務している、削除されていないスタッフに紐づき、所属サロンが削除されていないもの)だけで、admin、顧客、サロンに届かないアカウントには403を返します。権限は最初に確認します。")
    @route("/me")
    interface StaffOwnProfile {
      @doc("ログインしているスタッフのプロフィールを取得します。顧客に見せるのと同じ項目を返します。認証のあとでスタッフが在籍しなくなった、または削除された場合は404を返します。")
      @summary("Get the signed-in staff member's profile")
      @get
      get():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffProfileResponse>;
          }
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ログインしているスタッフのプロフィールのうち、指定した項目だけを更新します。書き換えられるのは、自己紹介、写真、得意分野、資格、経験年数です。顧客に見せる名前、技術レベル、役職、予約を受け付けるかどうかは、スタッフ台帳の操作で更新します(このリクエストに指定すると400を返します)。認証のあとでスタッフが在籍しなくなった、または削除された場合は404を返します。")
      @summary("Update the signed-in staff member's profile")
      @patch
      update(@body request: StaffProfileUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffProfileResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
