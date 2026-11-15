import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/salon.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("サロン拠点の登録・更新・検索を行うAPI操作群です。ここに定義した操作はすべて実装済みで、定義と実装は一致しています。一覧と1件の取得は、予約前の閲覧のために認証なしで呼び出せます。")
  @route("/api/v1/salons")
  @tag("Salons")
  namespace SalonOperations {
    interface SalonCrud {
      @doc("絞り込み条件とページネーションを指定してサロンを一覧取得します。削除済みのサロンは含みません。")
      @summary("List salons")
      @useAuth(NoAuth)
      @get
      list(...SalonSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SalonResponse>;
          }
        | ProblemResponse<400>
        | PublicErrors;

      @doc("サロンを新規登録します。admin だけが実行できます。メールアドレスが既存のサロンと重複する場合は409を返します。")
      @summary("Create a salon")
      @post
      create(@body request: SalonCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<SalonResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定してサロンを1件取得します。")
      @summary("Get a salon")
      @useAuth(NoAuth)
      @get
      get(@path id: SalonId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalonResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | PublicErrors;

      @doc("指定した項目だけを更新します。openingHoursを指定した場合は営業日カレンダー全体を置き換えます。admin と、そのサロンの owner / manager が実行できます。ほかのサロンの owner / manager には403を返します。")
      @summary("Update a salon")
      @patch
      update(@path id: SalonId, @body request: SalonUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalonResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンを論理削除します。削除後は一覧・取得の対象外になります。admin と、そのサロンの owner が実行できます。ほかのサロンの owner には403を返します。終わっていない予約(ステータスが draft・pending・confirmed・in_progress の予約)があるサロンは削除できず、409を返します。先に予約を完了、キャンセル、または削除してください。")
      @summary("Delete a salon")
      @delete
      delete(@path id: SalonId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }
}
