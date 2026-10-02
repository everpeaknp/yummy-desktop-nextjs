# Wave 9 Settings UI Audit

Status: audit complete; no Settings UI migration has started.

This document maps the current Settings and configuration surface from the checked-in Next.js code. It is a code-level audit only: no browser review, API mutation, UI change, or business-logic change was performed.

## Executive summary

The application already has the beginnings of the intended ownership model, but it does not yet present one coherent Settings product.

The most important findings are:

1. `/settings` is the intended canonical hub, but `/manage/additional-settings` renders the same client page directly instead of redirecting. Both URLs therefore own the same UI and query-driven dialogs.
2. The hub has been regrouped into sensible categories, but it mixes real settings, device-local preferences, partially implemented controls, destructive account actions, and links to domain-owned workspaces.
3. Finance configuration is mostly owned correctly by `/finance/setup` and `/finance/operations`. The old `/finance/accounting/*` clients are compatibility code and are unreachable because their parent layout redirects to `/finance/operations`.
4. Route access is inconsistent. The Settings sidebar item requires `admin.staff.view`, direct `/settings` access falls back to all dashboard roles, and every nested `/manage/*` route currently inherits the broad `/manage` permission `admin.staff.view` unless a page performs an additional check. Backend authorization remains authoritative, but the frontend does not communicate a single policy.
5. Mobile title/back ownership is duplicated between `components/layout/header.tsx` and `lib/mobile-module-navigation.ts`. Several Settings children return to `/manage` or `/manage/profile` rather than `/settings`; `/manage/stations` and `/leave-restaurant` rely on generic fallbacks.
6. The Settings hub uses approved list primitives, but most detail screens are from different generations: legacy card forms, custom modals, fixed three-pane designers, tables inside dialogs, and page-specific loading/error states.
7. Some visible controls do not represent durable product behavior. Language is informational, Gallery fetching/deletion is disabled, several preferences are local-browser only, Strict Inventory Mode has no persistence handler, and the kitchen sound key does not match the preference model.

The recommended first implementation stage is the Settings Hub and route/navigation ownership. Detail screens should migrate only after every destination has one canonical owner and a clear access policy.

## 1. Current route inventory

### Access model used in this audit

The dashboard route guard checks the longest matching entry in `ROUTE_PERMISSIONS` before legacy roles. Important consequences:

- `/settings` has no entry in `ROUTE_PERMISSIONS`; it falls back to `ROUTE_ROLES` and is allowed to all dashboard roles.
- The sidebar still requires `admin.staff.view` before showing Settings.
- `/manage/*` inherits `/manage: admin.staff.view`, including Profile, Roles, Taxes, Audit logs, Stations, Restaurant operations, and the designers.
- `/premium` uses the legacy `ADMIN_MANAGER` role rule.
- `/finance/setup` inherits `finance.income.view` from `/finance`.
- `/finance/accounting/setup` would require `finance.accounting.view`, but the parent layout redirects before the page can render.
- `/leave-restaurant` is explicitly allowed for any authenticated member; the backend preflight controls whether leaving is possible.

This is a description of current frontend behavior, not the recommended policy.

### Canonical and user-facing routes

