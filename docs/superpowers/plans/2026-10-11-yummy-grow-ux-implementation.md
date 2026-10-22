# Yummy Grow UX implementation plan

## Goal
Implement the approved Grow ecosystem UX design across overview, campaigns, builder, detail, customers, and settings while preserving routes, APIs, saved state, access, and consent behavior.

## Working approach
Execute in the current shared checkout to preserve the user's existing local settings work and avoid moving unrelated dirty files. Do not push. Use tests before implementation, keep existing app data flows in place, and validate after each cohesive change.

## Tasks

1. **Shared Grow navigation and page frame**
   - Add a responsive in-page navigation for Overview, Campaigns, Customers, and Settings inside the existing entitlement gate.
   - Mark the current route accessibly, ensure campaign creation/detail map to Campaigns, and verify mobile overflow/touch behavior.
   - Add reusable page heading/container primitives only where they reduce repeated inconsistent markup.
   - Add focused component tests first for links, active states, and nested campaign routes.

2. **Overview and campaign pages**
   - Align overview and campaign list hierarchy, page width, heading, cards, status presentation, and empty/error/retry guidance.
   - Keep all existing actions, filters, counts, URL state, paging, draft creation, and campaign transitions.
   - Add/update tests for navigation and key primary actions/status behavior before changing each page.

3. **Campaign builder and detail**
   - Retain the four-step campaign builder and persisted draft continuity; clarify step heading and primary action hierarchy without changing validation or approval safeguards.
   - Align campaign detail status summary and permitted actions with shared patterns.
   - Add focused tests for retained step progression/draft state and detail status actions.

4. **Customers and settings**
   - Standardize the visible admin term to Customers while retaining route/API identifiers and consent semantics.
   - Align consent controls, filters, bulk actions, and settings page heading/layout with shared Grow patterns.
   - Preserve the already-approved local settings redesign and extend only the shared shell integration.
   - Add tests for visible terminology and existing consent/settings actions.

5. **Public preference flow and final verification**
   - Keep public preferences separate from admin navigation while aligning its visual language and actionable state feedback.
   - Run focused Grow tests, TypeScript, and lint; run relevant broader tests if time and dependencies permit.
   - Inspect available UI at desktop/mobile widths. If profile/API access still blocks rendering, report that separately and rely on component tests.

## Acceptance checks
- Shared responsive navigation is present and active state is correct on all admin Grow routes.
- Users can see a clear primary task/action and consistent statuses across the Grow pages.
- No route, API contract, access, draft, consent, or campaign transition behavior changes.
- Changed code passes TypeScript, lint, and focused regression tests.
