# Parent Bank And Card/QR Assignment Workflow

Date: 2026-06-25

Purpose:

- explain how payment banks, cards, and QRs are supposed to work
- explain where sync happens
- explain why hidden `config_id` exists
- keep this short and implementation-focused

## Core idea

There are two layers:

1. `Manage > Settings > Payments & POS`
   - this is the restaurant-owned source for card and QR rows
2. `Finance > Accounting > Setup`
   - this is the accounting enforcement layer
   - it stores real `payment_banks` and `payment_instruments`

So:

- operators add or edit cards and QRs in restaurant settings
- backend syncs those rows into accounting payment instruments
- accounting then uses the synced instrument plus bank assignment for clearing and journals

## Parent bank meaning

A `payment bank` is the parent settlement bank.

Examples:

- Himalayan
- Nabil
- NIMB
- Default Bank

A card or QR instrument is then assigned under that bank.

Examples:

- `Himalayan POS 1` -> bank assignment: `Himalayan`
- `Nabil Static QR` -> bank assignment: `Nabil`

Why this exists:

- checkout needs a specific card/QR option
- accounting needs to know which clearing bank receives that money

## Expected user workflow

### Normal path

1. Open `Manage > Settings > Payments & POS`
2. Add or edit:
   - card
   - static QR
3. If known, assign its bank there
4. Save restaurant settings
5. Backend auto-sync runs during restaurant save
6. Matching accounting payment instrument is created or updated
7. In `Finance > Accounting > Setup`, the instrument appears with its bank assignment

### If bank is not known yet

1. Add the card or QR in restaurant settings
2. Save
3. Backend still syncs it into accounting
4. It is parked under fallback bank:
   - `Default Bank`
5. Web labels that as:
   - `Default Bank (Needs Review)`
6. Later, assign the real bank
7. Save again
8. Backend updates the accounting instrument to the real bank

## Hidden `config_id`

Each restaurant settings card or QR row now carries a hidden stable ID:

- `config_id`

This is not for display.
It exists so renaming does not break identity.

Example:

- before: `Nabil POS 1`
- later renamed to: `Nabil Bank`

Without `config_id`:

- backend may think this is a new instrument
- duplicate or wrong matching can happen

With `config_id`:

- backend knows both names are the same original settings row
- the synced accounting instrument stays linked correctly

## Sync rule

There is no separate manual sync endpoint for normal settings saves.

Sync is supposed to happen automatically when restaurant settings are updated.

That means:

- card/QR changes in `PUT /restaurants/{restaurant_id}`
- trigger backend payment-config sync logic
- which creates, updates, reactivates, or deactivates accounting payment instruments

## Endpoint map

### Restaurant settings source

- `GET /restaurants/by-user`
  - fetch current restaurant payload including:
    - `payment_cards`
    - `payment_qrs`

- `PUT /restaurants/{restaurant_id}`
  - save restaurant settings including:
    - `payment_cards`
    - `payment_qrs`
  - this is the main source-of-truth write path
  - sync happens after this update

### Accounting payment banks

- `GET /accounting/payment-banks?restaurant_id={id}&active_only=false`
  - list banks

- `POST /accounting/payment-banks`
  - create a bank

- `PATCH /accounting/payment-banks/{bank_id}`
  - update a bank

### Accounting payment instruments

- `GET /accounting/payment-instruments?restaurant_id={id}&business_line=restaurant&active_only=false`
  - list instruments

- `POST /accounting/payment-instruments`
  - manually create instrument if needed

- `PATCH /accounting/payment-instruments/{instrument_id}`
  - update instrument
  - includes bank reassignment

- `POST /accounting/payment-instruments/{instrument_id}/deactivate`
  - deactivate instrument

## Matching logic

Backend matching order is supposed to be:

1. match by hidden settings identity:
   - `settings_config_id`
2. if missing, fall back to name-based matching

This is why web checkout and web restaurant settings now preserve `config_id`.

## Checkout contract

When web sends a card or static QR payment, instrument metadata should include:

- `config_id`

So the accounting side can resolve the exact synced instrument safely.

Name matching still exists as fallback, but `config_id` is the stronger path.

## Default bank behavior

`Default Bank` is a fallback, not the desired final assignment.

Meaning:

- transaction can still proceed
- accounting can still post
- but the real bank should be reviewed and assigned later

UI label:

- `Default Bank (Needs Review)`

## Permissions

Accounting bank and instrument management uses:

- `finance.payment_instruments.manage`

Restaurant settings save uses restaurant/admin settings permissions through the normal restaurant update flow.

## Short implementation rule

If you remember only one thing, remember this:

- cards and QRs are owned in restaurant settings
- banks and instruments are enforced in accounting
- `config_id` keeps one settings row tied to one accounting instrument even after rename
