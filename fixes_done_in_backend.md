# Fixes Done In Backend

## 2026-04-14

### Payroll Restaurant Context Resolution (commit `bee7c8c5`)

**What was happening**
- Payroll endpoints (`/payroll/*`) resolved restaurant context using only:
  - `users.restaurant_id` (DB), or
  - `restaurants.registered_by == user_id` (owner)
- Admin users linked via `restaurant_admins` (common in production) often have `users.restaurant_id = NULL`, so payroll failed even with correct permissions:
  - Error: `400 Restaurant not found for user`

**What was fixed**
- `app/services/payroll_service.py` now resolves `restaurant_id` via `SubscriptionService.resolve_restaurant_id_for_user(current_user)`, which supports:
  - token `restaurant_id`, DB `users.restaurant_id`, `restaurant_admins` association, owned restaurant.

**Result**
- Before: Admin-associated accounts could not use payroll at all (`Restaurant not found for user`).
- Now: Payroll works for admin-associated accounts (subject to plan + `finance.payroll.view/manage` permissions).

### Staff Profile Creation For Payroll (commit `6748db26`)

**What was happening**
- Creating a staff payroll profile (`POST /staff`) required the *target user* to already have `users.restaurant_id` set.
- For admin-associated restaurants, many users exist without `users.restaurant_id`, so payroll profile setup failed:
  - Error: `400 User must belong to a restaurant to create staff profile`

**What was fixed**
- `POST /staff` now uses the requester's resolved restaurant context (same resolver logic) to:
  - assign `users.restaurant_id` to the target user when missing, and
  - prevent cross-restaurant staff profile creation when the user belongs to a different restaurant.

**Result**
- Before: You could have users in `/users/all` but could not make them payroll-ready via `/staff` without manually setting `users.restaurant_id`.
- Now: Admin can create payroll staff profiles for existing users in their restaurant context; those users then appear in payroll runs and selection.
