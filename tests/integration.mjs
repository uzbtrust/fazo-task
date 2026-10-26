import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
  process.env.TEST_ALLOW_REMOTE !== "1"
) {
  throw new Error(
    "Remote tests create real fixtures. Set TEST_ALLOW_REMOTE=1 only for the intended test deployment.",
  );
}
const runId = `qa${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const password = randomBytes(18).toString("base64url");
const fixtures = { users: [], tasks: [], files: [] };
let checks = 0;
let admin;
let originalAdminPassword;

function client() {
  let cookie = "";
  return {
    async request(path, { method = "GET", body, origin = base.origin } = {}) {
      const headers = {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      };
      if (method !== "GET") headers.Origin = origin;
      if (body !== undefined && !(body instanceof FormData))
        headers["Content-Type"] = "application/json";
      const response = await fetch(new URL(path, base), {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
      const setCookies =
        response.headers.getSetCookie?.() ||
        [response.headers.get("set-cookie")].filter(Boolean);
      if (setCookies.length)
        cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
      const type = response.headers.get("content-type") || "";
      const data = type.includes("application/json")
        ? await response.json()
        : await response.text();
      return {
        status: response.status,
        data,
        headers: response.headers,
        setCookies,
      };
    },
  };
}

function status(result, expected, label) {
  assert.ok(
    [expected].flat().includes(result.status),
    `${label}: expected HTTP ${[expected].flat().join("/")}, received ${result.status}${result.data?.error ? ` (${result.data.error})` : ""}`,
  );
  checks++;
  return result.data;
}

async function login(username, loginPassword = password) {
  const session = client();
  const result = await session.request("/api/auth/login", {
    method: "POST",
    body: { username, password: loginPassword },
  });
  status(result, 200, "Login");
  assert.ok(result.data.user?.id, "Login must return a safe user profile");
  assert.ok(
    result.setCookies.some(
      (value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value),
    ),
    "Session cookie needs HttpOnly and SameSite=Lax",
  );
  return { session, user: result.data.user };
}

async function createUser(suffix, role) {
  const username = `${runId}${suffix}`;
  const data = status(
    await admin.request("/api/users", {
      method: "POST",
      body: { name: `QA ${runId} ${suffix}`, username, password, role },
    }),
    201,
    `Create ${role}`,
  );
  assert.ok(data.user?.id, "Create user must return {user}");
  fixtures.users.push(data.user.id);
  return login(username);
}

async function createTask(session, extra = {}) {
  const data = status(
    await session.request("/api/tasks", {
      method: "POST",
      body: {
        title: `QA ${runId} lifecycle`,
        description: "Dizayner uchun tekshiruv brifi.",
        priority: "medium",
        category: "Ijtimoiy tarmoq",
        dueDate: "2030-12-31",
        fileIds: [],
        ...extra,
      },
    }),
    201,
    "Create task",
  );
  assert.ok(data.task?.id, "Create task must return {task}");
  fixtures.tasks.push(data.task.id);
  return data.task;
}

async function taskAction(session, taskId, action, extra = {}, expected = 200) {
  const data = status(
    await session.request(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: { action, ...extra },
    }),
    expected,
    `Task action ${action}`,
  );
  return data.task;
}

async function main() {
  console.log(`Fazo Task integration: ${base.origin} (${runId})`);
  const anonymous = client();
  status(await anonymous.request("/api/me"), 401, "Unauthenticated profile");
  status(
    await anonymous.request("/api/tasks"),
    401,
    "Unauthenticated task list",
  );
  status(await anonymous.request("/api/users"), 401, "Unauthenticated roster");
  status(
    await anonymous.request("/api/auth/login", {
      method: "POST",
      body: { username: `${runId}missing`, password },
    }),
    401,
    "Invalid login",
  );

  const adminLogin = await login(
    process.env.ADMIN_USERNAME || "admin",
    process.env.ADMIN_PASSWORD || "admin",
  );
  admin = adminLogin.session;
  assert.equal(adminLogin.user.role, "admin");
  status(await admin.request("/api/me"), 200, "Authenticated profile");
  const creator = await createUser("c1", "creator");
  const otherCreator = await createUser("c2", "creator");
  const designerA = await createUser("d1", "designer");
  const designerB = await createUser("d2", "designer");
  console.log(
    "✓ Login, private APIs, secure cookie, and admin-created role profiles",
  );

  status(
    await designerA.session.request("/api/users", {
      method: "POST",
      body: {
        name: "Unauthorized",
        username: `${runId}no`,
        password,
        role: "admin",
      },
    }),
    403,
    "Designer cannot create a profile",
  );
  status(
    await creator.session.request("/api/users", {
      method: "POST",
      body: {
        name: "Unauthorized",
        username: `${runId}no`,
        password,
        role: "designer",
      },
    }),
    403,
    "Creator cannot create a profile",
  );
  status(
    await designerA.session.request("/api/tasks", {
      method: "POST",
      body: {
        title: "Unauthorized",
        description: "Forbidden",
        priority: "medium",
        category: "Other",
        fileIds: [],
      },
    }),
    403,
    "Designer cannot create a task",
  );
  status(
    await admin.request("/api/users", {
      method: "POST",
      origin: "https://cross-site.invalid",
      body: {
        name: "Unauthorized",
        username: `${runId}csrf`,
        password,
        role: "designer",
      },
    }),
    403,
    "Cross-site mutation",
  );
  status(
    await creator.session.request("/api/tasks", { method: "POST", body: null }),
    400,
    "Non-object task body",
  );
  status(
    await creator.session.request("/api/tasks", {
      method: "POST",
      body: {
        title: "Invalid priority",
        description: "Malformed input",
        priority: ["high"],
      },
    }),
    400,
    "Priority must be a string enum",
  );
  status(
    await creator.session.request("/api/tasks", {
      method: "POST",
      body: {
        title: "Invalid date",
        description: "Malformed input",
        dueDate: "2030-13-01",
      },
    }),
    400,
    "Invalid calendar date",
  );
  const roster = status(await admin.request("/api/users"), 200, "Safe roster");
  assert.ok(Array.isArray(roster.users));
  assert.ok(
    roster.users.every(
      (user) =>
        !Object.keys(user).some((key) =>
          /password|hash|token|session/i.test(key),
        ),
    ),
    "Roster must not contain credentials",
  );
  console.log("✓ Role permissions, cross-site protection, and safe roster");

  const task = await createTask(creator.session);
  assert.equal(task.status, "open");
  const race = await Promise.all([
    designerA.session.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { action: "claim" },
    }),
    designerB.session.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { action: "claim" },
    }),
  ]);
  assert.deepEqual(
    race.map((response) => response.status).sort(),
    [200, 409],
    "Exactly one concurrent designer claim must win",
  );
  checks++;
  const winnerIndex = race.findIndex((response) => response.status === 200);
  const winner = [designerA, designerB][winnerIndex];
  const loser = [designerA, designerB][1 - winnerIndex];
  assert.equal(race[winnerIndex].data.task.assigneeId, winner.user.id);
  await taskAction(
    loser.session,
    task.id,
    "submit",
    { message: "Unauthorized delivery" },
    403,
  );
  await taskAction(winner.session, task.id, "complete", {}, [400, 409]);
  console.log(
    "✓ Concurrent claims: one winner; assignee and completion state guards",
  );

  let current = await taskAction(winner.session, task.id, "submit", {
    message: "Birinchi dizayn tayyor.",
  });
  assert.equal(current.status, "in_review");
  await taskAction(otherCreator.session, task.id, "approve", {}, 403);
  await taskAction(creator.session, task.id, "request_changes", {
    message: "Sarlavha o‘lchamini kattalashtiring.",
  });
  const changed = status(
    await creator.session.request("/api/tasks"),
    200,
    "Read requested changes",
  ).tasks.find((item) => item.id === task.id);
  assert.equal(changed.status, "in_progress");
  current = await taskAction(winner.session, task.id, "submit", {
    message: "Tuzatishlar tayyor.",
  });
  assert.equal(current.status, "in_review");
  current = await taskAction(creator.session, task.id, "approve");
  assert.equal(current.status, "approved");
  await taskAction(loser.session, task.id, "complete", {}, 403);
  current = await taskAction(winner.session, task.id, "complete");
  assert.equal(current.status, "completed");
  assert.ok(
    current.activity.length >= 6,
    "Task lifecycle must have a persistent audit trail",
  );
  console.log(
    "✓ Submit → changes → resubmit → owner approval → designer completion",
  );

  const fixtureContent = `Fazo Task durable attachment ${runId}\n`;
  const upload = new FormData();
  upload.set(
    "file",
    new Blob([fixtureContent], { type: "text/plain" }),
    "fazo-qa.txt",
  );
  const file = status(
    await creator.session.request("/api/files", {
      method: "POST",
      body: upload,
    }),
    201,
    "Upload brief file",
  ).file;
  assert.ok(
    file?.id && file?.url,
    "Upload must return safe attachment metadata",
  );
  fixtures.files.push(file.id);
  const fileTask = await createTask(creator.session, {
    title: `QA ${runId} file brief`,
    description: "",
    fileIds: [file.id],
  });
  assert.equal(
    fileTask.attachments[0]?.id,
    file.id,
    "Attachment-only briefs must work",
  );
  status(
    await anonymous.request(file.url),
    401,
    "Unauthenticated file download",
  );
  const download = await designerA.session.request(file.url);
  status(download, 200, "Authenticated file download");
  assert.equal(
    download.data,
    fixtureContent,
    "Downloaded attachment must match original bytes",
  );
  assert.match(
    download.headers.get("content-disposition") || "",
    /attachment/i,
    "Uploaded content must download safely",
  );
  const wrongUploadOwner = await designerA.session.request("/api/files", {
    method: "POST",
    body: (() => {
      const form = new FormData();
      form.set(
        "file",
        new Blob(["private upload"], { type: "text/plain" }),
        "private-qa.txt",
      );
      return form;
    })(),
  });
  const privateFile = status(
    wrongUploadOwner,
    201,
    "Upload ownership fixture",
  ).file;
  fixtures.files.push(privateFile.id);
  status(
    await creator.session.request(privateFile.url),
    404,
    "Other user cannot download an unbound upload",
  );
  status(
    await creator.session.request("/api/tasks", {
      method: "POST",
      body: {
        title: `QA ${runId} forbidden file`,
        description: "",
        priority: "medium",
        category: "Other",
        fileIds: [privateFile.id],
      },
    }),
    [403, 400],
    "Cannot attach someone else's unbound upload",
  );
  status(
    await designerA.session.request(`/api/tasks/${fileTask.id}/comments`, {
      method: "POST",
      body: { message: "Brifni ko‘rib chiqdim." },
    }),
    [200, 201],
    "Task comment",
  );
  const commented = status(
    await admin.request("/api/tasks"),
    200,
    "Read persisted comment",
  ).tasks.find((item) => item.id === fileTask.id);
  assert.ok(
    commented.comments.some(
      (comment) =>
        comment.message === "Brifni ko‘rib chiqdim." &&
        comment.userId === designerA.user.id,
    ),
  );
  console.log(
    "✓ File-only brief, durable file bytes, ownership protection, and comments",
  );

  await taskAction(designerA.session, fileTask.id, "claim");
  let reopened = await taskAction(designerA.session, fileTask.id, "release");
  assert.equal(reopened.status, "open");
  assert.equal(reopened.assigneeId, null);
  reopened = await taskAction(creator.session, fileTask.id, "edit", {
    title: `QA ${runId} edited`,
    description: "Yangilangan brif.",
    priority: "high",
    category: "Other",
    dueDate: "2031-01-01",
  });
  assert.equal(reopened.priority, "high");
  assert.equal(reopened.title, `QA ${runId} edited`);
  const cancelled = await taskAction(creator.session, fileTask.id, "cancel");
  assert.equal(cancelled.status, "cancelled");
  console.log("✓ Release, edit, and cancellation state transitions");

  status(
    await admin.request(`/api/users/${loser.user.id}`, {
      method: "PATCH",
      body: { active: false },
    }),
    200,
    "Deactivate designer",
  );
  status(
    await loser.session.request("/api/me"),
    401,
    "Deactivated user's existing session",
  );
  status(
    await client().request("/api/auth/login", {
      method: "POST",
      body: { username: loser.user.username, password },
    }),
    [401, 403],
    "Deactivated user cannot log in",
  );
  status(
    await admin.request(`/api/users/${adminLogin.user.id}`, {
      method: "PATCH",
      body: { active: false },
    }),
    [400, 403, 409],
    "Last admin protection",
  );
  console.log(
    "✓ Deactivated accounts lose access immediately; last admin remains protected",
  );

  if (process.env.TEST_ADMIN_PASSWORD_CHANGE === "1") {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
      "Admin password test is local-only",
    );
    assert.ok(
      (process.env.ADMIN_PASSWORD || "").length >= 8,
      "Optional password test requires a scratch ADMIN_PASSWORD of at least eight characters so the original can be restored",
    );
    originalAdminPassword = process.env.ADMIN_PASSWORD;
    status(
      await admin.request("/api/me", {
        method: "PATCH",
        body: { currentPassword: originalAdminPassword, newPassword: password },
      }),
      200,
      "Admin changes initial password",
    );
    const refreshed = await login(process.env.ADMIN_USERNAME || "admin");
    admin = refreshed.session;
    status(
      await admin.request("/api/me", {
        method: "PATCH",
        body: { currentPassword: password, newPassword: originalAdminPassword },
      }),
      200,
      "Restore scratch admin password",
    );
    originalAdminPassword = undefined;
    console.log("✓ Admin password change (local scratch database only)");
  }

  const logoutSession = await login(creator.user.username);
  status(
    await logoutSession.session.request("/api/auth/logout", { method: "POST" }),
    200,
    "Logout",
  );
  status(
    await logoutSession.session.request("/api/me"),
    401,
    "Logged-out session",
  );
  console.log(
    `PASS: ${checks} HTTP and concurrency checks plus lifecycle/data assertions`,
  );
}

try {
  await main();
} catch (error) {
  console.error(
    `FAIL: ${error instanceof Error ? error.message : "Unexpected test failure"}`,
  );
  process.exitCode = 1;
} finally {
  if (admin) {
    if (originalAdminPassword) {
      await admin
        .request("/api/me", {
          method: "PATCH",
          body: {
            currentPassword: password,
            newPassword: originalAdminPassword,
          },
        })
        .catch(() => {});
    }
    for (const id of fixtures.tasks) {
      await admin
        .request(`/api/tasks/${id}`, {
          method: "PATCH",
          body: { action: "cancel" },
        })
        .catch(() => {});
    }
    for (const id of fixtures.users) {
      await admin
        .request(`/api/users/${id}`, {
          method: "PATCH",
          body: { active: false },
        })
        .catch(() => {});
    }
    if (fixtures.users.length)
      console.log(
        `Cleanup: ${fixtures.users.length} QA accounts deactivated; test tasks retained with prefix ${runId}.`,
      );
  }
  console.log(
    `FIXTURES ${JSON.stringify({ prefix: runId, userIds: fixtures.users, taskIds: fixtures.tasks, fileIds: fixtures.files })}`,
  );
}
