import "@typespec/http";

using TypeSpec.Http;

namespace BeautySalon.Models {
  using TypeSpec.OpenAPI;
  @doc("システム利用者（顧客・スタッフ・管理者）を一意に識別するブランド付きUUID。")
  @format("uuid")
  scalar UserId extends string;

  @doc("ログインセッションを追跡するためのブランド付きUUID。")
  @format("uuid")
  scalar SessionId extends string;

  @doc("サロン店舗・拠点を識別するためのブランド付きUUID。")
  @format("uuid")
  scalar SalonId extends string;

  @doc("施術スタッフや従業員を識別するためのブランド付きUUID。")
  @format("uuid")
  scalar StaffId extends string;

  @doc("提供メニュー・施術サービスを識別するためのブランド付きUUID。")
  @format("uuid")
  scalar ServiceId extends string;

  @doc("顧客（来店者）を識別するためのブランド付きUUID。")
  @format("uuid")
  scalar CustomerId extends string;

  @doc("予約（bookings の1行）を識別するブランド付きUUID。")
  @format("uuid")
  scalar BookingId extends string;

  @doc("予約に含まれる施術明細（booking_services の1行）を識別するブランド付きUUID。")
  @format("uuid")
  scalar BookingServiceId extends string;

  @doc("顧客レビューや口コミを識別するブランド付きUUID。")
  @format("uuid")
  scalar ReviewId extends string;

  @doc("サービスカテゴリやメニュー分類を識別するブランド付きUUID。")
  @format("uuid")
  scalar CategoryId extends string;

  @doc("在庫アイテムや消耗品を識別するブランド付きUUID。")
  @format("uuid")
  scalar InventoryId extends string;

  @doc("サロンで扱う商品（商品マスタ。店販品・施術用商材）を識別するブランド付きUUID。")
  @format("uuid")
  scalar ProductId extends string;

  @doc("在庫の入出庫(在庫移動)の記録を識別するブランド付きUUID。")
  @format("uuid")
  scalar InventoryTransactionId extends string;

  @doc("サプライヤー発注・仕入れオーダーを識別するブランド付きUUID。")
  @format("uuid")
  scalar OrderId extends string;

  @doc("決済取引（売上に対する1回の支払い）を識別するブランド付きUUID。")
  @format("uuid")
  scalar PaymentId extends string;

  @doc("売上（1回の来店の会計）を識別するブランド付きUUID。")
  @format("uuid")
  scalar SaleId extends string;

  @doc("サロンが受け付ける支払い方法の設定を識別するブランド付きUUID。")
  @format("uuid")
  scalar PaymentMethodId extends string;

  @doc("施術記録やカウンセリングメモを識別するブランド付きUUID。")
  @format("uuid")
  scalar TreatmentRecordId extends string;

  @doc("カルテ（メディカルチャート）を識別するブランド付きUUID。")
  @format("uuid")
  scalar MedicalChartId extends string;

  @doc("添付ファイル・画像データを識別するブランド付きUUID。")
  @format("uuid")
  scalar AttachmentId extends string;

  @doc("ロールベース権限管理で利用する役割IDを識別するブランド付きUUID。")
  @format("uuid")
  scalar RoleId extends string;

  @doc("アクセス許可や操作権限を識別するブランド付きUUID。")
  @format("uuid")
  scalar PermissionId extends string;

  @doc("顧客ポイントの加算・減算履歴を識別するブランド付きUUID。")
  @format("uuid")
  scalar PointTransactionId extends string;

  @doc("税率や金額計算で用いる汎用小数型。")
  scalar decimal extends float64;

  @doc("""
    曜日区分 - 営業日やスケジュール管理で使用される曜日の定義
    
    monday: 月曜日
    tuesday: 火曜日
    wednesday: 水曜日
    thursday: 木曜日
    friday: 金曜日
    saturday: 土曜日
    sunday: 日曜日
    """)
  enum DayOfWeekType {
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,
  }

