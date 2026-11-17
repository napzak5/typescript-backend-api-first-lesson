import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    在庫移動種別区分 - 在庫数を増減させた操作の種類を表す区分
    
    purchase: 仕入 - 仕入先から商品を受け入れた入庫
    sale: 販売 - 顧客への店頭販売による出庫
    use: 施術使用 - 施術の材料として消費した出庫
    adjustment: 調整 - 棚卸差異や破損などの補正による増減
    return: 返品 - 仕入先への返品または顧客からの返品による増減
    disposal: 廃棄 - 期限切れや破損による廃棄
    transfer: 移動 - ほかの保管場所・店舗との間の移動による増減
    """)
  enum InventoryTransactionType {
    purchase,
    sale,
    use,
    adjustment,
    `return`,
    disposal,
    transfer,
  }

  @doc("""
    在庫アラート種別区分 - 在庫に対して発生するアラートの種類
    
    low_stock: 在庫僅少 - 在庫数が閾値を下回った状態
    expiring: 期限間近 - 使用期限が近づいている状態
    expired: 期限切れ - 使用期限を過ぎた状態
    overstock: 過剰在庫 - 在庫数が上限を超えた状態
    """)
  enum InventoryAlertType {
    low_stock,
    expiring,
    expired,
    overstock,
  }

  @doc("""
    アラート重要度区分 - 在庫アラートの重要度
    
    info: 情報 - 対応を急がない通知
    warning: 警告 - 早めの対応が必要な通知
    critical: 重大 - 直ちに対応が必要な通知
    """)
  enum InventoryAlertSeverityType {
    info,
    warning,
    critical,
  }

  @doc("""
    商品レスポンス - products テーブルの、削除日時(deletedAt)以外の全カラムを返す。1行はサロンが店頭で売る、または施術で使う1つの商品を表す。
    プロパティ名と null 許可は DB カラムと一致させている。
    在庫数の3つの値は、null でないものの間で minimumStock ≦ reorderPoint ≦ maximumStock の順に並ぶ
    """)
  model ProductResponse {
    @doc("商品 ID")
    id: ProductId;

    @doc("商品を持つサロン ID")
    salonId: SalonId;

    @doc("商品コード。サロンの削除されていない商品の間で一意")
    productCode: string;

    @doc("商品名")
    name: string;

    @doc("説明。未設定の場合はnull")
    description: string | null;

    @doc("商品カテゴリ。在庫評価額をカテゴリ別に集計する単位。未設定の場合はnull")
    category: string | null;

    @doc("ブランド。未設定の場合はnull")
    brand: string | null;

    @doc("仕入価格(円)。未設定の場合はnull")
    purchasePrice: int32 | null;

    @doc("希望小売価格(定価、円)。未設定の場合はnull")
    retailPrice: int32 | null;

    @doc("サロンの店頭での販売価格(円)。未設定の場合はnull")
    salonPrice: int32 | null;

    @doc("数量の単位(本、ml など)")
    unit: string;

    @doc("最低在庫数。在庫数がこれを下回らないように発注する")
    minimumStock: float64;

    @doc("最大在庫数。未設定の場合はnull")
    maximumStock: float64 | null;

    @doc("発注点。在庫数がこれ以下になったら発注する。未設定の場合はnull")
    reorderPoint: float64 | null;

    @doc("仕入先の名前。未設定の場合はnull")
    supplier: string | null;

    @doc("仕入先の商品コード。未設定の場合はnull")
    supplierProductCode: string | null;

    @doc("発注から納品までの日数。未設定の場合はnull")
    leadTimeDays: int32 | null;

    @doc("商品画像の URL。未設定の場合はnull")
    imageUrl: string | null;

    @doc("バーコード。未設定の場合はnull")
    barcode: string | null;

    @doc("店頭で販売する商品か")
    isForSale: boolean;

    @doc("施術で使う商品か")
    isForTreatment: boolean;

    @doc("在庫をロット番号で分けて管理するか")
    requiresLotTracking: boolean;

    @doc("使用期限までの月数の目安。未設定の場合はnull")
    expiryMonths: int32 | null;

    @doc("保管条件。未設定の場合はnull")
    storageConditions: string | null;

    @doc("安全データシート(SDS)の URL。未設定の場合はnull")
    safetyDataSheet: string | null;

    @doc("取り扱い中か。取り扱いをやめた商品は false")
    isActive: boolean;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    商品新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    商品を持つサロンはパスの salonId で指定する。文字列は、空白だけの文字列を指定できない。
    在庫数の3つの値は、null でないものの間で minimumStock ≦ reorderPoint ≦ maximumStock の順に指定する
    """)
  model ProductCreateRequest {
    @doc("商品コード。サロンの削除されていない商品の間で一意")
    @minLength(1)
    @maxLength(100)
    productCode: string;

    @doc("商品名")
    @minLength(1)
    @maxLength(255)
    name: string;

    @doc("説明。未設定の場合はnull")
    description: string | null;

    @doc("商品カテゴリ。未設定の場合はnull")
    @maxLength(100)
    category: string | null;

    @doc("ブランド。未設定の場合はnull")
    @maxLength(100)
    brand: string | null;

    @doc("仕入価格(円)。未設定の場合はnull")
    @minValue(0)
    purchasePrice: int32 | null;

    @doc("希望小売価格(定価、円)。未設定の場合はnull")
    @minValue(0)
    retailPrice: int32 | null;

    @doc("サロンの店頭での販売価格(円)。未設定の場合はnull")
    @minValue(0)
    salonPrice: int32 | null;

    @doc("数量の単位(本、ml など)")
    @minLength(1)
    @maxLength(20)
    unit: string;

    @doc("最低在庫数。小数第2位まで")
    @minValue(0)
    @maxValue(99999999.99)
    minimumStock: float64;

    @doc("最大在庫数。小数第2位まで。minimumStock 以上。未設定の場合はnull")
    @minValue(0)
    @maxValue(99999999.99)
    maximumStock: float64 | null;

    @doc("発注点。小数第2位まで。minimumStock 以上、maximumStock 以下。未設定の場合はnull")
    @minValue(0)
    @maxValue(99999999.99)
    reorderPoint: float64 | null;

    @doc("仕入先の名前。未設定の場合はnull")
    @maxLength(255)
    supplier: string | null;

    @doc("仕入先の商品コード。未設定の場合はnull")
    @maxLength(100)
    supplierProductCode: string | null;

    @doc("発注から納品までの日数。未設定の場合はnull")
    @minValue(0)
    leadTimeDays: int32 | null;

    @doc("商品画像の URL(http または https)。未設定の場合はnull")
    @maxLength(500)
    imageUrl: string | null;

    @doc("バーコード。未設定の場合はnull")
    @maxLength(100)
    barcode: string | null;

    @doc("店頭で販売する商品か")
    isForSale: boolean;

    @doc("施術で使う商品か")
    isForTreatment: boolean;

    @doc("在庫をロット番号で分けて管理するか")
    requiresLotTracking: boolean;

    @doc("使用期限までの月数の目安。未設定の場合はnull")
    @minValue(1)
    expiryMonths: int32 | null;

    @doc("保管条件。未設定の場合はnull")
    storageConditions: string | null;

    @doc("安全データシート(SDS)の URL(http または https)。未設定の場合はnull")
    @maxLength(500)
    safetyDataSheet: string | null;

    @doc("取り扱い中か")
    isActive: boolean;
  }

  @doc("""
    商品部分更新リクエスト - 指定した項目だけを更新する。項目を1つも指定しないリクエストは受け付けない。
    DB で NULL 許可のカラムは null でクリアできる。商品を持つサロンは変更できない。
    在庫数の3つの値は、更新後の値の間で minimumStock ≦ reorderPoint ≦ maximumStock の順に並ぶ
    """)
  model ProductUpdateRequest {
    @doc("商品コード。サロンの削除されていない商品の間で一意")
    @minLength(1)
    @maxLength(100)
    productCode?: string;

    @doc("商品名")
    @minLength(1)
    @maxLength(255)
    name?: string;

    @doc("説明。nullでクリア")
    description?: string | null;

    @doc("商品カテゴリ。nullでクリア")
    @maxLength(100)
    category?: string | null;

    @doc("ブランド。nullでクリア")
    @maxLength(100)
    brand?: string | null;

    @doc("仕入価格(円)。nullでクリア")
    @minValue(0)
    purchasePrice?: int32 | null;

    @doc("希望小売価格(定価、円)。nullでクリア")
    @minValue(0)
    retailPrice?: int32 | null;

    @doc("サロンの店頭での販売価格(円)。nullでクリア")
    @minValue(0)
    salonPrice?: int32 | null;

    @doc("数量の単位(本、ml など)")
    @minLength(1)
    @maxLength(20)
    unit?: string;

    @doc("最低在庫数。小数第2位まで")
    @minValue(0)
    @maxValue(99999999.99)
    minimumStock?: float64;

    @doc("最大在庫数。小数第2位まで。nullでクリア")
    @minValue(0)
    @maxValue(99999999.99)
    maximumStock?: float64 | null;

    @doc("発注点。小数第2位まで。nullでクリア")
    @minValue(0)
    @maxValue(99999999.99)
    reorderPoint?: float64 | null;

    @doc("仕入先の名前。nullでクリア")
    @maxLength(255)
    supplier?: string | null;

    @doc("仕入先の商品コード。nullでクリア")
    @maxLength(100)
    supplierProductCode?: string | null;

    @doc("発注から納品までの日数。nullでクリア")
    @minValue(0)
    leadTimeDays?: int32 | null;

    @doc("商品画像の URL(http または https)。nullでクリア")
    @maxLength(500)
    imageUrl?: string | null;

    @doc("バーコード。nullでクリア")
    @maxLength(100)
    barcode?: string | null;

    @doc("店頭で販売する商品か")
    isForSale?: boolean;

    @doc("施術で使う商品か")
    isForTreatment?: boolean;

    @doc("在庫をロット番号で分けて管理するか")
    requiresLotTracking?: boolean;

    @doc("使用期限までの月数の目安。nullでクリア")
    @minValue(1)
    expiryMonths?: int32 | null;

    @doc("保管条件。nullでクリア")
    storageConditions?: string | null;

    @doc("安全データシート(SDS)の URL(http または https)。nullでクリア")
    @maxLength(500)
    safetyDataSheet?: string | null;

    @doc("取り扱い中か")
    isActive?: boolean;
  }

  @doc("""
    商品一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model ProductSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("商品名・商品コード・ブランドに対する部分一致キーワード(大文字小文字を区別しない)")
    @minLength(1)
    @maxLength(100)
    keyword?: string;

    @query
    @doc("商品カテゴリによる絞り込み(完全一致)")
    @minLength(1)
    @maxLength(100)
    category?: string;

    @query
    @doc("バーコードによる絞り込み(完全一致)")
    @minLength(1)
    @maxLength(100)
    barcode?: string;

    @query
    @doc("取り扱い中かどうかによる絞り込み。指定しない場合は取り扱いをやめた商品も返す")
    isActive?: boolean;

    @query
    @doc("店頭で販売する商品かどうかによる絞り込み")
    isForSale?: boolean;

    @query
    @doc("施術で使う商品かどうかによる絞り込み")
    isForTreatment?: boolean;
  }

  @doc("""
    在庫レスポンス - inventory テーブルの全カラムを返す。1行はサロンにおける1商品の1ロットの在庫を表し、salonId・productId・lotNumber の組はサロンの在庫の間で一意(lotNumber が null の行も1つまで)。
    プロパティ名と null 許可は DB カラムと一致させている。
    在庫数(currentStock・availableStock・reservedStock)は在庫移動と棚卸によってのみ変わる
    """)
  model InventoryResponse {
    @doc("在庫 ID")
    id: InventoryId;

    @doc("在庫を管理するサロン ID")
    salonId: SalonId;

    @doc("在庫の対象となる商品 ID")
    productId: ProductId;

    @doc("現在の在庫数量")
    currentStock: float64;

    @doc("引当中の数量を除いた、利用できる在庫数量。常に currentStock - reservedStock")
    availableStock: float64;

    @doc("引当済み(予約済み)の在庫数量。0以上 currentStock 以下。引当を記録するオペレーションはなく、APIで登録した在庫では0")
    reservedStock: float64;

    @doc("ロット番号。ロット管理をしない場合はnull")
    lotNumber: string | null;

    @doc("使用期限。期限のない場合はnull")
    expiryDate: plainDate | null;

    @doc("サロン内の保管場所。未設定の場合はnull")
    location: string | null;

    @doc("保管場所内の棚番号。未設定の場合はnull")
    shelf: string | null;

    @doc("最後に棚卸を行った日時。棚卸をしていない場合はnull")
    lastCountedAt: utcDateTime | null;

    @doc("最後に棚卸を行ったスタッフ ID。棚卸をしていない場合はnull")
    lastCountedBy: StaffId | null;

    @doc("備考メモ。未設定の場合はnull")
    notes: string | null;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    在庫新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    在庫数は0で登録され、入庫は在庫移動(movement)で記録する。文字列は空白だけのものを指定できない
    """)
  model InventoryCreateRequest {
    @doc("在庫を追加するサロン ID。削除されていないサロンを指定する")
    salonId: SalonId;

    @doc("在庫の対象となる商品 ID。salonId のサロンの、削除されていない商品を指定する")
    productId: ProductId;

    @doc("ロット番号。同じサロン・商品の在庫の間で一意。商品の requiresLotTracking が true なら必須、false なら null")
    @maxLength(100)
    lotNumber: string | null;

    @doc("使用期限。期限のない場合はnull")
    expiryDate: plainDate | null;

    @doc("サロン内の保管場所。未設定の場合はnull")
    @maxLength(100)
    location: string | null;

    @doc("保管場所内の棚番号。未設定の場合はnull")
    @maxLength(50)
    shelf: string | null;

    @doc("備考メモ。未設定の場合はnull")
    notes: string | null;
  }

  @doc("""
    在庫部分更新リクエスト - 指定した項目だけを更新し、1つ以上の項目を指定する。DB で NULL 許可のカラムは null でクリアできる。
    在庫数は変更できない(在庫移動と棚卸で変更する)。サロンと商品も変更できない。文字列は空白だけのものを指定できない
    """)
  model InventoryUpdateRequest {
    @doc("ロット番号。同じサロン・商品の在庫の間で一意。商品の requiresLotTracking が true なら null にできず、false なら null だけを指定できる")
    @maxLength(100)
    lotNumber?: string | null;

    @doc("使用期限。nullでクリア")
    expiryDate?: plainDate | null;

    @doc("サロン内の保管場所。nullでクリア")
    @maxLength(100)
    location?: string | null;

    @doc("保管場所内の棚番号。nullでクリア")
    @maxLength(50)
    shelf?: string | null;

    @doc("備考メモ。nullでクリア")
    notes?: string | null;
  }

  @doc("""
    在庫一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model InventorySearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("在庫を管理するサロンの ID による絞り込み(完全一致)。省略すると、サロンのユーザーには所属サロンの在庫、管理者にはすべてのサロンの在庫を返す")
    salonId?: SalonId;

    @query
    @doc("商品の ID による絞り込み(完全一致)")
    productId?: ProductId;

    @query
    @doc("ロット番号による絞り込み(完全一致)")
    @minLength(1)
    @maxLength(100)
    lotNumber?: string;
  }

  @doc("""
    在庫僅少一覧リクエスト - 取り扱い中の商品のうち、サロンにある在庫数の合計が閾値以下の商品の在庫を、ページネーションを指定して取得する
    """)
  model InventoryLowStockSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("在庫僅少とみなす在庫数の閾値。商品ごとに、サロンにあるその商品の在庫の currentStock の合計がこの値以下なら、その商品の在庫に一致する。省略時は商品ごとの最低在庫数(minimumStock)を使う")
    @minValue(0)
    @maxValue(99999999.99)
    threshold?: float64;
  }

  @doc("""
    期限間近一覧リクエスト - 使用期限が近く、在庫数が0より多い在庫をページネーションを指定して取得する
    """)
  model InventoryExpiringSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("サロンのタイムゾーンでの今日から何日後までに使用期限を迎える在庫を対象とするか (0〜365、両端を含む)。期限切れの在庫も含む")
    @minValue(0)
    @maxValue(365)
    days?: int32 = 30;
  }

  @doc("""
    在庫移動レスポンス - inventory_transactions テーブルの全カラムを返す。1行は在庫数を増減させた1回の操作を表し、作成後は変更されない。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model InventoryTransactionResponse {
    @doc("在庫移動 ID")
    id: InventoryTransactionId;

    @doc("処理を行ったサロン ID")
    salonId: SalonId;

    @doc("対象の商品 ID")
    productId: ProductId;

    @doc("対象在庫 ID。対象の在庫が削除された場合はnull")
    inventoryId: InventoryId | null;

    @doc("在庫操作区分")
    transactionType: InventoryTransactionType;

    @doc("操作した数量。在庫数の増減量で、入庫は正、出庫は負の値")
    quantity: float64;

    @doc("操作前の在庫数量")
    balanceBefore: float64;

    @doc("操作後の在庫数量")
    balanceAfter: float64;

    @doc("単価(円)。未設定の場合はnull")
    unitCost: int32 | null;

    @doc("金額(円)。unitCost と quantity の絶対値の積を四捨五入した値。単価が未設定の場合はnull")
    totalCost: int32 | null;

    @doc("関連する記録の種別 (例: purchase_order、treatment_record)。関連する記録がない場合はnull")
    referenceType: string | null;

    @doc("関連する外部参照 ID。referenceType の記録の ID。関連する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("操作時点の対象在庫のロット番号。ロット管理をしない場合はnull")
    lotNumber: string | null;

    @doc("操作時点の対象在庫の使用期限。期限のない場合はnull")
    expiryDate: plainDate | null;

    @doc("操作理由。未設定の場合はnull")
    reason: string | null;

    @doc("操作を担当したスタッフ ID。未設定の場合はnull")
    performedBy: StaffId | null;

    @doc("操作日時")
    createdAt: utcDateTime;
  }

  @doc("""
    在庫移動一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model InventoryTransactionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("在庫操作区分による絞り込み(完全一致)")
    transactionType?: InventoryTransactionType;

    @query
    @doc("検索対象期間の開始日時。操作日時(createdAt)がこの日時以降の在庫移動に一致する")
    startDate?: utcDateTime;

    @query
    @doc("検索対象期間の終了日時。操作日時(createdAt)がこの日時より前の在庫移動に一致する")
    endDate?: utcDateTime;
  }

  @doc("""
    在庫移動記録リクエスト - 1件の在庫移動(inventory_transactions の行)を記録し、対象在庫の在庫数を増減する。
    全項目のキーが必須。salonId・productId・lotNumber・expiryDate は対象在庫から、
    balanceBefore・balanceAfter・totalCost はサーバーが設定する
    """)
  model InventoryMovementRequest {
    @doc("対象在庫 ID")
    inventoryId: InventoryId;

    @doc("在庫操作区分")
    transactionType: InventoryTransactionType;

    @doc("""
      操作数量。在庫数の増減量で、入庫は正、出庫は負の値で指定する。0は指定できない。
      purchase は正、sale・use・disposal は負でなければならない
      """)
    @minValue(-99999999.99)
    @maxValue(99999999.99)
    quantity: float64;

    @doc("単価(円)。未設定の場合はnull")
    @minValue(0)
    unitCost: int32 | null;

    @doc("関連する記録の種別 (例: purchase_order、treatment_record)。関連する記録がない場合はnull")
    @maxLength(50)
    referenceType: string | null;

    @doc("関連する外部参照 ID。referenceType の記録の ID。関連する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("操作理由。未設定の場合はnull")
    reason: string | null;
  }

  @doc("棚卸で数えた1件の在庫の数量")
  model InventoryStockCountItem {
    @doc("棚卸した在庫 ID")
    inventoryId: InventoryId;

    @doc("実際に数えた在庫数量")
    @minValue(0)
    @maxValue(99999999.99)
    countedQuantity: float64;
  }

  @doc("""
    棚卸リクエスト - 数えた在庫数量を登録する。全項目のキーが必須。
    すべての在庫を1つのトランザクションで処理し、1件でも処理できない場合はどの在庫も更新しない
    """)
  model InventoryStockCountRequest {
    @doc("棚卸を行うサロン ID")
    salonId: SalonId;

    @doc("棚卸した在庫の一覧。salonId のサロンの在庫を1件以上500件以下で、同じ在庫を重複せずに指定する")
    @minItems(1)
    @maxItems(500)
    items: InventoryStockCountItem[];

    @doc("棚卸の補足。差異を調整する在庫移動の reason に記録する。補足がない場合はnull")
    reason: string | null;
  }

  @doc("棚卸で見つかった1件の在庫の差異")
  model InventoryStockCountDiscrepancy {
    @doc("差異のあった在庫 ID")
    inventoryId: InventoryId;

    @doc("棚卸前の在庫数量(currentStock)")
    expected: float64;

    @doc("実際に数えた在庫数量")
    counted: float64;

    @doc("差異(counted - expected)")
    difference: float64;
  }

  @doc("棚卸の結果 - 記録した調整の在庫移動と、差異の一覧を返す")
  model InventoryStockCountResponse {
    @doc("差異を調整するために記録した在庫移動(transactionType が adjustment)の一覧。差異がない場合は空配列")
    adjustments: InventoryTransactionResponse[];

    @doc("差異のあった在庫の一覧。差異がない場合は空配列")
    discrepancies: InventoryStockCountDiscrepancy[];
  }

  @doc("在庫評価額レポートリクエスト - 対象のサロンとカテゴリを指定する")
  model InventoryValueReportRequest {
    @query
    @doc("対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("商品カテゴリによる絞り込み(完全一致)")
    @minLength(1)
    @maxLength(100)
    category?: string;
  }

  @doc("在庫評価額レポートのカテゴリ別の集計")
  model InventoryValueReportCategory {
    @doc("商品カテゴリ。カテゴリ未設定の商品の集計の場合はnull")
    category: string | null;

    @doc("カテゴリの在庫評価額(円)")
    value: float64;

    @doc("カテゴリの在庫品目数")
    itemCount: int32;
  }

  @doc("""
    在庫評価額レポート - 在庫数量に商品の仕入価格(purchasePrice)を掛けた評価額を集計する。
    仕入価格が未設定の商品は評価額0として数える
    """)
  model InventoryValueReportResponse {
    @doc("在庫評価額の合計(円)")
    totalValue: float64;

    @doc("集計した在庫品目数")
    totalItems: int32;

    @doc("カテゴリ別の集計")
    categories: InventoryValueReportCategory[];
  }

  @doc("""
    仕入れ発注の明細 - 発注作成リクエストと発注レスポンスの両方で使う。全項目のキーが必須
    """)
  model PurchaseOrderItem {
    @doc("紐づく在庫 ID")
    inventoryId: InventoryId;

    @doc("商品コード")
    @minLength(1)
    productCode: string;

    @doc("商品名")
    @minLength(1)
    productName: string;

    @doc("発注数量")
    @minValueExclusive(0)
    quantity: float64;

    @doc("数量単位")
    @minLength(1)
    unit: string;

    @doc("単価")
    @minValue(0)
    unitPrice: float64;

    @doc("明細ごとの金額")
    @minValue(0)
    totalPrice: float64;

    @doc("備考メモ。未設定の場合はnull")
    notes: string | null;
  }

  @doc("""
    仕入れ発注レスポンス - 発注の基本情報と明細を返す
    """)
  model PurchaseOrderResponse {
    @doc("発注 ID")
    id: OrderId;

    @doc("発注を行うサロン ID")
    salonId: SalonId;

    @doc("発注番号。登録時にサーバーが採番する")
    orderNumber: string;

    @doc("仕入先名")
    supplier: string;

    @doc("発注ステータス区分")
    status: OrderStatusType;

    @doc("発注明細の一覧")
    items: PurchaseOrderItem[];

    @doc("税抜小計金額")
    subtotal: float64;

    @doc("税額")
    taxAmount: float64;

    @doc("送料。送料がかからない場合はnull")
    shippingCost: float64 | null;

    @doc("発注合計金額")
    totalAmount: float64;

    @doc("発注日")
    orderDate: utcDateTime;

    @doc("予定納期。未定の場合はnull")
    expectedDelivery: utcDateTime | null;

    @doc("実際の納品日。納品前の場合はnull")
    actualDelivery: utcDateTime | null;

    @doc("納品に関するメモ。未設定の場合はnull")
    deliveryNotes: string | null;

    @doc("支払条件。未設定の場合はnull")
    paymentTerms: string | null;

    @doc("その他備考。未設定の場合はnull")
    notes: string | null;

    @doc("発注承認を行ったスタッフ ID。承認前の場合はnull")
    approvedBy: StaffId | null;

    @doc("承認日時。承認前の場合はnull")
    approvedAt: utcDateTime | null;

    ...AuditInfo;
  }

  @doc("""
    仕入れ発注作成リクエスト - 全項目のキーが必須。null を指定できる項目は未設定を表す。
    作成した発注のステータスは draft になる
    """)
  model PurchaseOrderCreateRequest {
    @doc("発注を行うサロン ID")
    salonId: SalonId;

    @doc("仕入先名")
    @minLength(1)
    supplier: string;

    @doc("発注明細一覧。salonId のサロンの在庫を1件以上指定する")
    @minItems(1)
    items: PurchaseOrderItem[];

    @doc("税額")
    @minValue(0)
    taxAmount: float64;

    @doc("送料。送料がかからない場合はnull")
    @minValue(0)
    shippingCost: float64 | null;

    @doc("予定納期。未定の場合はnull")
    expectedDelivery: utcDateTime | null;

    @doc("支払条件。未設定の場合はnull")
    paymentTerms: string | null;

    @doc("備考メモ。未設定の場合はnull")
    notes: string | null;
  }

  @doc("""
    仕入れ発注部分更新リクエスト - 指定した項目だけを更新する。null を指定できる項目は null でクリアできる
    """)
  model PurchaseOrderUpdateRequest {
    @doc("""
      更新後の発注ステータス。変更できるのは draft→pending、approved→ordered、ordered→shipped の遷移のみ。
      approved・cancelled・delivered への遷移はそれぞれ approve・cancel・receive で行う
      """)
    status?: OrderStatusType;

    @doc("更新後の予定納期。nullでクリア")
    expectedDelivery?: utcDateTime | null;

    @doc("実際の納品日。nullでクリア")
    actualDelivery?: utcDateTime | null;

    @doc("納品関連の備考。nullでクリア")
    deliveryNotes?: string | null;

    @doc("その他の備考。nullでクリア")
    notes?: string | null;
  }

  @doc("""
    仕入れ発注一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model PurchaseOrderSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("発注を行うサロンの ID による絞り込み(完全一致)")
    salonId?: SalonId;

    @query
    @doc("発注ステータスによる絞り込み(完全一致)")
    status?: OrderStatusType;

    @query
    @doc("仕入先名による絞り込み(完全一致)")
    @minLength(1)
    supplier?: string;

    @query
    @doc("検索対象期間の開始日時。発注日(orderDate)がこの日時以降の発注に一致する")
    startDate?: utcDateTime;

    @query
    @doc("検索対象期間の終了日時。発注日(orderDate)がこの日時より前の発注に一致する")
    endDate?: utcDateTime;
  }

  @doc("仕入れ発注承認リクエスト - 全項目のキーが必須")
  model PurchaseOrderApproveRequest {
    @doc("発注を承認するスタッフ ID")
    approvedBy: StaffId;

    @doc("承認時のメモ。メモがない場合はnull")
    notes: string | null;
  }

  @doc("仕入れ発注キャンセルリクエスト")
  model PurchaseOrderCancelRequest {
    @doc("キャンセル理由")
    @minLength(1)
    reason: string;
  }

  @doc("受領した1件の発注明細")
  model PurchaseOrderReceivedItem {
    @doc("受領した在庫 ID。発注明細の inventoryId のいずれかを指定する")
    inventoryId: InventoryId;

    @doc("受領数量")
    @minValueExclusive(0)
    @maxValue(99999999.99)
    receivedQuantity: float64;

    @doc("受領時のメモ。メモがない場合はnull")
    notes: string | null;
  }

  @doc("""
    仕入れ発注受領リクエスト - 全項目のキーが必須。
    受領数量を在庫移動(transactionType が purchase)として記録し、在庫数を増やす
    """)
  model PurchaseOrderReceiveRequest {
    @doc("受領した明細の一覧。1件以上を指定する")
    @minItems(1)
    receivedItems: PurchaseOrderReceivedItem[];

    @doc("納品に関するメモ。メモがない場合はnull")
    deliveryNotes: string | null;
  }

  @doc("""
    発注提案一覧リクエスト - 対象のサロンとページネーションを指定する
    """)
  model ReorderSuggestionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("対象のサロン ID")
    salonId: SalonId;
  }

  @doc("発注提案 - 在庫数が最低在庫数を下回った在庫と、推奨する発注数量を返す")
  model ReorderSuggestionResponse {
    @doc("対象在庫 ID")
    inventoryId: InventoryId;

    @doc("商品名")
    productName: string;

    @doc("現在の在庫数量")
    currentStock: float64;

    @doc("商品の最低在庫数")
    minimumStock: float64;

    @doc("推奨する発注数量")
    suggestedQuantity: float64;

    @doc("仕入先名。仕入先が登録されていない場合はnull")
    supplier: string | null;

    @doc("直近の発注日。発注履歴がない場合はnull")
    lastOrderDate: utcDateTime | null;
  }

  @doc("在庫に関するアラート情報")
  model InventoryAlertResponse {
    @doc("対象在庫 ID。inventoryId と同じ値")
    itemId: InventoryId;

    @doc("アラートの判定に使った閾値")
    threshold: float64;

    @doc("警告発生時の在庫数")
    currentStock: float64;

    @doc("警告が発生した日時")
    triggeredAt: utcDateTime;

    @doc("関連する在庫 ID")
    inventoryId: InventoryId;

    @doc("アラート種別")
    alert: InventoryAlertType;

    @doc("通知メッセージ")
    message: string;

    @doc("重要度レベル")
    severity: InventoryAlertSeverityType;

    @doc("確認済みかどうか")
    acknowledged: boolean;

    @doc("確認したスタッフ ID。未確認の場合はnull")
    acknowledgedBy: StaffId | null;

    @doc("確認日時。未確認の場合はnull")
    acknowledgedAt: utcDateTime | null;
  }

  @doc("""
    在庫アラート一覧リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model InventoryAlertSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("アラート種別による絞り込み(完全一致)")
    type?: InventoryAlertType;

    @query
    @doc("重要度による絞り込み(完全一致)")
    severity?: InventoryAlertSeverityType;
  }

  @doc("在庫アラート確認リクエスト - 全項目のキーが必須")
  model InventoryAlertAcknowledgeRequest {
    @doc("アラートを確認したスタッフ ID")
    acknowledgedBy: StaffId;

    @doc("確認時のメモ。メモがない場合はnull")
    notes: string | null;
  }

  @doc("在庫アラートの件数の集計")
  model InventoryAlertSummaryResponse {
    @doc("有効なアラートの総数")
    totalAlerts: int32;

    @doc("重要度 critical のアラート数")
    criticalAlerts: int32;

    @doc("重要度 warning のアラート数")
    warningAlerts: int32;

    @doc("重要度 info のアラート数")
    infoAlerts: int32;

    @doc("未確認のアラート数")
    unacknowledged: int32;
  }
}