| Route                                         | Current purpose and owner                                                    | Main components                                                                                                                  | Current access                                                                                     | Actions and workflows                                                                                                                                                                                  | Current status                                                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings`                                   | General Settings hub; intended canonical Settings owner                      | Re-exports `manage/additional-settings/page.tsx`; `AppPage`, `PageHeader`, `SearchField`, `DataList`, `ListRow`, shared `Dialog` | Direct route: all dashboard roles. Sidebar visibility: `admin.staff.view`                          | Search settings; open local/dialog settings; link to Business Profile, Restaurant operations, designers, Roles, Finance setup, Taxes, Audit logs, Plans                                                | Canonical URL, but not a distinct implementation boundary                                                                                     |
| `/manage/profile`                             | Restaurant/business identity and business-day configuration                  | Custom form, `Card`, `LocationPicker`, `TimezoneSelect`, `AppPhoneInput`, `FieldInfo`                                            | Inherits `/manage: admin.staff.view`; backend controls update                                      | Upload logo/cover; edit name, phone, address, PAN/VAT, timezone, business-day start, coordinates, description; save/discard                                                                            | Real configuration screen; incorrectly treated as a top-level mobile destination and visually legacy                                          |
| `/manage/settings?tab=advanced`               | Restaurant operational behavior                                              | `AppPage`, `PageHeader`, Radix `Tabs`, cards, switches                                                                           | Inherits `/manage: admin.staff.view`; no meaningful local permission gate                          | Enable/disable KOT; enable/disable tax when not fiscally locked; view disabled service-charge control; display non-persistent Strict Inventory switch                                                  | Real KOT/tax updates mixed with placeholder controls                                                                                          |
| `/manage/settings?tab=payments`               | Payment-provider integration                                                 | Same page; cards, forms, QR/card dialogs                                                                                         | Same route access; backend controls mutation                                                       | Configure FonePay credentials and active state. Hidden legacy blocks still contain payment banks, static QR and card configuration. Links users to Finance operations for accounts/instruments/drawers | Transitional route; provider integration belongs to Finance & payments, not Restaurant operations                                             |
| `/manage/taxes`                               | Canonical tenant tax/fee configuration                                       | `AppPage`, `PageHeader`, `DataList`/`ListRow` mobile, desktop `Table`, `TaxDialog`                                               | Inherits `/manage: admin.staff.view`; fiscal profile and backend lock VAT changes                  | Toggle global tax, add/edit/delete one tax configuration, view fiscal lock                                                                                                                             | Functional and responsive, but duplicated tax enablement remains in Restaurant operations and dormant hub code                                |
| `/manage/roles`                               | Role templates and custom permission sets                                    | `AppPage`, `PageHeader`, `SearchField`, cards, badges, custom `SimpleModal`                                                      | Inherits `/manage: admin.staff.view`; no page-level granular gate                                  | Search; create from built-in template; create/edit/delete custom role; select grouped permissions                                                                                                      | Functional but uses a card gallery and a one-off modal rather than approved register/form grammar                                             |
| `/manage/audit-logs`                          | Last 30 days of administrative/operational activity                          | `AppPage`, `PageHeader`, `SearchField`, selects, mobile `DataList`, desktop `Table`, detail `Dialog`                             | Inherits `/manage: admin.staff.view`; backend may reject                                           | Search; filter entity/action; inspect actor, event, values, and changes                                                                                                                                | Functional read-only administration workspace; detail UI is card-heavy                                                                        |
| `/manage/receipt-designer`                    | Receipt/bill template authoring                                              | Entitlement gate, page loader, `ReceiptDesigner`, `ThermalPreview`, block/property editors                                       | `/manage` permission plus `designers.receipt.enabled` entitlement                                  | Add/reorder/edit/delete blocks; switch bill/receipt preview; save restaurant template                                                                                                                  | Canonical domain tool, but fixed 280px + flexible preview + 320px composition is desktop-oriented and not a mobile design                     |
| `/manage/kot-designer`                        | KOT template authoring                                                       | Entitlement gate, page loader, `KOTDesigner`, `ThermalPreview`, block/property editors                                           | `/manage` permission plus `designers.kot.enabled` entitlement                                      | Add/reorder/edit/delete blocks; preview; save restaurant template                                                                                                                                      | Same fixed three-pane responsiveness issue as Receipt Designer                                                                                |
| `/manage/stations`                            | Cross-domain station/department master data and printer assignment           | `StationsManagementClient`, custom page header, `Card`, desktop `Table`, dialogs                                                 | Inherits `/manage: admin.staff.view`; backend controls changes                                     | Show inactive; add/edit; assign business line/printer; deactivate/reactivate                                                                                                                           | Correctly domain-specific master data, linked from Manage and Finance setup; missing explicit mobile route metadata and mobile list treatment |
| `/finance/setup`                              | Canonical Finance configuration directory                                    | `AppPage`, `PageHeader`, grouped link rows                                                                                       | Inherits `/finance: finance.income.view`                                                           | Link to Chart of Accounts, Stations, Finance operations tabs, Taxes, and reports                                                                                                                       | Approved Finance owner; should remain a domain settings directory rather than be duplicated in general Settings                               |
| `/finance/operations?tab=accounts`            | Cash/bank/safe/owner-fund account management                                 | `AppPage`, `PageHeader`, scrollable tabs, responsive rows, dialogs                                                               | Route requires `finance.income.view`; account mutation checks `finance.payment_instruments.manage` | Add/edit/archive/reactivate financial accounts; view balances                                                                                                                                          | Approved Finance workspace                                                                                                                    |
| `/finance/operations?tab=payment-instruments` | Checkout payment instruments and settlement mapping                          | `PaymentInstrumentsPanel` inside Finance operations                                                                              | Route plus component/backend permission rules                                                      | Configure terminals, QR/wallet/card instruments and settlement accounts                                                                                                                                | Approved Finance workspace                                                                                                                    |
| `/finance/operations?tab=cash-drawers`        | Drawer configuration                                                         | `CashDrawerConfigPanel` inside Finance operations                                                                                | Route plus component/backend permission rules                                                      | Configure drawers, float/cashier behavior and related controls                                                                                                                                         | Approved Finance workspace; operational `/cash-drawers` remains separate                                                                      |
| `/finance/heads`                              | Chart of Accounts                                                            | `AccountHeadsClient`                                                                                                             | `finance.coa.view`; mutations have their own backend permissions                                   | View/manage accounts and reporting hierarchy                                                                                                                                                           | Correct Finance owner                                                                                                                         |
| `/premium`                                    | Billing catalog, current subscription, usage, invoices, plan/add-on requests | Custom page, `Card`, `UsageIndicator`, alerts, tables, contact and feature dialogs                                               | `ADMIN_MANAGER` role rule                                                                          | Refresh billing state; compare plans/add-ons; save upgrade request; contact Yummy; inspect features, usage, invoices                                                                                   | Functional Billing destination, but visually isolated from Settings and uses an oversized marketing/card composition                          |
| `/leave-restaurant`                           | Personal restaurant-membership exit workflow                                 | Custom `Card`, preflight states, blocker actions, destructive confirmation                                                       | Explicitly allowed for authenticated members; backend preflight authoritative                      | Check ownership/drawer/attendance blockers; refresh; leave restaurant; redirect to onboarding                                                                                                          | Correct personal membership workflow; not currently linked as a first-class Settings row and missing route metadata                           |

### Compatibility, alias, hidden, and non-canonical routes

| Route                         | Current behavior                                                                                                                                                                             | Recommendation                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/manage/additional-settings` | Renders the same page used by `/settings`; query links such as `?setting=appearance` still target both URLs                                                                                  | Convert to a compatibility redirect to `/settings`, preserving the `setting` query string                                                                                           |
| `/finance/accounting/setup`   | Page imports `AccountingSetupClient`, but `finance/accounting/layout.tsx` redirects every `/finance/accounting/*` request to `/finance/operations`                                           | Keep compatibility redirect; do not reactivate the old setup client. Move any uniquely required repair operation into a permissioned internal/support workflow only if still needed |
| `/dashboard/subscriptions`    | Redirects to `/premium`                                                                                                                                                                      | Keep redirect                                                                                                                                                                       |
| `/manage/compliance`          | Redirects to `/manage`; comment states fiscal activation and CBMS credentials are platform-operator workflows                                                                                | Keep tenant redirect. Do not expose operator credentials in Settings                                                                                                                |
| `/manage/awaiting-payments`   | Redirects to `/suppliers` because supplier bills/allocations are owned by the supplier workspace                                                                                             | Keep redirect                                                                                                                                                                       |
| `/dashboard/payments`         | Static sample dashboard with hard-coded counts and unavailable chart; no API data                                                                                                            | Remove from user navigation and retire or redirect. It is neither settings nor a valid operational report                                                                           |
| `/settings?setting=<id>`      | Deep-links a dialog inside the hub. Used by global search for Appearance, Language, Branding, Gallery, printers, notifications, export, admin management, restaurant switching, and password | Preserve deep-link compatibility during hub migration, but give complex workflows proper subroutes or responsive sheets                                                             |

