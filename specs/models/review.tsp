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

    @doc("レビューが「参考になった」と評価された累積回数")
    helpfulCount: int32;

    @doc("不適切報告が入った累積回数")
    reportCount: int32;

    @doc("サロン運営からの公式返信本文。オーナー未返信のレビューの場合はnull")
    ownerResponse: string | null;

    @doc("運営が返信した日時 (UTC)。オーナー未返信のレビューの場合はnull")
    ownerRespondedAt: utcDateTime | null;

    @doc("レコード作成日時（レビュー投稿日時）")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    レビュー作成リクエスト - 顧客が新規レビュー投稿時に入力する評価情報と任意コメント・画像を受け取る。
    全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    検証フラグ、参考になった数、報告数、運営の返信はシステムやほかの操作が設定するため含まない
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

    @doc("更新後のスタッフ評価 (1〜5)。nullでクリア")
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

  @doc("参考になった評価の結果 - 加算後の参考になった数を返す")
  model ReviewHelpfulResponse {
    @doc("加算後の、レビューが「参考になった」と評価された累積回数")
    helpfulCount: int32;
  }

  @doc("""
    レビュー通報リクエスト - 不適切な内容や虚偽が疑われるレビューの通報内容を受け取る。全項目のキーが必須
    """)
  model ReviewReportRequest {
    @doc("通報の理由")
    @minLength(1)
    @maxLength(255)
    reason: string;

    @doc("通報内容の詳細。補足説明がない場合はnull")
    @maxLength(2000)
    details: string | null;
  }

  @doc("レビュー通報の結果 - 受け付けた通報を識別するIDを返す")
  model ReviewReportResponse {
    @doc("受け付けた通報を識別するID")
    reportId: string;
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
