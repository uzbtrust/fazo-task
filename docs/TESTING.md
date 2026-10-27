# Fazo Task integration verification

Run the suite against an already running application and a disposable database:

```sh
npm run test:integration
```

The default target is `http://127.0.0.1:3000`. Set `BASE_URL` for a different server. `ADMIN_USERNAME` and `ADMIN_PASSWORD` override the sign-in account (default `admin` / `admin`). The test prints a unique run prefix and generated IDs; it never prints credentials or session values.

The suite creates two QA employees and two tasks. Its checks cover:

- Anonymous access to `/api/me`, `/api/tasks` and `/api/employees` returns `401`; retired `/api/users` and `/api/files` return `404`.
- Sign-in returns the account without its password hash; the session cookie is `HttpOnly` and `SameSite=Lax`; cross-site mutations return `403`; logout revokes the session.
- Employee creation and partial edits; blank names, over-long positions and non-object JSON return `400`.
- Task validation: missing or unknown assignee, empty title, priority outside the integers `1`–`3`, legacy status values and impossible dates return `400`.
- Partial task updates keep untouched fields. Moving to `done` records `completedAt`, edits keep it, reopening clears it. Due dates can be cleared and tasks reassigned.
- An employee with unfinished tasks cannot be deleted (`409`). After the work is done, deletion hides the employee from the roster, the completed task keeps the employee's name, and new assignments to that employee return `400`.
- Task deletion, wrong current password and short new password.

The suite deletes its tasks and soft-deletes its employees when it finishes. A `FIXTURES` JSON line is always printed with its `prefix`, `employeeIds` and `taskIds`. To physically remove one run's soft-deleted employees as well:

```sh
node scripts/cleanup-test-fixtures.mjs ACTUAL_QA_PREFIX_FROM_OUTPUT
```

The helper only touches rows whose names start with `QA <prefix>`, refuses to run if a fixture task belongs to a real employee or a fixture employee has unrelated tasks, and deletes everything in one transaction. It uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` when explicitly loaded, otherwise local `fazo.db`.

Remote fixture execution requires `TEST_ALLOW_REMOTE=1`. Set it only for the intended deployment.

Build and TypeScript checks remain separate:

```sh
npm run typecheck
npm run build
```

Browser verification should cover the sign-in page, both views and all dialogs at 375 px, 768 px and 1440 px, in light and dark themes: status circle cycling and its undo toast, the overdue filter, the employee sheet's "Vazifa belgilash" shortcut, keyboard focus and Escape. API tests do not establish visual completion.