### Other domain configuration that should not move into Settings

The following are configuration surfaces, but their user task is inseparable from the operational domain. General Settings should link to them when useful, not absorb their forms:

- Menu items, categories, options/add-ons, discounts, and stations.
- Cash/bank accounts, payment instruments, drawers, Chart of Accounts, and finance controls.
- Staff roles as a People & access destination; staff employment/access editing remains in Staff Detail.
- Attendance settings inside the Attendance workspace.
- Hotel settings exposed by hotel-domain clients/endpoints.
- Table layout/edit mode and service configuration.
- Printer-to-station routing may be discoverable from Hardware, but stations remain canonical master data.

## 2. Current Settings hub inventory

`/settings` currently groups these visible destinations:

| Group                 | Item                  | Behavior and persistence                                                                                                   |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Personal              | Appearance            | Dialog; theme changes through `useTheme`                                                                                   |
| Personal              | Language              | Informational dialog; English only, other languages disabled                                                               |
| Personal              | Change password       | Dialog; posts current/new/confirmation credentials                                                                         |
| Personal              | Switch restaurant     | Dialog; loads user restaurants, updates client restaurant store, then reloads `/manage`                                    |
| Business              | Business profile      | Routes to `/manage/profile`                                                                                                |
| Business              | Branding              | Dialog; changes restaurant profile/cover images via gallery selection                                                      |
| Business              | Gallery               | Dialog; upload exists, but gallery fetch and deletion are explicitly disabled                                              |
| Business              | Restaurant operations | Routes to `/manage/settings?tab=advanced`                                                                                  |
| Hardware & documents  | Printer Management    | Large dialog containing printer, routing and device-local auto-print management                                            |
| Hardware & documents  | Receipt Designer      | Routes to `/manage/receipt-designer`                                                                                       |
| Hardware & documents  | KOT Designer          | Routes to `/manage/kot-designer`                                                                                           |
| Notifications         | Kitchen Sounds        | Dialog. Intended device-local preference, but the UI uses `kitchen_sounds` while the preference model uses `kitchen_sound` |
| Notifications         | Push Alerts           | Dialog; browser-local storage only; no notification permission workflow is visible here                                    |
| Notifications         | Email Summaries       | Dialog; browser-local storage only, so it is not an account-level email subscription                                       |
| Notifications         | KOT Notifications     | Dialog; persisted through user preferences API                                                                             |
| Notifications         | Order Notifications   | Dialog; persisted through user preferences API                                                                             |
| People & access       | Roles & permissions   | Routes to `/manage/roles`                                                                                                  |
| People & access       | Admin Management      | Dialog; lists admins, invites, removes access, transfers ownership if owner                                                |
| Finance & compliance  | Finance setup         | Routes to `/finance/setup`                                                                                                 |
| Finance & compliance  | Tax configuration     | Routes to `/manage/taxes`                                                                                                  |
| Finance & compliance  | Payment integrations  | Routes to `/manage/settings?tab=payments`                                                                                  |
| Administration & data | Audit logs            | Routes to `/manage/audit-logs`                                                                                             |
| Administration & data | Data export           | Dialog; downloads Menu, up to 1,000 orders, or administrator records as JSON/CSV                                           |
| Administration & data | Auto Backup           | Dialog; browser-local preference only; it does not implement a backup job                                                  |
| Billing               | Subscription & plans  | Routes to `/premium`                                                                                                       |
| Account & danger zone | Delete account        | Confirmation dialog; deletes the user account and logs out                                                                 |

The file also retains dormant legacy definitions for global tax toggle, logout, support, guides, privacy, and terms. These are not in the current visible category array, although a help-center link still targets the old `guides` query on `/manage/additional-settings`.

## 3. Settings ownership map

### Recommended ownership

```text
Settings

Business
 ├── Business profile
 ├── Branding and media
 ├── Restaurant operations
 └── Business day, location and timezone

Finance & payments
 ├── Finance setup                    -> /finance/setup
 ├── Payment-provider integrations    -> dedicated provider detail
 ├── Taxes & fees                     -> /manage/taxes
 └── Financial accounts/instruments   -> /finance/operations

People & access
 ├── Roles & permissions              -> /manage/roles
 ├── Administrators / ownership
 └── Restaurant membership

Hardware & documents
 ├── Printers and routing
 ├── Receipt designer
 └── KOT designer

Notifications
 ├── Order notifications
 ├── KOT notifications
 └── Device-local sound/browser preferences (clearly labelled)

Administration & data
 ├── Audit logs
 └── Data export

Billing
 └── Subscription & plans             -> /premium

Personal
 ├── Appearance
 ├── Language
 ├── Password/security
 ├── Switch restaurant
 └── Leave restaurant
```

### Ownership corrections

