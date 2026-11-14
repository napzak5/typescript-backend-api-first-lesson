import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/service.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("各サロンが提供する施術メニューを管理し、価格や所要時間などの情報を一元化するAPI操作群です。")
  @route("/api/v1/salons/{salonId}/services")
  @tag("Services")
  namespace ServiceOperations {
    interface ServiceCrud {
      @doc("サロン内の提供メニューを、絞り込み条件とページネーションを指定して一覧取得します。削除済みのサービスは含みません。サロンが存在しない場合は404を返します。")
      @summary("List salon services")
      @get
      list(@path salonId: SalonId, ...ServiceSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("新しい施術メニューを登録し、価格・施術時間・提供条件を設定します。サロンが存在しない場合は404を、categoryIdやpackageServiceIdsに同じサロンのものではないIDを指定した場合は400を返します。")
      @summary("Create service")
      @post
      create(@path salonId: SalonId, @body request: ServiceCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<ServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("特定メニューの詳細情報を取得し、予約システムやスタッフ教育に必要な内容を確認します。")
      @summary("Get service")
      @get
      get(@path salonId: SalonId, @path id: ServiceId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("既存メニューの指定した項目だけを更新し、料金改定や提供条件の変更に対応します。categoryIdやpackageServiceIdsに同じサロンのものではないIDを指定した場合は400を返します。")
      @summary("Update service")
      @patch
      update(
        @path salonId: SalonId,
        @path id: ServiceId,
        @body request: ServiceUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ServiceResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("提供終了となったメニューを論理削除し、予約導線から除外します。削除後は一覧・取得の対象外になります。")
      @summary("Delete service")
      @delete
      delete(@path salonId: SalonId, @path id: ServiceId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("複数メニューの共通項目を一括更新し、季節キャンペーンや価格調整を効率化します。すべてのサービスを1つのトランザクションで更新し、指定したサービスのいずれかがサロンに存在しない場合は404を返してどのサービスも更新しません。")
      @summary("Bulk update services")
      @route("/bulk")
      @patch
      bulkUpdate(
        @path salonId: SalonId,
        @body request: ServiceBulkUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ServiceBulkUpdateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("施術メニューのカテゴリ体系を整備し、顧客が選びやすい構造を提供するAPI操作群です。")
  @route("/api/v1/service-categories")
  @tag("Services")
  namespace ServiceCategoryOperations {
    interface ServiceCategoryCrud {
      @doc("登録済みのカテゴリを、絞り込み条件とページネーションを指定して一覧取得し、メニュー分類や表示順を管理します。")
      @summary("List service categories")
      @get
      list(...ServiceCategorySearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ServiceCategoryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("新しい施術カテゴリを作成し、階層構造や表示順を定義します。salonIdのサロンが存在しない場合や、parentIdに同じサロンのものではないカテゴリを指定した場合は400を返します。")
      @summary("Create service category")
      @post
      create(@body request: ServiceCategoryCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<ServiceCategoryResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("特定カテゴリの詳細情報を取得し、名称や親子関係、表示順を確認します。")
      @summary("Get service category")
      @get
      get(@path id: CategoryId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ServiceCategoryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("既存カテゴリの指定した項目だけを更新し、名称や表示順、親子関係を調整します。parentIdに同じサロンのものではないカテゴリや、自身または子孫のカテゴリを指定した場合は400を返します。")
      @summary("Update service category")
      @patch
      update(
        @path id: CategoryId,
        @body request: ServiceCategoryUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ServiceCategoryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("利用されなくなったカテゴリを削除し、メニュー構成を整理します。このカテゴリに属するサービスのcategoryIdと、子カテゴリのparentIdはnullになります。")
      @summary("Delete service category")
      @delete
      delete(@path id: CategoryId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }
}
