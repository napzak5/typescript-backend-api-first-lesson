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

    @doc("サービスのカテゴリーの区分ごとの施術件数。件数の多い順、同じ件数は区分の値の順。施術記録のない区分は載らない")
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
    @doc("アレルギーの種類")
    allergyType: AllergyType;

    @doc("アレルゲンの名称")
    allergenName: string;

    @doc("重篤度を表す数値")
    severity: int32;

    @doc("症状の内容。記録していない場合はnull")
    symptoms: string | null;

    @doc("施術時の注意事項などのメモ。特記事項がない場合はnull")
    notes: string | null;

    @doc("アレルギーを確認した日。確認日が不明な場合はnull")
    confirmedDate: plainDate | null;

    @doc("重篤度の区分。区分を設定していない場合はnull")
    severityType: AllergySeverityType | null;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    顧客アレルギー一覧リクエスト - ページネーションを指定する
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
  // カルテ (対応するテーブルはまだない)
  // ============================================================================

  @doc("過去施術の履歴。カルテに含める")
  model PreviousTreatment {
    @doc("施術タイプ")
    treatment: TreatmentType;

    @doc("施術日")
    date: utcDateTime;

    @doc("施術を受けたサロン名 - 自店での施術や不明な場合はnull")
    salonName: string | null;

    @doc("施術に関するメモ - 特記事項がない通常の過去施術の場合はnull")
    notes: string | null;
  }

  @doc("""
    カルテレスポンス - 顧客ごとのカルテ情報を返す。対応するテーブルはまだない
    """)
  model MedicalChartResponse {
    @doc("カルテ ID")
    id: MedicalChartId;

    @doc("対象顧客 ID")
    customerId: CustomerId;

    @doc("アレルギー・敏感情報 - アレルギーがない顧客の場合はnull")
    allergies: string[] | null;

    @doc("頭皮状態のメモ - 頭皮に問題がない健康な状態の場合はnull")
    scalpCondition: string | null;

    @doc("毛髪状態のメモ - 毛髪に特筆すべき問題がない場合はnull")
    hairCondition: string | null;

    @doc("過去に実施したケミカル施術履歴 - 初回来店やケミカル施術経験がない顧客の場合はnull")
    previousTreatments: PreviousTreatment[] | null;

    @doc("注意が必要な持病・体調情報 - 健康上の問題がない顧客の場合はnull")
    medicalConditions: string | null;

    @doc("好みの商材・ブランド - 特定の好みがない顧客の場合はnull")
    preferredProducts: string[] | null;

    @doc("避けるべき商材 - 特に避けるべき商材がない顧客の場合はnull")
    avoidProducts: string[] | null;

    @doc("自由記述メモ - 追加情報がない標準的なカルテの場合はnull")
    notes: string | null;

    @doc("最終更新日時")
    lastUpdated: utcDateTime;

    ...AuditInfo;
  }

  @doc("""
    カルテ新規作成リクエスト - 全項目のキーが必須。値がない項目は null を指定する。対応するテーブルはまだない
    """)
  model MedicalChartCreateRequest {
    @doc("対象顧客 ID。カルテをまだ持たない顧客を指定する")
    customerId: CustomerId;

    @doc("アレルギー情報 - アレルギーがない顧客の場合はnull")
    allergies: string[] | null;

    @doc("頭皮状態 - 頭皮に問題がない健康な状態の場合はnull")
    scalpCondition: string | null;

    @doc("毛髪状態 - 毛髪に特筆すべき問題がない場合はnull")
    hairCondition: string | null;

    @doc("過去施術の履歴 - 初回来店やケミカル施術経験がない顧客の場合はnull")
    previousTreatments: PreviousTreatment[] | null;

    @doc("注意すべき体調・持病 - 健康上の問題がない顧客の場合はnull")
    medicalConditions: string | null;

    @doc("好みの商材 - 特定の好みがない顧客の場合はnull")
    preferredProducts: string[] | null;

    @doc("避けるべき商材 - 特に避けるべき商材がない顧客の場合はnull")
    avoidProducts: string[] | null;

    @doc("その他メモ - 追加情報がない標準的なカルテの場合はnull")
    notes: string | null;
  }

  @doc("""
    カルテ部分更新リクエスト - 指定した項目だけを更新する。null を指定した項目はクリアする。対応するテーブルはまだない。
    対象の顧客は変更できない
    """)
  model MedicalChartUpdateRequest {
    @doc("アレルギー情報 - アレルギーがない顧客の場合はnull、null指定で値をリセット可能")
    allergies?: string[] | null;

    @doc("頭皮状態 - 頭皮に問題がない健康な状態の場合はnull、null指定で値をリセット可能")
    scalpCondition?: string | null;

    @doc("毛髪状態 - 毛髪に特筆すべき問題がない場合はnull、null指定で値をリセット可能")
    hairCondition?: string | null;

    @doc("過去施術の履歴 - 初回来店やケミカル施術経験がない顧客の場合はnull、null指定で値をリセット可能")
    previousTreatments?: PreviousTreatment[] | null;

    @doc("注意すべき体調・持病 - 健康上の問題がない顧客の場合はnull、null指定で値をリセット可能")
    medicalConditions?: string | null;

    @doc("好みの商材 - 特定の好みがない顧客の場合はnull、null指定で値をリセット可能")
    preferredProducts?: string[] | null;

    @doc("避けるべき商材 - 特に避けるべき商材がない顧客の場合はnull、null指定で値をリセット可能")
    avoidProducts?: string[] | null;

    @doc("その他メモ - 追加情報がない標準的なカルテの場合はnull、null指定で値をリセット可能")
    notes?: string | null;
  }

  @doc("""
    カルテ一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する。対応するテーブルはまだない
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
    @doc("カルテの記載内容に対する部分一致キーワード")
    @minLength(1)
    @maxLength(100)
    search?: string;

    @query
    @doc("アレルギー情報の有無による絞り込み。trueの場合はアレルギー情報を持つカルテに一致する")
    hasAllergies?: boolean;
  }
}
