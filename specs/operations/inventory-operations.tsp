import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/inventory.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("サロンごとの商品の在庫(inventory)と、在庫数を増減させる在庫移動(inventory_transactions)を管理するAPI操作群です。")
  @route("/api/v1/inventory")
  @tag("Inventory")
  namespace InventoryOperations {
    interface InventoryCrud {
      @doc("絞り込み条件とページネーションを指定して在庫を一覧取得します。")
      @summary("List inventory")
      @get
      list(...InventorySearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("商品の在庫を新規登録します。在庫数は0で登録され、入庫は在庫移動で記録します。salonIdのサロンが存在しない場合や、productIdにsalonIdのサロンの商品ではないIDを指定した場合は400を、salonId・productId・lotNumberの組み合わせが既存の在庫と重複する場合は409を返します。")
      @summary("Create an inventory record")
      @post
      create(@body request: InventoryCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して在庫を1件取得します。")
      @summary("Get an inventory record")
      @get
      get(@path id: InventoryId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("在庫の指定した項目だけを更新します。在庫数は変更できません。lotNumberの変更で同じサロン・商品・ロット番号の在庫と重複する場合は409を返します。")
      @summary("Update an inventory record")
      @patch
      update(@path id: InventoryId, @body request: InventoryUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("在庫を削除します。この在庫の在庫移動の記録は残り、その inventoryId は null になります。")
      @summary("Delete an inventory record")
      @delete
      delete(@path id: InventoryId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("在庫数が閾値以下の在庫を一覧取得します。閾値を省略した場合は商品ごとの最低在庫数を使います。salonIdのサロンが存在しない場合は400を返します。")
      @summary("List low-stock inventory")
      @route("/low-stock")
      @get
      listLowStock(...InventoryLowStockSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("指定した日数以内に使用期限を迎える在庫を、期限切れの在庫も含めて一覧取得します。salonIdのサロンが存在しない場合は400を返します。")
      @summary("List expiring inventory")
      @route("/expiring")
      @get
      listExpiring(...InventoryExpiringSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("在庫移動を1件記録し、対象在庫の currentStock と availableStock に quantity を加算します。inventoryIdの在庫が存在しない場合や、quantityの符号が在庫操作区分と合わない場合は400を、在庫数が負になる場合は409を返します。")
      @summary("Record a stock movement")
      @route("/movement")
      @post
      recordMovement(@body request: InventoryMovementRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryTransactionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("在庫の在庫移動の履歴を、新しい順に絞り込み条件とページネーションを指定して取得します。在庫が存在しない場合は404を返します。")
      @summary("List stock movements of an inventory record")
      @route("/{id}/movements")
      @get
      listMovements(
        @path id: InventoryId,
        ...InventoryTransactionSearchRequest,
      ):
        | {
            @statusCode statusCode: 200;

            @body
            response: CursorPaginationResponse<InventoryTransactionResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("棚卸で数えた在庫数量を登録します。差異のある在庫は差分を在庫移動(adjustment)として記録して在庫数を数えた値にし、すべての在庫の lastCountedAt・lastCountedBy を更新します。すべての在庫を1つのトランザクションで処理し、salonIdのサロンが存在しない場合や、itemsにsalonIdのサロンの在庫ではないIDや重複したIDを指定した場合は400を返してどの在庫も更新しません。")
      @summary("Perform a stock count")
      @route("/stock-count")
      @post
      performStockCount(@body request: InventoryStockCountRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryStockCountResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの在庫評価額を、商品カテゴリ別に集計して返します。salonIdのサロンが存在しない場合は400を返します。")
      @summary("Get the inventory value report")
      @route("/value-report")
      @get
      getValueReport(...InventoryValueReportRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryValueReportResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;
    }
  }

  @doc("仕入先への発注の作成・承認・受領を管理するAPI操作群です。")
  @route("/api/v1/purchase-orders")
  @tag("Purchase Orders")
  namespace PurchaseOrderOperations {
    interface PurchaseOrderCrud {
      @doc("絞り込み条件とページネーションを指定して仕入れ発注を一覧取得します。")
      @summary("List purchase orders")
      @get
      list(...PurchaseOrderSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("仕入れ発注を draft のステータスで作成します。salonIdのサロンが存在しない場合や、明細のinventoryIdにsalonIdのサロンの在庫ではないIDを指定した場合は400を返します。")
      @summary("Create a purchase order")
      @post
      create(@body request: PurchaseOrderCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("IDを指定して仕入れ発注を1件取得します。")
      @summary("Get a purchase order")
      @get
      get(@path id: OrderId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("仕入れ発注の指定した項目だけを更新します。statusで許可されていない遷移を指定した場合や、delivered・cancelledの発注を更新しようとした場合は409を返します。")
      @summary("Update a purchase order")
      @patch
      update(@path id: OrderId, @body request: PurchaseOrderUpdateRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("承認待ち(pending)の仕入れ発注を承認し、ステータスを approved にします。approvedByのスタッフが存在しない場合は400を、発注が pending でない場合は409を返します。")
      @summary("Approve a purchase order")
      @route("/{id}/approve")
      @post
      approve(@path id: OrderId, @body request: PurchaseOrderApproveRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("仕入れ発注をキャンセルし、ステータスを cancelled にします。発注が delivered または cancelled の場合は409を返します。")
      @summary("Cancel a purchase order")
      @route("/{id}/cancel")
      @post
      cancel(@path id: OrderId, @body request: PurchaseOrderCancelRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("発注済み(ordered)または発送済み(shipped)の仕入れ発注の納品を受領し、ステータスを delivered にします。受領数量は在庫移動(purchase)として記録し、在庫数を増やします。受領明細のinventoryIdが発注明細にない場合は400を、発注が ordered・shipped でない場合は409を返します。")
      @summary("Receive a purchase order")
      @route("/{id}/receive")
      @post
      receive(@path id: OrderId, @body request: PurchaseOrderReceiveRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("在庫数が最低在庫数を下回った在庫について、推奨する発注数量を一覧取得します。salonIdのサロンが存在しない場合は400を返します。")
      @summary("List reorder suggestions")
      @route("/reorder-suggestions")
      @get
      listReorderSuggestions(...ReorderSuggestionSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ReorderSuggestionResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;
    }
  }

  @doc("在庫僅少や期限切れなど、在庫に関するアラートを確認するAPI操作群です。")
  @route("/api/v1/inventory-alerts")
  @tag("Inventory Alerts")
  namespace InventoryAlertOperations {
    interface InventoryAlertCrud {
      @doc("有効な在庫アラートを、絞り込み条件とページネーションを指定して一覧取得します。salonIdのサロンが存在しない場合は400を返します。")
      @summary("List active inventory alerts")
      @get
      list(...InventoryAlertSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryAlertResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("在庫のアラートを確認済みにします。acknowledgedByのスタッフが存在しない場合は400を、在庫に有効なアラートがない場合は404を、アラートが確認済みの場合は409を返します。")
      @summary("Acknowledge an inventory alert")
      @route("/{inventoryId}/acknowledge")
      @post
      acknowledge(
        @path inventoryId: InventoryId,
        @body request: InventoryAlertAcknowledgeRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryAlertResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの有効な在庫アラートの件数を、重要度別と確認状況別に集計して返します。salonIdのサロンが存在しない場合は400を返します。")
      @summary("Get the inventory alert summary")
      @route("/summary")
      @get
      getSummary(@query salonId: SalonId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryAlertSummaryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;
    }
  }
}
