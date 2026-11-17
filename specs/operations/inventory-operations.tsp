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
  @doc("サロンが店頭で売る、または施術で使う商品の台帳(products)を登録・取得・更新・削除するAPI操作群です。ここに定義した操作はすべて実装済みで、定義と実装は一致しています。一覧と1件の取得は admin と、そのサロンの owner / manager / staff が実行できます。登録・更新・削除は admin と、そのサロンの owner / manager が実行できます。それ以外のアカウント(ほかのサロンのメンバー、顧客)には、パスの salonId だけで判断して403を返します。商品は仕入価格と仕入先を持つので、顧客には公開しません。サロンが存在しない場合は404を返します。ほかのサロンの商品と削除済みの商品は、存在しない商品と同じく404を返します。")
  @route("/api/v1/salons/{salonId}/products")
  @tag("Products")
  namespace ProductOperations {
    interface ProductCrud {
      @doc("サロンの商品を、絞り込み条件とページネーションを指定して一覧取得します。商品コード(productCode)の昇順、同じ商品コードならIDの昇順に並びます。削除済みの商品は含みません。取り扱いをやめた商品(isActive が false)は含みます。cursorがそのサロンの削除されていない商品を指していない場合は400を返します。")
      @summary("List products")
      @get
      list(@path salonId: SalonId, ...ProductSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ProductResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("サロンに商品を登録します。productCode がサロンの削除されていない商品と重複する場合は409を返します。在庫数の3つの値が minimumStock ≦ reorderPoint ≦ maximumStock の順に並んでいない場合は400を返します。在庫は商品とは別に、在庫(inventory)として登録します。")
      @summary("Create product")
      @post
      create(@path salonId: SalonId, @body request: ProductCreateRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<ProductResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの商品を1件取得します。取り扱いをやめた商品も取得できます。")
      @summary("Get product")
      @get
      get(@path salonId: SalonId, @path id: ProductId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ProductResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("商品の指定した項目だけを更新します。更新後の在庫数の3つの値が順に並んでいない場合は400を返します(一部だけを指定した場合は、ほかの値の現在の値と比べます)。productCode の変更で、サロンの削除されていない商品と重複する場合は409を返します。")
      @summary("Update product")
      @patch
      update(
        @path salonId: SalonId,
        @path id: ProductId,
        @body request: ProductUpdateRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ProductResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("商品を論理削除します。削除した商品は、どの操作からも取得できず、売上の明細にも指定できません。削除した商品の商品コードは、新しい商品に使えます。在庫(inventory)のある商品は削除できず、409を返します。先に在庫を削除するか、取り扱いをやめた商品として isActive を false にします。")
      @summary("Delete product")
      @delete
      delete(@path salonId: SalonId, @path id: ProductId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }

  @doc("サロンごとの商品の在庫(inventory)と、在庫数を増減させる在庫移動(inventory_transactions)を管理するAPI操作群です。")
  @route("/api/v1/inventory")
  @tag("Inventory")
  namespace InventoryOperations {
    interface InventoryCrud {
      @doc("絞り込み条件とページネーションを指定して在庫を一覧取得します。商品の商品コード、ロット番号(nullが先)、IDの順に並べます。管理者と、サロンのオーナー・マネージャー・スタッフ(所属サロンの在庫)が使えます。ほかのサロンのsalonIdを指定した場合は403を、cursorが一覧できる在庫を指していない場合は400を返します。")
      @summary("List inventory")
      @get
      list(...InventorySearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("商品の在庫を新規登録します。在庫数は0で登録され、入庫は在庫移動で記録します。管理者と、salonIdのサロンのオーナー・マネージャーが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合や、productIdにsalonIdのサロンの商品ではないIDを指定した場合、lotNumberが商品のロット管理(requiresLotTracking)と合わない場合は400を、salonId・productId・lotNumberの組み合わせが既存の在庫と重複する場合は409を返します。")
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

      @doc("IDを指定して在庫を1件取得します。管理者と、在庫のサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンの在庫は、存在しない在庫と同じく404を返します。")
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

      @doc("在庫の指定した項目だけを更新します。在庫数は変更できません。管理者と、在庫のサロンのオーナー・マネージャーが使えます。ほかのサロンの在庫は404を、lotNumberが商品のロット管理(requiresLotTracking)と合わない場合は400を、lotNumberの変更で同じサロン・商品・ロット番号の在庫と重複する場合は409を返します。")
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

      @doc("在庫を削除します。この在庫の在庫移動の記録は残り、その inventoryId は null になります。管理者と、在庫のサロンのオーナー・マネージャーが使えます。ほかのサロンの在庫は404を、在庫数(currentStock)が0でない場合は409を返します。")
      @summary("Delete an inventory record")
      @delete
      delete(@path id: InventoryId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("取り扱い中の商品のうち、サロンにある在庫数の合計が閾値以下の商品の在庫を一覧取得します。閾値を省略した場合は商品ごとの最低在庫数を使います。並びは在庫の一覧と同じです。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合は400を返します。")
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

      @doc("指定した日数以内に使用期限を迎える、在庫数が0より多い在庫を、期限切れの在庫も含めて、使用期限の早い順に一覧取得します。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合は400を返します。")
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
