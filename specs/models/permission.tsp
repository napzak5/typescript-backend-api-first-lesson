import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;

namespace BeautySalon.Models {
  @doc("""
    権限適用範囲区分 - 権限が及ぶデータの範囲を表す
    
    own: 本人 - 操作するユーザー自身に関係するデータだけに適用される
    salon: サロン - 対象サロンのデータに適用される
    all: 全体 - すべてのサロンのデータに適用される
    """)
  enum PermissionScopeType {
    own,
    salon,
    all,
  }

  @doc("""
    システムロールタイプ区分 - システムで事前定義されたロールの種類
    
    super_admin: スーパー管理者 - システム全体へのフルアクセス権限
    salon_owner: サロンオーナー - サロン全体へのフルアクセス権限
    salon_manager: サロンマネージャー - サロンの管理業務権限
    senior_staff: シニアスタッフ - 上級スタイリスト・セラピストの権限
    staff: スタッフ - 一般スタッフの権限
    receptionist: 受付 - フロントデスク業務の権限
    customer: 顧客 - 顧客セルフサービスの権限
    guest: ゲスト - 限定的なゲストアクセス権限
    """)
  enum SystemRoleType {
    super_admin,
    salon_owner,
    salon_manager,
    senior_staff,
    staff,
    receptionist,
    customer,
    guest,
  }

  // ============================================================================
  // 権限
  // ============================================================================

  @doc("""
    権限レスポンス - 操作権限の定義を返す。全項目のキーが必須で、未設定の項目は null で表す
    """)
  model PermissionResponse {
    @doc("権限 ID")
    id: PermissionId;

    @doc("権限キー（例: booking.create）")
    key: string;

    @doc("権限の名称")
    name: string;

    @doc("権限の説明 - 自明な権限や説明不要な基本権限の場合はnull")
    description: string | null;

    @doc("対象リソース種別")
    resource: string;

    @doc("許可する操作区分")
    action: string;

    @doc("権限の適用範囲（own/salon/all） - 範囲指定が不要なグローバル権限の場合はnull")
    scope: PermissionScopeType | null;
  }

  @doc("""
    権限一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model PermissionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("対象リソース種別による絞り込み(完全一致)")
    resource?: string;

    @query
    @doc("操作区分による絞り込み(完全一致)")
    action?: string;
  }

  @doc("""
    権限グループレスポンス - 対象リソース種別ごとにまとめた権限の一覧を返す
    """)
  model PermissionGroupResponse {
    @doc("対象リソース種別")
    resource: string;

    @doc("このリソース種別に属する権限の一覧")
    permissions: PermissionResponse[];
  }

  // ============================================================================
  // ロール
  // ============================================================================

  @doc("""
    ロールレスポンス - 権限管理におけるロール定義と、付与されている権限を返す。
    全項目のキーが必須で、未設定の項目は null で表す
    """)
  model RoleResponse {
    @doc("ロール ID")
    id: RoleId;

    @doc("ロールのシステム内部名。ロール間で一意")
    name: string;

    @doc("管理画面などで表示する名称")
    displayName: string;

    @doc("ロールの詳細説明 - システム標準ロールや説明不要なシンプルなロールの場合はnull")
    description: string | null;

    @doc("付与されている権限一覧")
    permissions: PermissionResponse[];

    @doc("システム標準ロールかどうか")
    isSystem: boolean;

    @doc("ロールが有効状態かどうか")
    isActive: boolean;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコードを作成したユーザー ID。システム自動作成または匿名作成の場合はnull")
    createdBy: UserId | null;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;

    @doc("レコードを最後に更新したユーザー ID。システム自動更新または匿名更新の場合はnull")
    updatedBy: UserId | null;
  }

  @doc("""
    ロール新規作成リクエスト - 全項目のキーが必須。説明は null を指定できる
    """)
  model RoleCreateRequest {
    @doc("ロールの内部名。ロール間で一意")
    @minLength(1)
    @maxLength(100)
    name: string;

    @doc("表示用のロール名")
    @minLength(1)
    @maxLength(100)
    displayName: string;

    @doc("ロール説明文。説明が不要な場合はnull")
    description: string | null;

    @doc("付与する権限 ID リスト。存在する権限の ID を指定する")
    permissions: PermissionId[];
  }

  @doc("""
    ロール部分更新リクエスト - 指定した項目だけを更新する。説明は null でクリアできる。
    内部名は変更できない
    """)
  model RoleUpdateRequest {
    @doc("更新後の表示名")
    @minLength(1)
    @maxLength(100)
    displayName?: string;

    @doc("更新後の説明文。nullでクリア")
    description?: string | null;

    @doc("更新後の権限 ID リスト。指定した場合は付与されている権限全体を置き換える")
    permissions?: PermissionId[];

    @doc("有効/無効の切り替え")
    isActive?: boolean;
  }

  @doc("""
    ロール一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model RoleSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("システム標準ロールかどうかによる絞り込み")
    isSystem?: boolean;

    @query
    @doc("ロールが有効状態かどうかによる絞り込み")
    isActive?: boolean;
  }

