import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/treatment.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("顧客の来店ごとの施術内容・使用商材・施術写真を記録し、施術の統計を提供するAPI操作群です。")
  @route("/api/v1/treatments")
  @tag("Treatments")
  namespace TreatmentOperations {
    interface TreatmentRecordCrud {
      @doc("絞り込み条件とページネーションを指定して施術記録を一覧取得します。顧客別の施術履歴やスタッフ別の施術一覧は customerId・staffId で絞り込みます。サロンのメンバーがほかのサロンの salonId を指定した場合は403を返します。")
      @summary("List treatment records")
      @get
      list(...TreatmentRecordSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<TreatmentRecordResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("施術記録を新規登録します。bookingId・customerId・staffId・services・nextRecommendedServices・materialsのproductIdに存在しないIDや削除済みのもの、予約と別のサロンのものを指定した場合、customerIdが予約の顧客と一致しない場合、nextRecommendedDateが予約の日より前の場合、およびロット番号が商品のロット管理と合わない場合は400を返します。予約が施術中（in_progress）でも完了（completed）でもない場合と、予約に施術記録がすでにある場合は409を返します。")
      @summary("Create a treatment record")
      @post
      create(@body request: TreatmentRecordCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<TreatmentRecordResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して施術記録を1件取得します。使用商材と施術写真を含みます。")
      @summary("Get a treatment record")
      @get
      get(@path id: TreatmentRecordId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<TreatmentRecordResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定した項目だけを更新します。materialsを指定した場合は使用商材の一覧全体を置き換えます。services・nextRecommendedServices・materialsのproductIdに存在しないIDや削除済みのもの、予約と別のサロンのものを指定した場合、nextRecommendedDateが予約の日より前の場合、およびロット番号が商品のロット管理と合わない場合は400を返します。")
      @summary("Update a treatment record")
      @patch
      update(
        @path id: TreatmentRecordId,
        @body request: TreatmentRecordUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<TreatmentRecordResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("施術記録を削除します。施術記録の使用商材と施術写真も削除されます。削除できるのは管理者と、サロンのオーナー・マネージャーです（スタッフは403）。施術記録を削除すると、予約を削除できるようになります。")
      @summary("Delete a treatment record")
      @delete
      delete(@path id: TreatmentRecordId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("施術記録に写真を追加します。すべての写真を1つのトランザクションで追加し、1件でも追加できない場合はどの写真も追加しません。顧客の同意(customerConsent)のない写真をisPublicにした場合と、リクエストのなかで同じphotoUrlを繰り返した場合は400を返します。施術記録の写真が追加済みのものと合わせて20枚を超える場合と、施術記録に同じphotoUrlの写真がすでにある場合は409を返します。追加した写真は個別のURLを持たないため、Locationヘッダーは返しません。追加した写真は施術記録の取得結果のphotosに含まれ、施術記録のupdatedAtが更新されます。")
      @summary("Add photos to a treatment record")
      @route("/{id}/photos")
      @post
      addPhotos(
        @path id: TreatmentRecordId,
        @body request: TreatmentPhotoBulkCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @body response: ApiResponse<TreatmentPhotoBulkCreateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("施術記録から写真を1枚削除します。誤って追加した写真を、施術記録を残したまま外すための操作です。削除すると施術記録のupdatedAtが更新されます。写真が施術記録のものでない場合は404を返します。")
      @summary("Remove a photo from a treatment record")
      @route("/{id}/photos/{photoId}")
      @delete
      removePhoto(
        @path id: TreatmentRecordId,
        @path photoId: TreatmentPhotoId,
      ):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("サロンの施術記録を集計した統計を取得します。salonIdのサロンが存在しない場合と削除されている場合は400を、サロンのメンバーがほかのサロンのsalonIdを指定した場合は403を返します。")
      @summary("Get treatment statistics")
      @route("/statistics")
      @get
      getStatistics(...TreatmentStatisticsGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<TreatmentStatisticsResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;
    }
  }

  @doc("顧客ごとのカルテと、施術時に確認するアレルギー情報を扱うAPI操作群です。")
  @route("/api/v1/medical-charts")
  @tag("Medical Charts")
  namespace MedicalChartOperations {
    interface MedicalChartCrud {
      @doc("絞り込み条件とページネーションを指定してカルテを一覧取得します。")
      @summary("List medical charts")
      @get
      list(...MedicalChartSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<MedicalChartResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("顧客のカルテを新規作成します。customerIdの顧客が存在しない場合は400を、顧客がすでにカルテを持つ場合は409を返します。Locationヘッダーは顧客IDによるカルテ取得のURLを指します。")
      @summary("Create a medical chart")
      @post
      create(@body request: MedicalChartCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<MedicalChartResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客IDを指定してカルテを取得します。顧客が存在しない場合や、顧客がカルテを持たない場合は404を返します。")
      @summary("Get the medical chart of a customer")
      @route("/customer/{customerId}")
      @get
      getByCustomer(@path customerId: CustomerId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<MedicalChartResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定した項目だけを更新します。")
      @summary("Update a medical chart")
      @patch
      update(
        @path id: MedicalChartId,
        @body request: MedicalChartUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<MedicalChartResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("施術時の注意喚起のため、顧客のアレルギー情報を一覧取得します。顧客が存在しない場合は404を返します。")
      @summary("List the allergies of a customer")
      @route("/customer/{customerId}/allergies")
      @get
      listAllergies(
        @path customerId: CustomerId,
        ...CustomerAllergySearchRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<CustomerAllergyResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }
}
