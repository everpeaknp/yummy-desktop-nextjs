# API Requirements

Base URL: `https://your-domain.com` (Check env)

## Authentication
- `POST /auth/login` - Login with credentials
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `POST /auth/firebase/google` - Google Sign In

## Dashboard
- `GET /admin/dashboard/v2` - Main dashboard data
- `GET /admin/dashboard/v2/delta` - Real-time updates (delta)

## Orders
- `GET /orders/summary` - Optimized list of orders
- `GET /orders/active` - List of active orders (running kots)
- `GET /orders/{id}/full` - Full order details (items, payments, tables)
- `POST /orders/` - Create new order
- `PATCH /orders/{id}/status` - Update status

## Restaurant & Menu
- `GET /restaurants/by-user` - Get restaurants for logged-in user
- `GET /menus/restaurant/{id}/summary` - Menu items for ordering
- `GET /item-categories/restaurant/{id}` - Categories list

## Tables
- `GET /restaurants/tables/summary/{id}` - Table status and layout
- `GET /restaurants/tables/all/{id}` - Complete table list

## Notifications
- `GET /notifications` - List notifications
- `GET /notifications/unread-count` - Badge count

## WebSocket
- Connect to `/ws/kot/{restaurantId}` for real-time KOT updates.
