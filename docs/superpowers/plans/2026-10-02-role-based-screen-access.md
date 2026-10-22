# Feature Implementation Plan

## Goal

Make the signed-in interface reflect each user's effective backend permissions across dashboard routes, navigation, nested menus, tabs, and permission-sensitive actions. A user with a custom role or a direct permission must see the screens and options granted to them regardless of their legacy role label. The backend remains authoritative for all data and mutations.

## Architecture

- Use the permission array returned for the authenticated user as the source of effective grants; keep existing compatibility semantics for built-in admin and platform staff.
- Maintain one route-to-permission policy in `lib/role-permissions.ts` and use it for route guards and link visibility. Prefer the narrowest permission for nested pages and actions; do not grant a whole module because a user can view one unrelated page in it.
- Filter grouped navigation after it is assembled so nested links, desktop/mobile navigation, global search, and manage shortcuts share the same route decision.
- Reuse existing action-level `hasPermission` checks. Add missing checks only where the audit finds a visible control whose UI is broader than the action permission already enforced by the backend.
- Order history uses `pos.view` (the backend catalog defines it as viewing active and past orders); date/history scope remains governed by subscription entitlements and backend scope enforcement, not by an invented user permission.

## Stack

Next.js App Router, TypeScript, Zustand auth state, Vitest.

## Spec

The request is to show each user only the UI corresponding to access assigned through their role and direct grants, throughout the product. Route checks must still allow a direct effective permission for a custom role, and denied routes must not appear in navigation or searchable shortcuts. The backend's scope limits and permission checks remain in force.

## Constraints

- Frontend repository only unless inspection proves the backend lacks the required permission/scope data.
- Do not commit or push.
- Preserve all pre-existing unrelated local files.
- Keep legacy role behavior for sessions without a populated permission array while the session/profile data hydrates.
- Do not confuse the `finance.history_days` subscription entitlement with per-user role permission.

## Review Focus

- A waiter with `pos.view` can see orders and permitted history; a waiter without an unrelated finance permission does not see finance links or routes.
- A custom-role user with a direct grant can reach that screen without requiring a matching built-in role.
- Nested links and action buttons do not leak access to screens or actions lacking their required permission.
- Order-history subscription/date scope continues to work independently from the UI permission decision.
- Route permission changes do not break profile self-service or safe home-route redirects.

## Tasks

1. Audit permission keys and existing frontend gates against the backend registry, then write failing tests for route resolution, direct grants, nested finance routes, history behavior, and sidebar visibility.
2. Refine the route permission registry and home-route fallback so mapped screens use the narrow effective permission while legacy-only sessions retain a safe compatibility path.
3. Apply the shared route decision to assembled navigation trees and in-page links/tabs that lead to permission-specific screens; verify existing action controls use their granular checks.
4. Run the focused RBAC tests, related suite, and static type/build checks; review the diff and confirm no backend edits or unrelated files were changed.