  @doc("""
    スタッフレベル区分 - スタッフの技術レベルや経験を表す階層
    
    junior: ジュニア - 新人・見習いレベル、基本的な施術が可能
    stylist: スタイリスト - 標準レベル、一般的な施術が可能
    senior: シニア - 上級レベル、高度な技術と経験を保有
    expert: エキスパート - 専門家レベル、特殊技術や指導が可能
    director: ディレクター - 管理職レベル、サロンの技術的な指導を担当
    """)
  enum StaffLevelType {
    junior,
    stylist,
    senior,
    expert,
    director,
  }

  @doc("""
    サービスカテゴリー区分 - サロンで提供される主要なサービスカテゴリーの定義
    
    cut: カット - ヘアカット、トリミング等の切断系サービス
    color: カラー - ヘアカラー、ハイライト等の染色系サービス
    perm: パーマ - パーマネント、デジタルパーマ等のウェーブ形成サービス
    treatment: トリートメント - ヘアトリートメント、ヘアケア等の補修・改善サービス
    spa: スパ - ヘッドスパ、リラクゼーション等の癒し系サービス
    styling: スタイリング - セット、アレンジ等のスタイリングサービス
    extension: エクステンション - ヘアエクステ、増毛等の毛髪追加サービス
    other: その他 - 上記カテゴリーに分類されないサービス
    """)
  enum ServiceCategoryType {
    cut,
    color,
    perm,
    treatment,
    spa,
    styling,
    extension,
    other,
  }

  @doc("""
    通貨コード区分 - ISO 4217準拠の通貨コード定義
    
    JPY: 日本円 - Japanese Yen
    USD: 米ドル - United States Dollar
    EUR: ユーロ - Euro
    GBP: 英ポンド - British Pound Sterling
    AUD: 豪ドル - Australian Dollar
    CAD: カナダドル - Canadian Dollar
    CNY: 中国人民元 - Chinese Yuan
    KRW: 韓国ウォン - South Korean Won
    SGD: シンガポールドル - Singapore Dollar
    TWD: 台湾ドル - Taiwan Dollar
    """)
  enum CurrencyCodeType {
    JPY,
    USD,
    EUR,
    GBP,
    AUD,
    CAD,
    CNY,
    KRW,
    SGD,
    TWD,
  }

  @doc("""
    発注ステータス区分 - 商品発注の進行状態を表す区分
    
    draft: 下書き - 発注内容を作成中の状態
    pending: 承認待ち - 発注内容が確定し、承認を待っている状態
    approved: 承認済み - 責任者により発注が承認された状態
    ordered: 発注済み - サプライヤーへ正式に発注が行われた状態
    shipped: 発送済み - サプライヤーから商品が発送された状態
    delivered: 配送完了 - 商品が到着し、受領が完了した状態
    cancelled: キャンセル - 発注が取り消された状態
    """)
  enum OrderStatusType {
    draft,
    pending,
    approved,
    ordered,
    shipped,
    delivered,
    cancelled,
  }

  @doc("""
    性別区分 - 顧客の性別を表す区分（多様性に配慮した選択肢を含む）
    
    male: 男性
    female: 女性
    other: その他 - 男性・女性以外の性自認を持つ方
    prefer_not_to_say: 回答しない - 性別の回答を希望しない方
    """)
  enum CustomerGenderType {
    male,
    female,
    other,
    prefer_not_to_say,
  }

  @doc("""
    施術タイプ区分 - サロンで提供される具体的な施術の種類
    
    cut: カット - ヘアカット、レイヤーカット等の切断技術
    color: カラー - ヘアカラー、白髪染め、ハイライト等の染色技術
    perm: パーマ - コールドパーマ、デジタルパーマ等のウェーブ技術
    treatment: トリートメント - ダメージケア、栄養補給等の毛髪改善技術
    head_spa: ヘッドスパ - 頭皮マッサージ、スカルプケア等の頭皮ケア技術
    styling: スタイリング - セット、アレンジ等のスタイリング技術
    extension: エクステンション - ヘアエクステ、増毛等の毛髪追加技術
    nail: ネイル - マニキュア、ジェルネイル等の爪装飾技術
    eyelash: まつげ - まつげエクステ、まつげパーマ等のまつげ装飾技術
    other: その他 - 上記に分類されない施術
    """)
  enum TreatmentType {
    cut,
    color,
    perm,
    treatment,
    head_spa,
    styling,
    extension,
    nail,
    eyelash,
    other,
  }

