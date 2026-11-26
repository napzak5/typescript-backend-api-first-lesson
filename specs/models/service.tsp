import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    価格戦略タイプ区分 - サービスの価格設定方法を定義
    
    fixed: 固定価格 - 常に同じ価格で提供
    variable: 変動価格 - 髪の長さや量など施術内容に応じて価格が変わる
    tiered: 段階価格 - 条件によって価格が変わる段階制
    dynamic: 動的価格 - 需要や時間帯によって変動する価格
    consultation_based: 要相談 - カウンセリング後に価格を決定する
    """)
  enum PricingStrategyType {
    fixed,
    variable,
    tiered,
    dynamic,
    consultation_based,
  }

  @doc("""
    サービスステータス区分 - サービスの提供状態を表す区分
    
    active: 有効 - 現在提供中のサービス
    inactive: 一時停止 - 一時的に提供を停止しているサービス
    coming_soon: 近日公開 - 近々提供予定のサービス
    discontinued: 廃止 - 提供を終了したサービス
    """)
  enum ServiceStatusType {
    active,
    inactive,
    coming_soon,
    discontinued,
  }

  @doc("""
    サービス提供可能性タイプ区分 - サービスが提供される時期や条件
    
    always: 常時提供 - いつでも利用可能なサービス
    weekdays_only: 平日のみ - 平日に限り提供するサービス
    weekends_only: 週末のみ - 土曜日・日曜日に限り提供するサービス
    by_appointment_only: 予約制 - 事前予約がある場合のみ提供するサービス
    seasonal: 季節限定 - 特定の季節のみ提供
    
    空き枠は、weekdays_only のサービスを月曜日〜金曜日だけ、weekends_only のサービスを土曜日・日曜日だけに返す(サロンのタイムゾーンでの曜日)。
    ほかの値は、どの日も同じに扱う(空き枠からの予約は事前の予約であり、季節はサロンが serviceStatus で切り替える)
    """)
  enum ServiceAvailabilityType {
    always,
    weekdays_only,
    weekends_only,
    by_appointment_only,
    seasonal,
  }

  @doc("""
    予約要件タイプ区分 - サービス予約時に必要な条件や制約
    
    consultation_required: 事前カウンセリング必須 - 施術前の相談・カウンセリングが必要
    patch_test_required: パッチテスト必須 - アレルギー確認のための事前テストが必要
    advance_booking_required: 事前予約必須 - 当日予約を受け付けず、事前の予約が必要
    deposit_required: デポジット必須 - 予約時に予約金の支払いが必要
    
    空き枠は、advance_booking_required のあるサービスに、当日(サロンのタイムゾーンでの今日)の枠を返さない。
    ほかの値は、サーバーでは確かめられない条件で、空き枠には影響しない
    """)
  enum BookingRequirementType {
    consultation_required,
    patch_test_required,
    advance_booking_required,
    deposit_required,
  }

  @doc("""
    サービスオプションタイプ区分 - サービスに追加できるオプションの種類
    
    addon: アドオン - 基本サービスに追加できるオプション
    upgrade: アップグレード - サービスのグレードを上げるオプション
    duration_extension: 時間延長 - サービス時間を延長するオプション
    product_choice: 商品選択 - 施術に使用する商品を選ぶオプション
    """)
  enum ServiceOptionType {
    addon,
    upgrade,
    duration_extension,
    product_choice,
  }

  @doc("""
    サービスオプション - service_options テーブルの1行。サービスに追加できるオプションを表す。
    サービスのレスポンスでも、登録・更新リクエストでも同じ形を使う。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model ServiceOption {
    @doc("オプション名")
    @minLength(1)
    @maxLength(255)
    name: string;

    @doc("オプションの説明。未設定の場合はnull")
    description: string | null;

    @doc("オプションの種類")
    optionType: ServiceOptionType;

    @doc("追加される施術時間（分）")
    @minValue(0)
    additionalTime: int32;

    @doc("追加料金")
    @minValue(0)
    additionalPrice: int32;

    @doc("1回の予約で選択できる最大数量")
    @minValue(1)
    maxQuantity: int32;

    @doc("必須オプションかどうか")
    isRequired: boolean;

    @doc("表示順序")
    @minValue(0)
    sortOrder: int32;

    @doc("有効フラグ")
    isActive: boolean;
  }

  @doc("""
    サービスレスポンス - services テーブルの公開カラムと、サービスオプション(service_options)を返す。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model ServiceResponse {
    @doc("サービス ID")
    id: ServiceId;

    @doc("サービスを提供するサロン ID")
    salonId: SalonId;

    @doc("所属するサービスカテゴリの ID。カテゴリ未設定、またはカテゴリが削除された場合はnull")
    categoryId: CategoryId | null;

    @doc("サービス名")
    name: string;

    @doc("説明文。未設定の場合はnull")
    description: string | null;

    @doc("短めの紹介文。詳細説明で十分な場合はnull")
    shortDescription: string | null;

    @doc("施術時間（分）")
    duration: int32;

    @doc("料金。税込かどうかは taxIncluded で示す")
    price: int32;

    @doc("割引後の料金。割引がない場合はnull")
    discountPrice: int32 | null;

    @doc("税込価格かどうか")
    taxIncluded: boolean;

    @doc("採用している価格戦略")
    pricingStrategy: PricingStrategyType;

    @doc("画像 URL。画像が登録されていない場合はnull")
    imageUrl: string | null;

    @doc("サービス画像の URL 一覧。画像がない場合は空配列")
    imageUrls: string[];

    @doc("必要なスタッフレベル。全スタッフが対応可能な場合はnull")
    requiredStaffLevel: StaffLevelType | null;

    @doc("1 日あたりの提供上限。日次制限がない場合はnull")
    maxBookingsPerDay: int32 | null;

    @doc("施術前にカウンセリングが必要かどうか")
    requiresConsultation: boolean;

    @doc("オンライン予約を受け付けるかどうか")
    allowOnlineBooking: boolean;

    @doc("予約時に必要な要件一覧。特別な要件がない場合は空配列")
    bookingRequirements: BookingRequirementType[];

    @doc("複数のサービスを組み合わせたパッケージかどうか")
    isPackage: boolean;

    @doc("パッケージに含まれるサービスの ID 一覧。パッケージでない場合は空配列")
    packageServiceIds: ServiceId[];

    @doc("タグ一覧。タグがない場合は空配列")
    tags: string[];

    @doc("表示順序")
    sortOrder: int32;

    @doc("現在の提供ステータス")
    serviceStatus: ServiceStatusType;

    @doc("提供可能な時期の区分")
    availability: ServiceAvailabilityType;

    @doc("有効フラグ")
    isActive: boolean;

    @doc("追加オプションの一覧。sortOrderの昇順で並ぶ。オプションがない場合は空配列")
    options: ServiceOption[];

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    サービス新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    登録先のサロンはパスの salonId で指定する
    """)
  model ServiceCreateRequest {
    @doc("所属するサービスカテゴリの ID。同じサロンのカテゴリを指定する。カテゴリに属さない場合はnull")
    categoryId: CategoryId | null;

    @doc("サービス名")
    @minLength(1)
    @maxLength(255)
    name: string;

    @doc("説明文。未設定の場合はnull")
    description: string | null;

    @doc("短めの紹介文。詳細説明で十分な場合はnull")
    @maxLength(500)
    shortDescription: string | null;

    @doc("施術時間（分）")
    @minValue(1)
    @maxValue(1440)
    duration: int32;

    @doc("料金。税込かどうかは taxIncluded で示す")
    @minValue(0)
    price: int32;

    @doc("割引後の料金。price 以下の値を指定する。割引がない場合はnull")
    @minValue(0)
    discountPrice: int32 | null;

    @doc("税込価格かどうか")
    taxIncluded: boolean;

    @doc("採用している価格戦略")
    pricingStrategy: PricingStrategyType;

    @doc("画像 URL。画像が登録されていない場合はnull")
    @maxLength(500)
    imageUrl: string | null;

    @doc("サービス画像の URL 一覧。画像がない場合は空配列")
    imageUrls: string[];

    @doc("必要なスタッフレベル。全スタッフが対応可能な場合はnull")
    requiredStaffLevel: StaffLevelType | null;

    @doc("1 日あたりの提供上限。日次制限がない場合はnull")
    @minValue(1)
    maxBookingsPerDay: int32 | null;

    @doc("施術前にカウンセリングが必要かどうか")
    requiresConsultation: boolean;

    @doc("オンライン予約を受け付けるかどうか")
    allowOnlineBooking: boolean;

    @doc("予約時に必要な要件一覧。同じ要件を重ねて指定できない。特別な要件がない場合は空配列")
    bookingRequirements: BookingRequirementType[];

    @doc("複数のサービスを組み合わせたパッケージかどうか。trueの場合は packageServiceIds に構成サービスを指定する")
    isPackage: boolean;

    @doc("パッケージに含まれるサービスの ID 一覧。isPackage が true の場合は、同じサロンの、パッケージではないサービスを重複なく2件以上20件以下で指定する。false の場合は空配列")
    @maxItems(20)
    packageServiceIds: ServiceId[];

    @doc("タグ一覧。タグがない場合は空配列")
    tags: string[];

    @doc("表示順序")
    @minValue(0)
    sortOrder: int32;

    @doc("現在の提供ステータス")
    serviceStatus: ServiceStatusType;

    @doc("提供可能な時期の区分")
    availability: ServiceAvailabilityType;

    @doc("有効フラグ")
    isActive: boolean;

    @doc("追加オプションの一覧。オプションがない場合は空配列")
    options: ServiceOption[];
  }

  @doc("""
    サービス部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる
    """)
  model ServiceUpdateRequest {
    @doc("所属するサービスカテゴリの ID。同じサロンのカテゴリを指定する。nullでクリア")
    categoryId?: CategoryId | null;

    @doc("サービス名")
    @minLength(1)
    @maxLength(255)
    name?: string;

    @doc("説明文。nullでクリア")
    description?: string | null;

    @doc("短めの紹介文。nullでクリア")
    @maxLength(500)
    shortDescription?: string | null;

    @doc("施術時間（分）")
    @minValue(1)
    @maxValue(1440)
    duration?: int32;

    @doc("料金。税込かどうかは taxIncluded で示す")
    @minValue(0)
    price?: int32;

    @doc("割引後の料金。更新後の price 以下の値を指定する。nullでクリア")
    @minValue(0)
    discountPrice?: int32 | null;

    @doc("税込価格かどうか")
    taxIncluded?: boolean;

    @doc("採用している価格戦略")
    pricingStrategy?: PricingStrategyType;

    @doc("画像 URL。nullでクリア")
    @maxLength(500)
    imageUrl?: string | null;

    @doc("サービス画像の URL 一覧。指定した場合は一覧全体を置き換える")
    imageUrls?: string[];

    @doc("必要なスタッフレベル。nullでクリア（全スタッフが対応可能になる）")
    requiredStaffLevel?: StaffLevelType | null;

    @doc("1 日あたりの提供上限。nullでクリア（日次制限なし）")
    @minValue(1)
    maxBookingsPerDay?: int32 | null;

    @doc("施術前にカウンセリングが必要かどうか")
    requiresConsultation?: boolean;

    @doc("オンライン予約を受け付けるかどうか")
    allowOnlineBooking?: boolean;

    @doc("予約時に必要な要件一覧。同じ要件を重ねて指定できない。指定した場合は一覧全体を置き換える")
    bookingRequirements?: BookingRequirementType[];

    @doc("複数のサービスを組み合わせたパッケージかどうか。更新後の isPackage と packageServiceIds の組み合わせで検証する")
    isPackage?: boolean;

    @doc("パッケージに含まれるサービスの ID 一覧。更新後の isPackage が true の場合は、同じサロンの、パッケージではない、このサービス以外のサービスを重複なく2件以上20件以下で指定する。false の場合は空配列")
    @maxItems(20)
    packageServiceIds?: ServiceId[];

    @doc("タグ一覧。指定した場合は一覧全体を置き換える")
    tags?: string[];

    @doc("表示順序")
    @minValue(0)
    sortOrder?: int32;

    @doc("現在の提供ステータス")
    serviceStatus?: ServiceStatusType;

    @doc("提供可能な時期の区分")
    availability?: ServiceAvailabilityType;

    @doc("有効フラグ")
    isActive?: boolean;

    @doc("追加オプションの一覧。指定した場合は一覧全体を置き換える")
    options?: ServiceOption[];
  }

  @doc("""
    サービス一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model ServiceSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル")
    cursor?: string;

    @query
    @doc("サービスカテゴリの ID による絞り込み(完全一致)")
    categoryId?: CategoryId;

    @query
    @doc("有効フラグによる絞り込み。指定しない場合は無効なサービスも返す")
    isActive?: boolean;
  }

  @doc("""
    サービス一括更新リクエスト - 指定した複数のサービスに同じ更新内容を適用する。
    すべてのサービスを1つのトランザクションで更新し、1件でも更新できない場合はどのサービスも更新しない
    """)
  model ServiceBulkUpdateRequest {
    @doc("更新対象のサービス ID 一覧。パスの salonId のサロンのサービスを重複なく1件以上100件以下で指定する")
    @minItems(1)
    @maxItems(100)
    serviceIds: ServiceId[];

    @doc("各サービスに適用する更新内容。指定した項目だけを更新する")
    updates: ServiceUpdateRequest;
  }

  @doc("サービス一括更新の結果 - 更新したサービスの ID 一覧を返す")
  model ServiceBulkUpdateResponse {
    @doc("更新したサービスの ID 一覧。serviceIds と同じ順に並ぶ")
    updated: ServiceId[];
  }

  @doc("""
    サービスカテゴリレスポンス - service_categories テーブルの全カラムを返す。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model ServiceCategoryResponse {
    @doc("カテゴリ ID")
    id: CategoryId;

    @doc("カテゴリを持つサロン ID")
    salonId: SalonId;

    @doc("カテゴリ名")
    name: string;

    @doc("カテゴリ説明。未設定の場合はnull")
    description: string | null;

    @doc("親カテゴリ ID。最上位カテゴリの場合はnull")
    parentId: CategoryId | null;

    @doc("サービスカテゴリ区分")
    category: ServiceCategoryType;

    @doc("表示順序")
    displayOrder: int32;

    @doc("アイコン画像の URL。未設定の場合はnull")
    iconUrl: string | null;

    @doc("表示色(#RRGGBB形式)。未設定の場合はnull")
    color: string | null;

    @doc("有効フラグ")
    isActive: boolean;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    サービスカテゴリ新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    カテゴリを持つサロンはパスの salonId で指定する
    """)
  model ServiceCategoryCreateRequest {
    @doc("カテゴリ名")
    @minLength(1)
    @maxLength(100)
    name: string;

    @doc("カテゴリ説明。未設定の場合はnull")
    description: string | null;

    @doc("親カテゴリ ID。同じサロンのカテゴリを指定する。最上位カテゴリの場合はnull")
    parentId: CategoryId | null;

    @doc("サービスカテゴリ区分")
    category: ServiceCategoryType;

    @doc("表示順序")
    @minValue(0)
    displayOrder: int32;

    @doc("アイコン画像の URL。未設定の場合はnull")
    @maxLength(500)
    iconUrl: string | null;

    @doc("表示色(#RRGGBB形式)。未設定の場合はnull")
    @pattern("^#[0-9A-Fa-f]{6}$")
    @maxLength(7)
    color: string | null;

    @doc("有効フラグ")
    isActive: boolean;
  }

  @doc("""
    サービスカテゴリ部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    カテゴリを持つサロンは変更できない
    """)
  model ServiceCategoryUpdateRequest {
    @doc("カテゴリ名")
    @minLength(1)
    @maxLength(100)
    name?: string;

    @doc("カテゴリ説明。nullでクリア")
    description?: string | null;

    @doc("親カテゴリ ID。同じサロンのカテゴリを指定する。nullでクリア（最上位カテゴリになる）")
    parentId?: CategoryId | null;

    @doc("サービスカテゴリ区分")
    category?: ServiceCategoryType;

    @doc("表示順序")
    @minValue(0)
    displayOrder?: int32;

    @doc("アイコン画像の URL。nullでクリア")
    @maxLength(500)
    iconUrl?: string | null;

    @doc("表示色(#RRGGBB形式)。nullでクリア")
    @pattern("^#[0-9A-Fa-f]{6}$")
    @maxLength(7)
    color?: string | null;

    @doc("有効フラグ")
    isActive?: boolean;
  }

  @doc("""
    サービスカテゴリ一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model ServiceCategorySearchRequest {
    @query
    @doc("1ページあたりの取得件数上限")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル")
    cursor?: string;

    @query
    @doc("有効フラグによる絞り込み。指定しない場合は無効なカテゴリも返す")
    isActive?: boolean;
  }
}