  @doc("""
    ロール複製リクエスト - 複製して作成するロールの内部名と表示名を指定する。全項目のキーが必須
    """)
  model RoleCloneRequest {
    @doc("新しいロールの内部名。ロール間で一意")
    @minLength(1)
    @maxLength(100)
    name: string;

    @doc("新しいロールの表示名")
    @minLength(1)
    @maxLength(100)
    displayName: string;
  }

  // ============================================================================
  // ユーザーへのロール割当
  // ============================================================================

  @doc("""
    ロール割当レスポンス - ユーザーへのロール割当情報を返す。
    割当はユーザー ID・ロール ID・サロン ID の組で識別する。全項目のキーが必須で、未設定の項目は null で表す
    """)
  model UserRoleAssignmentResponse {
    @doc("対象ユーザー ID（スタッフ/顧客いずれも可）")
    userId: UserId;

    @doc("割り当てるロール ID")
    roleId: RoleId;

    @doc("サロン単位のロールの場合の対象サロン ID - システム全体ロールの場合はnull")
    salonId: SalonId | null;

    @doc("割当日時")
    assignedAt: utcDateTime;

    @doc("割当を実施したユーザー ID")
    assignedBy: UserId;

    @doc("ロール割当の有効期限 - 無期限割当の場合はnull")
    expiresAt: utcDateTime | null;

    @doc("割当が現在有効かどうか")
    isActive: boolean;
  }

  @doc("""
    ロール割当リクエスト - ユーザーへロールを割り当てる。全項目のキーが必須。
    サロン ID と有効期限は null を指定できる
    """)
  model UserRoleAssignmentCreateRequest {
    @doc("対象ユーザー ID")
    userId: UserId;

    @doc("割当対象のロール ID")
    roleId: RoleId;

    @doc("サロン単位の場合のサロン ID。システム全体ロールとして割り当てる場合はnull")
    salonId: SalonId | null;

    @doc("割当の有効期限。無期限で割り当てる場合はnull")
    expiresAt: utcDateTime | null;
  }

  @doc("""
    ロール割当部分更新リクエスト - 指定した項目だけを更新する。有効期限は null でクリアできる。
    対象のユーザー・ロール・サロンは変更できない
    """)
  model UserRoleAssignmentUpdateRequest {
    @doc("割当の有効期限。nullでクリア（無期限になる）")
    expiresAt?: utcDateTime | null;

    @doc("割当が有効かどうか")
    isActive?: boolean;
  }

