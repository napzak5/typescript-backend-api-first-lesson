import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/review.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("施術体験に対する顧客レビューを収集・運用し、信頼性の高いフィードバック基盤を構築するAPI操作群です。一覧・投稿・取得・修正・削除を実装済みで、参考になった・通報は未実装です(404)。一覧と取得はログインなしで読めます。削除したサロンのレビューは、一覧・取得・修正・削除の対象外です。")
  @route("/api/v1/reviews")
  @tag("Reviews")
  namespace ReviewOperations {
    interface ReviewCrud {
      @doc("サロン、スタッフ、顧客、予約、実来店確認、評価点でレビューを絞り込み、指定した並び順とページネーションで一覧取得し、店舗運営の改善材料を抽出します。ログインなしで呼べます。削除したサロンのレビューは含みません。存在しないIDで絞り込んだ場合は空の一覧を返します。minRatingにmaxRatingより大きい値を指定した場合と、cursorが一覧に出るレビューのIDでない場合は400を返します。")
      @summary("List reviews")
      @useAuth(NoAuth)
      @get
      list(...ReviewSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ReviewResponse>;
          }
        | ProblemResponse<400>
        | PublicErrors;

      @doc("施術完了後に顧客がレビューを投稿し、サービス品質の可視化と信頼獲得につなげます。投稿できるのは、予約の顧客本人(ロール customer で顧客のプロフィールがあるアカウント)だけで、admin とサロンのメンバー、プロフィールのない顧客のアカウント、customerId が自分の顧客IDでないリクエストには403を返します。bookingIdが自分の予約でない場合、salonIdがその予約のサロンでない場合(削除したサロンを含む)、staffIdがその予約を担当したスタッフ(予約の担当者か施術明細のスタッフ)でないか削除されている場合、staffIdがnullでstaffRatingを指定した場合は400を、予約のステータスがcompletedでない場合と、予約のレビューが既に存在する場合は409を返します。投稿すると、サロンの rating と reviewCount を、そのサロンのレビューから数え直します。")
      @summary("Create review")
      @post
      create(@body request: ReviewCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<ReviewResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("単一レビューの詳細を表示し、コメント内容や評価指標を確認します。ログインなしで呼べます。レビューが存在しない場合と、削除したサロンのレビューの場合は404を返します。")
      @summary("Get review")
      @useAuth(NoAuth)
      @get
      get(@path id: ReviewId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | PublicErrors;

      @doc("顧客が投稿後のレビューの指定した項目だけを修正し、誤記修正や追記を反映します。修正できるのは、レビューを書いた顧客本人(ロール customer で顧客のプロフィールがあるアカウント)だけで、admin とサロンのメンバー、プロフィールのない顧客のアカウント、ほかの顧客のレビューには403を返します。空の本文と、staffId が null のレビューに staffRating を指定した場合は400を、レビューが存在しない場合と、削除したサロンのレビューの場合は404を返します。overallRating が変わると、サロンの rating を、そのサロンのレビューから数え直します。")
      @summary("Update review")
      @patch
      update(@path id: ReviewId, @body request: ReviewUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("レビューの削除要請に応じて投稿を除去し、コンプライアンスを維持します。削除できるのは、レビューを書いた顧客本人と admin だけで、サロンのメンバー、プロフィールのない顧客のアカウント、ほかの顧客のレビューには403を返します。レビューが存在しない場合と、削除したサロンのレビューの場合は404を返します。削除は物理削除で、削除後は一覧・取得・集計の対象外になり、サロンの rating と reviewCount を数え直します。予約は削除できるようになり、顧客は同じ予約にもう一度投稿できます。")
      @summary("Delete review")
      @delete
      delete(@path id: ReviewId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("他の利用者に役立つレビューをマーキングし、信頼性の高い声を強調します。参考になった数を1加算し、加算後の値を返します。")
      @summary("Mark review as helpful")
      @route("/{id}/helpful")
      @post
      markHelpful(@path id: ReviewId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewHelpfulResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("不適切な内容や虚偽が疑われるレビューを通報し、運営による対応フローへ送ります。レビューの報告数を1加算します。")
      @summary("Report review")
      @route("/{id}/report")
      @post
      report(@path id: ReviewId, @body request: ReviewReportRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewReportResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("サロン単位でのレビュー評価と傾向を集計し、店舗ブランディングと改善施策に活かすAPI操作群です。サロンのレビュー一覧は GET /api/v1/reviews の salonId で絞り込みます。集計は保存せず、呼ぶたびにレビューから数えます。")
  @route("/api/v1/salons/{salonId}/reviews")
  @tag("Reviews")
  namespace SalonReviewOperations {
    interface SalonReviewSummary {
      @doc("サロン全体の平均評価や件数などの概要指標を取得し、ダッシュボード表示に利用します。ログインなしで呼べます。averageRating と totalReviews は、サロンの rating と reviewCount と一致します。サロンが存在しない場合と、削除されている場合は404を返します。")
      @summary("Get salon reviews summary")
      @useAuth(NoAuth)
      @route("/summary")
      @get
      getSummary(@path salonId: SalonId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewSummaryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | PublicErrors;
    }
  }

  @doc("スタッフ単位でのレビューを把握し、個々の接客品質評価や育成につなげるAPI操作群です。スタッフのレビュー一覧は GET /api/v1/reviews の staffId で絞り込みます。集計は保存せず、呼ぶたびにレビューから数えます。")
  @route("/api/v1/staff/{staffId}/reviews")
  @tag("Reviews")
  namespace StaffReviewOperations {
    interface StaffReviewSummary {
      @doc("スタッフ別の平均評価やレビュー数を集計し、人事評価や表彰に用います。ログインなしで呼べます。staffId がそのスタッフのレビューを数えます。スタッフが存在しない場合と、スタッフかそのサロンが削除されている場合は404を返します。")
      @summary("Get staff reviews summary")
      @useAuth(NoAuth)
      @route("/summary")
      @get
      getStaffSummary(@path staffId: StaffId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewSummaryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | PublicErrors;
    }
  }
}
