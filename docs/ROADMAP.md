# Roadmap: Yummy Next.js Implementation

This roadmap outlines the steps to build the `yummy-web` interface using Next.js, matching the Flutter app's design and functionality.

## Phase 1: Setup & Foundation <!-- id: phase-1 -->
- [ ] **Project Initialization**
  - Initialize Next.js 14+ (App Router).
  - Setup TypeScript, Tailwind CSS, ESLint.
  - Install `shadcn/ui` core components.
  - Configure Font (`Inter`).
- [ ] **Design System Implementation**
  - Configure `tailwind.config.ts` with colors from `DESIGN_SYSTEM.md`.
  - Create global theme provider (Dark/Light mode).
  - Build base UI components:
    - `Button` (Primary, Outline, Ghost)
    - `Input` / `Form` components
    - `Card` (App style)
- [ ] **API Client**
  - Setup `Axios` or `Ky` instance.
  - Implement Interceptors for Auth (Token Refresh).
  - Create Service layer mirroring `endpoints.dart`.

## Phase 2: Authentication <!-- id: phase-2 -->
- [ ] **Auth Pages**
  - `LoginPage`: Email/Password form.
  - `SignupPage`: Registration form.
  - `GoogleSignIn`: Integration.
- [ ] **Auth Logic**
  - `AuthContext` or `Zustand` store for user session.
  - Protected Routes (Middleware).

## Phase 3: Core Dashboard UI <!-- id: phase-3 -->
- [ ] **Layout Shell**
  - Sidebar (Desktop): Collapsible, custom icons.
  - Bottom Navigation (Mobile): Responsive design.
  - Top Bar: User profile, Restaurant selector.
- [ ] **Dashboard Home**
  - Stats Cards (Sales, Orders, etc.).
  - Recent Activity Feed.

## Phase 4: Order Management <!-- id: phase-4 -->
- [ ] **Active Orders List**
  - Kanban or List view of running orders.
  - Status indicators.
- [ ] **Order Creation Flow**
  - Menu selection interface.
  - Cart management.
  - Table selection.

## Phase 5: Polish & Verify <!-- id: phase-5 -->
- [ ] **Optimization**
  - SEO Metadata.
  - Performance tuning (React Server Components).
- [ ] **Testing**
  - E2E tests for critical flows.
