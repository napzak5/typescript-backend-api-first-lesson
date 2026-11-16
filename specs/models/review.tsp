import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    レビュー並び順区分 - レビュー一覧の並び順を表す
    
    recent: 新着順 - 投稿日時(createdAt)の新しい順
    rating: 評価順 - 総合評価(overallRating)の高い順
    helpful: 参考になった順 - 参考になった数(helpfulCount)の多い順
    """)
  enum ReviewSortType {
    recent,
    rating,
    helpful,
  }

  @doc("""
    レビュー通報理由区分 - レビューを通報する理由を表す。運営が理由で絞り込み、集計する
    
    inappropriate: 不適切な表現 - 暴言、差別的な表現、わいせつな内容
    false_information: 事実と違う内容 - 施術や来店の事実と違う記述
    personal_information: 個人情報 - スタッフやほかの顧客の氏名・連絡先などの記述
    spam: 宣伝・無関係 - 宣伝や、来店と関係のない内容
    other: その他 - ほかのどれにも当たらない理由。details に内容を書く
    """)
  enum ReviewReportReasonType {
    inappropriate,
    false_information,
    personal_information,
    spam,
    other,
  }

  @doc("""
    レビュー通報状態区分 - 通報の処理状態を表す
    
    pending: 未処理 - 運営がまだ確かめていない通報。レビューの reportCount が数える
    dismissed: 却下 - 運営が確かめ、レビューに問題がないと判断した通報
    """)
  enum ReviewReportStatusType {
    pending,
    dismissed,
  }

  @doc("""
    レビューレスポンス - reviews テーブルの全カラムを返す。施術後の顧客体験を定量・定性的に記録し、サロン品質の改善と信頼性向上に活用する。
    プロパティ名と null 許可は DB カラムと一致させている。評価値はすべて1〜5の整数
    """)
  model ReviewResponse {
    @doc("レビューを一意に識別するID")
    id: ReviewId;

    @doc("レビュー対象のサロンID")
    salonId: SalonId;

    @doc("レビューを投稿した顧客ID")
    customerId: CustomerId;

    @doc("紐づく来店予約ID。1件の予約につきレビューは1件")
    bookingId: BookingId;

    @doc("評価対象のスタッフID。予約を担当したスタッフ(予約の担当者か施術明細のスタッフ)。スタッフを評価しないレビューの場合はnull")
    staffId: StaffId | null;

    @doc("全体満足度の評価値 (1〜5)")
    overallRating: int32;

    @doc("施術サービスそのものに対する評価値 (1〜5)。個別評価をしない総合評価のみのレビューの場合はnull")
    serviceRating: int32 | null;

    @doc("スタッフの接客・技術に対する評価値 (1〜5)。スタッフ評価を省略した場合と、staffId が null の場合はnull")
    staffRating: int32 | null;

    @doc("店内の雰囲気・居心地に対する評価値 (1〜5)。雰囲気評価を省略したレビューの場合はnull")
    atmosphereRating: int32 | null;

    @doc("店内の清潔さ・衛生面に対する評価値 (1〜5)。清潔さ評価を省略したレビューの場合はnull")
    cleanlinessRating: int32 | null;

    @doc("価格に対する価値・コストパフォーマンス評価値 (1〜5)。価格評価を省略したレビューの場合はnull")
    valueRating: int32 | null;

    @doc("レビュータイトルや要約。タイトル未設定の簡易レビューの場合はnull")
    title: string | null;

    @doc("自由記述のレビューコメント。評価のみでコメントなしのシンプルレビューの場合はnull")
    comment: string | null;

    @doc("レビューに添付された画像のURLの一覧。添付がない場合は空配列")
    imageUrls: string[];

    @doc("実来店が確認済みかを表す検証フラグ。システムが設定する。完了した予約のレビューだけを受け付けるので、APIで投稿したレビューはtrue")
    isVerified: boolean;

    @doc("レビューを「参考になった」と評価した顧客の数。1人1回で、評価したトランザクションが数え直す")
    helpfulCount: int32;

    @doc("未処理(pending)の通報の件数。通報したトランザクションと却下したトランザクションが、通報の行から数え直す。運営が却下した通報は数えない")
    reportCount: int32;

    @doc("サロンからの返信。レビューのサロンの owner・manager が書く。返信のないレビューと、返信を取り下げたレビューの場合はnull")
    ownerResponse: string | null;

    @doc("サロンが返信を書いた日時 (UTC)。返信を書き換えると変わり、同じ返信をもう一度指定しても変わらない。返信のないレビューの場合はnull")
    ownerRespondedAt: utcDateTime | null;

    @doc("レコード作成日時（レビュー投稿日時）")
    createdAt: utcDateTime;

    @doc("顧客がレビューを投稿または修正した日時。参考になった数、通報の件数、サロンからの返信が変わっても変わらない")
    updatedAt: utcDateTime;
  }

  @doc("""
    レビュー作成リクエスト - 顧客が新規レビュー投稿時に入力する評価情報と任意コメント・画像を受け取る。
    全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    検証フラグ、参考になった数、通報の件数、サロンからの返信はシステムやほかの操作が設定するため含まない
    """)
  model ReviewCreateRequest {
    @doc("レビュー対象のサロンID。bookingIdの予約のサロンを指定する")
    salonId: SalonId;

    @doc("レビュー投稿者の顧客ID。bookingIdの予約の顧客を指定する")
    customerId: CustomerId;

    @doc("紐づく来店予約ID。1件の予約につきレビューは1件まで")
    bookingId: BookingId;

    @doc("評価対象スタッフのID。bookingIdの予約を担当したスタッフ(予約の担当者か施術明細のスタッフ)で、削除されていないスタッフを指定する。スタッフを評価しない場合はnull")
    staffId: StaffId | null;

    @doc("全体満足度の評価値 (1〜5)")
    @minValue(1)
    @maxValue(5)
    overallRating: int32;

    @doc("サービス品質に対する評価値 (1〜5)。個別評価をしない総合評価のみのレビューの場合はnull")
    @minValue(1)
    @maxValue(5)
    serviceRating: int32 | null;

    @doc("スタッフ対応に対する評価値 (1〜5)。スタッフ評価を省略する場合はnull。staffId が null の場合はnullしか指定できない")
    @minValue(1)
    @maxValue(5)
    staffRating: int32 | null;

    @doc("店内の雰囲気・居心地に対する評価値 (1〜5)。雰囲気評価を省略したレビューの場合はnull")
    @minValue(1)
    @maxValue(5)
    atmosphereRating: int32 | null;

    @doc("清潔さ・衛生状態に対する評価値 (1〜5)。清潔さ評価を省略したレビューの場合はnull")
    @minValue(1)
    @maxValue(5)
    cleanlinessRating: int32 | null;

    @doc("価格に見合う価値の評価値 (1〜5)。価格評価を省略したレビューの場合はnull")
    @minValue(1)
    @maxValue(5)
    valueRating: int32 | null;

    @doc("レビュータイトル。空白だけの文字列は指定できない。タイトル未設定の簡易レビューの場合はnull")
    @maxLength(255)
    title: string | null;

    @doc("自由記述のコメント。空白だけの文字列は指定できない。評価のみでコメントなしのシンプルレビューの場合はnull")
    comment: string | null;

    @doc("添付画像のURL(http または https、500文字まで)の一覧。10件まで。添付がない場合は空配列。同じURLの繰り返しは指定できない")
    @maxItems(10)
    imageUrls: string[];
  }

  @doc("""
    レビュー部分更新リクエスト - 指定した項目だけを更新し、既存レビューの評価やコメントを調整する。
    DB で NULL 許可のカラムは null でクリアできる。対象のサロン・顧客・予約・スタッフは変更できない
    """)
  model ReviewUpdateRequest {
    @doc("更新後の全体満足度評価 (1〜5)")
    @minValue(1)
    @maxValue(5)
    overallRating?: int32;

    @doc("更新後のサービス品質評価 (1〜5)。nullでクリア")
    @minValue(1)
    @maxValue(5)
    serviceRating?: int32 | null;

    @doc("更新後のスタッフ評価 (1〜5)。nullでクリア。staffId が null のレビューには null 以外を指定できない")
    @minValue(1)
    @maxValue(5)
    staffRating?: int32 | null;

    @doc("更新後の雰囲気評価 (1〜5)。nullでクリア")
    @minValue(1)
    @maxValue(5)
    atmosphereRating?: int32 | null;

    @doc("更新後の清潔さ評価 (1〜5)。nullでクリア")
    @minValue(1)
    @maxValue(5)
    cleanlinessRating?: int32 | null;

    @doc("更新後の価格価値評価 (1〜5)。nullでクリア")
    @minValue(1)
    @maxValue(5)
    valueRating?: int32 | null;

    @doc("更新後のレビュータイトル。空白だけの文字列は指定できない。nullでクリア")
    @maxLength(255)
    title?: string | null;

    @doc("更新後のコメント本文。空白だけの文字列は指定できない。nullでクリア")
    comment?: string | null;

    @doc("画像のURL(http または https、500文字まで)の一覧の更新内容。10件まで。指定した場合は全件を置き換える。空配列でクリア。同じURLの繰り返しは指定できない")
    @maxItems(10)
    imageUrls?: string[];
  }

  @doc("""
    レビュー一覧・検索リクエスト - 絞り込み条件・並び順とページネーションを指定する。条件はすべて AND で結合する
    """)
  model ReviewSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。同じ絞り込み条件と並び順で取得した前回レスポンスの `meta.nextCursor` を指定する。一覧に出るレビューのIDでない場合は検証エラー")
    cursor?: string;

    @query
    @doc("レビュー対象のサロンIDによる絞り込み(完全一致)")
    salonId?: SalonId;

    @query
    @doc("評価対象のスタッフIDによる絞り込み(完全一致)")
    staffId?: StaffId;

    @query
    @doc("レビューを投稿した顧客IDによる絞り込み(完全一致)")
    customerId?: CustomerId;

    @query
    @doc("紐づく来店予約IDによる絞り込み(完全一致)")
    bookingId?: BookingId;

    @query
    @doc("実来店確認済みかどうかによる絞り込み")
    isVerified?: boolean;

    @query
    @doc("全体満足度評価(overallRating)の下限による絞り込み。指定値以上のレビューに一致する。maxRatingより大きい値は検証エラー")
    @minValue(1)
    @maxValue(5)
    minRating?: int32;

    @query
    @doc("全体満足度評価(overallRating)の上限による絞り込み。指定値以下のレビューに一致する")
    @minValue(1)
    @maxValue(5)
    maxRating?: int32;

    @query
    @doc("並び順。省略時は新着順。評価順と参考になった順で同じ値のレビューは、新着順に並ぶ")
    sortBy?: ReviewSortType = ReviewSortType.recent;
  }

  @doc("参考になった評価の結果 - 評価したあとの参考になった数を返す")
  model ReviewHelpfulResponse {
    @doc("評価したあとの、レビューを「参考になった」と評価した顧客の数")
    helpfulCount: int32;
  }

  @doc("""
    サロンからの返信リクエスト - レビューへのサロンの返信を書く、置き換える、取り下げる。キーは必須
    """)
  model ReviewRespondRequest {
    @doc("サロンからの返信。空白だけの文字列は指定できない。null を指定すると返信を取り下げる。admin が指定できるのは null だけ")
    ownerResponse: string | null;
  }

  @doc("""
    レビュー通報リクエスト - 不適切な内容や虚偽が疑われるレビューの通報内容を受け取る。全項目のキーが必須
    """)
  model ReviewReportRequest {
    @doc("通報の理由")
    reason: ReviewReportReasonType;

    @doc("通報内容の詳細。空白だけの文字列は指定できない。reason が other の場合は必須で、ほかの理由で補足がない場合はnull")
    @maxLength(2000)
    details: string | null;
  }

  @doc("""
    レビュー通報レスポンス - review_reports テーブルの全カラムを返す。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model ReviewReportResponse {
    @doc("通報を一意に識別するID")
    id: ReviewReportId;

    @doc("通報されたレビューのID")
    reviewId: ReviewId;

    @doc("通報したアカウントのユーザーID")
    reportedBy: UserId;

    @doc("通報の理由")
    reason: ReviewReportReasonType;

    @doc("通報内容の詳細。補足がない場合はnull")
    details: string | null;

    @doc("通報の処理状態")
    status: ReviewReportStatusType;

    @doc("通報を却下した管理者のユーザーID。未処理の場合はnull")
    resolvedBy: UserId | null;

    @doc("通報を却下した日時。未処理の場合はnull")
    resolvedAt: utcDateTime | null;

    @doc("通報を受け付けた日時")
    createdAt: utcDateTime;

    @doc("通報を最後に更新した日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    レビュー通報の一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する。受け付けた順(createdAt と id の昇順)に並ぶ
    """)
  model ReviewReportSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。同じ絞り込み条件で取得した前回レスポンスの `meta.nextCursor` を指定する。一覧に出る通報のIDでない場合は検証エラー")
    cursor?: string;

    @query
    @doc("通報の処理状態による絞り込み")
    status?: ReviewReportStatusType;

    @query
    @doc("通報されたレビューのIDによる絞り込み(完全一致)")
    reviewId?: ReviewId;

    @query
    @doc("通報されたレビューのサロンIDによる絞り込み(完全一致)")
    salonId?: SalonId;
  }

  @doc("""
    レビュー集計レスポンス - サロンまたはスタッフのレビューから平均評価や件数分布を算出し、ダッシュボードやランキング表示に活用する
    """)
  model ReviewSummaryResponse {
    @doc("全体満足度評価(overallRating)の平均値。小数第2位に四捨五入する。レビューが1件もない場合はnull")
    averageRating: float32 | null;

    @doc("レビュー総件数")
    totalReviews: int32;

    @doc("全体満足度評価(overallRating)の値ごとのレビュー件数分布。キーは評価値の\"1\"〜\"5\"で、5つのキーを常に含む(該当するレビューがない評価値は0)")
    ratingDistribution: Record<int32>;
  }
}
