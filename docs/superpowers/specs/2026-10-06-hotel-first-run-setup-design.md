# Hotel First-Run Setup Design

## Summary

Add a non-blocking first-run setup checklist to the existing Hotel workspace. It helps a hotel administrator prepare hotel settings, room inventory, rates, and staff access while keeping the normal Hotel tabs and dashboard sidebar available. The checklist is driven by existing Hotel and user-permission data; it does not create a second membership model or require a new onboarding record.

Hotel access remains controlled by the existing restaurant plan entitlement and `hotel_enabled` capability. This setup begins only after access is enabled.

## Goals

- Help a newly enabled Hotel property reach a sensible, bookable starting configuration.
- Explain each setup task in operational language and link to the existing screen that performs it.
- Let staff continue into Hotel operations while setup is incomplete.
- Show hotel staff access from effective permissions already assigned to users.
- Respect the current user's Hotel, staff, and role-management permissions for data and actions.
- Keep setup useful on desktop and mobile without hiding the global sidebar or header.

## Non-Goals

- Re-enter the restaurant or business name already maintained in restaurant profile.
- Change the plan entitlement or enable Hotel from the restaurant workspace.
- Create a separate Hotel member table, duplicate role assignment, or new permission system.
- Prevent access to front desk, bookings, housekeeping, or other currently permitted Hotel tabs while setup is incomplete.
- Add a backend setup-completion column or migration in this phase.
- Require buildings, floors, advanced rate plans, or date-specific rate overrides for every property.

## User Experience

The Hotel workspace remains the normal application page with its existing header, tabs, and dashboard shell. When setup readiness checks indicate unfinished work, show a concise `Get your hotel ready` panel above the active Hotel content. It contains a step list with status, a short reason, and an action that selects or opens the relevant existing Hotel screen. It is not a modal and does not cover or hide navigation.

The checklist can be collapsed after the user has seen it. Collapsing is a view preference only; it does not mark any task complete or hide incomplete state from another user. Once required operational checks pass, replace the large setup panel with a compact ready state and a way to reopen the checklist. Optional steps remain available without blocking Hotel work.

The user can enter any tab they are already authorized to use before completing setup. A user who can view Hotel but cannot manage a setup area sees its readiness state and a polite administrator handoff instead of a disabled or misleading action. Existing role permissions remain the source of truth for whether links and controls are available.

## Checklist And Readiness Rules

Use existing Hotel APIs and existing response data. Do not infer a user's role from a display label.

1. **Hotel settings**
   - Read the existing hotel settings record: check-in time, check-out time, currency, overbooking, and clean-room requirement.
   - The backend creates settings with valid defaults when first read, so show those values as configured and offer a review/edit action to users with `hotel.manage`.
   - Do not ask for the business name again.

2. **Buildings and floors**
   - Treat a building/floor layout as optional; a room's `floor_id` is nullable.
   - Floors are useful for multi-floor properties and the floor plan, but do not block bookings for a small property.
   - The current list-buildings service creates a default `Main building` if none exists. Do not interpret that generated row as proof that an administrator deliberately configured the building. Avoid making building setup a required readiness check.

3. **Room types**
   - Require at least one active room type for the operational-ready state.
   - Show type name, code, occupancy limits, amenities, and base rate. The backend permits a zero base rate, so flag a zero rate clearly as a setup warning rather than claiming it is a usable sell rate.

4. **Rooms**
   - Require at least one active room linked to an active room type for operational-ready state.
   - Show floor assignment as optional. Do not allow a manual occupancy edit in setup; occupancy is controlled by check-in and checkout.
   - Housekeeping and service readiness use the room's existing statuses.

5. **Rates**
   - Treat a positive room-type base rate as the default booking rate and the minimum rate readiness check.
   - Show rate plans and date-specific daily rates as optional advanced setup. Do not require a rate plan: the backend availability service falls back to the room type base rate when no rate plan is selected.
   - Do not claim date coverage is complete unless the API can verify the selected stay dates.

