import { z } from 'zod'

/**
 * @description
 * アレルギー重篤度区分 - アレルギー反応の重篤度を表し、対応レベルを決定
 *
 *
 * mild: 軽度 - 軽いかゆみや赤み程度、通常の施術で注意すれば対応可能
 *
 * moderate: 中等度 - 明確な皮膚反応、特別な配慮や代替品の使用が必要
 *
 * severe: 重度 - 激しい反応、特定の施術を避けるべきレベル
 *
 * life_threatening: 生命に関わる - アナフィラキシー等の危険があり、該当する商材・施術を一切使用できないレベル
 */
export const AllergySeverityTypeSchema = z.enum(['mild', 'moderate', 'severe', 'life_threatening'])
/**
 * @description
 * アレルギー重篤度区分 - アレルギー反応の重篤度を表し、対応レベルを決定
 *
 *
 * mild: 軽度 - 軽いかゆみや赤み程度、通常の施術で注意すれば対応可能
 *
 * moderate: 中等度 - 明確な皮膚反応、特別な配慮や代替品の使用が必要
 *
 * severe: 重度 - 激しい反応、特定の施術を避けるべきレベル
 *
 * life_threatening: 生命に関わる - アナフィラキシー等の危険があり、該当する商材・施術を一切使用できないレベル
 */
export type AllergySeverityType = z.infer<typeof AllergySeverityTypeSchema>

/**
 * @description
 * アレルギータイプ区分 - 顧客が持つアレルギーの種類を分類、施術時の注意事項として使用
 *
 *
 * chemical: 化学物質 - カラー剤、パーマ剤等の化学薬品に対するアレルギー
 *
 * fragrance: 香料 - 香水、シャンプー等の香料成分に対するアレルギー
 *
 * metal: 金属 - ヘアピン、ハサミ等の金属製品に対するアレルギー
 *
 * latex: ラテックス - 手袋等のゴム製品に対するアレルギー
 *
 * plant: 植物 - ヘナ、ハーブ等の植物由来成分に対するアレルギー
 *
 * other: その他 - 上記に分類されないアレルギー
 */
export const AllergyTypeSchema = z.enum(['chemical', 'fragrance', 'metal', 'latex', 'plant', 'other'])
/**
 * @description
 * アレルギータイプ区分 - 顧客が持つアレルギーの種類を分類、施術時の注意事項として使用
 *
 *
 * chemical: 化学物質 - カラー剤、パーマ剤等の化学薬品に対するアレルギー
 *
 * fragrance: 香料 - 香水、シャンプー等の香料成分に対するアレルギー
 *
 * metal: 金属 - ヘアピン、ハサミ等の金属製品に対するアレルギー
 *
 * latex: ラテックス - 手袋等のゴム製品に対するアレルギー
 *
 * plant: 植物 - ヘナ、ハーブ等の植物由来成分に対するアレルギー
 *
 * other: その他 - 上記に分類されないアレルギー
 */
export type AllergyType = z.infer<typeof AllergyTypeSchema>

/**
 * @description
 * 予約要件タイプ区分 - サービス予約時に必要な条件や制約
 *
 *
 * consultation_required: 事前カウンセリング必須 - 施術前の相談・カウンセリングが必要
 *
 * patch_test_required: パッチテスト必須 - アレルギー確認のための事前テストが必要
 *
 * advance_booking_required: 事前予約必須 - 当日予約を受け付けず、事前の予約が必要
 *
 * deposit_required: デポジット必須 - 予約時に予約金の支払いが必要
 * 空き枠は、advance_booking_required のあるサービスに、当日(サロンのタイムゾーンでの今日)の枠を返さない。
 * ほかの値は、サーバーでは確かめられない条件で、空き枠には影響しない
 */
export const BookingRequirementTypeSchema = z.enum([
  'consultation_required',
  'patch_test_required',
  'advance_booking_required',
  'deposit_required'
])
/**
 * @description
 * 予約要件タイプ区分 - サービス予約時に必要な条件や制約
 *
 *
 * consultation_required: 事前カウンセリング必須 - 施術前の相談・カウンセリングが必要
 *
 * patch_test_required: パッチテスト必須 - アレルギー確認のための事前テストが必要
 *
 * advance_booking_required: 事前予約必須 - 当日予約を受け付けず、事前の予約が必要
 *
 * deposit_required: デポジット必須 - 予約時に予約金の支払いが必要
 * 空き枠は、advance_booking_required のあるサービスに、当日(サロンのタイムゾーンでの今日)の枠を返さない。
 * ほかの値は、サーバーでは確かめられない条件で、空き枠には影響しない
 */
export type BookingRequirementType = z.infer<typeof BookingRequirementTypeSchema>

/**
 * @description
 * 予約ステータス区分 - 予約の詳細な進行状態を表す区分
 *
 *
 * draft: 下書き - 予約内容を作成中、まだ確定していない状態
 *
 * pending: 保留中 - 予約リクエストを受付、確認待ちの状態
 *
 * confirmed: 確定 - 予約が確定し、スタッフが割り当てられた状態
 *
 * in_progress: 施術中 - 現在サービスを実施中の状態(start アクションで記録する)
 *
 * completed: 完了 - サービス提供が終了した状態
 *
 * cancelled: キャンセル - 予約がキャンセルされた状態
 *
 * no_show: 無断キャンセル - 顧客が連絡なしに来店しなかった状態(no-show アクションで、開始日時を過ぎてから記録する)
 */
export const BookingStatusTypeSchema = z.enum([
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
])
/**
 * @description
 * 予約ステータス区分 - 予約の詳細な進行状態を表す区分
 *
 *
 * draft: 下書き - 予約内容を作成中、まだ確定していない状態
 *
 * pending: 保留中 - 予約リクエストを受付、確認待ちの状態
 *
 * confirmed: 確定 - 予約が確定し、スタッフが割り当てられた状態
 *
 * in_progress: 施術中 - 現在サービスを実施中の状態(start アクションで記録する)
 *
 * completed: 完了 - サービス提供が終了した状態
 *
 * cancelled: キャンセル - 予約がキャンセルされた状態
 *
 * no_show: 無断キャンセル - 顧客が連絡なしに来店しなかった状態(no-show アクションで、開始日時を過ぎてから記録する)
 */
export type BookingStatusType = z.infer<typeof BookingStatusTypeSchema>

