# Staff Edit and Access Audit

## Scope

Stage 3 Slice 2 covers presentation and composition for staff editing, role
assignment, direct permissions, and history restrictions. It does not change
API contracts, permission gates, salary history, employment lifecycle, or
restaurant-membership behavior.

## Previous surfaces

| Surface                         | Fields or information                                                                                        | Actions                              | Data and mutation                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------- |
| Staff register edit dialog      | name, immutable email, one role                                                                              | save                                 | `PATCH /users/{id}`                                 |
| Staff register payroll dialog   | payroll account, salary type and amount, effective date, reason, phone, address, age, weekly and daily hours | create or update profile             | `POST /staff`, `PATCH /staff/{id}`                  |
| Staff Detail account dialog     | name, immutable email                                                                                        | save account                         | `PATCH /users/{id}`                                 |
| Staff Detail pay-profile dialog | payroll and contact fields                                                                                   | create or update profile             | `POST /staff`, `PATCH /staff/{id}`                  |
| Staff Detail role dialog        | available system and custom roles                                                                            | save role                            | `PATCH /users/{id}`                                 |
| Permission dialog               | all permissions grouped by backend module                                                                    | replace direct permission assignment | `POST /users/{id}/permissions/`                     |
| Restriction dialog              | lookback days or explicit date window                                                                        | save or remove restriction           | `PUT` or `DELETE /users/{id}/access-scopes/{scope}` |
| Employment danger area          | membership explanation                                                                                       | remove from restaurant               | `DELETE /users/{id}`                                |

The previous UI split one employee-editing task across independent dialogs,
repeated identity context, exposed the complete permission catalogue without
search, and did not distinguish inherited role access from direct access.

## Permission and validation rules retained

- `admin.staff.manage` continues to gate ordinary staff, role, permission, and
  restriction management.
- Platform account status remains controlled by `platform.staff.manage` or a
  platform role. Restaurant managers cannot deactivate the global user account.
- Administrator and platform roles remain protected and continue through their
  existing verified or platform management flows.
- Email remains identity-owned and read-only in restaurant staff management.
- Salary changes retain effective dating and require an audit reason.
- A new staff pay profile still requires a payroll account and valid salary.
- Role assignment remains the normal source of access; direct permissions are
  presented as exceptions and use the existing user-permission mutation.
- Analytics, order, and receipt history restrictions retain the existing scope
  endpoints and validation.
- Removing restaurant membership remains separate from normal editing and keeps
  attendance, payroll, and audit history.

## Implemented composition

- Mobile uses one full-height editor with divider-led Profile, Employment,
  Access, and Status sections plus a sticky Save/Cancel footer.
- Desktop uses one standard dialog with Profile, Employment, and Access tabs.
- Register Edit and Set up profile actions route into the same Staff Detail
  editor instead of opening a second payroll/editor pattern.
- Permission drill-down now provides search, backend module grouping,
  read/manage labels, and inherited/direct provenance.
- Restrictions use the same row grammar for Analytics, Orders, and Receipts,
  with common history presets plus the existing custom lookback/date controls.
- The Employment section remains the only home of the membership danger action.

## Loading, empty, and error behavior

- The existing Staff Detail loading and unavailable states remain authoritative.
- Role and permission data continue to load with the Staff workspace.
- Permission search has a focused no-results state.
- Existing mutation errors remain visible through the established toast path.
- A missing employment profile can be created from the unified Employment
  editor without manufacturing attendance or salary data.
