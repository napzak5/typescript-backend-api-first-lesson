import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/permission.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("権限管理で使うロールを定義し、ロールに付与する権限を管理するAPI操作群です。")
  @route("/api/v1/roles")
  @tag("Roles & Permissions")
  namespace RoleOperations {
    interface RoleCrud {
      @doc("絞り込み条件とページネーションを指定してロールを一覧取得します。システム標準ロールだけを取得する場合はisSystemにtrueを指定します。")
      @summary("List roles")
      @get
      list(...RoleSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<RoleResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("IDを指定してロールを1件取得します。")
      @summary("Get a role")
      @get
      get(@path id: RoleId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<RoleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ロールを新規作成します。permissionsに存在しない権限のIDを指定した場合は400を、内部名が既存のロールと重複する場合は409を返します。")
      @summary("Create a role")
      @post
      create(@body request: RoleCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<RoleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ロールの指定した項目だけを更新します。permissionsを指定した場合は付与されている権限全体を置き換えます。permissionsに存在しない権限のIDを指定した場合は400を返します。")
      @summary("Update a role")
      @patch
      update(@path id: RoleId, @body request: RoleUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<RoleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ロールを削除します。システム標準ロール、またはユーザーに割り当てられているロールは削除できず409を返します。")
      @summary("Delete a role")
      @delete
      delete(@path id: RoleId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("指定したロールの説明と権限を引き継いだ新しいロールを、指定した内部名と表示名で作成します。複製元のロールが存在しない場合は404を、内部名が既存のロールと重複する場合は409を返します。")
      @summary("Clone a role")
      @post
      @route("/{id}/clone")
      clone(@path id: RoleId, @body request: RoleCloneRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<RoleResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("ロールに付与できる操作権限の定義を参照するAPI操作群です。")
  @route("/api/v1/permissions")
  @tag("Permissions")
  namespace PermissionOperations {
    interface PermissionCrud {
      @doc("絞り込み条件とページネーションを指定して権限を一覧取得します。特定のリソース種別の権限だけを取得する場合はresourceを指定します。")
      @summary("List permissions")
      @get
      list(...PermissionSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<PermissionResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("すべての権限を対象リソース種別ごとにまとめて取得します。")
      @summary("Get permission groups")
      @get
      @route("/groups")
      getGroups():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PermissionGroupResponse[]>;
          }
        | CommonErrors;
    }
  }

  @doc("ユーザーへのロールの割当・変更・解除を行うAPI操作群です。割当はユーザーID・ロールID・サロンIDの組で識別します。")
  @route("/api/v1/user-roles")
  @tag("User Roles")
  namespace UserRoleAssignmentOperations {
    interface UserRoleAssignmentCrud {
      @doc("指定したユーザーのロール割当を、絞り込み条件とページネーションを指定して一覧取得します。ユーザーが存在しない場合は404を返します。")
      @summary("List role assignments of a user")
      @get
      @route("/user/{userId}")
      listByUser(@path userId: UserId, ...UserRoleAssignmentSearchRequest):
        | {
            @statusCode statusCode: 200;

            @body
            response: CursorPaginationResponse<UserRoleAssignmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ユーザーにロールを割り当てます。Locationには作成した割当の取得先（サロン単位の割当ではsalonIdのクエリパラメータ付き）を返します。userId・roleId・salonIdに存在しないIDを指定した場合は400を、同じユーザー・ロール・サロンの割当が既に存在する場合は409を返します。")
      @summary("Assign a role to a user")
      @post
      create(@body request: UserRoleAssignmentCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<UserRoleAssignmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ユーザー・ロール・サロンを指定してロール割当を1件取得します。salonIdを省略した場合はシステム全体の割当（salonIdがnull）を対象にします。")
      @summary("Get a role assignment")
      @get
      @route("/user/{userId}/role/{roleId}")
      get(
        @path userId: UserId,
        @path roleId: RoleId,

        @query
        @doc("サロン単位の割当を対象にする場合のサロン ID。省略した場合はシステム全体の割当を対象にする")
        salonId?: SalonId,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserRoleAssignmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ロール割当の指定した項目だけを更新します。salonIdを省略した場合はシステム全体の割当（salonIdがnull）を対象にします。")
      @summary("Update a role assignment")
      @patch
      @route("/user/{userId}/role/{roleId}")
      update(
        @path userId: UserId,
        @path roleId: RoleId,

        @query
        @doc("サロン単位の割当を対象にする場合のサロン ID。省略した場合はシステム全体の割当を対象にする")
        salonId?: SalonId,

        @body request: UserRoleAssignmentUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserRoleAssignmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ユーザーからロールの割当を解除します。salonIdを省略した場合はシステム全体の割当（salonIdがnull）を対象にします。")
      @summary("Revoke a role assignment")
      @delete
      @route("/user/{userId}/role/{roleId}")
      delete(
        @path userId: UserId,
        @path roleId: RoleId,

        @query
        @doc("サロン単位の割当を対象にする場合のサロン ID。省略した場合はシステム全体の割当を対象にする")
        salonId?: SalonId,
      ):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定したロールを割り当てられているユーザーを、絞り込み条件とページネーションを指定して一覧取得します。ロールが存在しない場合は404を返します。")
      @summary("List users assigned to a role")
      @get
      @route("/role/{roleId}/users")
      listUsersByRole(
        @path roleId: RoleId,
        ...UserRoleAssignmentSearchRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<RoleAssignedUserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定したすべてのユーザーに、指定したすべてのロールを割り当てます。すべての割当を1つのトランザクションで作成し、存在しないIDを指定した場合は400を、既に存在する割当が含まれる場合は409を返してどの割当も作成しません。")
      @summary("Bulk assign roles")
      @post
      @route("/bulk-assign")
      bulkCreate(@body request: UserRoleAssignmentBulkCreateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserRoleAssignmentBulkCreateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;
    }
  }

  @doc("ユーザーのアクセス権限を判定・照会するAPI操作群です。")
  @route("/api/v1/access-control")
  @tag("Access Control")
  namespace AccessControlOperations {
    interface AccessControlCrud {
      @doc("ユーザーが指定したリソースに対する操作を実行できるかを判定します。userIdに存在しないユーザーを指定した場合は400を返します。")
      @summary("Check user access")
      @post
      @route("/check")
      check(@body request: AccessCheckRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AccessCheckResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ユーザーが指定した複数の権限を保有しているかを権限ごとに判定します。userIdに存在しないユーザーを指定した場合は400を返します。")
      @summary("Check multiple permissions")
      @post
      @route("/check-permissions")
      checkPermissions(@body request: PermissionCheckRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PermissionCheckResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ユーザーに割り当てられたロールから、ユーザーが保有する実効権限を取得します。ユーザーが存在しない場合は404を返します。")
      @summary("Get user effective permissions")
      @get
      @route("/user/{userId}/permissions")
      getUserPermissions(
        @path userId: UserId,

        @query
        @doc("サロン単位の権限を含める場合のサロン ID。省略した場合はシステム全体の権限だけを対象にする")
        salonId?: SalonId,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserPermissionsResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("指定したリソース種別に対するユーザーごとのアクセス可否を、絞り込み条件とページネーションを指定して一覧取得します。権限が定義されていないリソース種別を指定した場合は404を返します。")
      @summary("List resource access")
      @get
      @route("/resource/{resource}/access")
      listResourceAccess(
        @path
        @doc("対象リソース種別")
        resource: string,

        ...ResourceAccessSearchRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ResourceAccessResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ロールが必要な権限をすべて満たしているかを検証し、不足している権限と余分な権限を返します。roleIdに存在しないロールを指定した場合は400を返します。")
      @summary("Validate role permissions")
      @post
      @route("/validate")
      validatePermissions(@body request: RolePermissionValidateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<RolePermissionValidateResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;
    }
  }
}
