# Superadmin/Admin Dashboard RBAC Deep Research

Date: 2026-04-24 (UTC)
Project: `yummy-desktop-nextjs`
Scope: Investigate why superadmin appears normalized to admin, and why restaurant admins can access admin dashboard APIs.

---

## 1) Executive Summary

What is happening is mostly consistent with the current architecture:

1. This repository is a **frontend + proxy**, not the backend service implementation.
2. The frontend stores whatever role the backend returns (`user_role`, `user_roles`, `primary_role`) and does not contain explicit `superadmin -> admin` mapping logic.
3. The frontend RBAC treats `admin` as a full bypass role (all permissions/routes).
4. Backend API paths named `/admin/*` are being used as operational dashboard endpoints for restaurant operations, not strictly “platform superadmin only”.
5. Backend contract supports **restaurant-level admin association** (`/restaurant/{restaurant_id}/admins`), so restaurant admins being allowed into dashboard flows is expected in this design.

Most likely root cause of your concern:
- Either backend login/refresh is returning `user_role: "admin"` for superadmin users (flattening distinction), or backend never intended a separate `superadmin` role for this web app and uses `admin` as the top app role.

---

## 2) Important Limitation

The actual backend source code is not present in this repo. So we cannot prove internal backend role-mapping logic from code here.

What we can prove in this repo:
- Frontend role handling behavior.
- Proxy behavior.
- OpenAPI contract and endpoint semantics.

---

## 3) Evidence: Frontend Auth + Role Flow

### 3.1 Login payload is consumed directly
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/app/page.tsx:80`
- `handleAuthSuccess` reads backend fields: `user_role`, `user_roles`, `primary_role`, `permissions`.
- It sets:
  - `user.role = user_role || primary_role || roles[0] || ""`
  - `user.roles = roles`
- No code here maps `superadmin` to `admin`.

### 3.2 Session restore also trusts backend refresh payload
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/hooks/use-auth.ts:82`
- Refresh flow uses `/auth/refresh` response and sets:
  - `role: data.user_role`
  - `roles: data.user_roles || [data.user_role]`
- No `superadmin -> admin` mapping in this file either.

### 3.3 Role normalization only allows known app roles
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/role-permissions.ts:16`
- `normalizeRole()` accepts only:
  - `admin, manager, cashier, waiter, kitchen, bar, cafe, barista`
- Unknown roles become `null`.
- There is no explicit branch mapping `superadmin` to `admin`.

### 3.4 Critical frontend bypass for `admin`
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/role-permissions.ts:121`
- `hasPermission()` returns `true` for `user.role === "admin"`.
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/role-permissions.ts:367`
- `isRouteAllowed()` also returns `true` immediately when `user.role === "admin"`.

Implication:
- Any account whose effective role is `admin` gets broad frontend access regardless of granular permissions.

### 3.5 Route guard uses these checks globally in dashboard
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/components/auth/role-guard.tsx:71`
- Dashboard pages are wrapped by `RoleGuard` in layout.
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/app/(dashboard)/layout.tsx:79`

---

## 4) Evidence: API and Proxy Behavior

### 4.1 Proxy forwards auth, does not rewrite role claims
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/app/api/proxy/[...path]/route.ts:10`
- Proxy forwards `authorization` and request payload.
- It does not alter user role data.

