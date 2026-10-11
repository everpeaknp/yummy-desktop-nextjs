# Yummy Grow ecosystem UX design

## Goal

Make Yummy Grow feel like one clear, trustworthy restaurant workflow. A restaurant owner or manager should be able to understand what Grow does, find the next useful action, create and follow a campaign, understand customer contact permissions, and configure messaging without needing to interpret internal product terminology.

## Current findings

- The admin experience is spread across Grow overview, campaign list, campaign creation, campaign detail, customers, and settings. Their headers, content widths, card treatments, navigation cues, and vocabulary vary.
- The sidebar exposes Campaigns and Subscribers, while the feature also has an overview and settings destination. In-page wayfinding is not consistent across these routes.
- The customer area is titled “Subscribers” in navigation but “Customers” in the page, while campaign creation and settings describe audience eligibility and consent separately.
- Campaign creation has a multi-step editor and saved draft state; the redesign must keep progress, deep links, filters, and existing actions intact.
- The public customer preference page is a separate customer-facing flow and should not inherit admin navigation, but it should remain visually related to Yummy and use plain consent language.
- The current local account was able to sign in, but `/grow` then displayed a restaurant-profile connection error. The Grow pages are also protected by the restaurant entitlement gate. This limits live visual verification until the local profile/API state is available.

## Recommended approach

Add a small shared Grow presentation layer and align the existing pages to it. Keep each page’s data loading and business actions in its current client component; share only navigation, page headings, status language, and visual conventions. Avoid a full rewrite of campaign/customer workflows.

## Experience design

### Admin navigation and page frame

- Add persistent Grow navigation for Overview, Campaigns, Customers, and Settings across the authenticated Grow routes. Mark the active destination accessibly. Keep the campaign builder and detail pages within the Campaigns destination and give them a clear return path.
- Add a reusable page-heading pattern with a concise title, task-oriented explanation, and primary action aligned consistently. Use a common content width, spacing scale, responsive breakpoints, and restrained Yummy orange accents.
- Keep the existing global restaurant sidebar and entitlement gate. Do not alter who can access Grow or its current plan rules.

### Page-specific hierarchy

- **Overview:** lead with the best next action and a short explanation of why it is suggested. Make reach, message balance, campaign activity, and setup blockers supporting information rather than competing priorities.
- **Campaigns:** make the default “Needs attention” view clearly explain the next action. Keep tabs, filters, search, counts, statuses, and paging, but present them with the same headers, cards, and status labels as the other pages.
- **Create campaign:** preserve the existing four-step flow and draft persistence. Give each step a plain-language purpose, visible progress, a clear Back/Continue action, and a review stage that states exactly what will be sent and to whom. Keep the current eligibility and approval safeguards.
- **Campaign detail:** establish one status summary at the top, explain what that status means, show the next permitted action, and group delivery/results and offer details consistently.
- **Customers:** use “Customers” throughout admin navigation and page copy. Explain contact permission with consistent channel terms, and keep search, filters, individual consent updates, and bulk consent actions intact.
- **Settings:** retain the approved task-focused sections for sign-ups, delivery, customer reach, SMS credits, and consent policy. Align its shared header and navigation with the rest of Grow.
- **Public preferences:** retain a focused customer-facing page without admin navigation. Use the Yummy visual language and straightforward per-channel preference status and action feedback.

### Shared visual and language rules

- Use consistent card borders, radii, internal padding, heading sizes, icon containers, and status badge colors.
- Use status colors consistently for campaign lifecycle and customer permission states; pair color with text and never rely on color alone.
- Prefer restaurant language (“customers”, “offers”, “messages”, “scheduled”) over internal terms (“subscribers”, “enrollment”, “campaign channel”) where the meaning stays accurate.
- Standardize loading, error/retry, empty, and success states so each gives a clear explanation or next step.
- Keep desktop layouts readable and use single-column, touch-friendly layouts on narrow screens. Preserve keyboard focus, semantic headings, contrast, and reduced-motion behavior.

## Scope and constraints

Included routes: `/grow`, `/grow/campaigns`, `/grow/campaigns/new`, `/grow/campaigns/[id]`, `/grow/subscribers`, `/grow/settings`, and the public growth-preferences page.

This is a frontend-only experience change. Preserve route URLs, API request/response shapes, data semantics, campaign state transitions, permissions, consent rules, and entitlement checks. Do not change the backend or widen access. Rename “Subscribers” only as a user-facing label; do not rename routes or API concepts.

The pre-existing local changes in the workspace must remain untouched except for the existing, already approved Growth settings redesign and files explicitly needed for this Grow work.

## Acceptance criteria

1. Admin users can move between Grow overview, campaigns, customers, and settings from a consistent, responsive navigation pattern, with the active destination announced clearly.
2. Every included admin page has the same page-heading hierarchy, container rhythm, card language, and campaign/permission status vocabulary.
3. A restaurant user can identify the primary next action on the overview, campaign list, campaign builder, and campaign detail without decoding internal terms.
4. Campaign filters, URL state, saved drafts, payment/credit actions, consent controls, and role/permission gates retain their current behavior.
5. Customer-facing preference management remains distinct from admin navigation and explains saved preference state and action outcomes.
6. Empty, loading, error, and retry states provide consistent, actionable guidance.
7. TypeScript, focused Grow tests, and the applicable broader test suite pass; desktop and mobile layouts are visually checked when the local API/profile state permits.

## Verification plan

- Add or update component tests for shared navigation, active-route behavior, page headings, and important empty/error states.
- Run focused tests for overview, campaign list/builder/detail, customer permissions, settings, and public preference interactions.
- Run TypeScript and lint checks for changed files.
- Inspect the authenticated Grow routes at desktop and mobile widths. Verify navigation, campaign draft continuity, customer consent controls, and settings without changing production data.
- If local profile/API access remains unavailable, report that visual verification limitation separately from automated results.
