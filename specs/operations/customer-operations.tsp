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
  @doc("顧客台帳を管理するAPI操作群です。台帳はプラットフォーム全体で1つで、サロンごとには分かれていません。実装済みの操作は、一覧・登録・1件の取得・更新・削除です。これらは admin とサロンのスタッフ(owner / manager / staff。所属サロンは問いません)が実行でき、削除は admin と owner / manager だけが実行できます。レスポンスはスタッフ専用の項目を含むので、顧客本人(customer)には403を返します。権限は最初に確認し、権限のないユーザーにはIDや本文が不正でも403を返します。")
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

      @doc("顧客を論理削除します。削除後は一覧・取得の対象外になり、メールアドレスは別の顧客の登録に使えるようになります。admin と、サロンの owner / manager が実行できます。")
      @summary("Delete a customer")
      @delete
      delete(@path id: CustomerId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("複数の顧客IDをまとめて取得し、一覧画面の遅延読み込みや外部連携に利用します。指定した顧客のいずれかが存在しない場合は404を返します。")
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

      @doc("複数の顧客を一括登録します。すべての顧客を1つのトランザクションで登録し、1件でも登録できない場合はどの顧客も登録しません。メールアドレスまたは紹介コードが既存の顧客やリクエスト内の他の顧客と重複する場合は409を、referredByに存在しない顧客を指定した場合は400を返します。")
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

      @doc("複数の顧客をそれぞれの更新内容で一括更新します。すべての顧客を1つのトランザクションで更新し、1件でも更新できない場合はどの顧客も更新しません。指定した顧客のいずれかが存在しない場合は404を、メールアドレスまたは紹介コードが重複する場合は409を返します。")
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

      @doc("複数の顧客を一括で論理削除します。すべての顧客を1つのトランザクションで削除し、指定した顧客のいずれかが存在しない場合は404を返してどの顧客も削除しません。")
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
        | RequestBodyErrors
        | CommonErrors;

      @doc("一覧と同じ絞り込み条件に一致する顧客を指定形式でエクスポートするジョブを受け付け、帳票出力や外部共有に活用します。")
      @summary("Export customers")
      @post
      @route("/export")
      export(@body request: CustomerExportRequest):
        | {
            @statusCode statusCode: 202;
            @body response: ApiResponse<CustomerExportResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客レコードに対する操作の監査履歴を新しい順に取得し、変更者や変更内容を追跡します。顧客が存在しない場合は404を返します。")
      @summary("Get customer audit history")
      @get
      @route("/{id}/history")
      getHistory(@path id: CustomerId, ...CustomerAuditEntrySearchRequest):
        | {
            @statusCode statusCode: 200;

            @body
            response: CursorPaginationResponse<CustomerAuditEntryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定したバージョン時点の顧客情報を取得し、過去状態の確認や比較に利用します。顧客またはバージョンが存在しない場合は404を返します。")
      @summary("Get customer version")
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
            @body response: ApiResponse<CustomerResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("論理削除された顧客を復元し、誤削除への迅速なリカバリを可能にします。顧客が存在しない場合は404を、削除されていない顧客を指定した場合は409を返します。")
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

      @doc("来店頻度や売上貢献度など顧客指標を集計し、セグメント施策やVIP判定に利用します。顧客が存在しない場合は404を返します。")
      @summary("Get customer statistics")
      @get
      @route("/{id}/statistics")
      getStatistics(
        @path id: CustomerId,

        @query
        @doc("集計対象期間（例: '7d', '1m', '3m', '1y'）。数値と単位(d: 日、m: 月、y: 年)で指定する")
        period?: string = "1y",
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<CustomerStatisticsResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("顧客の施術好みや指名スタッフなどの希望設定のうち、指定した項目だけを更新し、パーソナライズされた提案に反映します。好み設定がまだない場合は作成し、指定しなかった項目はnullになります。顧客が存在しない場合は404を、preferredStaffIdやavoidStaffIdsに存在しないスタッフを指定した場合は400を返します。")
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

      @doc("重複登録された顧客レコードを統合し、履歴やポイントを一本化します。secondaryCustomerIdの顧客は統合後に論理削除されます。存在しない顧客や同じ顧客を指定した場合は400を、両方の顧客が別々のログインアカウントに紐づいている場合は409を返します。")
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

      @doc("顧客が自身のデータを取得できるようエクスポートし、GDPR等の個人情報規制に対応します。顧客が存在しない場合は404を返します。")
      @summary("Export customer data")
      @get
      @route("/{id}/export")
      exportData(
        @path id: CustomerId,

        @query
        @doc("エクスポート形式")
        format?: CustomerDataExportFormatType = CustomerDataExportFormatType.json,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: bytes;
            @header("Content-Type") content: string;
            @header("Content-Disposition") contentDisposition: string;
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

    @doc("顧客本人が自分のプロフィール(自分の顧客レコード)を扱うAPI操作群です。実行できるのは customer ロールのユーザーだけで、admin とサロンのスタッフには403を返します。権限は最初に確認します。スタッフ用の項目は、リクエストにもレスポンスにも含みません。")
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
    }
  }
}
