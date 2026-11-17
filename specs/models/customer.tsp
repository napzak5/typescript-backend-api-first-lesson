import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  // ============================================================================
  // Enums
  // ============================================================================

  @doc("""
    会員ランク区分 - 顧客の会員ランクを表し、特典・優待内容を決定する区分
    
    regular: 一般会員 - 基本ランク、標準的なサービスを提供
    silver: シルバー会員 - 中級ランク、5%の基本割引等の特典付与
    gold: ゴールド会員 - 上級ランク、10%の割引や優先予約等の特典付与
    platinum: プラチナ会員 - 最上級ランク、15%の割引や特別サービス提供
    vip: VIP会員 - 特別会員、完全カスタマイズされた特別待遇を提供
    """)
  enum MembershipTierType {
    regular,
    silver,
    gold,
    platinum,
    vip,
  }

  @doc("""
    顧客ステータス区分 - 顧客アカウントの活動状態や利用可否を表す区分
    
    active: アクティブ - 通常利用可能な状態
    inactive: 休眠中 - 長期間利用がないがアカウントは維持されている状態
    vip: VIP - 特別な対応が必要な重要顧客として扱う状態
    blacklisted: ブラックリスト - 利用を禁止された状態
    """)
  enum CustomerStatusType {
    active,
    inactive,
    vip,
    blacklisted,
  }

  @doc("""
    髪質タイプ区分 - 顧客の髪のクセや形状を分類、適切な施術提案に使用
    
    straight: ストレート - 直毛、クセがほとんどない髪質
    wavy: ウェービー - 緩やかな波状、S字カーブの髪質
    curly: カーリー - 明確なカール、螺旋状の髪質
    coily: コイリー - 非常に細かいカール、ジグザグ状の髪質
    """)
  enum HairType {
    straight,
    wavy,
    curly,
    coily,
  }

  @doc("""
    髪の太さ区分 - 髪の毛一本の太さを分類、カットやスタイリングの参考に使用
    
    thin: 細毛 - 柔らかく細い髪、ボリュームが出にくい
    medium: 普通毛 - 平均的な太さの髪、扱いやすい
    thick: 太毛 - しっかりとした太い髪、ボリュームが出やすい
    """)
  enum HairThicknessType {
    thin,
    medium,
    thick,
  }

  @doc("""
    頭皮状態区分 - 頭皮の状態を分類、適切なケア方法の選択に使用
    
    normal: 正常 - 健康的な頭皮状態、特別なケア不要
    dry: 乾燥 - 乾燥しやすい頭皮、保湿ケアが必要
    oily: 脂性 - 皮脂分泌が多い頭皮、洗浄力のあるケアが必要
    sensitive: 敏感 - 刺激に弱い頭皮、低刺激の製品使用が必要
    dandruff: フケ - フケが出やすい頭皮、フケ対策のケアが必要
    """)
  enum ScalpConditionType {
    normal,
    dry,
    oily,
    sensitive,
    dandruff,
  }

  @doc("""
    顧客統合時の競合解決方針区分 - 2件の顧客レコードで値が異なる項目をどちらに合わせるか
    
    keep_primary: メイン優先 - 統合後も残す顧客(primaryCustomerId)の値を使う
    keep_secondary: サブ優先 - 統合して削除する顧客(secondaryCustomerId)の値を使う
    keep_newest: 新しい方優先 - 最後に更新された顧客の値を使う
    """)
  enum CustomerMergeConflictResolutionType {
    keep_primary,
    keep_secondary,
    keep_newest,
  }

  @doc("""
    顧客一覧エクスポート形式区分 - 検索結果のエクスポートで出力するファイル形式
    
    csv: CSV - カンマ区切りテキスト
    json: JSON - JSON形式
    excel: Excel - Excelブック形式
    """)
  enum CustomerExportFormatType {
    csv,
    json,
    excel,
  }

  @doc("""
    顧客データエクスポート形式区分 - 顧客本人のデータを出力するファイル形式
    
    json: JSON - JSON形式
    csv: CSV - カンマ区切りテキスト
    pdf: PDF - PDF文書
    """)
  enum CustomerDataExportFormatType {
    json,
    csv,
    pdf,
  }

  @doc("""
    顧客の版の操作区分 - 版を作った、顧客台帳への書き込みの種類
    
    baseline: 記録の開始 - 版を記録する前からいた顧客の、記録を始めた時点の値。変更者はない
    create: 登録 - 顧客を登録した(一括登録、顧客本人のプロフィールの作成を含む)
    update: 更新 - 台帳の項目を変えた(一括更新、顧客本人のプロフィールの更新、プロフィールの作成で台帳の顧客を引き継いだときを含む)
    delete: 削除 - 顧客を論理削除した(一括削除を含む)
    restore: 復元 - 論理削除した顧客を台帳に戻した
    """)
  enum CustomerVersionOperationType {
    baseline,
    create,
    update,
    delete,
    restore,
  }

  // ============================================================================
  // Customers (customers)
  // ============================================================================

  @doc("""
    顧客の基本的な好み - customers.preferences(jsonb) に保存する構造。
    スタッフ指名や時間帯などの詳細な好み設定は customer_preferences で管理する
    """)
  model CustomerBasicPreferences {
    @doc("希望するサービスの種類(サービスカテゴリ)の一覧。希望がない場合は空配列")
    preferredServices: ServiceCategoryType[];

    @doc("好みや要望に関する備考。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("""
    顧客レスポンス - customers テーブルの公開カラムを返す。スタッフ専用の項目(internalNotes)を含むので、顧客本人には返さない。
    プロパティ名と null 許可は DB カラムと一致させている。
    来店回数やポイントなどの集計値は他の機能が更新し、リクエストでは変更できない
    """)
  model CustomerResponse {
    @doc("顧客を一意に識別するID。システム内で重複しない識別子")
    id: CustomerId;

    @doc("ログインに使うユーザーアカウントのID。紐づけは認証機能が行う。ログインアカウントを持たない顧客の場合はnull")
    userId: UserId | null;

    @doc("名")
    firstName: string;

    @doc("姓")
    lastName: string;

    @doc("名のカナ表記。未登録の場合はnull")
    firstNameKana: string | null;

    @doc("姓のカナ表記。未登録の場合はnull")
    lastNameKana: string | null;

    @doc("主要連絡先として利用するメールアドレス。小文字で保存され、削除されていない顧客の間で一意")
    email: string;

    @doc("主要連絡先として利用する電話番号")
    phoneNumber: string;

    @doc("緊急連絡用などの予備電話番号。未登録の場合はnull")
    alternativePhone: string | null;

    @doc("郵便番号。未登録の場合はnull")
    postalCode: string | null;

    @doc("都道府県名。未登録の場合はnull")
    prefecture: string | null;

    @doc("市区町村名。未登録の場合はnull")
    city: string | null;

    @doc("町名・番地。未登録の場合はnull")
    address: string | null;

    @doc("建物名・部屋番号。未登録の場合はnull")
    building: string | null;

    @doc("生年月日。未登録または非公開の場合はnull")
    birthDate: plainDate | null;

    @doc("顧客の性別。未登録または非公開の場合はnull")
    gender: CustomerGenderType | null;

    @doc("職業。未登録の場合はnull")
    occupation: string | null;

    @doc("会員ランク。顧客の現在のメンバーシップレベル")
    membershipTier: MembershipTierType;

    @doc("現在のロイヤルティポイント。ポイント取引の結果として更新され、リクエストでは変更できない")
    loyaltyPoints: int32;

    @doc("顧客の好みや要望。未設定の場合はnull")
    preferences: CustomerBasicPreferences | null;

    @doc("顧客に関する備考。メモがない場合はnull")
    notes: string | null;

    @doc("スタッフ専用の内部メモ。顧客本人に見せることを想定しない情報。メモがない場合はnull")
    internalNotes: string | null;

    @doc("分類用タグ。顧客をグループ化するためのラベル。タグがない場合は空配列")
    tags: string[];

    @doc("紹介元顧客ID。紹介元の顧客があとで削除されても値は残る。紹介ではない場合はnull")
    referredBy: CustomerId | null;

    @doc("この顧客が他の顧客を紹介するときに使う紹介コード。削除済みを含むすべての顧客の間で一意。未発行の場合はnull")
    referralCode: string | null;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail: boolean;

    @doc("初回来店日。完了(completed)した予約の来店日のうち最も早い日。来店がない場合はnull")
    firstVisitDate: plainDate | null;

    @doc("最終来店日。完了(completed)した予約の来店日のうち最も遅い日。来店がない場合はnull")
    lastVisitDate: plainDate | null;

    @doc("総来店回数。完了(completed)した予約の数")
    visitCount: int32;

    @doc("無断キャンセル回数。顧客が来店しなかった(no_show)予約の数")
    noShowCount: int32;

    @doc("キャンセル回数。キャンセル(cancelled)された予約の数")
    cancellationCount: int32;

    @doc("アクティブな顧客かどうか")
    isActive: boolean;

    @doc("髪質タイプ。髪のクセや形状の分類。未登録の場合はnull")
    hairType: HairType | null;

    @doc("髪の太さ。一本あたりの毛髪の太さ。未登録の場合はnull")
    hairThickness: HairThicknessType | null;

    @doc("頭皮の状態。健康状態やケア必要性の分類。未登録の場合はnull")
    scalpCondition: ScalpConditionType | null;

    @doc("顧客ステータス")
    customerStatus: CustomerStatusType;

    @doc("レコード作成日時(顧客の登録日時)")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    顧客新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    ログインアカウントとの紐づけ、来店回数やポイントなどの集計値は含まない
    """)
  model CustomerCreateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName: string;

    @doc("名のカナ表記。未登録の場合はnull")
    @maxLength(100)
    firstNameKana: string | null;

    @doc("姓のカナ表記。未登録の場合はnull")
    @maxLength(100)
    lastNameKana: string | null;

    @doc("主要連絡先として利用するメールアドレス。小文字にそろえて保存する。削除されていない顧客の間で一意")
    @maxLength(255)
    email: string;

    @doc("主要連絡先として利用する電話番号")
    @maxLength(20)
    phoneNumber: string;

    @doc("緊急連絡用などの予備電話番号。未登録の場合はnull")
    @maxLength(20)
    alternativePhone: string | null;

    @doc("郵便番号。未登録の場合はnull")
    @maxLength(10)
    postalCode: string | null;

    @doc("都道府県名。未登録の場合はnull")
    @maxLength(50)
    prefecture: string | null;

    @doc("市区町村名。未登録の場合はnull")
    @maxLength(100)
    city: string | null;

    @doc("町名・番地。未登録の場合はnull")
    @maxLength(255)
    address: string | null;

    @doc("建物名・部屋番号。未登録の場合はnull")
    @maxLength(255)
    building: string | null;

    @doc("生年月日。年齢計算や誕生日特典に使用。1900-01-01以降で、未来の日付は指定できない。未登録の場合はnull")
    birthDate: plainDate | null;

    @doc("顧客の性別。未登録または非公開の場合はnull")
    gender: CustomerGenderType | null;

    @doc("職業。未登録の場合はnull")
    @maxLength(100)
    occupation: string | null;

    @doc("会員ランク。顧客の現在のメンバーシップレベル")
    membershipTier: MembershipTierType;

    @doc("顧客の好みや要望。未設定の場合はnull")
    preferences: CustomerBasicPreferences | null;

    @doc("顧客に関する備考。メモがない場合はnull")
    notes: string | null;

    @doc("スタッフ専用の内部メモ。顧客本人に見せることを想定しない情報。メモがない場合はnull")
    internalNotes: string | null;

    @doc("分類用タグ。顧客をグループ化するためのラベル。同じタグは繰り返せない。タグがない場合は空配列")
    tags: string[];

    @doc("紹介元顧客ID。削除されていない顧客を指定する。紹介ではない場合はnull")
    referredBy: CustomerId | null;

    @doc("この顧客が他の顧客を紹介するときに使う紹介コード。削除済みを含むすべての顧客の間で一意。未発行の場合はnull")
    @maxLength(50)
    referralCode: string | null;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail: boolean;

    @doc("アクティブな顧客かどうか")
    isActive: boolean;

    @doc("髪質タイプ。髪のクセや形状の分類。未登録の場合はnull")
    hairType: HairType | null;

    @doc("髪の太さ。一本あたりの毛髪の太さ。未登録の場合はnull")
    hairThickness: HairThicknessType | null;

    @doc("頭皮の状態。健康状態やケア必要性の分類。未登録の場合はnull")
    scalpCondition: ScalpConditionType | null;

    @doc("顧客ステータス")
    customerStatus: CustomerStatusType;
  }

  @doc("""
    顧客部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    ログインアカウントとの紐づけ、来店回数やポイントなどの集計値は変更できない
    """)
  model CustomerUpdateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName?: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName?: string;

    @doc("名のカナ表記。nullでクリア")
    @maxLength(100)
    firstNameKana?: string | null;

    @doc("姓のカナ表記。nullでクリア")
    @maxLength(100)
    lastNameKana?: string | null;

    @doc("主要連絡先として利用するメールアドレス。小文字にそろえて保存する。削除されていない顧客の間で一意")
    @maxLength(255)
    email?: string;

    @doc("主要連絡先として利用する電話番号")
    @maxLength(20)
    phoneNumber?: string;

    @doc("緊急連絡用などの予備電話番号。nullでクリア")
    @maxLength(20)
    alternativePhone?: string | null;

    @doc("郵便番号。nullでクリア")
    @maxLength(10)
    postalCode?: string | null;

    @doc("都道府県名。nullでクリア")
    @maxLength(50)
    prefecture?: string | null;

    @doc("市区町村名。nullでクリア")
    @maxLength(100)
    city?: string | null;

    @doc("町名・番地。nullでクリア")
    @maxLength(255)
    address?: string | null;

    @doc("建物名・部屋番号。nullでクリア")
    @maxLength(255)
    building?: string | null;

    @doc("生年月日。年齢計算や誕生日特典に使用。1900-01-01以降で、未来の日付は指定できない。nullでクリア")
    birthDate?: plainDate | null;

    @doc("顧客の性別。nullでクリア")
    gender?: CustomerGenderType | null;

    @doc("職業。nullでクリア")
    @maxLength(100)
    occupation?: string | null;

    @doc("会員ランク。顧客の現在のメンバーシップレベル")
    membershipTier?: MembershipTierType;

    @doc("顧客の好みや要望。nullでクリア")
    preferences?: CustomerBasicPreferences | null;

    @doc("顧客に関する備考。nullでクリア")
    notes?: string | null;

    @doc("スタッフ専用の内部メモ。顧客本人に見せることを想定しない情報。nullでクリア")
    internalNotes?: string | null;

    @doc("分類用タグ。指定するとタグの一覧を丸ごと置き換える。同じタグは繰り返せない。空配列でクリア")
    tags?: string[];

    @doc("紹介元顧客ID。削除されていない、この顧客以外の顧客を指定する。nullでクリア")
    referredBy?: CustomerId | null;

    @doc("この顧客が他の顧客を紹介するときに使う紹介コード。削除済みを含むすべての顧客の間で一意。nullでクリア")
    @maxLength(50)
    referralCode?: string | null;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing?: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms?: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail?: boolean;

    @doc("アクティブな顧客かどうか")
    isActive?: boolean;

    @doc("髪質タイプ。髪のクセや形状の分類。nullでクリア")
    hairType?: HairType | null;

    @doc("髪の太さ。一本あたりの毛髪の太さ。nullでクリア")
    hairThickness?: HairThicknessType | null;

    @doc("頭皮の状態。健康状態やケア必要性の分類。nullでクリア")
    scalpCondition?: ScalpConditionType | null;

    @doc("顧客ステータス")
    customerStatus?: CustomerStatusType;
  }

  @doc("""
    顧客一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する。
    並びは登録日時の新しい順
    """)
  model CustomerSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("顧客名(姓・名とそのカナ表記)、メールアドレスに対する部分一致キーワード(大文字小文字を区別しない)。数字・空白・-+()だけのキーワードは、電話番号とも数字だけを取り出して比べる")
    @minLength(1)
    @maxLength(100)
    search?: string;

    @query(#{ explode: true })
    @doc("タグによる絞り込み。指定したタグをすべて持つ顧客に一致する")
    tags?: string[];

    @query
    @doc("登録日時(createdAt)の下限による絞り込み。この日時以降に登録された顧客に一致する。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    registeredFrom?: utcDateTime;

    @query
    @doc("登録日時(createdAt)の上限による絞り込み。この日時以前に登録された顧客に一致する。registeredFromより前の日時は指定できない。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    registeredTo?: utcDateTime;

    @query
    @doc("顧客ステータスによる絞り込み(完全一致)")
    customerStatus?: CustomerStatusType;

    @query
    @doc("会員ランクによる絞り込み(完全一致)")
    membershipTier?: MembershipTierType;
  }

  // ============================================================================
  // The customer's own profile (customers, as the customer sees it)
  // ============================================================================

  @doc("""
    顧客本人のプロフィールのレスポンス - customers テーブルの行のうち、本人に見せるカラムだけを返す。
    スタッフ用の項目(internalNotes、notes、tags、customerStatus、isActive、referredBy、
    noShowCount、cancellationCount)と userId は含まない。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model CustomerProfileResponse {
    @doc("顧客を一意に識別するID")
    id: CustomerId;

    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName: string;

    @doc("名のカナ表記。未登録の場合はnull")
    @maxLength(100)
    firstNameKana: string | null;

    @doc("姓のカナ表記。未登録の場合はnull")
    @maxLength(100)
    lastNameKana: string | null;

    @doc("メールアドレス。アカウントのメールアドレスと同じで、プロフィールからは変更できない")
    @maxLength(255)
    email: string;

    @doc("主要連絡先として利用する電話番号")
    @maxLength(20)
    phoneNumber: string;

    @doc("緊急連絡用などの予備電話番号。未登録の場合はnull")
    @maxLength(20)
    alternativePhone: string | null;

    @doc("郵便番号。未登録の場合はnull")
    @maxLength(10)
    postalCode: string | null;

    @doc("都道府県名。未登録の場合はnull")
    @maxLength(50)
    prefecture: string | null;

    @doc("市区町村名。未登録の場合はnull")
    @maxLength(100)
    city: string | null;

    @doc("町名・番地。未登録の場合はnull")
    @maxLength(255)
    address: string | null;

    @doc("建物名・部屋番号。未登録の場合はnull")
    @maxLength(255)
    building: string | null;

    @doc("生年月日。1900-01-01以降で、未来の日付は指定できない。未登録の場合はnull")
    birthDate: plainDate | null;

    @doc("性別。未登録または非公開の場合はnull")
    gender: CustomerGenderType | null;

    @doc("職業。未登録の場合はnull")
    @maxLength(100)
    occupation: string | null;

    @doc("会員ランク。本人は変更できない")
    membershipTier: MembershipTierType;

    @doc("現在のロイヤルティポイント")
    loyaltyPoints: int32;

    @doc("好みや要望。未設定の場合はnull")
    preferences: CustomerBasicPreferences | null;

    @doc("ほかの人を紹介するときに使う紹介コード。未発行の場合はnull")
    @maxLength(50)
    referralCode: string | null;

    @doc("初回来店日。完了(completed)した予約の来店日のうち最も早い日。来店がない場合はnull")
    firstVisitDate: plainDate | null;

    @doc("最終来店日。完了(completed)した予約の来店日のうち最も遅い日。来店がない場合はnull")
    lastVisitDate: plainDate | null;

    @doc("総来店回数。完了(completed)した予約の数")
    visitCount: int32;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail: boolean;

    @doc("髪質タイプ。サロンが記録する。未登録の場合はnull")
    hairType: HairType | null;

    @doc("髪の太さ。サロンが記録する。未登録の場合はnull")
    hairThickness: HairThicknessType | null;

    @doc("頭皮の状態。サロンが記録する。未登録の場合はnull")
    scalpCondition: ScalpConditionType | null;

    @doc("レコード作成日時(顧客の登録日時)")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    顧客本人のプロフィールの作成リクエスト - ログインしているアカウントの顧客レコードを作る。
    メールアドレスはアカウントのものを使うので、リクエストには含めない。
    会員ランクやスタッフ用の項目は指定できない
    """)
  model CustomerProfileCreateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName: string;

    @doc("名のカナ表記。未登録の場合はnull")
    @maxLength(100)
    firstNameKana: string | null;

    @doc("姓のカナ表記。未登録の場合はnull")
    @maxLength(100)
    lastNameKana: string | null;

    @doc("主要連絡先として利用する電話番号")
    @maxLength(20)
    phoneNumber: string;

    @doc("緊急連絡用などの予備電話番号。未登録の場合はnull")
    @maxLength(20)
    alternativePhone: string | null;

    @doc("郵便番号。未登録の場合はnull")
    @maxLength(10)
    postalCode: string | null;

    @doc("都道府県名。未登録の場合はnull")
    @maxLength(50)
    prefecture: string | null;

    @doc("市区町村名。未登録の場合はnull")
    @maxLength(100)
    city: string | null;

    @doc("町名・番地。未登録の場合はnull")
    @maxLength(255)
    address: string | null;

    @doc("建物名・部屋番号。未登録の場合はnull")
    @maxLength(255)
    building: string | null;

    @doc("生年月日。1900-01-01以降で、未来の日付は指定できない。未登録の場合はnull")
    birthDate: plainDate | null;

    @doc("性別。未登録または非公開の場合はnull")
    gender: CustomerGenderType | null;

    @doc("職業。未登録の場合はnull")
    @maxLength(100)
    occupation: string | null;

    @doc("好みや要望。未設定の場合はnull")
    preferences: CustomerBasicPreferences | null;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail: boolean;
  }

  @doc("""
    顧客本人のプロフィールの部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    メールアドレス、会員ランク、スタッフ用の項目は変更できない
    """)
  model CustomerProfileUpdateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName?: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName?: string;

    @doc("名のカナ表記。未登録の場合はnull")
    @maxLength(100)
    firstNameKana?: string | null;

    @doc("姓のカナ表記。未登録の場合はnull")
    @maxLength(100)
    lastNameKana?: string | null;

    @doc("主要連絡先として利用する電話番号")
    @maxLength(20)
    phoneNumber?: string;

    @doc("緊急連絡用などの予備電話番号。未登録の場合はnull")
    @maxLength(20)
    alternativePhone?: string | null;

    @doc("郵便番号。未登録の場合はnull")
    @maxLength(10)
    postalCode?: string | null;

    @doc("都道府県名。未登録の場合はnull")
    @maxLength(50)
    prefecture?: string | null;

    @doc("市区町村名。未登録の場合はnull")
    @maxLength(100)
    city?: string | null;

    @doc("町名・番地。未登録の場合はnull")
    @maxLength(255)
    address?: string | null;

    @doc("建物名・部屋番号。未登録の場合はnull")
    @maxLength(255)
    building?: string | null;

    @doc("生年月日。1900-01-01以降で、未来の日付は指定できない。未登録の場合はnull")
    birthDate?: plainDate | null;

    @doc("性別。未登録または非公開の場合はnull")
    gender?: CustomerGenderType | null;

    @doc("職業。未登録の場合はnull")
    @maxLength(100)
    occupation?: string | null;

    @doc("好みや要望。未設定の場合はnull")
    preferences?: CustomerBasicPreferences | null;

    @doc("マーケティング配信を許可するかどうか")
    allowMarketing?: boolean;

    @doc("SMSでの連絡を許可するかどうか")
    allowSms?: boolean;

    @doc("メールでの連絡を許可するかどうか")
    allowEmail?: boolean;
  }

  // ============================================================================
  // Customer preferences (customer_preferences)
  // ============================================================================

  @doc("""
    スタイルの好み - customer_preferences.stylePreferences(jsonb) に保存する構造。
    一覧は null にならない。1つもない場合は空配列
    """)
  model StylePreference {
    @doc("希望の髪の長さ。特に希望がない場合はnull。空白だけの文字列は指定できない")
    preferredLength: string | null;

    @doc("希望のカラーの一覧。希望がない場合は空配列。空白だけの要素と、同じ要素の繰り返しは指定できない")
    preferredColors: string[];

    @doc("避けたいスタイルの一覧。ない場合は空配列。空白だけの要素と、同じ要素の繰り返しは指定できない")
    avoidStyles: string[];

    @doc("参考画像のURL(http または https、500文字まで)の一覧。ない場合は空配列。同じURLの繰り返しは指定できない")
    inspirationImages: string[];
  }

  @doc("""
    顧客の好み設定レスポンス - customer_preferences テーブルの1行。顧客ごとに最大1行。
    プロパティ名と null 許可は DB カラムと一致させている。行のない顧客の好み設定は、一覧が空配列で、ほかは null
    """)
  model CustomerPreferencesResponse {
    @doc("指名を希望するスタッフのID。指名がない場合はnull。保存したあとで削除されたスタッフのIDも、そのまま返す")
    preferredStaffId: StaffId | null;

    @doc("希望する時間帯の一覧。希望がない場合は空配列")
    preferredTimeSlots: TimeSlot[];

    @doc("避けたいスタッフのIDの一覧。ない場合は空配列。保存したあとで削除されたスタッフのIDも、そのまま返す")
    avoidStaffIds: StaffId[];

    @doc("スタイルの好み。設定がない場合はnull")
    stylePreferences: StylePreference | null;

    @doc("会話の多さなど、接客時のコミュニケーションの好み。特に希望がない場合はnull")
    communicationStyle: string | null;

    @doc("特別なリクエスト。特にない場合はnull")
    specialRequests: string | null;
  }

  @doc("""
    顧客の好み設定の部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアでき、一覧は空配列でクリアする。
    好み設定の行がまだない顧客には行を作り、指定しなかった項目は空(一覧は空配列、ほかは null)になる
    """)
  model CustomerPreferencesUpdateRequest {
    @doc("指名を希望するスタッフのID。削除されていないスタッフを指定する。避けたいスタッフ(avoidStaffIds)は指定できない。nullでクリア")
    preferredStaffId?: StaffId | null;

    @doc("希望する時間帯の一覧。指定した一覧で置き換える。各時間帯は開始が終了より前で、互いに重ならない")
    preferredTimeSlots?: TimeSlot[];

    @doc("避けたいスタッフのIDの一覧。指定した一覧で置き換える。削除されていないスタッフを指定する。同じIDの繰り返しと、指名を希望するスタッフ(preferredStaffId)は指定できない")
    avoidStaffIds?: StaffId[];

    @doc("スタイルの好み。指定した内容で、まとまりごと置き換える。nullでクリア")
    stylePreferences?: StylePreference | null;

    @doc("会話の多さなど、接客時のコミュニケーションの好み。空白だけの文字列は指定できない。nullでクリア")
    @maxLength(100)
    communicationStyle?: string | null;

    @doc("特別なリクエスト。空白だけの文字列は指定できない。nullでクリア")
    specialRequests?: string | null;
  }

  // ============================================================================
  // Bulk operations
  // ============================================================================

  @doc("""
    顧客一括取得リクエスト - 複数の顧客IDを指定してまとめて取得する
    """)
  model CustomerBatchGetRequest {
    @doc("取得する顧客のID一覧。1件以上100件以下で指定する。同じ ID を複数回指定できない")
    @minItems(1)
    @maxItems(100)
    ids: CustomerId[];
  }

  @doc("""
    顧客一括登録リクエスト - 複数の顧客をまとめて登録する。
    すべての顧客を1つのトランザクションで登録し、1件でも登録できない場合はどの顧客も登録しない
    """)
  model CustomerBulkCreateRequest {
    @doc("登録する顧客の一覧。1件以上100件以下で指定する")
    @minItems(1)
    @maxItems(100)
    items: CustomerCreateRequest[];
  }

  @doc("顧客一括登録の結果 - 登録した顧客の ID 一覧を返す")
  model CustomerBulkCreateResponse {
    @doc("登録した顧客の ID 一覧。リクエストの items と同じ順序で並ぶ")
    created: CustomerId[];
  }

  @doc("顧客一括更新の1件分 - 更新対象の顧客 ID と更新内容")
  model CustomerBulkUpdateItem {
    @doc("更新対象の顧客 ID")
    id: CustomerId;

    @doc("この顧客に適用する更新内容。指定した項目だけを更新する")
    updates: CustomerUpdateRequest;
  }

  @doc("""
    顧客一括更新リクエスト - 複数の顧客をそれぞれの更新内容で更新する。
    すべての顧客を1つのトランザクションで更新し、1件でも更新できない場合はどの顧客も更新しない
    """)
  model CustomerBulkUpdateRequest {
    @doc("更新対象と更新内容の一覧。1件以上100件以下で指定する。同じ顧客 ID を複数回指定できない")
    @minItems(1)
    @maxItems(100)
    items: CustomerBulkUpdateItem[];
  }

  @doc("顧客一括更新の結果 - 更新した顧客の ID 一覧を返す")
  model CustomerBulkUpdateResponse {
    @doc("更新した顧客の ID 一覧。リクエストの items と同じ順序で並ぶ")
    updated: CustomerId[];
  }

  @doc("""
    顧客一括削除リクエスト - 複数の顧客をまとめて論理削除する。
    すべての顧客を1つのトランザクションで削除し、1件でも削除できない場合はどの顧客も削除しない
    """)
  model CustomerBulkDeleteRequest {
    @doc("削除する顧客の ID 一覧。1件以上100件以下で指定する。同じ ID を複数回指定できない")
    @minItems(1)
    @maxItems(100)
    ids: CustomerId[];
  }

  @doc("顧客一括削除の結果 - 削除した顧客の ID 一覧を返す")
  model CustomerBulkDeleteResponse {
    @doc("削除した顧客の ID 一覧。リクエストの ids と同じ順序で並ぶ")
    deleted: CustomerId[];
  }

  // ============================================================================
  // Actions
  // ============================================================================

  @doc("""
    顧客統合リクエスト - 重複登録された2件の顧客レコードを1件に統合する
    """)
  model CustomerMergeRequest {
    @doc("統合後も残すメイン顧客ID")
    primaryCustomerId: CustomerId;

    @doc("統合して削除するサブ顧客ID。primaryCustomerId と異なる顧客を指定する")
    secondaryCustomerId: CustomerId;

    @doc("2件の顧客で値が異なる項目の優先ルール")
    conflictResolution: CustomerMergeConflictResolutionType;
  }

  @doc("""
    顧客データ削除要請リクエスト - 顧客本人からの個人データ削除の要請を受け付ける
    """)
  model CustomerDataDeletionRequest {
    @doc("削除を希望する理由")
    @minLength(1)
    reason: string;

    @doc("削除に伴う影響を理解しているか。true 以外は受け付けない")
    confirmed: boolean;
  }

  @doc("""
    顧客データ削除要請の受付結果 - 受け付けた削除要請と削除の予定を返す
    """)
  model CustomerDataDeletionResponse {
    @doc("削除リクエストID")
    requestId: string;

    @doc("予定される削除日時")
    scheduledDate: utcDateTime;

    @doc("猶予期間（日数）。この期間内であれば削除を取り消せる")
    gracePeriodDays: int32;
  }

  @doc("""
    顧客一覧エクスポートリクエスト - 一覧と同じ絞り込み条件に一致する顧客をファイルに出力する。
    全項目のキーが必須で、使わない絞り込み条件には null を指定する。条件はすべて AND で結合する
    """)
  model CustomerExportRequest {
    @doc("エクスポート形式")
    format: CustomerExportFormatType;

    @doc("出力する項目(CustomerResponse のプロパティ名)の一覧。nullの場合は全項目を出力する")
    exportFields: string[] | null;

    @doc("顧客名(姓・名とそのカナ表記)、メールアドレス、電話番号に対する部分一致キーワード(大文字小文字を区別しない)。nullの場合はキーワードで絞り込まない")
    @minLength(1)
    @maxLength(100)
    search: string | null;

    @doc("タグによる絞り込み。指定したタグをすべて持つ顧客に一致する。nullの場合はタグで絞り込まない")
    tags: string[] | null;

    @doc("登録日時(createdAt)の下限による絞り込み。この日時以降に登録された顧客に一致する。nullの場合は下限なし")
    registeredFrom: utcDateTime | null;

    @doc("登録日時(createdAt)の上限による絞り込み。この日時以前に登録された顧客に一致する。nullの場合は上限なし")
    registeredTo: utcDateTime | null;

    @doc("顧客ステータスによる絞り込み(完全一致)。nullの場合はステータスで絞り込まない")
    customerStatus: CustomerStatusType | null;

    @doc("会員ランクによる絞り込み(完全一致)。nullの場合は会員ランクで絞り込まない")
    membershipTier: MembershipTierType | null;
  }

  @doc("""
    顧客一覧エクスポートの受付結果 - 非同期で実行するエクスポートジョブの情報を返す
    """)
  model CustomerExportResponse {
    @doc("エクスポートジョブのID")
    jobId: string;

    @doc("ジョブの状態。受付直後は常にpending")
    status: "pending";

    @doc("完了までの推定所要時間（秒）。推定できない場合はnull")
    estimatedTime: int32 | null;
  }

  // ============================================================================
  // Statistics (bookings, booking_services, sales and payment_transactions,
  // counted at every request; no table of their own)
  // Amounts are integers in the currency of the salon (salons.currency)
  // ============================================================================

  @doc("""
    顧客統計の集計条件 - サロンと期間を指定する。予約は予約日(bookingDate)、売上は売上日(saleDate)で期間に入る。期間は両端を含み、366日まで
    """)
  model CustomerStatisticsGetRequest {
    @query
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("期間の最初の日。1900-01-01 から 2999-12-31 まで")
    startDate: plainDate;

    @query
    @doc("期間の最後の日。startDate 以降で、期間は startDate を含めて366日まで。1900-01-01 から 2999-12-31 まで")
    endDate: plainDate;
  }

  @doc("""
    顧客統計レスポンス - 顧客の、1つのサロンでの、期間の予約と売上を集計した結果。リクエストのたびに予約台帳と売上台帳から数え、記録しない
    """)
  model CustomerStatisticsResponse {
    @doc("対象の顧客 ID")
    customerId: CustomerId;

    @doc("対象サロン ID")
    salonId: SalonId;

    @doc("期間の最初の日")
    startDate: plainDate;

    @doc("期間の最後の日")
    endDate: plainDate;

    @doc("期間の予約の数。ステータスを問わない")
    totalBookings: int32;

    @doc("期間の、取り消していない売上の合計金額(totalAmount)の合計から、その決済取引の返金額(refundAmount)の合計を引いた額")
    totalSpent: int64;

    @doc("totalSpent のうち予約の会計(bookingId のある売上)の額を、その売上の件数で割った額(1円未満を切り捨て)。予約の会計がなければ0")
    averageBookingValue: int64;

    @doc("期間の完了(completed)した予約のうち、最後の予約の開始日時。なければnull")
    lastVisit: utcDateTime | null;

    @doc("期間の完了した予約の施術明細のサービスの上位5件。bookingCount の多い順、同じならサービス ID の順。削除したサービスも含む")
    favoriteServices: CustomerStatisticsServiceResponse[];

    @doc("期間の完了した予約の担当スタッフの上位5人。bookingCount の多い順、同じならスタッフ ID の順。削除したスタッフも含む")
    favoriteStaff: CustomerStatisticsStaffResponse[];

    @doc("顧客のいまのポイントの残高。サロンと期間によらない")
    loyaltyPoints: int32;

    @doc("顧客を台帳に登録した日時")
    customerSince: utcDateTime;

    @doc("cancelled の予約の数を totalBookings で割った百分率(小数第1位に四捨五入)。予約がなければ0")
    cancellationRate: float32;

    @doc("no_show の予約の数を totalBookings で割った百分率(小数第1位に四捨五入)。予約がなければ0")
    noShowRate: float32;
  }

  @doc("顧客統計のサービス - 期間の完了した予約で受けたサービス")
  model CustomerStatisticsServiceResponse {
    @doc("サービス ID")
    serviceId: ServiceId;

    @doc("サービスのいまの名前")
    name: string;

    @doc("そのサービスを施術明細に含む、期間の完了した予約の数")
    bookingCount: int32;
  }

  @doc("顧客統計のスタッフ - 期間の完了した予約の担当スタッフ")
  model CustomerStatisticsStaffResponse {
    @doc("スタッフ ID")
    staffId: StaffId;

    @doc("スタッフのいまの表示名")
    displayName: string;

    @doc("そのスタッフが担当した(bookings.staffId)、期間の完了した予約の数")
    bookingCount: int32;
  }

  // ============================================================================
  // Versions (customer_versions)
  // ============================================================================

  @doc("""
    顧客の変更履歴の一覧リクエスト - ページネーションを指定する
    """)
  model CustomerVersionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor`(その顧客の版の ID)を指定する")
    cursor?: string;
  }

  @doc("変更履歴の 1 項目の変更内容 - 前の版と値の違う台帳の項目と、変更前後の値")
  model CustomerVersionChangeResponse {
    @doc("台帳の項目の名前(顧客のレスポンスのプロパティ名)")
    field: string;

    @doc("前の版の値。顧客のレスポンスと同じ表し方。値がなかった場合はnull")
    oldValue: unknown | null;

    @doc("この版の値。顧客のレスポンスと同じ表し方。値がなくなった場合はnull")
    newValue: unknown | null;
  }

  @doc("""
    顧客の変更履歴の 1 項目 - customer_versions の 1 行の、誰がいつどの操作をしたかと、前の版から変わった項目
    """)
  model CustomerHistoryEntryResponse {
    @doc("版の ID")
    id: CustomerVersionId;

    @doc("顧客 ID")
    customerId: CustomerId;

    @doc("版の番号。顧客ごとに 1 から数える")
    version: int32;

    @doc("版を作った操作")
    operation: CustomerVersionOperationType;

    @doc("操作したユーザーの ID。記録を始める前の値(baseline)の場合はnull")
    changedBy: UserId | null;

    @doc("操作した日時")
    changedAt: utcDateTime;

    @doc("前の版と値の違う台帳の項目(顧客のレスポンスのプロパティの順)。update の版のときだけ返し、ほかの操作と、前の版がない版の場合はnull")
    changes: CustomerVersionChangeResponse[] | null;
  }

  @doc("""
    顧客の版 - customer_versions の 1 行。その版の時点の、顧客台帳の 30 項目の値。
    来店回数やポイントなど、予約やポイントが変える値と、アカウントとの紐づけは、台帳の項目ではないので含まない
    """)
  model CustomerVersionResponse {
    @doc("版の ID")
    id: CustomerVersionId;

    @doc("顧客 ID")
    customerId: CustomerId;

    @doc("版の番号。顧客ごとに 1 から数える")
    version: int32;

    @doc("版を作った操作")
    operation: CustomerVersionOperationType;

    @doc("操作したユーザーの ID。記録を始める前の値(baseline)の場合はnull")
    changedBy: UserId | null;

    @doc("操作した日時")
    changedAt: utcDateTime;

    ...PickProperties<
      CustomerResponse,
      | "firstName"
      | "lastName"
      | "firstNameKana"
      | "lastNameKana"
      | "email"
      | "phoneNumber"
      | "alternativePhone"
      | "postalCode"
      | "prefecture"
      | "city"
      | "address"
      | "building"
      | "birthDate"
      | "gender"
      | "occupation"
      | "membershipTier"
      | "preferences"
      | "notes"
      | "internalNotes"
      | "tags"
      | "referredBy"
      | "referralCode"
      | "allowMarketing"
      | "allowSms"
      | "allowEmail"
      | "isActive"
      | "hairType"
      | "hairThickness"
      | "scalpCondition"
      | "customerStatus"
    >;
  }
}
