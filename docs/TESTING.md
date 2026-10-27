# Fazo Task integration verification

Run the suite against an already running application and a disposable database:

```sh
npm run test:integration
```

The default target is `http://127.0.0.1:3000`. Set `BASE_URL` for a different server. `ADMIN_USERNAME` and `ADMIN_PASSWORD` override the administrator account (default `admin` / `admin`). The test prints a unique run prefix and generated IDs; it never prints credentials or session values.

The suite creates one QA project manager, two QA designers and two tasks. It follows the current workflow in `src/lib/workflow.ts`, where the designer marks the work finished. Its checks cover:

- **Access control:** anonymous requests return `401`; retired endpoints return `404`; cross-site mutations return `403`. The administrator has no task access, a PM has no statistics access, and a designer cannot read the roster or create tasks.
- **Accounts:** the administrator creates members with a login only. Creating another administrator, an invalid login or a duplicate login is rejected.
- **Registration:** signing in before registering explains the next step (`409`). Registration shows the member's name, rejects short passwords, sets the password and opens a session; a second registration is rejected.
- **Task validation:** title, TZ (text or file) and image count are required; priority is 1–5 stars; impossible dates are rejected; a TZ file links to one task only.
- **Open pool:** new tasks have no assignee. Every designer sees them and can read the TZ file. Two designers claiming at once — exactly one gets `200`, the other `409`. The task then disappears from the other designer's list, and its files become private.
- **Sessions and entry:** the session cookie lives about 180 days. A signed-out visit to `/` redirects to `/login`; a signed-in visit to `/login` redirects to `/`. The PM's first HTML already contains the task list.
- **Workflow (`REVIEW_STEP = false`):**
  - Result upload is optional and only possible while the task is in progress.
  - Only the assigned designer can mark the work finished (`complete`), with an optional note. The event history is `created → claim → complete`.
  - `submit`, `accept` and `return` are rejected while the review step is off.
  - The PM can still edit a finished task, but cannot cancel it.
- **Release:** the designer or the PM can return an in-progress task to the pool; draft uploads are removed. A designer with work in progress cannot be deleted.
- **Cancel and reopen:** only the PM cancels, with an optional reason. The assigned designer still sees the cancelled task and cannot finish it. The PM can edit it and reopen it into the open pool.
- **Statistics:** finished tasks, images and on-time completions per designer, and finished tasks per PM.
- **Password lifecycle:** an administrator reset signs the member out, the old password stops working and the member can register again. Wrong current password and logout are also checked.

The suite deletes its tasks and soft-deletes its members when it finishes. A `FIXTURES` JSON line is always printed with its `prefix`, `memberIds` and `taskIds`. To physically remove one run's records:

```sh
node scripts/cleanup-test-fixtures.mjs ACTUAL_QA_PREFIX_FROM_OUTPUT
```

The helper only removes members whose login and name carry the exact prefix, and their tasks, files, events and sessions. It refuses to run if such a member touched a task outside the run, and deletes everything in one transaction.

Sign-in and registration share a limiter (10 attempts per login, 40 per IP in 15 minutes). Running the suite several times in a row from one machine can hit it; wait 15 minutes or clear `login_attempts` in the local database.

Remote fixture execution requires `TEST_ALLOW_REMOTE=1`. Set it only for the intended deployment.

Browser verification should cover each role's panel at 375 px, 768 px and 1440 px in light and dark themes:

- registration;
- task creation with a TZ file;
- claiming from the open pool;
- uploading and submitting results;
- returning and accepting;
- the lightbox and Escape handling;
- the statistics period switch.
