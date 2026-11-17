import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    アレルギータイプ区分 - 顧客が持つアレルギーの種類を分類、施術時の注意事項として使用
    
    chemical: 化学物質 - カラー剤、パーマ剤等の化学薬品に対するアレルギー
    fragrance: 香料 - 香水、シャンプー等の香料成分に対するアレルギー
    metal: 金属 - ヘアピン、ハサミ等の金属製品に対するアレルギー
    latex: ラテックス - 手袋等のゴム製品に対するアレルギー
    plant: 植物 - ヘナ、ハーブ等の植物由来成分に対するアレルギー
    other: その他 - 上記に分類されないアレルギー
    """)
  enum AllergyType {
    chemical,
    fragrance,
    metal,
    latex,
    plant,
    other,
  }

  @doc("""
    アレルギー重篤度区分 - アレルギー反応の重篤度を表し、対応レベルを決定
    
    mild: 軽度 - 軽いかゆみや赤み程度、通常の施術で注意すれば対応可能
    moderate: 中等度 - 明確な皮膚反応、特別な配慮や代替品の使用が必要
    severe: 重度 - 激しい反応、特定の施術を避けるべきレベル
    life_threatening: 生命に関わる - アナフィラキシー等の危険があり、該当する商材・施術を一切使用できないレベル
    """)
  enum AllergySeverityType {
    mild,
    moderate,
    severe,
    life_threatening,
  }

  // ============================================================================
  // 施術記録 (treatment_records / treatment_materials / treatment_photos)
  // ============================================================================

  @doc("""
    施術写真種別区分 - 写真を施術のどの時点で撮ったかを表す
    
    before: 施術前 - 施術を始める前の状態
    during: 施術中 - 施術の途中の状態
    after: 施術後 - 施術を終えたあとの状態
    other: その他 - ほかのどれにも当たらない写真
    """)
  enum TreatmentPhotoType {
    before,
    during,
    after,
    other,
  }

  @doc("""
    施術で使用した商材 - treatment_materials テーブルの1行。施術記録の作成・更新リクエストとレスポンスで共通に使う。
    プロパティ名と null 許可は DB カラムと一致させている。商材は指定した順に保存し、その順に返す。
    使用商材を記録しても在庫は動かない。在庫は在庫の移動（use）で記録する
    """)
  model TreatmentMaterial {
    @doc("使用した商品の ID。予約と同じサロンの、削除されていない商品を指定する。ロットの違う同じ商品を複数回指定できる")
    productId: ProductId;

    @doc("使用量。0.01単位")
    @minValueExclusive(0)
    @maxValue(99999999.99)
    quantity: float64;

    @doc("数量単位")
    @minLength(1)
    @maxLength(20)
    unit: string;

    @doc("使用した商品のロット番号。ロットで管理する商品（requiresLotTracking）では必須、それ以外の商品ではnull")
    @maxLength(100)
    lotNumber: string | null;

    @doc("備考メモ - 特記事項がない標準的な使用量の場合はnull")
    notes: string | null;
  }

  @doc("""
    施術写真レスポンス - treatment_photos テーブルの1行。施術記録に読み取り専用で埋め込む。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model TreatmentPhotoResponse {
    @doc("写真 ID")
    id: TreatmentPhotoId;

    @doc("写真の種別")
    photoType: TreatmentPhotoType;

    @doc("写真の URL")
    photoUrl: string;

    @doc("サムネイル画像の URL。サムネイルを作成していない場合はnull")
    thumbnailUrl: string | null;

    @doc("撮影アングル。記録しない場合はnull")
    angle: string | null;

    @doc("写真の説明。説明がない場合はnull")
    description: string | null;

    @doc("サロン外（ポートフォリオ等）に公開してよい写真かどうか")
    isPublic: boolean;

    @doc("顧客が写真の撮影・利用に同意しているかどうか")
    customerConsent: boolean;

    @doc("表示順序。小さい順に並ぶ")
    sortOrder: int32;
  }

  @doc("""
    施術写真登録リクエスト - treatment_photos テーブルに1行を追加する。全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    写真を追加する施術記録はパスの id で指定する
    """)
  model TreatmentPhotoCreateRequest {
    @doc("写真の種別")
    photoType: TreatmentPhotoType;

    @doc("写真の URL(http または https、500文字まで)。1つの施術記録に同じURLの写真は1枚だけ")
    @minLength(1)
    @maxLength(500)
    photoUrl: string;

    @doc("サムネイル画像の URL(http または https、500文字まで)。サムネイルを作成していない場合はnull")
    @maxLength(500)
    thumbnailUrl: string | null;

    @doc("撮影アングル。空白だけの文字列は指定できない。記録しない場合はnull")
    @maxLength(50)
    angle: string | null;

    @doc("写真の説明。空白だけの文字列は指定できない。説明がない場合はnull")
    description: string | null;

    @doc("サロン外（ポートフォリオ等）に公開してよい写真かどうか。true にできるのは customerConsent が true の写真だけ")
    isPublic: boolean;

    @doc("顧客が写真の撮影・利用に同意しているかどうか")
    customerConsent: boolean;

    @doc("表示順序。小さい順に並び、同じ値の写真は先に追加した写真が先に並ぶ。1回の追加のなかで同じ値は指定できない")
    @minValue(0)
    sortOrder: int32;
  }

  @doc("""
    施術写真一括登録リクエスト - 1つの施術記録に複数の写真を追加する。
    すべての写真を1つのトランザクションで追加し、1件でも追加できない場合はどの写真も追加しない。
    1つの施術記録の写真は、追加済みのものと合わせて20枚まで
    """)
  model TreatmentPhotoBulkCreateRequest {
    @doc("追加する写真の一覧。1件以上20件以下で指定する。同じphotoUrlと同じsortOrderの繰り返しは指定できない")
    @minItems(1)
    @maxItems(20)
    photos: TreatmentPhotoCreateRequest[];
  }

  @doc("施術写真一括登録の結果 - 追加した写真の一覧を返す")
  model TreatmentPhotoBulkCreateResponse {
    @doc("追加した写真の一覧。リクエストと同じ順に並ぶ")
    created: TreatmentPhotoResponse[];
  }

  @doc("""
    施術記録レスポンス - treatment_records テーブルの公開カラムと、使用商材(treatment_materials)・施術写真(treatment_photos)を返す。
    プロパティ名と null 許可は DB カラムと一致させている。
    consultationNotes と staffEvaluation はスタッフ向けの情報で、誰に返すかは認可で決める
    """)
  model TreatmentRecordResponse {
    @doc("施術記録 ID")
    id: TreatmentRecordId;

    @doc("紐づく予約 ID。1件の予約に施術記録は1件まで")
    bookingId: BookingId;

    @doc("施術を受けた顧客 ID")
    customerId: CustomerId;

    @doc("施術担当スタッフ ID")
    staffId: StaffId;

    @doc("施術で提供したサービス ID 一覧")
    services: ServiceId[];

    @doc("施術で使った技法の名称の一覧。記録しない場合は空配列")
    techniques: string[];

    @doc("施術前のカウンセリング内容のメモ。記録しない場合はnull")
    consultationNotes: string | null;

    @doc("施術のときの頭皮の状態。記録しない場合はnull")
    scalpCondition: string | null;

    @doc("施術のときの毛髪の状態。記録しない場合はnull")
    hairCondition: string | null;

    @doc("カラー剤の配合。カラーをしない施術や記録しない場合はnull")
    colorFormula: string | null;

    @doc("施術の処理時間（分）。記録しない場合はnull")
    processingTime: int32 | null;

    @doc("施術結果のメモ。特記事項がない通常施術の場合はnull")
    resultNotes: string | null;

    @doc("次回来店の推奨日。特に提案事項がない場合はnull")
    nextRecommendedDate: plainDate | null;

    @doc("次回来店時に推奨するサービス ID の一覧。提案事項がない場合は空配列")
    nextRecommendedServices: ServiceId[];

    @doc("ホームケアの提案内容。提案事項がない場合はnull")
    homeCareSuggestions: string | null;

    @doc("顧客満足度（1〜5）。施術直後で未回答の場合はnull")
    customerSatisfaction: int32 | null;

    @doc("担当スタッフによる施術の自己評価・申し送り。記録しない場合はnull")
    staffEvaluation: string | null;

    @doc("施術で使用した商材の一覧。指定した順に並ぶ。商材を使用しない施術の場合は空配列")
    materials: TreatmentMaterial[];

    @doc("施術写真の一覧。sortOrderの昇順で並ぶ。写真がない場合は空配列")
    photos: TreatmentPhotoResponse[];

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    施術記録新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    施術写真は登録後に写真追加の操作で追加する
    """)
  model TreatmentRecordCreateRequest {
    @doc("紐づく予約 ID。施術中（in_progress）か完了（completed）の、施術記録がまだない予約を指定する")
    bookingId: BookingId;

    @doc("施術を受けた顧客 ID。予約の顧客と一致している必要がある")
    customerId: CustomerId;

    @doc("施術担当スタッフ ID。予約と同じサロンの、削除されていないスタッフを指定する。予約の担当でなくてもよい")
    staffId: StaffId;

    @doc("施術で提供したサービス ID 一覧。予約と同じサロンの、削除されていないサービスを1件以上20件以下で指定する。予約の明細にないサービスも指定できる。同じサービスの繰り返しは指定できない")
    @minItems(1)
    @maxItems(20)
    services: ServiceId[];

    @doc("施術で使った技法の名称の一覧（100文字まで）。20件まで。同じ名称の繰り返しは指定できない。記録しない場合は空配列")
    @maxItems(20)
    techniques: string[];

    @doc("施術前のカウンセリング内容のメモ。記録しない場合はnull")
    consultationNotes: string | null;

    @doc("施術のときの頭皮の状態。記録しない場合はnull")
    scalpCondition: string | null;

    @doc("施術のときの毛髪の状態。記録しない場合はnull")
    hairCondition: string | null;

    @doc("カラー剤の配合。カラーをしない施術や記録しない場合はnull")
    colorFormula: string | null;

    @doc("施術の処理時間（分）。記録しない場合はnull")
    @minValue(0)
    @maxValue(1440)
    processingTime: int32 | null;

    @doc("施術結果のメモ。特記事項がない通常施術の場合はnull")
    resultNotes: string | null;

    @doc("次回来店の推奨日。予約の日より前の日は指定できない。特に提案事項がない場合はnull")
    nextRecommendedDate: plainDate | null;

    @doc("次回来店時に推奨するサービス ID の一覧。予約と同じサロンのサービスを20件まで指定する。同じサービスの繰り返しは指定できない。提案事項がない場合は空配列")
    @maxItems(20)
    nextRecommendedServices: ServiceId[];

    @doc("ホームケアの提案内容。提案事項がない場合はnull")
    homeCareSuggestions: string | null;

    @doc("顧客満足度（1〜5）。施術直後で未回答の場合はnull")
    @minValue(1)
    @maxValue(5)
    customerSatisfaction: int32 | null;

    @doc("担当スタッフによる施術の自己評価・申し送り。記録しない場合はnull")
    staffEvaluation: string | null;

    @doc("施術で使用した商材の一覧。50件まで。指定した順に保存する。商材を使用しない施術の場合は空配列")
    @maxItems(50)
    materials: TreatmentMaterial[];
  }

  @doc("""
    施術記録部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    materials を指定した場合は使用商材の一覧全体を置き換える。予約・顧客・担当スタッフは変更できない
    """)
  model TreatmentRecordUpdateRequest {
    @doc("施術で提供したサービス ID 一覧。予約と同じサロンの、削除されていないサービスを1件以上20件以下で指定する。同じサービスの繰り返しは指定できない")
    @minItems(1)
    @maxItems(20)
    services?: ServiceId[];

    @doc("施術で使った技法の名称の一覧（100文字まで）。20件まで。同じ名称の繰り返しは指定できない。空配列でクリア")
    @maxItems(20)
    techniques?: string[];

    @doc("施術前のカウンセリング内容のメモ。nullでクリア")
    consultationNotes?: string | null;

    @doc("施術のときの頭皮の状態。nullでクリア")
    scalpCondition?: string | null;

    @doc("施術のときの毛髪の状態。nullでクリア")
    hairCondition?: string | null;

    @doc("カラー剤の配合。nullでクリア")
    colorFormula?: string | null;

    @doc("施術の処理時間（分）。nullでクリア")
    @minValue(0)
    @maxValue(1440)
    processingTime?: int32 | null;

    @doc("施術結果のメモ。nullでクリア")
    resultNotes?: string | null;

    @doc("次回来店の推奨日。予約の日より前の日は指定できない。nullでクリア")
    nextRecommendedDate?: plainDate | null;

    @doc("次回来店時に推奨するサービス ID の一覧。予約と同じサロンの、削除されていないサービスを20件まで指定する。同じサービスの繰り返しは指定できない。空配列でクリア")
    @maxItems(20)
    nextRecommendedServices?: ServiceId[];

    @doc("ホームケアの提案内容。nullでクリア")
    homeCareSuggestions?: string | null;

    @doc("顧客満足度（1〜5）。nullでクリア")
    @minValue(1)
    @maxValue(5)
    customerSatisfaction?: int32 | null;

    @doc("担当スタッフによる施術の自己評価・申し送り。nullでクリア")
    staffEvaluation?: string | null;

    @doc("施術で使用した商材の一覧。50件まで。指定した場合は全件を、指定した順に置き換える")
    @maxItems(50)
    materials?: TreatmentMaterial[];
  }

  @doc("""
    施術記録一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する。
    作成日時の新しい順（同時刻は ID の降順）に返す
    """)
  model TreatmentRecordSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("施術記録のサロン(予約のサロン)の ID による絞り込み(完全一致)。サロンのメンバーが省略した場合は自分のサロン")
    salonId?: SalonId;

    @query
    @doc("施術を受けた顧客の ID による絞り込み(完全一致)")
    customerId?: CustomerId;

    @query
    @doc("施術担当スタッフの ID による絞り込み(完全一致)")
    staffId?: StaffId;

    @query
    @doc("レコード作成日時(createdAt)がこの日時以降の施術記録に一致する")
    startDate?: utcDateTime;

    @query
    @doc("レコード作成日時(createdAt)がこの日時以前の施術記録に一致する")
    endDate?: utcDateTime;
  }

  @doc("""
    施術統計取得リクエスト - 集計対象のサロンと期間を指定する。期間は施術記録の作成日時(createdAt)で、一覧の絞り込みと同じく両端を含む
    """)
  model TreatmentStatisticsGetRequest {
    @query
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("レコード作成日時(createdAt)がこの日時以降の施術記録を数える。未指定の場合は期間の下限なし")
    startDate?: utcDateTime;

    @query
    @doc("レコード作成日時(createdAt)がこの日時以前の施術記録を数える。未指定の場合は期間の上限なし。startDate より前にはできない")
    endDate?: utcDateTime;
  }

  @doc("""
    サービスのカテゴリーの区分ごとの施術件数 - 施術記録の services のサービスを、カテゴリーの区分(service_categories.category のいまの値)ごとに合わせる。カテゴリーのないサービスは other。1つの施術記録が同じ区分のサービスを2つ含んでも1件と数える
    """)
  model TreatmentsByCategoryResponse {
    @doc("サービスカテゴリ区分")
    category: ServiceCategoryType;

    @doc("この区分のサービスを含む施術記録の件数")
    count: int32;
  }

  @doc("""
    サービスごとの施術件数 - 施術記録の services に含まれるサービスごとに合わせる。削除したサービスも載る
    """)
  model TreatmentsByServiceResponse {
    @doc("サービス ID")
    serviceId: ServiceId;

    @doc("このサービスを含む施術記録の件数")
    count: int32;
  }

  @doc("""
    施術統計レスポンス - 期間内の施術記録から算出した集計値を返す。対応するテーブルはない
    """)
  model TreatmentStatisticsResponse {
    @doc("期間内の施術記録の件数")
    totalTreatments: int32;

    @doc("サービスのカテゴリーの区分ごとの施術件数。件数の多い順、同じ件数は区分の名前の順。施術記録のない区分は載らない")
    treatmentsByCategory: TreatmentsByCategoryResponse[];

    @doc("施術時間(processingTime)のある施術記録の、施術時間の平均（分）。小数第1位に丸める。施術時間のある施術記録がなければnull")
    averageProcessingTime: float32 | null;

    @doc("施術件数の多いサービス。上位10件。件数の多い順、同じ件数はサービス ID の順")
    @maxItems(10)
    topServices: TreatmentsByServiceResponse[];
  }

  // ============================================================================
  // 顧客アレルギー (customer_allergies)
  // ============================================================================

  @doc("""
    顧客アレルギーレスポンス - customer_allergies テーブルの1行。顧客ごとのアレルギー情報を返す。
    プロパティ名と null 許可は DB カラムと一致させている。対象の顧客はパスの customerId で示す
    """)
  model CustomerAllergyResponse {
    @doc("アレルギー ID")
    id: CustomerAllergyId;

    @doc("アレルギーの種類")
    allergyType: AllergyType;

    @doc("アレルゲンの名称。1人の顧客に同じ名称は1件だけ")
    allergenName: string;

    @doc("重篤度")
    severityType: AllergySeverityType;

    @doc("症状の内容。記録していない場合はnull")
    symptoms: string | null;

    @doc("施術時の注意事項などのメモ。特記事項がない場合はnull")
    notes: string | null;

    @doc("アレルギーを確認した日。確認日が不明な場合はnull")
    confirmedDate: plainDate | null;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    顧客アレルギー追加リクエスト - 全項目のキーが必須。値がない項目は null を指定する。対象の顧客はパスの customerId で示す
    """)
  model CustomerAllergyCreateRequest {
    @doc("アレルギーの種類")
    allergyType: AllergyType;

    @doc("アレルゲンの名称（255文字まで。空白だけは指定できない）。顧客がすでに同じ名称のアレルギーを持つ場合は409。大文字と小文字は区別する")
    @maxLength(255)
    allergenName: string;

    @doc("重篤度")
    severityType: AllergySeverityType;

    @doc("症状の内容（空白だけは指定できない）。記録しない場合はnull")
    symptoms: string | null;

    @doc("施術時の注意事項などのメモ（空白だけは指定できない）。特記事項がない場合はnull")
    notes: string | null;

    @doc("アレルギーを確認した日。1900-01-01 から今日まで。確認日が不明な場合はnull")
    confirmedDate: plainDate | null;
  }

  @doc("""
    顧客アレルギー部分更新リクエスト - 指定した項目だけを更新する。項目を1つも指定しないリクエストは受け付けない。
    DB で NULL 許可のカラムは null でクリアできる。対象の顧客は変更できない
    """)
  model CustomerAllergyUpdateRequest {
    @doc("アレルギーの種類")
    allergyType?: AllergyType;

    @doc("アレルゲンの名称（255文字まで。空白だけは指定できない）。顧客のほかのアレルギーと同じ名称の場合は409")
    @maxLength(255)
    allergenName?: string;

    @doc("重篤度")
    severityType?: AllergySeverityType;

    @doc("症状の内容（空白だけは指定できない）。nullでクリア")
    symptoms?: string | null;

    @doc("施術時の注意事項などのメモ（空白だけは指定できない）。nullでクリア")
    notes?: string | null;

    @doc("アレルギーを確認した日。1900-01-01 から今日まで。nullでクリア")
    confirmedDate?: plainDate | null;
  }

  @doc("""
    顧客アレルギー一覧リクエスト - ページネーションを指定する。
    重篤度の重い順（life_threatening、severe、moderate、mild）、同じ重篤度は記録した順（作成日時、同時刻は ID の順）に返す
    """)
  model CustomerAllergySearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;
  }

  // ============================================================================
  // カルテ (medical_charts)
  // ============================================================================

  @doc("""
    過去の施術 1 件。カルテの previousTreatments の要素で、medical_charts.previousTreatments (jsonb) に、この形のまま保存する
    """)
  model PreviousTreatment {
    @doc("施術の種類")
    treatment: TreatmentType;

    @doc("施術日。1900-01-01 から今日まで")
    date: plainDate;

    @doc("施術を受けたサロンの名前（255文字まで）。自店での施術や、サロンが分からない場合はnull")
    @maxLength(255)
    salonName: string | null;

    @doc("施術についてのメモ。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("""
    カルテレスポンス - medical_charts テーブルの1行。顧客1人に1件で、施術の前に確認する情報を返す。
    プロパティ名と null 許可は DB カラムと一致させている。
    顧客のアレルギーは customer_allergies の行で、listAllergies で取得する。ふだんの頭皮と髪は顧客台帳に、施術のときの状態は施術記録にある。
    medicalConditions はスタッフ向けの情報で、顧客には返さない
    """)
  model MedicalChartResponse {
    @doc("カルテ ID")
    id: MedicalChartId;

    @doc("対象の顧客 ID。顧客1人にカルテは1件まで")
    customerId: CustomerId;

    @doc("過去の施術の一覧（ほかのサロンでの施術や、記録を始める前の施術）。保存した順。記録がない場合は空配列")
    previousTreatments: PreviousTreatment[];

    @doc("施術の前に注意が必要な持病・体調。特にない場合はnull")
    medicalConditions: string | null;

    @doc("好みの商材・ブランドの名前の一覧。保存した順。特にない場合は空配列")
    preferredProducts: string[];

    @doc("避ける商材・ブランドの名前の一覧。保存した順。特にない場合は空配列")
    avoidProducts: string[];

    @doc("自由記述のメモ。特記事項がない場合はnull")
    notes: string | null;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    カルテ新規作成リクエスト - 全項目のキーが必須。値がない項目は null か空配列を指定する
    """)
  model MedicalChartCreateRequest {
    @doc("対象の顧客 ID。削除されていない、カルテをまだ持たない顧客を指定する")
    customerId: CustomerId;

    @doc("過去の施術の一覧。50件まで。指定した順に保存する。記録がない場合は空配列")
    @maxItems(50)
    previousTreatments: PreviousTreatment[];

    @doc("施術の前に注意が必要な持病・体調。特にない場合はnull")
    medicalConditions: string | null;

    @doc("好みの商材・ブランドの名前の一覧（100文字まで）。50件まで。同じ名前の繰り返しは指定できない。特にない場合は空配列")
    @maxItems(50)
    preferredProducts: string[];

    @doc("避ける商材・ブランドの名前の一覧（100文字まで）。50件まで。同じ名前の繰り返しは指定できない。特にない場合は空配列")
    @maxItems(50)
    avoidProducts: string[];

    @doc("自由記述のメモ。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("""
    カルテ部分更新リクエスト - 指定した項目だけを更新する。項目を1つも指定しないリクエストは受け付けない。
    DB で NULL 許可のカラムは null でクリアできる。一覧の項目は、指定した一覧全体で置き換える。対象の顧客は変更できない
    """)
  model MedicalChartUpdateRequest {
    @doc("過去の施術の一覧。50件まで。指定した順に保存する。空配列でクリア")
    @maxItems(50)
    previousTreatments?: PreviousTreatment[];

    @doc("施術の前に注意が必要な持病・体調。nullでクリア")
    medicalConditions?: string | null;

    @doc("好みの商材・ブランドの名前の一覧（100文字まで）。50件まで。同じ名前の繰り返しは指定できない。空配列でクリア")
    @maxItems(50)
    preferredProducts?: string[];

    @doc("避ける商材・ブランドの名前の一覧（100文字まで）。50件まで。同じ名前の繰り返しは指定できない。空配列でクリア")
    @maxItems(50)
    avoidProducts?: string[];

    @doc("自由記述のメモ。nullでクリア")
    notes?: string | null;
  }

  @doc("""
    カルテ一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する。
    作成日時の新しい順（同時刻は ID の降順）に返す。削除された顧客のカルテは含めない
    """)
  model MedicalChartSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("持病・体調、メモ、好みの商材と避ける商材の名前に対する部分一致キーワード（大文字と小文字を区別しない）")
    @minLength(1)
    @maxLength(100)
    search?: string;

    @query
    @doc("アレルギーの有無による絞り込み。trueの場合は customer_allergies に行がある顧客の、falseの場合は行がない顧客のカルテに一致する")
    hasAllergies?: boolean;
  }
}