  @doc("特定の日付の営業時間（営業日カレンダーの1日分）を表すモデル。")
  model OpeningHours {
    @doc("dateの曜日。dateと一致している必要がある")
    dayOfWeek: DayOfWeekType;

    @doc("日付")
    date: plainDate;

    @doc("開店時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。終日休業の場合はnull")
    @pattern("^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$")
    openTime: string | null;

    @doc("閉店時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。終日休業の場合はnull")
    @pattern("^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$")
    closeTime: string | null;

    @doc("休業日かどうかを示すフラグ。")
    isHoliday: boolean;

    @doc("祝日名称や社内呼称などの休業理由。通常営業日または理由不要の場合はnull")
    holidayName: string | null;

    @doc("備考や注意事項。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("作成・更新ユーザーとタイムスタンプを保持する共通監査情報。")
  model AuditInfo {
    @doc("レコード作成日時。")
    createdAt: utcDateTime;

    @doc("レコードを作成したユーザーID。システム自動作成または匿名作成の場合はnull")
    createdBy: string | null;

    @doc("レコード最終更新日時。")
    updatedAt: utcDateTime;

    @doc("レコードを最後に更新したユーザーID。システム自動更新または匿名更新の場合はnull")
    updatedBy: string | null;
  }

  @doc("期間指定や有効期間に利用する共通レンジ型。")
  model DateRange {
    @doc("期間の開始日時。")
    startDate: utcDateTime;

    @doc("期間の終了日時。")
    endDate: utcDateTime;
  }

  @doc("税抜・税込計算に利用する金額モデル。")
  model Money {
    @doc("通貨の最小単位で表現した金額値。")
    value: int64;

    @doc("使用する通貨コード。")
    currency: CurrencyCodeType;

    @doc("適用税率。税率が適用されない場合はnull")
    taxRate: decimal | null;
  }

  @doc("期間条件で絞り込むための共通クエリモデル。")
  model DateRangeFilter {
    @query
    @doc("検索対象期間の開始日時。")
    startDate?: utcDateTime;

    @query
    @doc("検索対象期間の終了日時。")
    endDate?: utcDateTime;
  }

  @doc("営業時間や休憩時間を表現する単一の時間帯スロット。")
  model TimeSlot {
    @doc("開始時刻（HH:mm形式、24時間表記）。")
    startTime: string;

    @doc("終了時刻（HH:mm形式、24時間表記）。")
    endTime: string;
  }

  @doc("曜日単位で管理する営業スケジュール設定。")
  model BusinessHours {
    @doc("設定の対象となる曜日。")
    dayOfWeek: DayOfWeekType;

    @doc("営業時間帯の一覧。複数設定で分割営業に対応。")
    operatingSlots: TimeSlot[];

    @doc("休憩時間や中断時間帯の一覧。休憩がない場合はnull")
    breakSlots: TimeSlot[] | null;

    @doc("当該曜日を休業扱いとする場合のフラグ。既定値はfalse。")
    isClosed: boolean = false;

    @doc("季節営業などの適用期間。通年有効の場合はnull")
    effectivePeriod: DateRange | null;

    @doc("営業基準となるタイムゾーンID。サロン既定値を使用する場合はnull")
    timezone: string | null;
  }

  @doc("サービスメニューを一覧表示や候補選択で参照する際の要約情報。")
  model ServiceSummary {
    @doc("サービスメニューを識別するID。")
    id: ServiceId;

    @doc("顧客向けに表示するサービス名称。")
    name: string;

    @doc("対象サービスの予約件数。統計未計算の場合はnull")
    bookingCount: int32 | null;
  }

  @doc("スタッフ一覧や選択候補で利用する要約情報。")
  model StaffSummary {
    @doc("スタッフを識別するID。")
    id: StaffId;

    @doc("スタッフの表示名。")
    name: string;

    @doc("平均評価スコア。未評価または評価データがない場合はnull")
    rating: float32 | null;

    @doc("担当した予約件数。統計未計算の場合はnull")
    bookingCount: int32 | null;
  }
}