- `/settings` should be the only Settings root.
- `/manage/additional-settings` should redirect, not render a second root.
- `/manage/profile` remains Business Profile; it is not a personal profile.
- Payment-provider credentials belong under Finance & payments. Restaurant operational flags should remain in Restaurant operations.
- Tax enablement and tax configuration need one canonical workspace: `/manage/taxes`. Other screens may link to it or display read-only status.
- Accounts, settlement instruments, drawers, transfers, and Chart of Accounts stay in Finance.
- Stations remain shared product/operations master data. General Settings and Finance setup may both link to the same canonical route.
- Admin Management belongs under People & access, but should not be confused with Staff roles or Staff invitations.
- Restaurant switching and leaving are personal membership actions, not business configuration.
- Fiscal activation/CBMS credentials remain platform-operator owned and must not reappear in tenant Settings.
- Data export is Administration. The current “Staff Registry” export is actually administrators only and must be relabelled or connected to the real Staff dataset before it is presented as Staff export.
- Auto Backup must not be presented as a real administration capability while it is only a local boolean.

## 4. Current UI audit

### Settings hub

#### Mobile and tablet

- The shared app bar owns the title and Back action; the in-content `PageHeader` is hidden below `lg`.
- Search is placed first, followed by grouped divider-led `ListRow` sections. This is the strongest part of the current Settings UI and is aligned with Manage.
- Simple and complex settings both open the same centered `Dialog`; it is not a true mobile full-height sheet.
- The dialog always adds Cancel and Done, even for immediate-save preferences, child components with their own actions, and read-only content. This falsely implies transactional save/cancel semantics.
- Printer Management places desktop tables and fixed-width selectors inside that dialog, making it structurally unsuitable for narrow widths.
- Search has a custom oversized empty result instead of shared `EmptyState`.
- Mobile back ownership is inconsistent for child routes: Taxes, Roles, Audit logs, and designers point to `/manage` or generic header fallbacks rather than the Settings hub.

#### Desktop

- `AppPage width="wide"` and the approved `PageHeader`, SearchField, DataList, and ListRow provide a clean directory.
- The content remains a single long column despite desktop width. There is no persistent Settings navigation or selected-detail workspace.
- All non-route settings use modal interruption, including workflows that require tables, multiple sections, or long forms.
- Search filters only the hub list; it does not help within Roles, printers, or other detail workspaces.

### Business Profile

#### Mobile and tablet

- Shared mobile app bar labels the route “Business profile,” but the page itself uses no `AppPage`/`PageHeader`.
- Branding is a large card with a 48/64px cover, overlapping 128px logo, hover-only upload overlays, and separate Change Cover/Logo buttons.
- General information is another large card. Fields stack correctly, but the 400px map, large media treatment, and bottom action row produce a long form.
- Save/discard actions are at the end rather than sticky. Uploads save immediately while the rest of the form requires Submit, creating mixed commit semantics.
- Loading occupies the full viewport; fetch failure only emits a toast and then renders an empty form rather than an `ErrorState`.

#### Desktop

- The form is constrained to 1000px and uses two-column fields appropriately.
- It still lacks a desktop page heading/toolbar and uses two large cards rather than a structured form workspace.
- Branding and legal/business fields are not separated by ownership; PAN/VAT identity sits alongside general profile data without a dedicated business identity section.

### Restaurant operations and payment integrations

#### Mobile and tablet

- A shared app bar and a full-width two-tab control are used.
- Payment content is a vertical stack of cards; FonePay fields collapse to one column.
- Dialogs for QR/card setup are conventional centered dialogs rather than mobile sheets.
- Operational switches are individual bordered cards/rows. KOT and tax save immediately.
- The visible Strict Inventory switch has no update handler, so it appears actionable without durable behavior.

#### Desktop

- Standard-width page and two-column FonePay fields are reasonable.
- “Payments & POS” mixes a provider credential form with migration messaging. Hidden legacy QR/card/bank sections remain in the component, increasing maintenance ambiguity.
- Finance migration links do not preserve exact requested tabs for the first two buttons; both currently link to `/finance/operations` rather than distinct tab queries.

### Taxes & fees

#### Mobile and tablet

- Shared app bar/PageHeader action behavior, alerts, global toggle, and a mobile `DataList` are present.
- Add Tax remains a PageHeader action; the list uses overflow for edit/remove.
- Loading and empty states are plain text inside the list, not shared feedback states.
- Alerts use light-only blue/amber classes in several places and need semantic token review.

#### Desktop

- A bounded table replaces the mobile list and exposes name, type, percentage, status, and actions.
- The tax dialog handles add/edit and global fiscal locks correctly.
- The page still has several stacked card/alert surfaces for a very small data model.

### Roles & permissions

#### Mobile and tablet

- Shared app bar is present, but role templates and custom roles are displayed as card grids rather than compact rows.
- Create/Edit uses a custom portal modal, explicitly added to avoid a Radix presence-loop issue. It is centered and max-height based, not a full-height mobile editor.
- Permission selection can become a long two-column checkbox collection; mobile falls to one column but remains dense.
- Loading uses bespoke uppercase copy and spinner. No explicit load error state is rendered.

#### Desktop

- PageHeader, Create action, SearchField, responsive template grid and custom-role grid are used.
- The card gallery consumes more space than a roles register and hides row actions until hover.
- The editor has good grouped permissions and risk indicators, but it is a one-off form system rather than the shared desktop sheet/dialog grammar.

### Audit logs

#### Mobile and tablet

- Search plus entity and action selects stack responsively.
- Activity uses `DataList`/`ListRow`; tapping opens a detail dialog.
- The detail is a long collection of cards and can expose raw entity IDs, source strings, and value payloads.
- Loading/empty states are inline custom blocks.

