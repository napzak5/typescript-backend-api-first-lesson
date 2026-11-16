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
  @doc("施術体験に対する顧客レビューを収集・運用し、信頼性の高いフィードバック基盤を構築するAPI操作群です。一覧・投稿・取得・修正・削除・参考になった・通報を実装済みです。一覧と取得はログインなしで読めます。削除したサロンのレビューは、一覧・取得・修正・削除・参考になった・通報の対象外です。")
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

      @doc("他の利用者に役立つレビューをマーキングし、信頼性の高い声を強調します。評価できるのは顧客(ロール customer で顧客のプロフィールがあるアカウント)だけで、admin とサロンのメンバー、プロフィールのない顧客のアカウント、自分のレビューには403を返します。1人1回で、同じ顧客の2回目は数を変えずに今の数を返します。参考になった数を、評価した顧客の数から数え直し、評価したあとの値を返します。存在しないレビューと削除したサロンのレビューは404です。本文は読みません。")
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

      @doc("不適切な内容や虚偽が疑われるレビューを運営に通報し、受け付けた通報を返します。通報できるのは、顧客(ロール customer で顧客のプロフィールがあるアカウント)と、レビューのサロンの owner・manager です。admin と staff、ほかのサロンの owner・manager、プロフィールのない顧客のアカウント、自分のレビューには403を返します。1つのレビューを通報できるのは1アカウント1回で、2回目は409です(却下されたあとも同じ)。reason が other で details が null の場合は400を、レビューが存在しない場合と、削除したサロンのレビューの場合は404を返します。通報してもレビューは隠しません。レビューの reportCount を、未処理の通報から数え直します。")
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
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("レビューの通報を運営(admin)が処理するAPI操作群です。未処理の通報を受け付けた順に読み、レビューに問題がなければ通報を却下し、問題があればレビューを削除します(DELETE /api/v1/reviews/{id}。レビューの通報も一緒に消えます)。どの操作も admin だけが呼べます。削除したサロンのレビューの通報は対象外です。")
  @route("/api/v1/review-reports")
  @tag("Reviews")
  namespace ReviewReportOperations {
    interface ReviewReportCrud {
      @doc("レビューの通報を、受け付けた順(createdAt と id の昇順)に一覧取得します。admin だけが呼べ、ほかのロールには403を返します。status、reviewId、salonId で絞り込めます。削除したサロンのレビューの通報は含みません。存在しないIDで絞り込んだ場合は空の一覧を返します。cursor が一覧に出る通報のIDでない場合は400を返します。")
      @summary("List review reports")
      @get
      list(...ReviewReportSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ReviewReportResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("レビューに問題がないと判断した通報を却下し、却下した通報を返します。admin だけが呼べ、ほかのロールには403を返します。status を dismissed に、resolvedBy を操作者のユーザーIDに、resolvedAt を却下した日時にし、レビューの reportCount を未処理の通報から数え直します。却下した通報の却下は409、通報が存在しない場合と、削除したサロンのレビューの通報の場合は404を返します。本文は読みません。")
      @summary("Dismiss review report")
      @route("/{id}/dismiss")
      @post
      dismiss(@path id: ReviewReportId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ReviewReportResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
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
