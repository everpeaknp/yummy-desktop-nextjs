# Frontend Structure & Requirement Analysis

This document provides a detailed mapping of the existing Flutter application to the new Next.js structure. It serves as the master blueprint for the migration.

## 1. Project Directory Structure (Next.js App Router)

```
app/
├── (auth)/                 # Authentication Group
│   ├── login/page.tsx      # Login Screen
│   ├── register/page.tsx   # Sign-up Screen
│   └── layout.tsx          # Auth Layout (Centering, etc.)
├── (dashboard)/            # Main App Group (Sidebar + Header)
│   ├── layout.tsx          # Dashboard Shell (Sidebar, Header, AuthCheck)
│   ├── page.tsx            # /admin-dashboard (Redirects based on role)
│   ├── admin/              # Admin Specific Pages
│   ├── orders/             # Order Management
│   │   ├── active/         # /running-orders
│   │   ├── history/        # /order-history
│   │   ├── new/            # /orders/create (Channel Selection)
│   │   └── [id]/           # Order Details
│   ├── menu/               # Menu Management
│   │   ├── items/          # /menu-management
│   │   ├── categories/     # /item-categories
│   │   └── modifiers/      # /modifier-groups
│   ├── tables/             # Table Management
│   ├── customers/          # CRM
│   ├── finance/            # Finance Module
│   │   ├── expenses/
│   │   ├── income/
│   │   └── payroll/
│   └── inventory/          # Inventory Module
└── layout.tsx              # Root Layout (Providers: Theme, Query, Toast)
```

## 2. Route Mapping & Requirements

### Module: Authentication
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/auth` | `/login` | `POST /auth/login`, `POST /auth/firebase/google` | `LoginForm`, `SocialAuthButton` |
| `/auth` (Tab) | `/register` | `POST /users/admin/register` | `RegisterForm` |
| `/forgot-password` | `/forgot-password` | `POST /auth/forgot-password` | `RequestResetForm` |

### Module: Dashboard (Home)
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/admin-dashboard` | `/dashboard` | `GET /admin/dashboard/v2`<br>`GET /notifications/unread-count` | `StatsCards`, `HealthStatusWidget`<br>`DailyTrendsChart`, `DashboardDateFilter` |

### Module: Order Management
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/running-orders` | `/orders/active` | `GET /orders/active`<br>`GET /orders/summary` | `ActiveOrderList` (Kanban/Grid),<br>`OrderFilterBar`, `StatCard` |
| `/order-history` | `/orders/history` | `GET /orders/summary?date_from=...` | `OrderHistoryTable`, `DateRangePicker` |
| `/new-order` | `/orders/new` | `GET /restaurants/tables` | `ChannelSelector` (Dine-in/Takeaway) |
| `/order-screen` | `/orders/[id]/edit` | `GET /menus/restaurant/{id}`<br>`POST /orders/{id}/items` | `PointOfSaleUI`, `MenuGrid`, `CartSidebar` |
| `/table-order` | `/tables/[id]/order` | `GET /orders/{active_order_id}` | `TableOrderView` |
| `/bill-preview` | `/orders/[id]/bill` | `GET /orders/{id}/bill` | `BillPreview`, `PaymentModal` |

### Module: Menu Management
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/menu-management` | `/menu/items` | `GET /menus/restaurant/{id}/summary`<br>`DELETE /menus/{id}` | `MenuItemTable`, `ImageUploader`<br>`InventoryLinkerModal` |
| `/menu-add` | `/menu/items/new` | `POST /menus/{id}`<br>`GET /item-categories/...` | `MenuItemForm` |
| `/item-categories` | `/menu/categories` | `GET /item-categories/...` | `SortableList`, `QuickAddForm` |
| `/modifier-groups` | `/menu/modifiers` | `GET /modifiers/groups` | `ModifierGroupCard` |

### Module: Tables
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/tables` | `/tables` | `GET /restaurants/tables/summary` | `FloorPlanView`, `TableCard` (Draggable?) |
| `/tables-manage` | `/tables/manage` | `POST /restaurants/tables` | `TableEditor` |

### Module: Inventory
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/inventory-list` | `/inventory` | `GET /inventory/items` | `InventoryTable`, `StockAdjustModal` |
| `/purchases` | `/inventory/purchases` | `GET /general-purchases` | `PurchaseOrderList` |

### Module: CRM & Discounts
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/customers` | `/customers` | `GET /customers` | `CustomerTable`, `PurchaseHistory` |
| `/discounts` | `/discounts` | `GET /discounts` | `DiscountRuleBuilder` |

### Module: Finance
| Flutter Route | Next.js Path | APIs Required | Key Components |
|:--- |:--- |:--- |:--- |
| `/expenses` | `/finance/expenses` | `GET /expenses` | `ExpenseList`, `AddExpenseModal` |
| `/income` | `/finance/income` | `GET /income/summary` | `IncomeChart`, `TransactionList` |
| `/payroll` | `/finance/payroll` | `GET /payroll/runs` | `PayrollTable` |

## 3. Shared Components Strategy

To stick to the design system, we need these core "dumb" components:

- **`AppCard`**: Wrapper with standard border/radius/shadow.
- **`AppButton`**: Primary (Orange), Secondary (Blue), Destructive (Red).
- **`AppTextField`**: Standardized input with label and error state.
- **`MetricTile`**: For dashboard stats (Title, Value, Trend).
- **`StatusBadge`**: Pill-shaped badge for Order/Payment status.
- **`DataTable`**: Reusable table with pagination and sorting (Shadcn Table).
- **`Modal/Sheet`**: For "Add Item", "Link Inventory" flows.

## 4. State Management Plan

- **Global Auth**: `Zustand` store persisting user token and role.
- **Server State**: `TanStack Query` (React Query) for all API data.
  - Replaces Flutter `Bloc` for data fetching.
  - Automatic background refetching (stale-while-revalidate).
- **Form State**: `React Hook Form` + `Zod` validation.

## 5. API Client Strategy

- Use **Axios** with interceptors.
- **Auth Interceptor**:
  - Attach `Bearer` token.
  - Handle `401` -> Attempt Refresh -> If fail, Redirect to Login.
- **Base URL**: Configurable via `.env`.
