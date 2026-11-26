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
    description: "稼働の監視に使う操作です。プロセスが生きているか、リクエストを受けられるか、依存先の状態を答えます。監視の仕組みが呼ぶので、認証は要りません。",
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
@doc("Comprehensive REST API for managing beauty salon operations including salons, staff, services, customers, bookings, treatments, payments, inventory, and access control. Built with TypeSpec for type-safe API-first development.")
namespace BeautySalon {
// All models and operations are imported from separate files
// This namespace serves as the root for all API resources

// The API follows REST best practices with:
// - Consistent resource naming and URL patterns
// - Standard HTTP methods and status codes
// - Comprehensive error handling with Result types
// - Pagination support for list operations
// - Filtering and sorting capabilities
// - Role-based access control

}
