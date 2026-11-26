import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "@typespec/openapi3";

// Import all models
// common.tsp is imported by each model file, so we don't need to import it here
import "./models/_shared/common-api-patterns.tsp";
import "./models/auth.tsp";
import "./models/salon.tsp";
import "./models/staff.tsp";
import "./models/service.tsp";
import "./models/customer.tsp";
import "./models/booking.tsp";
import "./models/review.tsp";
import "./models/attachment.tsp";
import "./models/treatment.tsp";
import "./models/payment.tsp";
import "./models/inventory.tsp";

// Import all operations
import "./operations/system-operations.tsp";
import "./operations/auth-operations.tsp";
import "./operations/salon-operations.tsp";
import "./operations/staff-operations.tsp";
import "./operations/service-operations.tsp";
import "./operations/customer-operations.tsp";
import "./operations/booking-operations.tsp";
import "./operations/review-operations.tsp";
import "./operations/attachment-operations.tsp";
import "./operations/treatment-operations.tsp";
import "./operations/payment-operations.tsp";
import "./operations/inventory-operations.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;

// Where the requirement documents are read. A tag names the document of its domain
const REQUIREMENTS = "https://github.com/napzak5/typescript-backend-api-first-lesson/blob/main/docs";

@service(#{ title: "Beauty Salon API" })
@info(#{ version: "1.0" })
@server("https://api.beauty-salon.com", "Production API Server")
@server("https://api-staging.beauty-salon.com", "Staging API Server")
@server("http://localhost:3000", "Local Development Server")
@useAuth(BearerAuth)
// What each group of operations is, in the order the API reference lists them. A new tag is added here
@tagMetadata(#[
  #{
    name: "System",
    description: "稼働の監視に使うオペレーションです。プロセスが生きているか、リクエストを受けられるか、依存先の状態を答えます。監視の仕組みが呼ぶので、認証は要りません。",
  },
  #{
    name: "Authentication",
    description: "登録、ログインとログアウト、パスワードの再設定、メールアドレスの確認、2 要素認証、セッションを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/authentication.md",
      description: "認証と認可の要件",
    },
  },
  #{
    name: "Admin - Authentication",
    description: "管理者が、ユーザーのアカウントを読み、ロックを解除し、2 要素認証をリセットします。",
    externalDocs: #{
      url: "${REQUIREMENTS}/authentication.md",
      description: "認証と認可の要件",
    },
  },
  #{
    name: "Salons",
    description: "サロン（店舗）と、その営業時間を扱います。",
  },
  #{
    name: "Staff",
    description: "サロンのスタッフ台帳、勤務スケジュール、招待、ログインアカウントと、顧客に見せるプロフィールを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/staff.md",
      description: "スタッフ台帳の要件",
    },
  },
  #{
    name: "Services",
    description: "サロンのメニュー（サービス）と、そのカテゴリーを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/service-menu.md",
      description: "サービスメニューの要件",
    },
  },
  #{
    name: "Customers",
    description: "顧客台帳と、顧客本人のプロフィール、好みの設定を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/customers.md",
      description: "顧客台帳の要件",
    },
  },
  #{
    name: "Bookings",
    description: "サロンの予約台帳、予約の施術明細、空き枠と、顧客本人の予約を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/bookings.md",
      description: "予約台帳の要件",
    },
  },
  #{
    name: "Reviews",
    description: "レビューと、その通報、サロンとスタッフごとの集計を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/reviews.md",
      description: "レビューの要件",
    },
  },
  #{
    name: "Attachments",
    description: "添付ファイル（施術の写真や書類）と、その共有リンクを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/attachments.md",
      description: "添付ファイルの要件",
    },
  },
  #{
    name: "Share",
    description: "共有リンクを受け取った人が、ファイルを読みます。",
    externalDocs: #{
      url: "${REQUIREMENTS}/attachments.md",
      description: "添付ファイルの要件",
    },
  },
  #{
    name: "Treatments",
    description: "施術記録と、施術で使った商材、施術写真、施術の統計を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/treatments.md",
      description: "施術記録の要件",
    },
  },
  #{
    name: "Medical Charts",
    description: "カルテと、顧客のアレルギーを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/medical-charts.md",
      description: "カルテの要件",
    },
  },
  #{
    name: "Sales",
    description: "来店ごとの会計（売上）と、その明細、支払いの記録、レシート、請求額の試算を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/sales.md",
      description: "売上台帳の要件",
    },
  },
  #{
    name: "Payment Methods",
    description: "サロンが会計で使う支払い方法を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/payments.md",
      description: "支払いの要件",
    },
  },
  #{
    name: "Payments",
    description: "売上の決済取引の返金を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/payments.md",
      description: "支払いの要件",
    },
  },
  #{
    name: "Sales Reports",
    description: "売上を集計したレポートを扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/sales-reports.md",
      description: "売上レポートの要件",
    },
  },
  #{
    name: "Points",
    description: "顧客のポイントの付与、利用、調整、失効と、残高、履歴を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/points.md",
      description: "ポイント台帳の要件",
    },
  },
  #{
    name: "Products",
    description: "サロンの商品の台帳を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/products.md",
      description: "商品の要件",
    },
  },
  #{
    name: "Inventory",
    description: "商品の在庫と、在庫の移動を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/inventory.md",
      description: "在庫の要件",
    },
  },
  #{
    name: "Purchase Orders",
    description: "仕入先への発注を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/purchase-orders.md",
      description: "発注の要件",
    },
  },
  #{
    name: "Inventory Alerts",
    description: "在庫のアラートと、その確認を扱います。",
    externalDocs: #{
      url: "${REQUIREMENTS}/inventory-alerts.md",
      description: "在庫のアラートの要件",
    },
  }
])
@doc("""
  美容サロンの店舗、スタッフ、メニュー、顧客、予約、会計、在庫、施術の記録を扱う API です。
  
  オペレーションの説明が、次の規則と違うことを言うときは、オペレーションの説明に従います。
  
  # 認証
  
  `Authorization: Bearer <アクセストークン>` で認証します。アクセストークンは、ログインの応答にあります。認証の要らないオペレーションは、それぞれに示してあります。
  
  # 確認の順序
  
  リクエストは、次の順に確かめ、最初に合わなかったところで答えます。
  
  1. リクエストの数が、上限を超えていないか（429）
  2. 本文が JSON か（415）、大きすぎないか（413）、JSON として読めるか（400）
  3. アクセストークンが有効か（401）
  4. 利用者に権限があるか（403）
  5. パスの ID が、正しい形か（400）
  6. クエリと本文が、規則に合うか（400）
  7. 対象と、リクエストが指すものがあるか（404、400）。保存されている状態が、その操作を許すか（409）
  
  - 1 と 2 は、認証より前です。稼働の監視は、1 から 4 を確かめません。
  - 権限は、判定に要る値がそろったところで確かめます。ロールだけで決まる権限は 4 で確かめるので、権限のない利用者には、ID や本文が誤っていても 403 を返します。パスのサロンで決まる権限は、その ID の形を確かめた直後に確かめます。クエリや本文のサロンで決まる権限は 6 のあとに、保存されている値で決まる権限は対象を読んだあとに確かめます。
  - 400 は、1 つの段階で見つかった違反をすべて返します。別の段階の違反は混ぜません。
  - 7 の中の順序は領域ごとに決まっていて、領域の要件にあります。
  
  # リクエスト
  
  - 本文は JSON です（`Content-Type: application/json`）。
  - クエリと本文に、定義にないキーがあると 400 です（`unrecognized_keys`）。`id` や `createdAt` のようにサーバーが決める値も、リクエストに書けば同じです。クエリのパラメーターを定義していないオペレーションはクエリを、本文を定義していないオペレーションは本文を読みません。
  - クエリの同じパラメーターを 2 回書くと 400 です（`invalid_type`）。配列のパラメーターは、繰り返して書けます。
  - 作成のリクエストには、すべてのプロパティを書きます。値のないプロパティは null です。
  - 更新は `PATCH` で、書いたプロパティだけを変えます。null は値を消します。プロパティを 1 つも書かない更新は 400 です（`custom`。`field` は空文字）。
  - ID は UUID です。英字は大文字でも小文字でも同じ ID で、レスポンスでは小文字です。UUID でない ID は 400 です（`invalid_format`）。
  - 日時は UTC の ISO 8601 です。リクエストは `Z` で終わる形で書き、レスポンスはミリ秒まで書きます（`2026-11-20T03:40:00.000Z`）。
  - 日付は `YYYY-MM-DD` です。リクエストでは 1900-01-01 から 2999-12-31 までです。
  
  # 一覧
  
  ページに分かれた一覧は、先へだけ進みます。
  
  - 次のページは、`meta.nextCursor` の値を `cursor` に書いて読みます。
  - `cursor` が一覧のどの項目も指さないときは 400 です（`not_found`）。
  - 絞り込みの条件を複数書くと、すべてに合う項目を返します。
  
  # レスポンス
  
  - 成功の本文は `{ data, meta, links }` です。
  - 値のないプロパティは null です。空文字や既定値には置き換えません。
  - `createdAt` は作成した日時、`updatedAt` は最後に書き込んだ日時です。作成の直後は、2 つは同じ値です。
  - 作成の応答の `Location` ヘッダーは、`links.self` と同じ URL です。
  - どのレスポンスにも `X-Request-Id` ヘッダーがあります。値は、リクエストの `X-Request-Id`（英数字と `_`、`.`、`:`、`-` の 128 文字まで）か、なければ新しい UUID です。本文の `correlationId` も同じ値です。
  - 読み取りは、進行中の書き込みを待ちません。読み始めたときに確定している値を返します。
  
  # エラー
  
  エラーの本文は、問題の詳細（RFC 9457。`application/problem+json`）です。稼働の監視の 503 だけは、監視の結果を返します。
  
  - 文（`title`、`detail`、`errors[].message`）は、`Accept-Language` に合う言語で書きます。日本語と英語があり、合う言語がなければ英語です。`code`、`field`、`rule` は、言語で変わりません。成功のレスポンスも、言語で変わりません。
  - パスが指すものがなければ 404、クエリ、本文、`cursor` が指すものがなければ 400（`not_found`）です。
  - 権限の届かないもの（ほかのサロンのレコードなど）と、削除したものは、存在しないものと区別しません。
  - 規則に合わない値は 400 で、`errors` に 1 件ずつ入ります。画面は、`field` と `rule` で分岐します。
  
  `rule` の値は、次のとおりです。これ以外の `rule` は、領域の要件にあります。
  
  - `invalid_type`: 型が違う。必須のキーがない。null にできない値が null。整数でない
  - `invalid_format`: UUID、日付、日時、時刻、メールアドレス、URL、決まった書式の文字列の形でない。空白だけの文字列。数値でないクエリの値
  - `invalid_value`: 列挙にない値
  - `too_small`、`too_big`: 数、長さ、件数、日付が範囲の外
  - `not_multiple_of`: 金額の小数が 2 桁を超える
  - `unrecognized_keys`: 定義にないキー
  - `not_found`: クエリ、本文、`cursor` が指すものがない
  - `custom`: 複数の値にまたがる規則に合わない
  """)
namespace BeautySalon {

}