6. **Hotel team access**
   - Read the restaurant's user list from the existing staff-access API and filter on effective permission keys beginning with `hotel.`.
   - Show names, assigned role/business scope where available, and relevant Hotel permission groups (view, bookings/check-in, inventory, rates, housekeeping, folio/finance, audit).
   - The existing user-list route requires staff-view permission and returns effective permissions. If the current user lacks that access, show a short explanation and an administrator link instead of making an unauthorized request.
   - Offer links to the existing staff detail/role tools. Do not alter assignments from a second Hotel-specific control surface.
   - Team review is informative and does not block Hotel operations. Highlight when no user has Hotel viewing access or when no user appears to have front-desk actions, without assuming every property needs distinct people for each duty.

The main ready state requires at least one active room type, one active room linked to an active type, and a positive base rate for the room type. Settings with valid defaults count as configured. Building/floor and advanced rate-plan setup are optional. Team access is visible to authorized administrators and can raise a warning, but does not block.

## Data And Permission Boundaries

- Restaurant identity and Hotel enablement stay owned by existing restaurant and subscription management.
- Hotel settings, inventory, rate plans, and rates use the existing `/hotel/v2` API contracts.
- Hotel team visibility uses the existing user list and effective permissions. The `hotel.*` grants and `business_scope` remain authoritative.
- Existing per-action permission checks continue to control whether the user may edit settings, inventory, rates, or staff access.
- Readiness fetch failures must be shown as retryable, friendly status. Do not report missing setup when the API failed to load.
- If a user loses Hotel access while the page is open, existing entitlement and route guards continue to take precedence over the checklist.

## Architecture And Scope

Implement this in the Next.js Hotel workspace. Prefer a focused readiness hook/helper and a focused checklist component, composed by the existing Hotel page. Reuse the existing Hotel API client and permission helpers. Keep existing Hotel panels as the destinations for setup actions instead of duplicating their forms inside a new wizard.

The checklist state is derived from server data. The only local state is whether the panel is expanded. No backend migration or durable “wizard completed” flag is needed for this phase.

## Error And Empty States

- Loading: compact skeleton/status that preserves page layout.
- No room types: explain that room types are needed before rooms can be assigned, with an authorized action to Rooms/Inventory.
- No rooms: invite the manager to add the property's first room.
- Zero base rate: describe that availability will price at zero until a rate is set; link to Rates or room-type editing.
- No Hotel users: say no team members currently have Hotel permissions and link to staff/roles for authorized admins.
- Access denied to team list: do not fail the whole checklist; show an administrator handoff.
- API failure: show retry and preserve access to the existing Hotel tabs.

## Testing And Acceptance

- Readiness helper tests cover empty inventory, generated/default settings, room type without a room, room linked to an inactive type if returned, zero and positive base rates, optional floors, and optional rate plans.
- Component tests verify step statuses, collapse/reopen behavior, permission-aware actions, team filtering based on `hotel.*` effective permissions, and non-blocking navigation.
- Hotel page tests verify the checklist appears only when relevant, keeps existing tabs visible, and does not replace or hide the shared dashboard shell.
- Run focused tests, TypeScript, lint for touched files, and an authenticated UI check at `/hotel` with an enabled property.
- Verify the page remains usable at mobile width and that API failures do not mislabel setup as incomplete.

## Known Backend Behaviors To Preserve Or Revisit

- `GET /hotel/v2/settings` gets or creates a settings record with defaults.
- `GET /hotel/v2/buildings` currently creates a default building when none exists; do not treat that side effect as explicit completion.
- A floor is required to belong to a building, but a room may omit its floor.
- A room requires a room type; room types default to a zero base rate.
- Availability can use base rates without an explicit rate plan and applies daily-rate overrides when present.
- `GET /users/all` requires staff-view permission and returns user permissions after the service resolves effective grants. Use that existing permission-aware path for team visibility.

## Source References

- Backend Hotel API: `app/controller/hotel_pms_controller.py`
- Hotel settings, building/floor creation and availability: `app/services/hotel_pms_service.py`
- Hotel payload fields and defaults: `app/schema/hotel_pms_schema.py`
- Role business scope: `app/schema/role_schema.py` and `app/models/permission_model.py`
- Restaurant user list and permissions: `app/controller/user_controller.py` and `app/services/user_services.py`
- Existing Hotel workspace and tabs: `app/(dashboard)/hotel/page.tsx`
- Existing Hotel permission-to-tab mapping: `lib/role-permissions.ts`