/**
 * @description
 * 通貨コード区分 - ISO 4217準拠の通貨コード定義
 *
 *
 * JPY: 日本円 - Japanese Yen
 *
 * USD: 米ドル - United States Dollar
 *
 * EUR: ユーロ - Euro
 *
 * GBP: 英ポンド - British Pound Sterling
 *
 * AUD: 豪ドル - Australian Dollar
 *
 * CAD: カナダドル - Canadian Dollar
 *
 * CNY: 中国人民元 - Chinese Yuan
 *
 * KRW: 韓国ウォン - South Korean Won
 *
 * SGD: シンガポールドル - Singapore Dollar
 *
 * TWD: 台湾ドル - Taiwan Dollar
 */
export const CurrencyCodeTypeSchema = z.enum(['JPY', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CNY', 'KRW', 'SGD', 'TWD'])
/**
 * @description
 * 通貨コード区分 - ISO 4217準拠の通貨コード定義
 *
 *
 * JPY: 日本円 - Japanese Yen
 *
 * USD: 米ドル - United States Dollar
 *
 * EUR: ユーロ - Euro
 *
 * GBP: 英ポンド - British Pound Sterling
 *
 * AUD: 豪ドル - Australian Dollar
 *
 * CAD: カナダドル - Canadian Dollar
 *
 * CNY: 中国人民元 - Chinese Yuan
 *
 * KRW: 韓国ウォン - South Korean Won
 *
 * SGD: シンガポールドル - Singapore Dollar
 *
 * TWD: 台湾ドル - Taiwan Dollar
 */
export type CurrencyCodeType = z.infer<typeof CurrencyCodeTypeSchema>

/**
 * @description
 * 顧客監査操作区分 - 監査履歴に記録される顧客レコードへの操作の種類
 *
 *
 * create: 作成 - 顧客を新規登録した
 *
 * update: 更新 - 顧客情報を更新した
 *
 * delete: 削除 - 顧客を論理削除した
 *
 * restore: 復元 - 論理削除された顧客を復元した
 */
export const CustomerAuditOperationTypeSchema = z.enum(['create', 'update', 'delete', 'restore'])
/**
 * @description
 * 顧客監査操作区分 - 監査履歴に記録される顧客レコードへの操作の種類
 *
 *
 * create: 作成 - 顧客を新規登録した
 *
 * update: 更新 - 顧客情報を更新した
 *
 * delete: 削除 - 顧客を論理削除した
 *
 * restore: 復元 - 論理削除された顧客を復元した
 */
export type CustomerAuditOperationType = z.infer<typeof CustomerAuditOperationTypeSchema>

/**
 * @description
 * 顧客データエクスポート形式区分 - 顧客本人のデータを出力するファイル形式
 *
 *
 * json: JSON - JSON形式
 *
 * csv: CSV - カンマ区切りテキスト
 *
 * pdf: PDF - PDF文書
 */
export const CustomerDataExportFormatTypeSchema = z.enum(['json', 'csv', 'pdf'])
/**
 * @description
 * 顧客データエクスポート形式区分 - 顧客本人のデータを出力するファイル形式
 *
 *
 * json: JSON - JSON形式
 *
 * csv: CSV - カンマ区切りテキスト
 *
 * pdf: PDF - PDF文書
 */
export type CustomerDataExportFormatType = z.infer<typeof CustomerDataExportFormatTypeSchema>

/**
 * @description
 * 顧客一覧エクスポート形式区分 - 検索結果のエクスポートで出力するファイル形式
 *
 *
 * csv: CSV - カンマ区切りテキスト
 *
 * json: JSON - JSON形式
 *
 * excel: Excel - Excelブック形式
 */
export const CustomerExportFormatTypeSchema = z.enum(['csv', 'json', 'excel'])
/**
 * @description
 * 顧客一覧エクスポート形式区分 - 検索結果のエクスポートで出力するファイル形式
 *
 *
 * csv: CSV - カンマ区切りテキスト
 *
 * json: JSON - JSON形式
 *
 * excel: Excel - Excelブック形式
 */
export type CustomerExportFormatType = z.infer<typeof CustomerExportFormatTypeSchema>

/**
 * @description
 * 性別区分 - 顧客の性別を表す区分（多様性に配慮した選択肢を含む）
 *
 *
 * male: 男性
 *
 * female: 女性
 *
 * other: その他 - 男性・女性以外の性自認を持つ方
 *
 * prefer_not_to_say: 回答しない - 性別の回答を希望しない方
 */
export const CustomerGenderTypeSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
/**
 * @description
 * 性別区分 - 顧客の性別を表す区分（多様性に配慮した選択肢を含む）
 *
 *
 * male: 男性
 *
 * female: 女性
 *
 * other: その他 - 男性・女性以外の性自認を持つ方
 *
 * prefer_not_to_say: 回答しない - 性別の回答を希望しない方
 */
export type CustomerGenderType = z.infer<typeof CustomerGenderTypeSchema>

/**
 * @description
 * 顧客統合時の競合解決方針区分 - 2件の顧客レコードで値が異なる項目をどちらに合わせるか
 *
 *
 * keep_primary: メイン優先 - 統合後も残す顧客(primaryCustomerId)の値を使う
 *
 * keep_secondary: サブ優先 - 統合して削除する顧客(secondaryCustomerId)の値を使う
 *
 * keep_newest: 新しい方優先 - 最後に更新された顧客の値を使う
 */
export const CustomerMergeConflictResolutionTypeSchema = z.enum(['keep_primary', 'keep_secondary', 'keep_newest'])
/**
 * @description
 * 顧客統合時の競合解決方針区分 - 2件の顧客レコードで値が異なる項目をどちらに合わせるか
 *
 *
 * keep_primary: メイン優先 - 統合後も残す顧客(primaryCustomerId)の値を使う
 *
 * keep_secondary: サブ優先 - 統合して削除する顧客(secondaryCustomerId)の値を使う
 *
 * keep_newest: 新しい方優先 - 最後に更新された顧客の値を使う
 */
export type CustomerMergeConflictResolutionType = z.infer<typeof CustomerMergeConflictResolutionTypeSchema>

/**
 * @description
 * 顧客ステータス区分 - 顧客アカウントの活動状態や利用可否を表す区分
 *
 *
 * active: アクティブ - 通常利用可能な状態
 *
 * inactive: 休眠中 - 長期間利用がないがアカウントは維持されている状態
 *
 * vip: VIP - 特別な対応が必要な重要顧客として扱う状態
 *
 * blacklisted: ブラックリスト - 利用を禁止された状態
 */
export const CustomerStatusTypeSchema = z.enum(['active', 'inactive', 'vip', 'blacklisted'])
/**
 * @description
 * 顧客ステータス区分 - 顧客アカウントの活動状態や利用可否を表す区分
 *
 *
 * active: アクティブ - 通常利用可能な状態
 *
 * inactive: 休眠中 - 長期間利用がないがアカウントは維持されている状態
 *
 * vip: VIP - 特別な対応が必要な重要顧客として扱う状態
 *
 * blacklisted: ブラックリスト - 利用を禁止された状態
 */
export type CustomerStatusType = z.infer<typeof CustomerStatusTypeSchema>

/**
 * @description
 * 曜日区分 - 営業日やスケジュール管理で使用される曜日の定義
 *
 *
 * monday: 月曜日
 *
 * tuesday: 火曜日
 *
 * wednesday: 水曜日
 *
 * thursday: 木曜日
 *
 * friday: 金曜日
 *
 * saturday: 土曜日
 *
 * sunday: 日曜日
 */
export const DayOfWeekTypeSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
/**
 * @description
 * 曜日区分 - 営業日やスケジュール管理で使用される曜日の定義
 *
 *
 * monday: 月曜日
 *
 * tuesday: 火曜日
 *
 * wednesday: 水曜日
 *
 * thursday: 木曜日
 *
 * friday: 金曜日
 *
 * saturday: 土曜日
 *
 * sunday: 日曜日
 */
export type DayOfWeekType = z.infer<typeof DayOfWeekTypeSchema>

/**
 * @description
 * エラーコードタイプ区分 - 一貫したエラー処理のための標準化されたエラーコード
 * // 認証・認可 (1xxx)
 *
 *
 * 1001: 認証必須 - アクセスには認証が必要
 *
 * 1002: 無効な資格情報 - ユーザー名またはパスワードが不正
 *
 * 1003: トークン期限切れ - 認証トークンが期限切れ
 *
 * 1004: トークン無効 - 認証トークンが無効または破損
 *
 * 1005: 権限不足 - 操作を実行する権限が不足
 *
 * 1006: アカウントロック - アカウントがロックされている
 *
 * 1007: 2要素認証必須 - 2要素認証の入力が必要
 * // バリデーション (2xxx)
 *
 * 2001: 検証失敗 - 入力データの検証に失敗
 *
 * 2002: 不正な形式 - データ形式が不正
 *
 * 2003: 必須フィールド欠落 - 必須フィールドが入力されていない
 *
 * 2004: 範囲外の値 - 値が許可された範囲を超えている
 *
 * 2005: 重複値 - 一意であるべき値が重複している
 * // ビジネスロジック (3xxx)
 *
 * 3001: リソース未検出 - 指定されたリソースが存在しない
 *
 * 3002: リソース既存 - リソースが既に存在する
 *
 * 3003: 操作不可 - 現在の状態では操作が許可されない
 *
 * 3004: ビジネスルール違反 - ビジネスルールに違反している
 *
 * 3005: 残高不足 - ポイントや残高が不足
 *
 * 3006: 予約競合 - 予約時間が重複している
 *
 * 3007: 容量超過 - 利用可能な容量を超えている
 * // システム (4xxx)
 *
 * 4001: 内部サーバーエラー - サーバー内部でエラーが発生
 *
 * 4002: サービス利用不可 - サービスが一時的に利用できない
 *
 * 4003: データベースエラー - データベース処理中にエラーが発生
 *
 * 4004: 外部サービスエラー - 外部サービスでエラーが発生
 *
 * 4005: レート制限超過 - APIレート制限を超えた
 */
export const ErrorCodeTypeSchema = z.enum([
  '1001',
  '1002',
  '1003',
  '1004',
  '1005',
  '1006',
  '1007',
  '2001',
  '2002',
  '2003',
  '2004',
  '2005',
  '3001',
  '3002',
  '3003',
  '3004',
  '3005',
  '3006',
  '3007',
  '4001',
  '4002',
  '4003',
  '4004',
  '4005'
])
/**
 * @description
 * エラーコードタイプ区分 - 一貫したエラー処理のための標準化されたエラーコード
 * // 認証・認可 (1xxx)
 *
 *
 * 1001: 認証必須 - アクセスには認証が必要
 *
 * 1002: 無効な資格情報 - ユーザー名またはパスワードが不正
 *
 * 1003: トークン期限切れ - 認証トークンが期限切れ
 *
 * 1004: トークン無効 - 認証トークンが無効または破損
 *
 * 1005: 権限不足 - 操作を実行する権限が不足
 *
 * 1006: アカウントロック - アカウントがロックされている
 *
 * 1007: 2要素認証必須 - 2要素認証の入力が必要
 * // バリデーション (2xxx)
 *
 * 2001: 検証失敗 - 入力データの検証に失敗
 *
 * 2002: 不正な形式 - データ形式が不正
 *
 * 2003: 必須フィールド欠落 - 必須フィールドが入力されていない
 *
 * 2004: 範囲外の値 - 値が許可された範囲を超えている
 *
 * 2005: 重複値 - 一意であるべき値が重複している
 * // ビジネスロジック (3xxx)
 *
 * 3001: リソース未検出 - 指定されたリソースが存在しない
 *
 * 3002: リソース既存 - リソースが既に存在する
 *
 * 3003: 操作不可 - 現在の状態では操作が許可されない
 *
 * 3004: ビジネスルール違反 - ビジネスルールに違反している
 *
 * 3005: 残高不足 - ポイントや残高が不足
 *
 * 3006: 予約競合 - 予約時間が重複している
 *
 * 3007: 容量超過 - 利用可能な容量を超えている
 * // システム (4xxx)
 *
 * 4001: 内部サーバーエラー - サーバー内部でエラーが発生
 *
 * 4002: サービス利用不可 - サービスが一時的に利用できない
 *
 * 4003: データベースエラー - データベース処理中にエラーが発生
 *
 * 4004: 外部サービスエラー - 外部サービスでエラーが発生
 *
 * 4005: レート制限超過 - APIレート制限を超えた
 */
export type ErrorCodeType = z.infer<typeof ErrorCodeTypeSchema>

/**
 * @description
 * 髪の太さ区分 - 髪の毛一本の太さを分類、カットやスタイリングの参考に使用
 *
 *
 * thin: 細毛 - 柔らかく細い髪、ボリュームが出にくい
 *
 * medium: 普通毛 - 平均的な太さの髪、扱いやすい
 *
 * thick: 太毛 - しっかりとした太い髪、ボリュームが出やすい
 */
export const HairThicknessTypeSchema = z.enum(['thin', 'medium', 'thick'])
/**
 * @description
 * 髪の太さ区分 - 髪の毛一本の太さを分類、カットやスタイリングの参考に使用
 *
 *
 * thin: 細毛 - 柔らかく細い髪、ボリュームが出にくい
 *
 * medium: 普通毛 - 平均的な太さの髪、扱いやすい
 *
 * thick: 太毛 - しっかりとした太い髪、ボリュームが出やすい
 */
export type HairThicknessType = z.infer<typeof HairThicknessTypeSchema>

/**
 * @description
 * 髪質タイプ区分 - 顧客の髪のクセや形状を分類、適切な施術提案に使用
 *
 *
 * straight: ストレート - 直毛、クセがほとんどない髪質
 *
 * wavy: ウェービー - 緩やかな波状、S字カーブの髪質
 *
 * curly: カーリー - 明確なカール、螺旋状の髪質
 *
 * coily: コイリー - 非常に細かいカール、ジグザグ状の髪質
 */
export const HairTypeSchema = z.enum(['straight', 'wavy', 'curly', 'coily'])
/**
 * @description
 * 髪質タイプ区分 - 顧客の髪のクセや形状を分類、適切な施術提案に使用
 *
 *
 * straight: ストレート - 直毛、クセがほとんどない髪質
 *
 * wavy: ウェービー - 緩やかな波状、S字カーブの髪質
 *
 * curly: カーリー - 明確なカール、螺旋状の髪質
 *
 * coily: コイリー - 非常に細かいカール、ジグザグ状の髪質
 */
export type HairType = z.infer<typeof HairTypeSchema>

/**
 * @description
 * アラート重要度区分 - 在庫アラートの重要度
 *
 *
 * info: 情報 - 対応を急がない通知
 *
 * warning: 警告 - 早めの対応が必要な通知
 *
 * critical: 重大 - 直ちに対応が必要な通知
 */
export const InventoryAlertSeverityTypeSchema = z.enum(['info', 'warning', 'critical'])
/**
 * @description
 * アラート重要度区分 - 在庫アラートの重要度
 *
 *
 * info: 情報 - 対応を急がない通知
 *
 * warning: 警告 - 早めの対応が必要な通知
 *
 * critical: 重大 - 直ちに対応が必要な通知
 */
export type InventoryAlertSeverityType = z.infer<typeof InventoryAlertSeverityTypeSchema>

/**
 * @description
 * 在庫アラート種別区分 - 在庫に対して発生するアラートの種類
 *
 *
 * low_stock: 在庫僅少 - 在庫数が閾値を下回った状態
 *
 * expiring: 期限間近 - 使用期限が近づいている状態
 *
 * expired: 期限切れ - 使用期限を過ぎた状態
 *
 * overstock: 過剰在庫 - 在庫数が上限を超えた状態
 */
export const InventoryAlertTypeSchema = z.enum(['low_stock', 'expiring', 'expired', 'overstock'])
/**
 * @description
 * 在庫アラート種別区分 - 在庫に対して発生するアラートの種類
 *
 *
 * low_stock: 在庫僅少 - 在庫数が閾値を下回った状態
 *
 * expiring: 期限間近 - 使用期限が近づいている状態
 *
 * expired: 期限切れ - 使用期限を過ぎた状態
 *
 * overstock: 過剰在庫 - 在庫数が上限を超えた状態
 */
export type InventoryAlertType = z.infer<typeof InventoryAlertTypeSchema>

/**
 * @description
 * 在庫移動種別区分 - 在庫数を増減させた操作の種類を表す区分
 *
 *
 * purchase: 仕入 - 仕入先から商品を受け入れた入庫
 *
 * sale: 販売 - 顧客への店頭販売による出庫
 *
 * use: 施術使用 - 施術の材料として消費した出庫
 *
 * adjustment: 調整 - 棚卸差異や破損などの補正による増減
 *
 * return: 返品 - 仕入先への返品または顧客からの返品による増減
 *
 * disposal: 廃棄 - 期限切れや破損による廃棄
 *
 * transfer: 移動 - ほかの保管場所・店舗との間の移動による増減
 */
export const InventoryTransactionTypeSchema = z.enum(['purchase', 'sale', 'use', 'adjustment', 'return', 'disposal', 'transfer'])
/**
 * @description
 * 在庫移動種別区分 - 在庫数を増減させた操作の種類を表す区分
 *
 *
 * purchase: 仕入 - 仕入先から商品を受け入れた入庫
 *
 * sale: 販売 - 顧客への店頭販売による出庫
 *
 * use: 施術使用 - 施術の材料として消費した出庫
 *
 * adjustment: 調整 - 棚卸差異や破損などの補正による増減
 *
 * return: 返品 - 仕入先への返品または顧客からの返品による増減
 *
 * disposal: 廃棄 - 期限切れや破損による廃棄
 *
 * transfer: 移動 - ほかの保管場所・店舗との間の移動による増減
 */
export type InventoryTransactionType = z.infer<typeof InventoryTransactionTypeSchema>

/**
 * @description
 * 会員ランク区分 - 顧客の会員ランクを表し、特典・優待内容を決定する区分
 *
 *
 * regular: 一般会員 - 基本ランク、標準的なサービスを提供
 *
 * silver: シルバー会員 - 中級ランク、5%の基本割引等の特典付与
 *
 * gold: ゴールド会員 - 上級ランク、10%の割引や優先予約等の特典付与
 *
 * platinum: プラチナ会員 - 最上級ランク、15%の割引や特別サービス提供
 *
 * vip: VIP会員 - 特別会員、完全カスタマイズされた特別待遇を提供
 */
export const MembershipTierTypeSchema = z.enum(['regular', 'silver', 'gold', 'platinum', 'vip'])
/**
 * @description
 * 会員ランク区分 - 顧客の会員ランクを表し、特典・優待内容を決定する区分
 *
 *
 * regular: 一般会員 - 基本ランク、標準的なサービスを提供
 *
 * silver: シルバー会員 - 中級ランク、5%の基本割引等の特典付与
 *
 * gold: ゴールド会員 - 上級ランク、10%の割引や優先予約等の特典付与
 *
 * platinum: プラチナ会員 - 最上級ランク、15%の割引や特別サービス提供
 *
 * vip: VIP会員 - 特別会員、完全カスタマイズされた特別待遇を提供
 */
export type MembershipTierType = z.infer<typeof MembershipTierTypeSchema>

/**
 * @description
 * 発注ステータス区分 - 商品発注の進行状態を表す区分
 *
 *
 * draft: 下書き - 発注内容を作成中の状態
 *
 * pending: 承認待ち - 発注内容が確定し、承認を待っている状態
 *
 * approved: 承認済み - 責任者により発注が承認された状態
 *
 * ordered: 発注済み - サプライヤーへ正式に発注が行われた状態
 *
 * shipped: 発送済み - サプライヤーから商品が発送された状態
 *
 * delivered: 配送完了 - 商品が到着し、受領が完了した状態
 *
 * cancelled: キャンセル - 発注が取り消された状態
 */
export const OrderStatusTypeSchema = z.enum(['draft', 'pending', 'approved', 'ordered', 'shipped', 'delivered', 'cancelled'])
/**
 * @description
 * 発注ステータス区分 - 商品発注の進行状態を表す区分
 *
 *
 * draft: 下書き - 発注内容を作成中の状態
 *
 * pending: 承認待ち - 発注内容が確定し、承認を待っている状態
 *
 * approved: 承認済み - 責任者により発注が承認された状態
 *
 * ordered: 発注済み - サプライヤーへ正式に発注が行われた状態
 *
 * shipped: 発送済み - サプライヤーから商品が発送された状態
 *
 * delivered: 配送完了 - 商品が到着し、受領が完了した状態
 *
 * cancelled: キャンセル - 発注が取り消された状態
 */
export type OrderStatusType = z.infer<typeof OrderStatusTypeSchema>

/**
 * @description
 * 支払い方法区分 - サロンで利用可能な決済手段の種類
 *
 *
 * cash: 現金 - 現金による支払い
 *
 * credit_card: クレジットカード - クレジットカードによる支払い
 *
 * debit_card: デビットカード - 銀行口座から直接引き落としのカード支払い
 *
 * e_money: 電子マネー - Suica、PASMO等の電子マネーによる支払い
 *
 * qr_payment: QRコード決済 - PayPay、LINE Pay等のQRコード決済
 *
 * bank_transfer: 銀行振込 - 銀行口座への振込による支払い
 *
 * point: ポイント - サロンのポイントを使用した支払い
 */
export const PaymentMethodTypeSchema = z.enum([
  'cash',
  'credit_card',
  'debit_card',
  'e_money',
  'qr_payment',
  'bank_transfer',
  'point'
])
/**
 * @description
 * 支払い方法区分 - サロンで利用可能な決済手段の種類
 *
 *
 * cash: 現金 - 現金による支払い
 *
 * credit_card: クレジットカード - クレジットカードによる支払い
 *
 * debit_card: デビットカード - 銀行口座から直接引き落としのカード支払い
 *
 * e_money: 電子マネー - Suica、PASMO等の電子マネーによる支払い
 *
 * qr_payment: QRコード決済 - PayPay、LINE Pay等のQRコード決済
 *
 * bank_transfer: 銀行振込 - 銀行口座への振込による支払い
 *
 * point: ポイント - サロンのポイントを使用した支払い
 */
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>

/**
 * @description
 * 支払いステータス区分 - 決済取引(payment_transactions.status)と売上(sales.paymentStatus)の支払いの進行状態を表す区分
 *
 *
 * pending: 支払い待ち - 売上では、何も受け取っていない状態
 *
 * processing: 処理中 - 売上では、合計金額の一部を受け取った状態
 *
 * completed: 完了 - 決済取引では、支払いを受け取った状態。売上では、合計金額を受け取った状態
 *
 * failed: 失敗 - 支払い処理が失敗した状態
 *
 * refunded: 返金済み - 決済取引では、全額を返金した状態。売上では、受け取った全額を返金した状態
 *
 * partial_refund: 部分返金 - 決済取引では、一部を返金した状態。売上では、受け取った金額の一部を返金した状態
 * API が決済取引に書くのは completed・refunded・partial_refund だけで、売上に failed は書かない
 */
export const PaymentStatusTypeSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partial_refund'])
/**
 * @description
 * 支払いステータス区分 - 決済取引(payment_transactions.status)と売上(sales.paymentStatus)の支払いの進行状態を表す区分
 *
 *
 * pending: 支払い待ち - 売上では、何も受け取っていない状態
 *
 * processing: 処理中 - 売上では、合計金額の一部を受け取った状態
 *
 * completed: 完了 - 決済取引では、支払いを受け取った状態。売上では、合計金額を受け取った状態
 *
 * failed: 失敗 - 支払い処理が失敗した状態
 *
 * refunded: 返金済み - 決済取引では、全額を返金した状態。売上では、受け取った全額を返金した状態
 *
 * partial_refund: 部分返金 - 決済取引では、一部を返金した状態。売上では、受け取った金額の一部を返金した状態
 * API が決済取引に書くのは completed・refunded・partial_refund だけで、売上に failed は書かない
 */
export type PaymentStatusType = z.infer<typeof PaymentStatusTypeSchema>

/**
 * @description
 * 権限適用範囲区分 - 権限が及ぶデータの範囲を表す
 *
 *
 * own: 本人 - 操作するユーザー自身に関係するデータだけに適用される
 *
 * salon: サロン - 対象サロンのデータに適用される
 *
 * all: 全体 - すべてのサロンのデータに適用される
 */
export const PermissionScopeTypeSchema = z.enum(['own', 'salon', 'all'])
/**
 * @description
 * 権限適用範囲区分 - 権限が及ぶデータの範囲を表す
 *
 *
 * own: 本人 - 操作するユーザー自身に関係するデータだけに適用される
 *
 * salon: サロン - 対象サロンのデータに適用される
 *
 * all: 全体 - すべてのサロンのデータに適用される
 */
export type PermissionScopeType = z.infer<typeof PermissionScopeTypeSchema>

/**
 * @description
 * ポイント取引種別区分 - 顧客ポイントの増減(customer_points の1行)の種類
 *
 *
 * earned: 獲得 - 来店や購入などでポイントを付与した取引
 *
 * used: 利用 - 支払いなどでポイントを使用した取引
 *
 * expired: 失効 - 有効期限を過ぎたポイントを失効させた取引
 *
 * adjusted: 調整 - スタッフが手動でポイントを増減した取引
 *
 * transferred: 移行 - 別の顧客との間でポイントを移した取引
 */
export const PointTransactionTypeSchema = z.enum(['earned', 'used', 'expired', 'adjusted', 'transferred'])
/**
 * @description
 * ポイント取引種別区分 - 顧客ポイントの増減(customer_points の1行)の種類
 *
 *
 * earned: 獲得 - 来店や購入などでポイントを付与した取引
 *
 * used: 利用 - 支払いなどでポイントを使用した取引
 *
 * expired: 失効 - 有効期限を過ぎたポイントを失効させた取引
 *
 * adjusted: 調整 - スタッフが手動でポイントを増減した取引
 *
 * transferred: 移行 - 別の顧客との間でポイントを移した取引
 */
export type PointTransactionType = z.infer<typeof PointTransactionTypeSchema>

/**
 * @description
 * 価格戦略タイプ区分 - サービスの価格設定方法を定義
 *
 *
 * fixed: 固定価格 - 常に同じ価格で提供
 *
 * variable: 変動価格 - 髪の長さや量など施術内容に応じて価格が変わる
 *
 * tiered: 段階価格 - 条件によって価格が変わる段階制
 *
 * dynamic: 動的価格 - 需要や時間帯によって変動する価格
 *
 * consultation_based: 要相談 - カウンセリング後に価格を決定する
 */
export const PricingStrategyTypeSchema = z.enum(['fixed', 'variable', 'tiered', 'dynamic', 'consultation_based'])
/**
 * @description
 * 価格戦略タイプ区分 - サービスの価格設定方法を定義
 *
 *
 * fixed: 固定価格 - 常に同じ価格で提供
 *
 * variable: 変動価格 - 髪の長さや量など施術内容に応じて価格が変わる
 *
 * tiered: 段階価格 - 条件によって価格が変わる段階制
 *
 * dynamic: 動的価格 - 需要や時間帯によって変動する価格
 *
 * consultation_based: 要相談 - カウンセリング後に価格を決定する
 */
export type PricingStrategyType = z.infer<typeof PricingStrategyTypeSchema>

/**
 * @description
 * レビュー並び順区分 - レビュー一覧の並び順を表す
 *
 *
 * recent: 新着順 - 投稿日時(createdAt)の新しい順
 *
 * rating: 評価順 - 総合評価(overallRating)の高い順
 *
 * helpful: 参考になった順 - 参考になった数(helpfulCount)の多い順
 */
export const ReviewSortTypeSchema = z.enum(['recent', 'rating', 'helpful'])
/**
 * @description
 * レビュー並び順区分 - レビュー一覧の並び順を表す
 *
 *
 * recent: 新着順 - 投稿日時(createdAt)の新しい順
 *
 * rating: 評価順 - 総合評価(overallRating)の高い順
 *
 * helpful: 参考になった順 - 参考になった数(helpfulCount)の多い順
 */
export type ReviewSortType = z.infer<typeof ReviewSortTypeSchema>

/**
 * @description
 * 売上レポート出力形式区分 - 売上レポートを出力するファイルの形式
 *
 *
 * csv: CSV - カンマ区切りのテキストファイル
 *
 * excel: Excel - Excel のブック
 *
 * pdf: PDF - 印刷・配布用の PDF ファイル
 */
export const SalesReportExportFormatTypeSchema = z.enum(['csv', 'excel', 'pdf'])
/**
 * @description
 * 売上レポート出力形式区分 - 売上レポートを出力するファイルの形式
 *
 *
 * csv: CSV - カンマ区切りのテキストファイル
 *
 * excel: Excel - Excel のブック
 *
 * pdf: PDF - 印刷・配布用の PDF ファイル
 */
export type SalesReportExportFormatType = z.infer<typeof SalesReportExportFormatTypeSchema>

/**
 * @description
 * 売上推移区切り区分 - 売上推移の期間を区切る単位
 *
 *
 * daily: 日 - 1日ごと。ラベルは YYYY-MM-DD
 *
 * weekly: 週 - 月曜日に始まる週ごと。ラベルは週の月曜日の YYYY-MM-DD
 *
 * monthly: 月 - 暦の月ごと。ラベルは YYYY-MM
 */
export const SalesTrendPeriodTypeSchema = z.enum(['daily', 'weekly', 'monthly'])
/**
 * @description
 * 売上推移区切り区分 - 売上推移の期間を区切る単位
 *
 *
 * daily: 日 - 1日ごと。ラベルは YYYY-MM-DD
 *
 * weekly: 週 - 月曜日に始まる週ごと。ラベルは週の月曜日の YYYY-MM-DD
 *
 * monthly: 月 - 暦の月ごと。ラベルは YYYY-MM
 */
export type SalesTrendPeriodType = z.infer<typeof SalesTrendPeriodTypeSchema>

/**
 * @description
 * サロンロール区分 - サロンに属するアカウントのロール。スタッフへの招待で与え、スタッフのアカウントの操作で変える
 *
 *
 * owner: オーナー - サロンの所有者。スタッフ台帳を扱い、スタッフを招待できる
 *
 * manager: マネージャー - サロンの管理業務を担当する
 *
 * staff: スタッフ - 施術を提供するサロン従業員
 */
export const SalonRoleTypeSchema = z.enum(['owner', 'manager', 'staff'])
/**
 * @description
 * サロンロール区分 - サロンに属するアカウントのロール。スタッフへの招待で与え、スタッフのアカウントの操作で変える
 *
 *
 * owner: オーナー - サロンの所有者。スタッフ台帳を扱い、スタッフを招待できる
 *
 * manager: マネージャー - サロンの管理業務を担当する
 *
 * staff: スタッフ - 施術を提供するサロン従業員
 */
export type SalonRoleType = z.infer<typeof SalonRoleTypeSchema>

/**
 * @description
 * 頭皮状態区分 - 頭皮の状態を分類、適切なケア方法の選択に使用
 *
 *
 * normal: 正常 - 健康的な頭皮状態、特別なケア不要
 *
 * dry: 乾燥 - 乾燥しやすい頭皮、保湿ケアが必要
 *
 * oily: 脂性 - 皮脂分泌が多い頭皮、洗浄力のあるケアが必要
 *
 * sensitive: 敏感 - 刺激に弱い頭皮、低刺激の製品使用が必要
 *
 * dandruff: フケ - フケが出やすい頭皮、フケ対策のケアが必要
 */
export const ScalpConditionTypeSchema = z.enum(['normal', 'dry', 'oily', 'sensitive', 'dandruff'])
/**
 * @description
 * 頭皮状態区分 - 頭皮の状態を分類、適切なケア方法の選択に使用
 *
 *
 * normal: 正常 - 健康的な頭皮状態、特別なケア不要
 *
 * dry: 乾燥 - 乾燥しやすい頭皮、保湿ケアが必要
 *
 * oily: 脂性 - 皮脂分泌が多い頭皮、洗浄力のあるケアが必要
 *
 * sensitive: 敏感 - 刺激に弱い頭皮、低刺激の製品使用が必要
 *
 * dandruff: フケ - フケが出やすい頭皮、フケ対策のケアが必要
 */
export type ScalpConditionType = z.infer<typeof ScalpConditionTypeSchema>

/**
 * @description
 * サービス提供可能性タイプ区分 - サービスが提供される時期や条件
 *
 *
 * always: 常時提供 - いつでも利用可能なサービス
 *
 * weekdays_only: 平日のみ - 平日に限り提供するサービス
 *
 * weekends_only: 週末のみ - 土曜日・日曜日に限り提供するサービス
 *
 * by_appointment_only: 予約制 - 事前予約がある場合のみ提供するサービス
 *
 * seasonal: 季節限定 - 特定の季節のみ提供
 * 空き枠は、weekdays_only のサービスを月曜日〜金曜日だけ、weekends_only のサービスを土曜日・日曜日だけに返す(サロンのタイムゾーンでの曜日)。
 * ほかの値は、どの日も同じに扱う(空き枠からの予約は事前の予約であり、季節はサロンが serviceStatus で切り替える)
 */
export const ServiceAvailabilityTypeSchema = z.enum(['always', 'weekdays_only', 'weekends_only', 'by_appointment_only', 'seasonal'])
/**
 * @description
 * サービス提供可能性タイプ区分 - サービスが提供される時期や条件
 *
 *
 * always: 常時提供 - いつでも利用可能なサービス
 *
 * weekdays_only: 平日のみ - 平日に限り提供するサービス
 *
 * weekends_only: 週末のみ - 土曜日・日曜日に限り提供するサービス
 *
 * by_appointment_only: 予約制 - 事前予約がある場合のみ提供するサービス
 *
 * seasonal: 季節限定 - 特定の季節のみ提供
 * 空き枠は、weekdays_only のサービスを月曜日〜金曜日だけ、weekends_only のサービスを土曜日・日曜日だけに返す(サロンのタイムゾーンでの曜日)。
 * ほかの値は、どの日も同じに扱う(空き枠からの予約は事前の予約であり、季節はサロンが serviceStatus で切り替える)
 */
export type ServiceAvailabilityType = z.infer<typeof ServiceAvailabilityTypeSchema>

/**
 * @description
 * サービスカテゴリー区分 - サロンで提供される主要なサービスカテゴリーの定義
 *
 *
 * cut: カット - ヘアカット、トリミング等の切断系サービス
 *
 * color: カラー - ヘアカラー、ハイライト等の染色系サービス
 *
 * perm: パーマ - パーマネント、デジタルパーマ等のウェーブ形成サービス
 *
 * treatment: トリートメント - ヘアトリートメント、ヘアケア等の補修・改善サービス
 *
 * spa: スパ - ヘッドスパ、リラクゼーション等の癒し系サービス
 *
 * styling: スタイリング - セット、アレンジ等のスタイリングサービス
 *
 * extension: エクステンション - ヘアエクステ、増毛等の毛髪追加サービス
 *
 * other: その他 - 上記カテゴリーに分類されないサービス
 */
export const ServiceCategoryTypeSchema = z.enum(['cut', 'color', 'perm', 'treatment', 'spa', 'styling', 'extension', 'other'])
/**
 * @description
 * サービスカテゴリー区分 - サロンで提供される主要なサービスカテゴリーの定義
 *
 *
 * cut: カット - ヘアカット、トリミング等の切断系サービス
 *
 * color: カラー - ヘアカラー、ハイライト等の染色系サービス
 *
 * perm: パーマ - パーマネント、デジタルパーマ等のウェーブ形成サービス
 *
 * treatment: トリートメント - ヘアトリートメント、ヘアケア等の補修・改善サービス
 *
 * spa: スパ - ヘッドスパ、リラクゼーション等の癒し系サービス
 *
 * styling: スタイリング - セット、アレンジ等のスタイリングサービス
 *
 * extension: エクステンション - ヘアエクステ、増毛等の毛髪追加サービス
 *
 * other: その他 - 上記カテゴリーに分類されないサービス
 */
export type ServiceCategoryType = z.infer<typeof ServiceCategoryTypeSchema>

/**
 * @description
 * サービスオプションタイプ区分 - サービスに追加できるオプションの種類
 *
 *
 * addon: アドオン - 基本サービスに追加できるオプション
 *
 * upgrade: アップグレード - サービスのグレードを上げるオプション
 *
 * duration_extension: 時間延長 - サービス時間を延長するオプション
 *
 * product_choice: 商品選択 - 施術に使用する商品を選ぶオプション
 */
export const ServiceOptionTypeSchema = z.enum(['addon', 'upgrade', 'duration_extension', 'product_choice'])
/**
 * @description
 * サービスオプションタイプ区分 - サービスに追加できるオプションの種類
 *
 *
 * addon: アドオン - 基本サービスに追加できるオプション
 *
 * upgrade: アップグレード - サービスのグレードを上げるオプション
 *
 * duration_extension: 時間延長 - サービス時間を延長するオプション
 *
 * product_choice: 商品選択 - 施術に使用する商品を選ぶオプション
 */
export type ServiceOptionType = z.infer<typeof ServiceOptionTypeSchema>

/**
 * @description
 * サービスステータス区分 - サービスの提供状態を表す区分
 *
 *
 * active: 有効 - 現在提供中のサービス
 *
 * inactive: 一時停止 - 一時的に提供を停止しているサービス
 *
 * coming_soon: 近日公開 - 近々提供予定のサービス
 *
 * discontinued: 廃止 - 提供を終了したサービス
 */
export const ServiceStatusTypeSchema = z.enum(['active', 'inactive', 'coming_soon', 'discontinued'])
/**
 * @description
 * サービスステータス区分 - サービスの提供状態を表す区分
 *
 *
 * active: 有効 - 現在提供中のサービス
 *
 * inactive: 一時停止 - 一時的に提供を停止しているサービス
 *
 * coming_soon: 近日公開 - 近々提供予定のサービス
 *
 * discontinued: 廃止 - 提供を終了したサービス
 */
export type ServiceStatusType = z.infer<typeof ServiceStatusTypeSchema>

/**
 * @description
 * スタッフレベル区分 - スタッフの技術レベルや経験を表す階層
 *
 *
 * junior: ジュニア - 新人・見習いレベル、基本的な施術が可能
 *
 * stylist: スタイリスト - 標準レベル、一般的な施術が可能
 *
 * senior: シニア - 上級レベル、高度な技術と経験を保有
 *
 * expert: エキスパート - 専門家レベル、特殊技術や指導が可能
 *
 * director: ディレクター - 管理職レベル、サロンの技術的な指導を担当
 */
export const StaffLevelTypeSchema = z.enum(['junior', 'stylist', 'senior', 'expert', 'director'])
/**
 * @description
 * スタッフレベル区分 - スタッフの技術レベルや経験を表す階層
 *
 *
 * junior: ジュニア - 新人・見習いレベル、基本的な施術が可能
 *
 * stylist: スタイリスト - 標準レベル、一般的な施術が可能
 *
 * senior: シニア - 上級レベル、高度な技術と経験を保有
 *
 * expert: エキスパート - 専門家レベル、特殊技術や指導が可能
 *
 * director: ディレクター - 管理職レベル、サロンの技術的な指導を担当
 */
export type StaffLevelType = z.infer<typeof StaffLevelTypeSchema>

/**
 * @description
 * 施術タイプ区分 - サロンで提供される具体的な施術の種類
 *
 *
 * cut: カット - ヘアカット、レイヤーカット等の切断技術
 *
 * color: カラー - ヘアカラー、白髪染め、ハイライト等の染色技術
 *
 * perm: パーマ - コールドパーマ、デジタルパーマ等のウェーブ技術
 *
 * treatment: トリートメント - ダメージケア、栄養補給等の毛髪改善技術
 *
 * head_spa: ヘッドスパ - 頭皮マッサージ、スカルプケア等の頭皮ケア技術
 *
 * styling: スタイリング - セット、アレンジ等のスタイリング技術
 *
 * extension: エクステンション - ヘアエクステ、増毛等の毛髪追加技術
 *
 * nail: ネイル - マニキュア、ジェルネイル等の爪装飾技術
 *
 * eyelash: まつげ - まつげエクステ、まつげパーマ等のまつげ装飾技術
 *
 * other: その他 - 上記に分類されない施術
 */
export const TreatmentTypeSchema = z.enum([
  'cut',
  'color',
  'perm',
  'treatment',
  'head_spa',
  'styling',
  'extension',
  'nail',
  'eyelash',
  'other'
])
/**
 * @description
 * 施術タイプ区分 - サロンで提供される具体的な施術の種類
 *
 *
 * cut: カット - ヘアカット、レイヤーカット等の切断技術
 *
 * color: カラー - ヘアカラー、白髪染め、ハイライト等の染色技術
 *
 * perm: パーマ - コールドパーマ、デジタルパーマ等のウェーブ技術
 *
 * treatment: トリートメント - ダメージケア、栄養補給等の毛髪改善技術
 *
 * head_spa: ヘッドスパ - 頭皮マッサージ、スカルプケア等の頭皮ケア技術
 *
 * styling: スタイリング - セット、アレンジ等のスタイリング技術
 *
 * extension: エクステンション - ヘアエクステ、増毛等の毛髪追加技術
 *
 * nail: ネイル - マニキュア、ジェルネイル等の爪装飾技術
 *
 * eyelash: まつげ - まつげエクステ、まつげパーマ等のまつげ装飾技術
 *
 * other: その他 - 上記に分類されない施術
 */
export type TreatmentType = z.infer<typeof TreatmentTypeSchema>

/**
 * @description
 * 2要素認証ステータス区分 - 2要素認証の設定状態
 *
 *
 * disabled: 無効 - 2要素認証が設定されていない状態
 *
 * pending: 設定中 - 2要素認証の設定が進行中の状態
 *
 * enabled: 有効 - 2要素認証が有効化されている状態
 */
export const TwoFactorStatusTypeSchema = z.enum(['disabled', 'pending', 'enabled'])
/**
 * @description
 * 2要素認証ステータス区分 - 2要素認証の設定状態
 *
 *
 * disabled: 無効 - 2要素認証が設定されていない状態
 *
 * pending: 設定中 - 2要素認証の設定が進行中の状態
 *
 * enabled: 有効 - 2要素認証が有効化されている状態
 */
export type TwoFactorStatusType = z.infer<typeof TwoFactorStatusTypeSchema>

/**
 * @description
 * ユーザーアカウントステータス区分 - アカウントの利用可否状態
 *
 *
 * active: アクティブ - 正常に利用可能なアカウント
 *
 * unverified: メール未確認 - メールアドレスが確認されていないアカウント
 *
 * inactive: 非アクティブ - 利用が休止されているアカウント
 *
 * locked: ロック - ログイン失敗回数超過によりロックされたアカウント
 *
 * suspended: 停止 - 管理者によって停止されたアカウント
 *
 * deleted: 削除済み - 削除されたアカウント
 */
export const UserAccountStatusTypeSchema = z.enum(['active', 'unverified', 'inactive', 'locked', 'suspended', 'deleted'])
/**
 * @description
 * ユーザーアカウントステータス区分 - アカウントの利用可否状態
 *
 *
 * active: アクティブ - 正常に利用可能なアカウント
 *
 * unverified: メール未確認 - メールアドレスが確認されていないアカウント
 *
 * inactive: 非アクティブ - 利用が休止されているアカウント
 *
 * locked: ロック - ログイン失敗回数超過によりロックされたアカウント
 *
 * suspended: 停止 - 管理者によって停止されたアカウント
 *
 * deleted: 削除済み - 削除されたアカウント
 */
export type UserAccountStatusType = z.infer<typeof UserAccountStatusTypeSchema>

/**
 * @description
 * ユーザーロール区分 - システム内でのユーザーの役割と権限レベル
 *
 *
 * customer: 顧客 - サービスの予約・利用が可能なユーザー
 *
 * staff: スタッフ - 施術を提供するサロン従業員
 *
 * manager: マネージャー - サロンの管理業務を担当する管理者
 *
 * admin: 管理者 - システム全体の管理権限を持つユーザー
 *
 * owner: オーナー - サロンの所有者、最高権限を保持
 */
export const UserRoleTypeSchema = z.enum(['customer', 'staff', 'manager', 'admin', 'owner'])
/**
 * @description
 * ユーザーロール区分 - システム内でのユーザーの役割と権限レベル
 *
 *
 * customer: 顧客 - サービスの予約・利用が可能なユーザー
 *
 * staff: スタッフ - 施術を提供するサロン従業員
 *
 * manager: マネージャー - サロンの管理業務を担当する管理者
 *
 * admin: 管理者 - システム全体の管理権限を持つユーザー
 *
 * owner: オーナー - サロンの所有者、最高権限を保持
 */
export type UserRoleType = z.infer<typeof UserRoleTypeSchema>

