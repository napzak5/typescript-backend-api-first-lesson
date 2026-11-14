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
  @doc("サロン拠点の登録・更新・検索を行うAPI操作群です。ここに定義した操作はすべて実装済みで、定義と実装は一致しています。")
  @route("/api/v1/salons")
  @tag("Salons")
  namespace SalonOperations {
    interface SalonCrud {
      @doc("絞り込み条件とページネーションを指定してサロンを一覧取得します。削除済みのサロンは含みません。")
      @summary("List salons")
      @get
      list(...SalonSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SalonResponse>;
          }
        | {
            @statusCode statusCode: 400;
            @body error: ProblemDetails;
          };

      @doc("サロンを新規登録します。メールアドレスが既存のサロンと重複する場合は409を返します。")
      @summary("Create a salon")
      @post
      create(@body request: SalonCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<SalonResponse>;
          }
        | {
            @statusCode statusCode: 400;
            @body error: ProblemDetails;
          }
        | {
            @statusCode statusCode: 409;
            @body error: ProblemDetails;
          };

      @doc("IDを指定してサロンを1件取得します。")
      @summary("Get a salon")
      @get
      get(@path id: SalonId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalonResponse>;
          }
        | {
            @statusCode statusCode: 400;
            @body error: ProblemDetails;
          }
        | {
            @statusCode statusCode: 404;
            @body error: ProblemDetails;
          };

      @doc("指定した項目だけを更新します。openingHoursを指定した場合は営業日カレンダー全体を置き換えます。")
      @summary("Update a salon")
      @patch
      update(@path id: SalonId, @body request: SalonUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SalonResponse>;
          }
        | {
            @statusCode statusCode: 400;
            @body error: ProblemDetails;
          }
        | {
            @statusCode statusCode: 404;
            @body error: ProblemDetails;
          }
        | {
            @statusCode statusCode: 409;
            @body error: ProblemDetails;
          };

      @doc("サロンを論理削除します。削除後は一覧・取得の対象外になります。")
      @summary("Delete a salon")
      @delete
      delete(@path id: SalonId):
        | {
            @statusCode statusCode: 204;
          }
        | {
            @statusCode statusCode: 400;
            @body error: ProblemDetails;
          }
        | {
            @statusCode statusCode: 404;
            @body error: ProblemDetails;
          };
    }
  }
}