#### Desktop

- A desktop table with actor/entity/action/date replaces the list.
- Detail remains a modal up to 600px with its own scrolling and nested cards/table.
- The fixed 30-day scope is only described in the header; there is no date control or export.

### Printers and routing

#### Mobile and tablet

- This component is embedded in a Settings dialog rather than owning a route/sheet.
- Configured printers and station routing are tables; station and receipt selects use a fixed 240px width.
- Add/edit uses another dialog nested in the parent Settings dialog.
- Local device station selection is correctly device-specific, but that distinction is only explanatory copy.

#### Desktop

- It supports printer list, enable/default/test/edit/delete, KOT station routing, receipt printer, and local auto-print station choices.
- The task set is substantial enough to be a Hardware workspace, not modal content.

### Receipt and KOT designers

#### Mobile and tablet

- The route has a shared mobile app bar, entitlement gate, and full-page content.
- The actual designer uses three simultaneous panes with fixed 280px and 320px sidebars and a central preview. No mobile composition or pane switching exists.
- Loading and restaurant-not-found states are page-specific full-screen blocks; the fallback Back button targets the alias route.

#### Desktop

- The three-pane authoring layout is appropriate to a wide editor: block palette/order, live thermal preview, and selected-block properties.
- Save is local to the designer header. The page does not use the shared page workspace shell.

### Stations

#### Mobile and tablet

- Custom header stacks title and Add Station, but the data remains a horizontally scrollable desktop table.
- There is no explicit mobile app-bar metadata; the app bar derives “Stations” generically and header Back falls through to `/manage/profile` for `/manage/*`.
- Create/edit dialogs are not mobile sheets.

#### Desktop

- The max-5xl page, count/filter toolbar, table, and create/edit/deactivate dialogs are coherent.
- It does not use shared `AppPage`, `PageHeader`, register feedback states, or responsive data-view patterns.

### Billing / Plans

#### Mobile and tablet

- The page has its own hero, refresh action, current-plan card, usage grid, plan cards, add-on cards, invoices table, and contact dialogs.
- Content stacks, but the marketing hierarchy is much larger than the calm administrative grammar used elsewhere.
- The invoices area uses horizontal overflow. Multiple dialogs repeat nearly identical contact forms.

#### Desktop

- Responsive plan/add-on grids and a wide invoice table use the available space.
- There is no Settings left navigation or shared `AppPage`/`PageHeader`; Billing feels like a separate marketing page.

### Leave restaurant

#### Mobile and tablet

- Uses an internal Back button in addition to the global shell behavior because the route is not explicitly registered.
- One large rounded card contains preflight, blockers, remediation links, and destructive action.
- The workflow states are clear and safety-oriented, but it is visually separate from Personal settings.

#### Desktop

- The centered max-3xl readiness workflow is appropriate for a destructive operation.
- It should remain a dedicated route; only its navigation ownership and shell need alignment.

## 5. Existing component usage and gaps

### Shared foundation already used

- `AppPage`: Settings hub, Restaurant operations, Roles, Taxes, Audit logs, Finance setup, Finance operations.
- `PageHeader`: same routes except Business Profile, Stations, designers, Billing, and Leave Restaurant.
- `SearchField`: Settings hub, Roles, Audit logs.
- `DataList` / `ListRow`: Settings hub, mobile Taxes, mobile Audit logs.
- Shared buttons, inputs, labels, select, switch, badge, alert, dialog, tabs, table, and textarea primitives are widely used.
- EntitlementGate correctly protects both designer routes.

### Approved patterns not consistently used

- `MobileRegisterToolbar` and `FilterBar` are not used by settings registers such as Roles or Audit logs.
- `ResponsiveDataView` is not used; pages hand-code `md:hidden` list and desktop table branches.
- Shared `LoadingState`, `ErrorState`, and `EmptyState` are mostly absent.
- Settings forms do not share a section/form layout or sticky mobile action pattern.
- Complex mobile workflows use dialogs rather than bottom/full-height sheets.
- Detail fields/grids are not used for read-only configuration summaries.

### One-off and duplicated implementation

- `manage/additional-settings/page.tsx` is a 1,300+ line hub, dialog router, forms collection, data/export/admin host, destructive flow, and preference controller.
- Roles uses its own `SimpleModal` and scroll-lock implementation.
- Business Profile, Stations, Billing, Leave Restaurant, and both designers each implement their own page shell.
- Mobile route metadata and Header title/back logic are separate registries that already disagree.
- Tax enablement is implemented in Taxes, Restaurant operations, and dormant hub dialog code.
- Payment setup exists as current Finance operations, visible FonePay integration, and hidden legacy payment bank/QR/card code.
- Branding exists in Business Profile and the Settings hub dialog.
- Administrator management overlaps conceptually with the Staff invitation/access system but uses distinct APIs and UI.

## 6. UI-facing settings data model

### Business

- Restaurant name, phone, physical address, description.
- Logo/profile image and cover image.
- PAN/VAT number.
- Timezone and business-day start time.
- Latitude/longitude and mapped location.
- Restaurant KOT enabled state.
- Global tax enabled state, subject to fiscal lock.

### Finance & payments

- Tax name, percentage, active state, and global enablement.
- FonePay merchant code, API user, API secret, API password, active state.
- Cash/bank/safe/owner-fund accounts.
- Payment instruments and their settlement accounts.
- Cash drawers and drawer configuration.
- Chart of Accounts and reporting heads.
- Stations/departments used as financial reporting dimensions.

### People & access

- Built-in role templates.
- Custom role name, description, permission keys and risk metadata.
- Restaurant administrators, owner identity, invitation codes, ownership transfer, access removal.
- Current restaurant membership, switching, and leaving.

