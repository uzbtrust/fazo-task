# Fazo Task integration verification

Run the suite against an already running application and a disposable database:

```sh
npm run test:integration
```

The default target is `http://127.0.0.1:3000`. Set `BASE_URL` to use a different local port. `ADMIN_USERNAME` and `ADMIN_PASSWORD` override the initial `admin` account credentials. The test never prints credentials, session values, or uploaded private data.

The suite creates four uniquely named QA accounts and two task fixtures. It checks private API access, secure cookie attributes, role permissions, cross-site mutation protection, safe user profiles, and simultaneous claims by two designers. It then exercises submission, requested changes, resubmission, creator approval, designer completion, file-only briefs, byte-for-byte file downloads, upload ownership, comments, task release/edit/cancellation, account deactivation, last-admin protection, and logout.

Fixture accounts are deactivated in the cleanup path, including after a failure. The suite prints a `FIXTURES` JSON record containing the exact prefix and generated IDs. Tasks remain marked with that unique `QA` prefix until explicit cleanup. Use a disposable local database for repeat runs.

To remove only one run's generated fixtures, pass its exact prefix to the ownership-checked cleanup helper. It verifies QA usernames, names, and task creators, and rolls back if a fixture account is involved in an unrelated task:

```sh
node scripts/cleanup-test-fixtures.mjs qa_EXACT_PREFIX_FROM_OUTPUT
```

The placeholder above must be replaced with the actual alphanumeric `qa...` prefix. The helper uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` if explicitly loaded, otherwise the local `fazo.db`. Do not load production credentials for a local test cleanup.

Remote targets require the explicit `TEST_ALLOW_REMOTE=1` setting because the suite writes real fixtures. Do not point the suite at a workspace containing real employee data. A production smoke check can instead verify the login page, unauthenticated API responses, authenticated admin profile, roster, and task list without creating fixtures.

The optional `TEST_ADMIN_PASSWORD_CHANGE=1` test is limited to a local target and requires a scratch `ADMIN_PASSWORD` of at least eight characters so it can be restored under the password policy. It changes that password, verifies a fresh login, and restores the original password. It does not run by default and cannot run against a remote deployment.

Build and TypeScript checks remain separate:

```sh
npm run typecheck
npm run build
```

Browser verification should cover the complete creator/designer flow plus the admin employee form at 375 px, 768 px, and 1440 px. Check light and dark mode, keyboard focus, modal escape behavior, file-picker feedback, long task titles, empty states, and visible mutation errors. API integration tests alone do not prove the final interface has been visually verified.