  @doc("""
    ロール割当一覧リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model UserRoleAssignmentSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("割当先サロンの ID による絞り込み(完全一致)")
    salonId?: SalonId;
  }

  @doc("""
    ロール保有ユーザーレスポンス - 指定したロールを割り当てられているユーザーを返す。
    全項目のキーが必須で、未設定の項目は null で表す
    """)
  model RoleAssignedUserResponse {
    @doc("ロールを割り当てられているユーザー ID")
    userId: UserId;

    @doc("ユーザーの表示名。名前が登録されていない場合はnull")
    userName: string | null;

    @doc("割当日時")
    assignedAt: utcDateTime;

    @doc("ロール割当の有効期限 - 無期限割当の場合はnull")
    expiresAt: utcDateTime | null;
  }

  @doc("""
    ロール一括割当リクエスト - 指定したすべてのユーザーに、指定したすべてのロールを割り当てる。
    すべての割当を1つのトランザクションで作成し、1件でも作成できない場合はどの割当も作成しない。
    全項目のキーが必須
    """)
  model UserRoleAssignmentBulkCreateRequest {
    @doc("割当対象のユーザー ID 一覧。1件以上100件以下で指定する")
    @minItems(1)
    @maxItems(100)
    userIds: UserId[];

    @doc("割り当てるロール ID 一覧。1件以上20件以下で指定する")
    @minItems(1)
    @maxItems(20)
    roleIds: RoleId[];

    @doc("サロン単位の場合のサロン ID。システム全体ロールとして割り当てる場合はnull")
    salonId: SalonId | null;
  }

  @doc("ロール一括割当の結果 - 作成した割当の一覧を返す")
  model UserRoleAssignmentBulkCreateResponse {
    @doc("作成した割当の一覧")
    assigned: UserRoleAssignmentResponse[];
  }

  // ============================================================================
  // アクセス制御
  // ============================================================================

  @doc("""
    アクセス権限の確認リクエスト - ユーザーがリソースに対する操作を実行できるかを判定する。
    全項目のキーが必須
    """)
  model AccessCheckRequest {
    @doc("権限を判定するユーザー ID")
    userId: UserId;

    @doc("対象リソースの識別子")
    @minLength(1)
    resource: string;

    @doc("実行したい操作区分")
    @minLength(1)
    action: string;

    @doc("サロン単位での権限チェック時のサロン ID - システム全体権限のチェック時はnull")
    salonId: SalonId | null;

    @doc("リソース固有の ID - リソース種別全体への権限チェック時はnull")
    resourceId: string | null;
  }

  @doc("""
    アクセス権限チェックの結果 - 全項目のキーが必須で、該当しない項目は null で表す
    """)
  model AccessCheckResponse {
    @doc("操作が許可されたかどうか")
    allowed: boolean;

    @doc("拒否または許可の理由 - 理由説明不要な明白なケースの場合はnull")
    reason: string | null;

    @doc("必要な権限キー一覧 - 権限不要なパブリック操作の場合はnull")
    requiredPermissions: string[] | null;

    @doc("ユーザーが保有する権限キー一覧 - 未ログインや権限なしユーザーの場合はnull")
    userPermissions: string[] | null;
  }

  @doc("""
    複数権限の保有状況を確認するリクエスト - 全項目のキーが必須。サロン ID は null を指定できる
    """)
  model PermissionCheckRequest {
    @doc("確認対象のユーザー ID")
    userId: UserId;

    @doc("確認したい権限キー一覧。1件以上100件以下で指定する")
    @minItems(1)
    @maxItems(100)
    permissions: string[];

    @doc("サロン単位の権限チェック時のサロン ID。システム全体の権限をチェックする場合はnull")
    salonId: SalonId | null;
  }

  @doc("""
    権限チェックの結果 - 指定した権限キーごとの判定結果を返す
    """)
  model PermissionCheckResponse {
    @doc("確認対象のユーザー ID")
    userId: UserId;

    @doc("各権限の判定結果一覧")
    permissions: PermissionStatusResponse[];
  }

  @doc("""
    個別権限の判定結果 - 全項目のキーが必須で、該当しない項目は null で表す
    """)
  model PermissionStatusResponse {
    @doc("権限キー")
    permission: string;

    @doc("権限が付与されているかどうか")
    granted: boolean;

    @doc("権限を付与したロール情報 - 権限が付与されていない場合はnull")
    source: string | null;
  }

  @doc("""
    ユーザーの実効権限レスポンス - ユーザーが保有する権限キーと、その権限を付与しているロールを返す
    """)
  model UserPermissionsResponse {
    @doc("対象ユーザー ID")
    userId: UserId;

    @doc("ユーザーが保有する権限キーの一覧（全ロールの権限を合わせたもの）")
    permissions: string[];

    @doc("ユーザーに割り当てられているロールの一覧")
    roles: UserPermissionsRoleResponse[];
  }

  @doc("""
    実効権限の内訳となるロール - ユーザーに割り当てられたロールと、そのロールが付与する権限キーを表す
    """)
  model UserPermissionsRoleResponse {
    @doc("ロール ID")
    roleId: RoleId;

    @doc("ロール名")
    roleName: string;

    @doc("このロールが付与する権限キーの一覧")
    permissions: string[];
  }

  @doc("""
    リソースアクセス一覧リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model ResourceAccessSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("操作区分による絞り込み(完全一致)。省略した場合はリソースへのいずれかの操作で判定する")
    action?: string;

    @query
    @doc("サロンの ID による絞り込み(完全一致)。省略した場合はシステム全体の権限で判定する")
    salonId?: SalonId;
  }

  @doc("""
    リソースアクセスレスポンス - ユーザーごとのリソースへのアクセス可否を返す。
    全項目のキーが必須で、未設定の項目は null で表す
    """)
  model ResourceAccessResponse {
    @doc("ユーザー ID")
    userId: UserId;

    @doc("ユーザーの表示名。名前が登録されていない場合はnull")
    userName: string | null;

    @doc("リソースへアクセスできるかどうか")
    hasAccess: boolean;

    @doc("アクセスを許可しているロール名の一覧。アクセスできない場合は空配列")
    grantedBy: string[];
  }

  @doc("""
    ロール権限の検証リクエスト - ロールが必要な権限を満たしているかを検証する。全項目のキーが必須
    """)
  model RolePermissionValidateRequest {
    @doc("検証対象のロール ID")
    roleId: RoleId;

    @doc("ロールに必要な権限キーの一覧。1件以上100件以下で指定する")
    @minItems(1)
    @maxItems(100)
    requiredPermissions: string[];
  }

  @doc("""
    ロール権限の検証結果 - 不足している権限と、必要な権限以外に付与されている権限を返す
    """)
  model RolePermissionValidateResponse {
    @doc("必要な権限をすべて満たしているかどうか")
    isValid: boolean;

    @doc("ロールに付与されていない必要な権限キーの一覧。不足がない場合は空配列")
    missingPermissions: string[];

    @doc("必要な権限以外にロールに付与されている権限キーの一覧。ない場合は空配列")
    extraPermissions: string[];
  }
}
