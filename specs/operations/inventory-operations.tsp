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
  @route("/api/v1/salons/{salonId}/products")
  @tag("Products")
  namespace ProductOperations {
    interface ProductCrud {
      @doc("サロンの商品を、絞り込み条件とページネーションを指定して一覧取得します。商品コード(productCode)の昇順、同じ商品コードならIDの昇順に返します。取り扱いをやめた商品(isActive が false)も含みます。実行できるのは admin と、パスのサロンの owner / manager / staff です。それ以外のユーザー(ほかのサロンのメンバー、顧客)には403を返します。cursorの商品の商品コードが、前のページを取得したあとに変わっていた場合は、変わったあとの商品コードの次から返します。")
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

      @doc("サロンに商品を登録します。実行できるのは admin と、パスのサロンの owner / manager です(staff には403を返します)。productCode がサロンの削除されていない商品と重複する場合は409を返します。在庫数の3つの値が minimumStock ≦ reorderPoint ≦ maximumStock の順に並んでいない場合は400を返します。在庫は、商品とは別に登録します。")
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

      @doc("サロンの商品を1件取得します。実行できるのは、商品の一覧と同じ利用者です。取り扱いをやめた商品も取得できます。")
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

      @doc("商品を更新します。実行できるのは、商品の登録と同じ利用者です。取り扱いをやめた商品も、在庫のある商品も更新できます。更新後の在庫数の3つの値が順に並んでいない場合は400を返します(一部だけを指定した場合は、ほかの値の現在の値と比べます)。productCode が、サロンの削除されていないほかの商品と重複する場合は409を返します。値が変わらない更新でも、updatedAt は更新した時刻になります。")
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

      @doc("商品を削除します。実行できるのは、商品の登録と同じ利用者です。取り扱いをやめた商品も削除できます。在庫のある商品は削除できず、409を返します。数量が0の在庫も、ロットや保管場所の記録なので、在庫に数えます。先に在庫を削除するか、削除せずに isActive を false にして取り扱いをやめます。削除した商品の商品コードは、ほかの商品に使えます。")
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

      @doc("商品の在庫を新規登録します。在庫数は0で登録され、入庫は在庫移動か発注の入荷で記録します。管理者と、salonIdのサロンのオーナー・マネージャーが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合や、productIdにsalonIdのサロンの商品ではないIDを指定した場合、lotNumberが商品のロット管理(requiresLotTracking)と合わない場合は400を、salonId・productId・lotNumberの組み合わせが既存の在庫と重複する場合は409を返します。")
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

      @doc("在庫移動を1件記録し、対象在庫の currentStock と availableStock に quantity を加算します。管理者と、在庫のサロンのオーナー・マネージャーはすべての在庫操作区分を、スタッフは purchase・sale・use・return を記録できます(スタッフの adjustment・disposal・transfer は403)。inventoryIdの在庫が存在しない場合(ほかのサロンの在庫を含む)、quantityの符号が在庫操作区分と合わない場合、adjustment・disposal の reason が null の場合、referenceType と referenceId の一方だけを指定した場合、totalCost が int32 の範囲を超える場合は400を、移動後の在庫数が reservedStock を下回る場合と 99999999.99 を超える場合は409を返し、何も記録しません。")
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

      @doc("在庫の在庫移動の履歴を、新しい順(createdAt の降順、同じなら id の降順)に、絞り込み条件とページネーションを指定して取得します。管理者と、在庫のサロンのオーナー・マネージャー・スタッフが使えます。在庫が存在しない場合(ほかのサロンの在庫を含む)は404を、endDate が startDate より前の場合や、cursor がその在庫の在庫移動でない場合は400を返します。")
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

      @doc("棚卸で数えた在庫数量を登録します。差異のある在庫は差分を在庫移動(adjustment)として記録して currentStock を数えた値に、availableStock を数えた値から reservedStock を引いた値にし、差異のない在庫には在庫移動を記録しません。itemsのすべての在庫の lastCountedAt を棚卸の時刻に、lastCountedBy を操作したスタッフ(管理者はnull)にします。1回の棚卸の lastCountedAt・updatedAt と在庫移動の createdAt は同じ時刻です。管理者と、salonIdのサロンのオーナー・マネージャーが使えます(スタッフは403)。すべての在庫を1つのトランザクションで処理し、ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合や、itemsにsalonIdのサロンの在庫ではないIDや重複したIDを指定した場合は400を、数えた値が reservedStock を下回る在庫がある場合は409を返して、どの在庫も更新しません。")
      @summary("Perform a stock count")
      @route("/stock-count")
      @post
      performStockCount(@body request: InventoryStockCountRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryStockCountResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの在庫評価額を、商品カテゴリ別に集計して返します。在庫数量に商品の仕入価格を掛けた額をカテゴリごとに合計して円に四捨五入し、在庫のある商品の数を品目数として数えます。取り扱いをやめた商品も、在庫があれば数えます。並びは評価額の降順、同じ場合はカテゴリの昇順(カテゴリ未設定は最後)です。管理者と、salonIdのサロンのオーナー・マネージャーが使えます(スタッフは403)。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合は400を返します。")
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
      @doc("絞り込み条件とページネーションを指定して仕入れ発注を一覧取得します。発注日(orderDate)の新しい順、同じ日時ならIDの順に並べます。管理者と、サロンのオーナー・マネージャー・スタッフ(所属サロンの発注)が使えます。ほかのサロンのsalonIdを指定した場合は403を、cursorが一覧できる発注を指していない場合や、endDateがstartDateより前の場合は400を返します。")
      @summary("List purchase orders")
      @get
      list(...PurchaseOrderSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("仕入れ発注を draft のステータスで作成します。発注番号を採番し、明細の商品コード・商品名・単位を在庫の商品から写し、金額を計算します。作成したスタッフを createdBy に記録します(管理者は null)。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合や、明細のinventoryIdにsalonIdのサロンの在庫ではないIDを指定した場合、同じ在庫を2回指定した場合、明細の金額・小計・合計金額が2147483647円を超える場合は400を返します。")
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

      @doc("IDを指定して仕入れ発注を1件取得します。管理者と、発注のサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンの発注は、存在しない発注と同じく404を返します。")
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

      @doc("仕入れ発注の指定した項目だけを更新します。statusで変えられるのは draft→pending、approved→ordered、ordered→shipped です。管理者と、発注のサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンの発注は404を、statusで許可されていない遷移を指定した場合や、delivered・cancelledの発注を更新しようとした場合は409を返します。")
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

      @doc("承認待ち(pending)の仕入れ発注を承認し、ステータスを approved にします。承認したスタッフを approvedBy に(管理者は null)、承認した日時を approvedAt に記録します。管理者と、発注のサロンのオーナー・マネージャーが使えます。スタッフは403を、ほかのサロンの発注は404を、発注が pending でない場合は409を返します。本文は読みません。")
      @summary("Approve a purchase order")
      @route("/{id}/approve")
      @post
      approve(@path id: OrderId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<PurchaseOrderResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("仕入れ発注をキャンセルし、ステータスを cancelled にします。キャンセルした日時を cancelledAt に、本文の理由を cancellationReason に記録します。管理者と、発注のサロンのオーナー・マネージャーが使えます。スタッフは403を、ほかのサロンの発注は404を、発注が delivered または cancelled の場合は409を返します。")
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

      @doc("発注済み(ordered)または発送済み(shipped)の仕入れ発注の納品を受領し、ステータスを delivered に、受領した日時を actualDelivery にします。明細ごとに、受領数量を在庫移動(purchase。単価は明細の unitPrice、参照は purchase_order と発注 ID)として記録し、在庫数を増やします。管理者と、発注のサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンの発注は404を、受領明細の inventoryId が発注の明細にない場合と、受領数量が発注数量を超える場合は400を、発注が ordered・shipped でない場合と、在庫数が上限(99,999,999.99)を超える場合は409を返します。")
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

      @doc("サロンの有効な商品のうち、在庫と発注中の数量の和が発注点(reorderPoint、ない場合は minimumStock)以下のものについて、推奨する発注数量を商品ごとに一覧取得します。在庫の行がない商品と、推奨する発注数量が0の商品は含みません。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合は400を返します。")
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

  @route("/api/v1/inventory-alerts")
  @tag("Inventory Alerts")
  namespace InventoryAlertOperations {
    interface InventoryAlertCrud {
      @doc("サロンの今出ている在庫アラートを、絞り込み条件とページネーションを指定して一覧取得します。商品の一覧と同じく商品コード(productCode)の昇順、同じ商品コードなら商品IDの昇順に並べ、同じ商品のアラートは、商品のアラートを先に、在庫の行のアラートを使用期限の早い順、同じ日なら在庫IDの昇順に返します。ページと件数は、同じ時点の値です。meta.nextCursor は、ページの最後のアラートの在庫ID(商品のアラートでは商品ID)です。cursor の商品や在庫の行にアラートが今出ていなくても、その位置の続きを返します。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合や、cursorがサロンの商品か在庫の行を指さない場合は400を返します。")
      @summary("List active inventory alerts")
      @get
      list(...InventoryAlertSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<InventoryAlertResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("今出ている在庫アラートを、操作者が確認したことを記録します。確認するアラートは、本文の alert、productId、inventoryId で指定します。確認の記録には、そのときのアラートの重要度、閾値、使用期限を残します。確認は、在庫や閾値、使用期限が変わってアラートの状態が変わると、有効でなくなります。管理者と、商品のサロンのオーナー・マネージャー・スタッフが使えます。200で確認したアラートを返し、その acknowledgement が、作成した確認の記録です。アラートには1件ごとのURLがないため、links は self を持たず、links.list がそのサロンのアラートの一覧を、links.summary が件数を指します。alertとinventoryIdの組み合わせが合わない場合は400を、商品か在庫の行が存在しないかほかのサロンのものである場合、在庫の行がproductIdの商品のものでない場合、そのアラートが今出ていない場合(同じ商品や在庫の行に別の種別のアラートが出ている場合を含みます)は404を、アラートが確認済み(有効な確認がある)の場合は409を返します。")
      @summary("Acknowledge an inventory alert")
      @route("/acknowledge")
      @post
      acknowledge(@body request: InventoryAlertAcknowledgeRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<InventoryAlertResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("サロンの今出ている在庫アラートの件数を、重要度別と確認状況別に集計して返します。数えるのは、絞り込み条件のない一覧と同じアラートで、どの件数も同じ時点のものです。管理者と、salonIdのサロンのオーナー・マネージャー・スタッフが使えます。ほかのサロンのsalonIdを指定した場合は403を、salonIdのサロンが存在しない場合は400を返します。")
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