### 4.2 API client always sends bearer token
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/api-client.ts:22`
- Requests attach `Authorization: Bearer <token>`.
- This means backend is authoritative for final authorization.

### 4.3 Dashboard endpoints are named `/admin/dashboard/*`
- File: `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/api/endpoints.ts:48`
- Frontend calls `/admin/dashboard`, `/admin/dashboard/v2`, `/admin/dashboard/v2/delta`.

Interpretation:
- Endpoint naming includes `admin`, but that does not automatically mean “superadmin only”.
- Real access control is backend-side policy tied to token role + permissions + restaurant context.

---

## 5) Evidence: OpenAPI Indicates Restaurant-Scoped Admin Model

From `.openapi.json`:

1. `/users/admin/register`
- Summary text: “Super Admin Registration”.
- But role field types are string-based and not enum-restricted in schema.

2. `LoginResponse`
- Fields: `user_role`, `user_roles`, `primary_role`, `permissions`, `restaurant_id`.
- No enum forcing `superadmin` as distinct contract value.

3. Restaurant admin association endpoints exist:
- `/restaurant/{restaurant_id}/admins`
  - “Requester must be an existing admin or owner of the restaurant.”

4. `/restaurants/by-user`
- Exists specifically to resolve the current user’s restaurant context.

Conclusion from contract:
- System is built for restaurant-bound admins to operate dashboard features.
- “Admin dashboard” appears to mean operational admin shell (restaurant admin/manager/cashier), not a separate platform-superadmin console.

---

## 6) Why You Observe “Superadmin Normalizes to Admin”

Most probable explanations (ranked):

1. Backend returns `user_role = "admin"` for superadmin accounts.
- Frontend then naturally treats it as admin.

2. Backend stores superadmin internally but emits only app-facing role `admin` in login/refresh.
- Common pattern when platform role is hidden from tenant-facing UI.

3. A backend token/claims converter maps privileged roles into app role taxonomy.
- Not visible in this repo.

What is **not** happening in this frontend:
- There is no explicit transform function `superadmin -> admin`.

---

## 7) Why Restaurant Admins Can Access Admin Dashboard APIs

Because by current design they should, if authorized:

1. Restaurant admins are first-class in backend contract (`/restaurant/{restaurant_id}/admins`).
2. Dashboard routes in frontend include `admin/manager/cashier` shells.
3. `/admin/dashboard/*` endpoints appear to be operational APIs for restaurant management.
4. Backend receives bearer token and decides final authorization.

So the surprising part is mostly naming ambiguity (`/admin/*`) plus role flattening around superadmin/admin.

---

## 8) Security/Design Risks Found

1. Frontend `admin` short-circuit is very broad.
- `hasPermission()` and `isRouteAllowed()` bypass granular checks when role is `admin`.
- If backend accidentally issues `admin`, frontend becomes maximally permissive.

2. Multi-role handling inconsistency.
- Some checks rely on `user.role` single string instead of full `user.roles` set.
- Can cause subtle mismatches if backend sends multiple roles.

3. Naming confusion.
- `/admin/*` path naming implies superadmin to many developers, but behavior is tenant-admin operations.

---

## 9) Recommended Fix Strategy

### 9.1 Backend (highest priority)

1. Decide explicit role model:
- Option A: Keep `superadmin` and `admin` distinct in API responses and JWT claims.
- Option B: Intentionally flatten to `admin`, but document this contract clearly.

2. Enforce policy server-side for `/admin/*` endpoints:
- Check tenant/restaurant scope explicitly.
- Check required permissions explicitly.
- Do not rely on path naming.

3. Add contract clarity:
- Add role enum docs or schema examples for `user_role`, `user_roles`, `primary_role`.
- Document meaning of `admin` vs `superadmin` (if both exist).

### 9.2 Frontend

1. Remove unconditional admin bypass, or gate it behind explicit claim.
- Current bypass lines:
  - `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/role-permissions.ts:123`
  - `/home/ramon/projects/everacy/yummy-desktop-nextjs/lib/role-permissions.ts:367`

2. Use multi-role checks consistently.
- Route checks currently normalize only `user.role` in `isRouteAllowed()`.

3. Add explicit unknown-role handling telemetry.
- If backend ever sends `superadmin`, today normalization drops it unless also present as recognized role.

---

## 10) Backend Verification Checklist (must run in backend repo/env)

1. Inspect login/refresh service output:
- What exact values are returned for a true superadmin account?
  - `user_role`
  - `user_roles`
  - `primary_role`

2. Decode JWT for superadmin and restaurant admin users:
- Compare claims and restaurant scope fields.

3. Check `/admin/dashboard/v2` authorization decorator/service:
- Which roles are accepted?
- Are permission keys required?
- Is restaurant ownership/admin association validated?

4. Confirm policy for `/restaurant/{restaurant_id}/admins`:
- How membership is persisted.
- Whether “admin” here is tenant admin only.

---

## 11) Bottom Line Answer to Your Question

- In this codebase, I do **not** see frontend logic that explicitly converts `superadmin` to `admin`.
- The likely normalization is happening in backend auth payload/claims.
- Restaurant admins being able to use “admin dashboard” APIs is consistent with current product model and OpenAPI contract.
- The real issue is role-model clarity and hard frontend `admin` bypass behavior, not proxy transport.

