import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/customer.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("顧客台帳を管理するAPI操作群です。台帳はプラットフォーム全体で1つで、サロンごとには分かれていません。実装済みの操作は、一覧・登録・1件の取得・更新・削除、一括取得・一括登録・一括更新・一括削除、台帳の CSV 出力、統計の取得、変更履歴と版の取得、復元、統合、顧客のデータの出力と、好み設定の取得・更新です。これらは admin とサロンのスタッフ(owner / manager / staff。所属サロンは問いません)が実行でき、削除、一括削除、CSV 出力、変更履歴と版の取得、復元、統合、顧客のデータの出力は admin と owner / manager だけが実行できます。統計は、admin と、salonId のサロンの owner / manager / staff が実行できます。レスポンスはスタッフ専用の項目を含むので、顧客本人(customer)には403を返します。権限は最初に確認し、権限のないユーザーにはIDや本文が不正でも403を返します。")
  @route("/api/v1/customers")
  @tag("Customers")
  namespace CustomerOperations {
    interface CustomerCrud {
      @doc("絞り込み条件とページネーションを指定して顧客を一覧取得します。登録日時の新しい順に並びます。削除済みの顧客は含みません。cursorが顧客を指していない場合は400を返します。")
      @summary("List customers")
      @get
      list(...CustomerSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("顧客を新規登録します。メールアドレスが削除されていない顧客と重複する場合と、紹介コードが既存の顧客(削除済みを含む)と重複する場合は409を、referredByに削除されていない顧客以外を指定した場合は400を返します。")
      @summary("Create a customer")
      @post
      create(@body request: CustomerCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して顧客を1件取得します。削除済みの顧客は404を返します。")
      @summary("Get a customer")
      @get
      get(@path id: CustomerId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定した項目だけを更新します。メールアドレスが削除されていないほかの顧客と重複する場合と、紹介コードがほかの顧客(削除済みを含む)と重複する場合は409を、referredByに削除されていない顧客以外、またはこの顧客自身を指定した場合は400を返します。")
      @summary("Update a customer")
      @patch
      update(@path id: CustomerId, @body request: CustomerUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客を論理削除します。削除後は一覧・取得の対象外になり、メールアドレスは別の顧客の登録に使えるようになります。admin と、サロンの owner / manager が実行できます。終わっていない予約(ステータスが draft・pending・confirmed・in_progress の予約)がある顧客は削除できず、409を返します。どのサロンの予約でも同じです。先に予約を完了、キャンセル、または削除してください。")
      @summary("Delete a customer")
      @delete
      delete(@path id: CustomerId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("複数の顧客IDをまとめて取得し、一覧画面の遅延読み込みや外部連携に利用します。顧客はリクエストの ids と同じ順に並びます。同じIDを2回指定した場合は400を、指定した顧客のいずれかが存在しない場合(削除済みを含む)は404を返します。404の detail は、ids の順で最初に見つからなかった顧客です。")
      @summary("Batch get customers")
      @post
      @route("/batch/get")
      batchGet(@body request: CustomerBatchGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerResponse[]>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("複数の顧客を一括登録します。すべての顧客を1つのトランザクションで登録し、1件でも登録できない場合はどの顧客も登録しません。各項目の規則は1件の登録と同じです。referredByに削除されていない既存の顧客以外を指定した場合(同じリクエストで登録する顧客は指定できません)は400を、メールアドレスまたは紹介コードが既存の顧客やリクエスト内の他の顧客と重複する場合は409を返します。400は409より先に返します。")
      @summary("Bulk create customers")
      @post
      @route("/bulk")
      bulkCreate(@body request: CustomerBulkCreateRequest):
        | {
            @statusCode statusCode: 201;
            @body response: ApiResponse<CustomerBulkCreateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("複数の顧客をそれぞれの更新内容で一括更新します。すべての顧客を1つのトランザクションで更新し、1件でも更新できない場合はどの顧客も更新しません。各項目の規則は1件の更新と同じです。同じ顧客IDを2回指定した場合は400を、指定した顧客のいずれかが存在しない場合は404を、referredByに削除されていない顧客以外を指定した場合は400を、メールアドレスまたは紹介コードが重複する場合は409を返します。顧客は1人ずつリクエストの順に更新するので、2人のメールアドレスを入れ替える更新は409です。")
      @summary("Bulk update customers")
      @patch
      @route("/bulk")
      bulkUpdate(@body request: CustomerBulkUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerBulkUpdateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("複数の顧客を一括で論理削除します。すべての顧客を1つのトランザクションで削除し、1人でも削除できない場合はどの顧客も削除しません。同じIDを2回指定した場合は400を、指定した顧客のいずれかが存在しない場合は404を、いずれかの顧客に終わっていない予約(draft・pending・confirmed・in_progress。どのサロンの予約でも)がある場合は409を返します。")
      @summary("Bulk delete customers")
      @delete
      @route("/bulk")
      bulkDelete(@body request: CustomerBulkDeleteRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerBulkDeleteResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("一覧と同じ絞り込み条件に一致する顧客を、1人を1行にした CSV ファイルとして返します。admin と owner / manager だけが実行できます。列は CustomerResponse のプロパティで、その順に並び、1行目は列名です。行は一覧と同じ順(登録日時の新しい順、同じならIDの降順)です。null は空のセル、真偽値は true / false、tags と preferences は JSON の文字列です。カンマ、ダブルクォート、改行を含む値はダブルクォートで囲みます。=、+、-、@、タブ、CR で始まる文字列の値には、表計算ソフトが式として読まないよう、先頭に ' を付けます。文字コードは BOM 付きの UTF-8、改行は CRLF です(RFC 4180)。ファイルは保存せず、応答の本文として返します。件数と行は1つのスナップショットで読みます。クエリが不正な場合は400を、一致する顧客が10,000人を超える場合は409を返します。")
      @summary("Export customers as CSV")
      @get
      @route("/export")
      export(...CustomerExportRequest):
        | {
            @statusCode statusCode: 200;
            @header contentType: "text/csv";

            @doc("attachment; filename=customers-<出力した日(UTC)、YYYY-MM-DD>.csv")
            @header
            contentDisposition: string;

            @body file: string;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("顧客の変更履歴(顧客台帳への書き込みごとの版)を、新しい版から順に取得し、変更者、日時、前の版から変わった項目を返します。admin と owner / manager だけが実行できます。削除した顧客の履歴も取得できます。IDとクエリが不正な場合と、cursorがその顧客の版を指していない場合は400を、顧客が存在しない場合は404を返します。")
      @summary("Get the history of a customer")
      @get
      @route("/{id}/history")
      getHistory(@path id: CustomerId, ...CustomerVersionSearchRequest):
        | {
            @statusCode statusCode: 200;

            @body
            response: CursorPaginationResponse<CustomerHistoryEntryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客の 1 つの版を取得し、その時点の顧客台帳の項目の値を返します。admin と owner / manager だけが実行できます。削除した顧客の版も取得できます。IDと版の番号が不正な場合は400を、顧客か、その番号の版が存在しない場合は404を返します。")
      @summary("Get a version of a customer")
      @get
      @route("/{id}/versions/{version}")
      getVersion(
        @path id: CustomerId,

        @doc("取得するバージョン番号")
        @path
        @minValue(1)
        version: int32,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerVersionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("論理削除した顧客を台帳に戻し、版(restore)を記録します。admin と owner / manager だけが実行できます。アカウントとの紐づけは戻しません(userId は null。本人がプロフィールを作ると、メールアドレスで顧客を引き継ぎます)。IDが不正な場合は400を、顧客が存在しない場合は404を、削除されていない顧客を指定した場合と、統合(merge)で削除した顧客を指定した場合と、削除のあとに同じメールアドレスの顧客が登録されている場合は409を返します。")
      @summary("Restore a deleted customer")
      @post
      @route("/{id}/restore")
      restore(@path id: CustomerId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("顧客の、salonId のサロンでの、期間の予約と売上を集計します(来店の頻度、利用金額、よく受けるサービスと担当スタッフ、キャンセルの割合)。集計はリクエストのたびに予約台帳と売上台帳から行い、記録しません。salonId に自分のサロン以外を指定した場合は403を、ID とクエリが不正な場合、endDate が startDate より前の場合、期間が366日を超える場合、salonId のサロンが存在しない場合は400を、顧客が存在しない場合は404を返します。")
      @summary("Get customer statistics")
      @get
      @route("/{id}/statistics")
      getStatistics(@path id: CustomerId, ...CustomerStatisticsGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerStatisticsResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客の好み設定(指名を希望するスタッフ、避けたいスタッフ、希望する時間帯、スタイルの好み、接客の好み、特別なリクエスト)を取得します。好み設定をまだ保存していない顧客には、空の好み設定(一覧は空配列、ほかはnull)を返します。顧客が存在しない場合は404を返します。")
      @summary("Get customer preferences")
      @get
      @route("/{id}/preferences")
      getPreferences(@path id: CustomerId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerPreferencesResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客の好み設定のうち、指定した項目だけを更新します。好み設定をまだ保存していない顧客には作成し、指定しなかった項目は空(一覧は空配列、ほかはnull)になります。顧客が存在しない場合は404を返します。preferredStaffIdやavoidStaffIdsに、存在しないスタッフか削除されたスタッフを指定した場合と、指名を希望するスタッフが避けたいスタッフに含まれることになる場合は400を返します。")
      @summary("Update customer preferences")
      @patch
      @route("/{id}/preferences")
      updatePreferences(
        @path id: CustomerId,
        @body request: CustomerPreferencesUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerPreferencesResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("重複登録された2人の顧客を1人にまとめ、統合後のメイン顧客を返します。admin と owner / manager だけが実行できます。すべてを1つのトランザクションで行い、断るときは何も変えません。台帳の項目は、両方が同じ値ならその値、片方だけが値を持つならその値、両方が異なる値なら conflictResolution で決めます。どちらかの顧客を指す紹介元は値がないものとして扱い、サブを紹介元にしていたほかの顧客はメインを紹介元にします。メインがサブの紹介コードを受け継ぐときは、サブの紹介コードを外します。サブの予約・売上・施術記録・レビューはメインのものになり、来店回数などは予約から数え直します。サブだけがアカウントに紐づいていれば、そのアカウントをメインに紐づけます。サブのポイント残高は、移行(transferred)の取引で、残っている付与ごとに同じ有効期限でメインに移します。好み設定はサブだけにあれば移し、両方にあれば conflictResolution で選んだ行の値を残します。カルテはサブだけにあれば移し、両方にあれば何も落とさずに合わせます(施術歴はメインのあとにサブのもの、製品の一覧は両方を合わせ、既往歴とメモは値が違えば空行でつなぐ)。アレルギーはサブにだけあるものを移し、両方にあるアレルゲンは重いほうの記録を残します。サブの「参考になった」はメインのものにし、自分のレビューへの投票と重複する投票は消します。2人と、紹介元がメインに変わった顧客に版(merge)を記録し、サブは論理削除します。IDが不正な場合、同じ顧客を指定した場合、存在しない顧客や削除した顧客を指定した場合は400を、両方の顧客が別々のログインアカウントに紐づいている場合と、2人のポイント残高の合計が 2,147,483,647 を超える場合、2人のカルテを合わせると施術歴か製品の一覧が50件を超える場合は409を返します。")
      @summary("Merge customer records")
      @post
      @route("/merge")
      merge(@body request: CustomerMergeRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客について保有しているデータ(台帳、紐づいたアカウント、好み設定、カルテ、アレルギー、予約、売上、ポイント取引、書いたレビュー、参考になったと評価したレビュー、施術記録、台帳の版)を、1つの JSON ファイルとして返します。個人情報保護法の保有個人データの開示の請求に、電磁的記録で応えるためのものです(本人の確認はサロンが行います)。admin と owner / manager だけが実行できます。すべてを1つのスナップショットで読みます。ファイルは保存せず、応答の本文として返します。IDが不正な場合は400を、顧客が存在しない、または削除されている場合は404を返します。")
      @summary("Export the data of a customer")
      @get
      @route("/{id}/export")
      exportData(@path id: CustomerId):
        | {
            @statusCode statusCode: 200;
            @header contentType: "application/json";

            @doc("attachment; filename=customer-<顧客の ID>.json")
            @header
            contentDisposition: string;

            @body file: CustomerDataExportResponse;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客からの個人データ削除の要請を受け付け、規制に沿った消去フローを開始します。confirmedがtrueでない場合は400を、顧客が存在しない場合は404を返します。")
      @summary("Request customer data deletion")
      @post
      @route("/{id}/deletion-request")
      requestDeletion(
        @path id: CustomerId,
        @body request: CustomerDataDeletionRequest,
      ):
        | {
            @statusCode statusCode: 202;
            @body response: ApiResponse<CustomerDataDeletionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }

    @doc("顧客本人が自分のプロフィール(自分の顧客レコード)と好み設定を扱うAPI操作群です。実行できるのは customer ロールのユーザーだけで、admin とサロンのスタッフには403を返します。権限は最初に確認します。スタッフ用の項目は、リクエストにもレスポンスにも含みません。")
    @route("/me")
    interface CustomerProfile {
      @doc("ログインしているユーザーのプロフィールを取得します。プロフィールをまだ作っていない場合と、顧客レコードが削除された場合は404を返します。")
      @summary("Get the signed-in customer's profile")
      @get
      get():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerProfileResponse>;
          }
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ログインしているユーザーのプロフィールを作成します。メールアドレスはアカウントのものを使います。台帳に同じメールアドレスの顧客がいて、まだどのアカウントにも結び付いていない場合は、その顧客を自分のプロフィールにします(リクエストでnullにした項目は、台帳の値を残します)。すでにプロフィールがある場合、アカウントのメールアドレスを確認していない場合、同じメールアドレスの顧客がほかのアカウントに結び付いている場合は409を返します。")
      @summary("Create the signed-in customer's profile")
      @post
      create(@body request: CustomerProfileCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<CustomerProfileResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ログインしているユーザーのプロフィールのうち、指定した項目だけを更新します。プロフィールをまだ作っていない場合と、顧客レコードが削除された場合は404を返します。")
      @summary("Update the signed-in customer's profile")
      @patch
      update(@body request: CustomerProfileUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerProfileResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ログインしているユーザーの好み設定を取得します。好み設定をまだ保存していない場合は、空の好み設定(一覧は空配列、ほかはnull)を返します。プロフィールをまだ作っていない場合と、顧客レコードが削除された場合は404を返します。")
      @summary("Get the signed-in customer's preferences")
      @get
      @route("/preferences")
      getPreferences():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerPreferencesResponse>;
          }
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ログインしているユーザーの好み設定のうち、指定した項目だけを更新します。項目の規則は、台帳の好み設定の更新と同じです。プロフィールをまだ作っていない場合と、顧客レコードが削除された場合は404を返します。")
      @summary("Update the signed-in customer's preferences")
      @patch
      @route("/preferences")
      updatePreferences(@body request: CustomerPreferencesUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerPreferencesResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