### Hardware & documents

- Printers: name, type, network/Bluetooth address, port, enabled/default state.
- Station-to-printer routing.
- Receipt printer.
- Device-local auto-print stations.
- Receipt and KOT block templates, ordering, style/content properties, preview mode.

### Notifications and personal preferences

- Theme: light, dark, system.
- Backend KOT and order notification preferences.
- Browser-local kitchen sound, push-alert, email-summary, and auto-backup flags.
- Password change.
- Language selection is not yet a persisted feature.

### Administration and billing

- Audit events, actor, entity, action/change field, old/new values, source, timestamp.
- Client-side JSON/CSV exports for menu, orders, and administrator records.
- Current/effective plan, subscription status and period, catalog version, limits/usage, add-ons, invoices, plan requests and contact draft.

## 7. Current workflows

### Find and open a setting

1. User opens `/settings` from Manage, sidebar, or global search.
2. User browses a group or filters the local directory with Search.
3. A route-backed item navigates to a separate workspace.
4. A dialog-backed item sets `?setting=` state only when linked externally; clicks in the page set component state without updating the URL.
5. Dialog content may save immediately, expose its own action, or be informational; the parent still presents generic Cancel and Done buttons.

### Update restaurant profile

1. Load restaurant by current `restaurant_id`.
2. Uploading logo/cover immediately uploads and updates the restaurant record.
3. User edits identity, location, timezone, business-day and description fields.
4. Address and map coordinates synchronize through forward/reverse geocoding.
5. Submit updates the restaurant and refreshes global restaurant state; Discard navigates to `/manage` rather than resetting locally.

### Configure taxes

1. Load tax configurations, restaurant state, and fiscal profile.
2. If an active VAT fiscal profile exists, global enablement and tax mutations are locked and explained.
3. Otherwise, user may toggle global tax.
4. User can add one tax when none exists, or edit/remove the existing tax through `TaxDialog`/overflow.
5. Successful mutation refreshes the list/restaurant state.

### Change role permissions

1. Load custom roles, permission catalog, and built-in role presets.
2. Search existing custom roles or choose a built-in template.
3. Create a custom role from a template or blank state.
4. Optionally expand grouped permission selection; select individual, all, or none.
5. Save creates/updates the role; custom roles can be deleted; system roles cannot.

### Manage administrators

1. Open Admin Management inside the Settings dialog.
2. Load restaurant administrators; a 403 becomes an access-restricted state.
3. A user with `admin.staff.manage` may invite by verified name/email and copy a returned manual code.
4. Eligible administrators may be removed; the owner and current admin are protected.
5. Only the current owner may transfer ownership to another administrator.

### Configure payment provider

1. Open Restaurant operations → Payments & POS.
2. Load restaurant and Finance payment-bank data.
3. Configure FonePay enablement and credentials.
4. Save through the FonePay-specific restaurant endpoint.
5. Configure settlement accounts/instruments/drawers in Finance operations through linked destinations.

### Configure printers

1. Load printers, active stations, current receipt printer, and device-local station choices.
2. Add/edit a network or Bluetooth printer; set address/port and enabled/default flags.
3. Test via Electron network printing when available, otherwise backend printer test.
4. Enable/disable, make default, edit, or delete a printer.
5. Assign printers to stations and select the receipt printer.
6. Choose local auto-print stations in browser/device local storage.

### Edit receipt or KOT template

1. Entitlement gate verifies plan access.
2. Page loads restaurant templates.
3. Designer maps stored blocks or uses defaults.
4. User adds, selects, edits, reorders, or removes blocks while previewing output.
5. Save updates the restaurant template payload.

### Export data

1. Open Data Export dialog.
2. Choose Menu, Recent Orders, or Staff Registry and JSON/CSV.
3. Client fetches a complete menu, up to 1,000 order summaries, or restaurant administrators.
4. Browser constructs and downloads the file.

### Manage subscription

1. Load catalog, current subscription, usage and invoices from the subscription store.
2. Compare published plan pricing/features and optional add-ons.
3. Save a plan/add-on request.
4. Optionally use prepared contact details via email/clipboard/contact dialog.
5. Refresh reloads billing state; actual fulfillment remains handled by Yummy.

### Leave restaurant

1. Load a leave preflight.
2. Show ownership, open drawer, or attendance blockers with remediation links.
3. If eligible, ask for destructive confirmation.
4. Post leave, refresh auth/profile, clear restaurant state, and navigate to onboarding.

## 8. Problems and inconsistencies

### Navigation and ownership

- Two Settings URLs render the same page instead of one canonical URL plus redirect.
- Child back routes do not consistently return to Settings.
- Business Profile is configured as a global top-level mobile route even though it is business configuration.
- Header route metadata is duplicated, so title/back behavior can drift.
- Global search still links to the alias for Guides, which is not visible in the current hub.
- Finance setup correctly owns several controls, but transitional/hidden code leaves users and maintainers with multiple apparent owners.

### Permissions and discoverability

- Direct access, sidebar visibility, route permission, local permission and backend permission are not aligned.
- `admin.staff.view` is an inappropriate blanket gate for Taxes, printers, documents, business profile, and other Settings domains.
- The hub does not filter rows by the destination’s actual permission/entitlement. A user may see a row and then hit a route guard, entitlement gate, 403, or mutation failure.
- Roles has no explicit `admin.roles.manage`-style page check in the client.
- Finance setup is visible based on `finance.income.view`, while its children require different capabilities.

### Information hierarchy

- General Settings combines personal preferences, business configuration, hardware, access, finance links, billing, data tools, and account deletion in one long list.
- The single modal architecture treats a theme toggle and a printer management system as equivalent tasks.
- Billing uses marketing-page hierarchy; Business Profile uses media-first card hierarchy; Roles uses a gallery; the system lacks one settings detail grammar.
- Personal account, restaurant membership, Staff access, and restaurant administrators are conceptually adjacent but currently fragmented.

### Responsive behavior

- The Settings hub is usable on mobile but underuses desktop workspace navigation.
- Printer Management and designers are desktop compositions without mobile task switching.
- Stations is a desktop table on mobile.
- Roles editor, Audit detail, and hub dialogs are centered modals rather than mobile sheets.
- Business Profile has hover-dependent image overlays and a non-sticky long-form action row.
- Several desktop pages are effectively stretched mobile stacks; others are dense custom dashboards.

### Forms and save semantics

- Immediate-save switches, child-managed forms, informational content, and destructive actions share generic Cancel/Done footer controls.
- Business Profile mixes immediate image persistence with deferred form submission.
- Labels/copy/styles vary between sentence case and legacy uppercase/italic presentation.
- Confirmations use both native `window.confirm` and shared Alert/Dialog components.
- There is no consistent dirty-state, reset, sticky save, success, or mutation-error grammar.

### State and implementation completeness

- Strict Inventory Mode is visually interactive but has no persistence handler.
- Service Charge is disabled placeholder UI.
- Language is not configurable.
- Gallery retrieval and deletion are disabled; upload does not produce a working gallery management loop.
- Push alerts, Email summaries, and Auto backup are browser-local flags and do not implement the promised cross-device service.
- Kitchen Sounds uses a plural key that does not match the preference model’s singular `kitchen_sound` field.
- Static QR, card-account and payment-bank management remain hidden in the Restaurant settings component.
- The legacy Accounting setup client remains in source despite being unreachable.
- The static `/dashboard/payments` page contains hard-coded figures and actions with no behavior.

### Feedback states and accessibility

- Many pages use bespoke spinners/plain text instead of shared feedback states.
- Several load failures only emit toasts, leaving empty or misleading content.
- Some row actions appear only on hover at desktop.
- Icon buttons are not uniformly labelled; native confirmations lack the richer context of shared destructive flows.
- Fixed-width selects and tables can force mobile overflow.
- Light-only semantic color classes need dark-theme/token review.

## 9. Comparison with approved product patterns

### Reuse from Manage

- Keep the grouped directory model, restrained section labels, divider-led `DataList`, and `ListRow` navigation.
- Keep Manage as the mobile/tablet directory and `/settings` as a secondary workspace.
- Do not turn Settings into a card dashboard.

### Reuse from Inventory

- Use `AppPage` width/density intentionally.
- Adopt shared Loading/Error/Empty states and bounded desktop content.
- Preserve domain-specific tools such as designers and printers rather than forcing them into generic rows once opened.

### Reuse from Customers and Suppliers

- Mobile: app bar, compact identity/context when needed, grouped sections, attached action hierarchy, sheets for focused workflows.
- Desktop: persistent local navigation or bounded workspace, structured content columns, and source-specific detail rather than stacked cards.
- Settings does not need party identity chrome, but it should reuse the workspace/detail rhythm.

### Reuse from Staff

- Direct, visible section navigation; do not hide important configuration behind a generic More menu.
- Mobile horizontally scrollable section navigation is appropriate only inside a coherent large workspace, not for the top-level Settings directory.
- Desktop should be deliberately composed with a local rail and workspace, not a stretched mobile stack.
- Use clear unknown/unavailable/restricted states instead of repeating generic failures.

### Settings-specific form grammar

Settings needs a shared form composition, built from existing primitives rather than a new visual system:

- section heading and optional description;
- flat grouped fields with dividers;
- explicit scope labels such as “This device,” “Your account,” or “This restaurant”;
- one save model per screen: immediate save or staged save, never both without explanation;
- sticky mobile Save/Cancel only for staged forms;
- desktop action toolbar near the page title/section, not repeated card footers;
- responsive sheet on mobile and dialog/workspace on desktop according to task size;
- shared feedback states and permission-aware disabled/explanatory states.

## 10. Proposed future Settings architecture

### Mobile and tablet

```text
App bar: Back | Settings

Search settings

Business
  Business profile
  Branding and media
  Restaurant operations

Finance & payments
  Finance setup
  Payment integrations
  Taxes & fees

People & access
  Roles & permissions
  Administrators and ownership
  Restaurant membership

Hardware & documents
  Printers and routing
  Receipt designer
  KOT designer

Notifications
  Order and KOT notifications
  Device preferences

Administration & data
  Audit logs
  Data export

Billing
  Subscription & plans

Personal
  Appearance
  Language
  Password and security
  Switch restaurant
  Leave restaurant
```

Rules:

- The hub is navigation, not the place where every form must render.
- Simple preferences may use a focused bottom sheet.
- Multi-section configuration gets a route and mobile full-height workspace.
- Bottom navigation remains suppressed on Settings descendants.
- Every child app bar returns to `/settings` unless the child is explicitly nested under a domain owner such as Finance.
- Rows are filtered or explained using the same access decision as the destination.

### Desktop

```text
Settings

┌──────────────────────────┬─────────────────────────────────────────┐
│ Search settings          │ Selected setting                        │
│                          │                                         │
│ Business                 │ Page title + description + actions      │
│ Finance & payments       │                                         │
│ People & access          │ Structured sections / form / register   │
│ Hardware & documents     │                                         │
│ Notifications            │                                         │
│ Administration & data    │                                         │
│ Billing                  │                                         │
│ Personal                 │                                         │
└──────────────────────────┴─────────────────────────────────────────┘
```

Rules:

- Use a sticky local Settings rail within the existing desktop shell.
- Route-backed domain tools may replace the right workspace while retaining Settings ancestry.
- Complex editors such as Receipt/KOT Designer may use a full-width editor route rather than the two-column settings shell.
- Do not duplicate Finance, Staff, Menu, or operational configuration forms in Settings; use canonical links.
- Preserve existing URLs through redirects and query compatibility.

## 11. Proposed route ownership and redirects

| Existing route                                            | Future treatment                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/settings`                                               | Canonical Settings hub and desktop Settings shell                                                       |
| `/manage/additional-settings`                             | Redirect to `/settings`, preserving `setting` query                                                     |
| `/manage/profile`                                         | Keep route compatibility; present as Settings → Business profile and correct mobile back ownership      |
| `/manage/settings`                                        | Keep as Settings → Restaurant operations; separate provider integrations if necessary                   |
| `/manage/taxes`                                           | Keep canonical Taxes route; remove duplicate editable tax controls elsewhere                            |
| `/manage/roles`                                           | Keep canonical Roles route under People & access                                                        |
| `/manage/audit-logs`                                      | Keep canonical Audit route under Administration                                                         |
| `/manage/stations`                                        | Keep canonical Product/Operations master-data route; link from Finance and Settings without duplication |
| `/manage/receipt-designer`, `/manage/kot-designer`        | Keep canonical full editor routes under Hardware & documents                                            |
| `/finance/setup`, `/finance/operations`, `/finance/heads` | Keep Finance ownership; Settings links only                                                             |
| `/finance/accounting/*`                                   | Keep compatibility redirect; do not revive legacy UI                                                    |
| `/premium`                                                | Keep canonical Billing route; align shell/navigation                                                    |
| `/leave-restaurant`                                       | Keep dedicated safety workflow; expose from Personal/restaurant membership                              |
| `/dashboard/subscriptions`                                | Keep redirect to `/premium`                                                                             |
| `/dashboard/payments`                                     | Retire or redirect to canonical Finance destination                                                     |
| `/manage/compliance`                                      | Keep tenant redirect; operator workflow remains outside product Settings                                |

## 12. Migration plan

### Stage 9.1 — Settings Hub and navigation ownership

- Make `/settings` the implementation owner.
- Redirect `/manage/additional-settings` with query preservation.
- Establish canonical category metadata, destination permission/entitlement metadata, search aliases, title, and back target in one source.
- Correct child navigation ancestry and remove duplicate route-title/back registries where feasible.
- Separate real, local-only, unavailable, and placeholder capabilities in the directory.
- Build the desktop local rail/right-workspace shell while retaining the approved mobile grouped list.
- Do not migrate detail forms in this stage.

### Stage 9.2 — Business settings

- Recompose Business Profile into a responsive form workspace.
- Define one save model for media and profile fields, or clearly label immediate image saves.
- Move business identity, location/timezone/business day, and branding into clear sections.
- Rebuild Restaurant operations with only real persisted controls.
- Remove or disable misleading placeholder switches.

### Stage 9.3 — Finance and payment settings

- Keep Finance setup/operations as canonical; improve only Settings discovery and route ancestry.
- Separate FonePay/provider credentials from Restaurant operations.
- Make Taxes the sole editable tax owner and replace duplicates with links/read-only status.
- Remove hidden legacy payment configuration after confirming no live call sites depend on it.

### Stage 9.4 — People and access

- Convert Roles to responsive register + role editor grammar.
- Give the editor a full-height mobile sheet and bounded desktop dialog/workspace.
- Align route visibility and actions with actual role-management permissions.
- Move Admin Management from a generic hub dialog into a People & access workspace.
- Clarify distinction between restaurant administrators, staff roles, and membership.

### Stage 9.5 — Hardware and documents

- Give Printer Management its own responsive route/workspace.
- Use mobile lists for printers/routing and sheets for add/edit.
- Design mobile task switching for Receipt/KOT designers while preserving block/template behavior and exact output.
- Preserve entitlement gates and device-local auto-print semantics.

### Stage 9.6 — Administration, billing, notifications, and personal settings

- Migrate Audit logs to shared register/detail states.
- Correct Data Export labels/data scope and provide durable failure/large-export behavior.
- Remove or honestly label non-functional Auto Backup.
- Distinguish account-level notification preferences from device/browser preferences.
- Align Billing with the Settings shell without changing subscription logic.
- Add dedicated Personal membership/security entries, including Leave restaurant.

### Stage 9.7 — Cleanup and regression

- Remove unreachable legacy clients only after route/call-site verification.
- Retire static `/dashboard/payments`.
- Consolidate confirmation and form-state patterns.
- Validate permissions, entitlements, deep links, aliases, mobile back behavior, dark mode, keyboard/focus behavior, and all loading/error/empty states.
- Validate each migrated screen at 320, 390, 430, 768, 1024, and 1440px before approval.

## 13. Migration constraints

- No API, permission, accounting, fiscal, subscription, printer, staff, or restaurant-membership behavior should be changed as part of visual migration.
- Backend authorization remains authoritative; frontend policy alignment must not weaken it.
- Fiscal profile locks and platform-operator ownership must remain intact.
- Receipt/KOT designer output and printer routing semantics must be preserved.
- Finance remains the source of truth for accounts, instruments, drawers, transfers, and accounting structure.
- Domain-owned screens should be linked, not copied into Settings.
- `/settings` deep links and compatibility aliases must remain safe during migration.

## 14. Recommended approval boundary

Approve the ownership map and Stage 9.1 before any screen migration. The first implementation should change only the Settings Hub, alias/route ownership, permission-aware discoverability, and navigation ancestry. Business, Finance, People, Hardware, Administration, Billing, Notifications, and Personal detail surfaces should then migrate in separate reviewed stages.
