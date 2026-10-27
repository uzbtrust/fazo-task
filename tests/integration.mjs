import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
if (!local && process.env.TEST_ALLOW_REMOTE !== "1") {
  throw new Error("Remote tests create real fixtures. Set TEST_ALLOW_REMOTE=1 only for the intended test deployment.");
}
const runId = `qa${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";
const fixtures = { employees: [], tasks: [] };
let checks = 0;
let admin;

function client() {
  let cookie = "";
  return {
    async request(path, { method = "GET", body, origin = base.origin } = {}) {
      const headers = { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) };
      if (method !== "GET") headers.Origin = origin;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(new URL(path, base), {
        method, headers,
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        redirect: "manual", signal: AbortSignal.timeout(30000),
      });
      const setCookies = response.headers.getSetCookie?.() || [response.headers.get("set-cookie")].filter(Boolean);
      if (setCookies.length) cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
      const text = await response.text();
      const type = response.headers.get("content-type") || "";
      const data = type.includes("application/json") ? JSON.parse(text) : text;
      return { status: response.status, data, headers: response.headers, setCookies };
    },
  };
}

function status(result, expected, label) {
  assert.ok([expected].flat().includes(result.status), `${label}: expected HTTP ${[expected].flat().join("/")}, received ${result.status}${result.data?.error ? ` (${result.data.error})` : ""}`);
  checks++;
  return result.data;
}

async function login(username, password) {
  const session = client();
  const result = await session.request("/api/auth/login", { method: "POST", body: { username, password } });
  status(result, 200, "Login");
  assert.ok(result.data.user?.id, "Login must return the account profile");
  assert.equal(result.data.user.password_hash, undefined, "Account profile must not leak the password hash");
  assert.ok(result.setCookies.some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)), "Session cookie needs HttpOnly and SameSite=Lax");
  return session;
}

async function createEmployee(suffix, position = "Dizayner") {
  const data = status(await admin.request("/api/employees", { method: "POST", body: { name: `QA ${runId} ${suffix}`, position } }), 201, "Create employee");
  assert.ok(data.employee?.id, "Create employee must return {employee}");
  fixtures.employees.push(data.employee.id);
  return data.employee;
}

async function createTask(assigneeId, extra = {}) {
  const data = status(await admin.request("/api/tasks", {
    method: "POST", body: { title: `QA ${runId} vazifa`, description: "Tekshiruv uchun vazifa.", assigneeId, ...extra },
  }), 201, "Create task");
  assert.ok(data.task?.id, "Create task must return {task}");
  fixtures.tasks.push(data.task.id);
  return data.task;
}

const patchTask = async (id, body, expected = 200, label = "Update task") =>
  status(await admin.request(`/api/tasks/${id}`, { method: "PATCH", body }), expected, label).task;

async function main() {
  const anonymous = client();
  status(await anonymous.request("/login"), 200, "Login page");
  for (const path of ["/api/me", "/api/tasks", "/api/employees"])
    status(await anonymous.request(path), 401, `Anonymous ${path}`);
  status(await anonymous.request("/api/auth/login", { method: "POST", body: { username: adminUsername, password: `${adminPassword}-wrong` } }), 401, "Wrong password");
  for (const path of ["/api/users", "/api/files"])
    status(await anonymous.request(path), 404, `Retired endpoint ${path}`);
  admin = await login(adminUsername, adminPassword);
  const me = status(await admin.request("/api/me"), 200, "Current account");
  assert.equal(me.user.username, adminUsername.toLowerCase());
  status(await admin.request("/api/employees", { method: "POST", body: { name: "QA cross-site" }, origin: "https://example.invalid" }), 403, "Cross-site mutation rejected");
  console.log("✓ Single sign-in account, private API, cookie attributes and origin check");

  status(await admin.request("/api/employees", { method: "POST", body: { name: "   " } }), 400, "Blank employee name");
  status(await admin.request("/api/employees", { method: "POST", body: { name: `QA ${runId} long`, position: "x".repeat(81) } }), 400, "Position too long");
  status(await admin.request("/api/employees", { method: "POST", body: "[]" }), 400, "Non-object JSON");
  const designer = await createEmployee("dizayner");
  const editor = await createEmployee("muharrir", "");
  assert.equal(editor.position, "", "Position is optional");
  const renamed = status(await admin.request(`/api/employees/${editor.id}`, { method: "PATCH", body: { position: "Kopirayter" } }), 200, "Edit employee").employee;
  assert.equal(renamed.name, editor.name, "Partial edit keeps the name");
  assert.equal(renamed.position, "Kopirayter");
  status(await admin.request("/api/employees/missing", { method: "PATCH", body: { name: "X" } }), 404, "Edit missing employee");
  console.log("✓ Employees: create, validate and edit");

  const invalid = { title: `QA ${runId} invalid`, assigneeId: designer.id };
  for (const [body, label] of [
    [{ title: invalid.title }, "Missing assignee"],
    [{ ...invalid, assigneeId: "missing" }, "Unknown assignee"],
    [{ ...invalid, title: "" }, "Missing title"],
    [{ ...invalid, priority: 0 }, "Priority 0"],
    [{ ...invalid, priority: 4 }, "Priority 4"],
    [{ ...invalid, priority: 1.5 }, "Fractional priority"],
    [{ ...invalid, priority: "2" }, "String priority"],
    [{ ...invalid, status: "open" }, "Legacy status"],
    [{ ...invalid, dueDate: "2026-02-30" }, "Impossible date"],
    [{ ...invalid, dueDate: "31.12.2026" }, "Malformed date"],
  ]) status(await admin.request("/api/tasks", { method: "POST", body }), 400, label);

  let task = await createTask(designer.id, { dueDate: "2030-12-31" });
  assert.equal(task.status, "todo");
  assert.equal(task.priority, 1, "Default priority is Oddiy");
  assert.equal(task.assigneeName, designer.name);
  assert.equal(task.completedAt, null);
  task = await patchTask(task.id, { status: "in_progress" });
  assert.equal(task.status, "in_progress");
  assert.equal(task.title, `QA ${runId} vazifa`, "Partial update keeps other fields");
  assert.equal(task.dueDate, "2030-12-31");
  task = await patchTask(task.id, { status: "done" });
  assert.ok(task.completedAt, "Completion time recorded");
  const completedAt = task.completedAt;
  task = await patchTask(task.id, { priority: 3 });
  assert.equal(task.completedAt, completedAt, "Editing a done task keeps its completion time");
  task = await patchTask(task.id, { status: "todo", dueDate: null });
  assert.equal(task.completedAt, null, "Reopening clears completion time");
  assert.equal(task.dueDate, null, "Due date can be cleared");
  task = await patchTask(task.id, { assigneeId: editor.id });
  assert.equal(task.assigneeName, editor.name, "Task reassigned");
  await patchTask(task.id, { status: "finished" }, 400, "Unknown status rejected");
  await patchTask("missing", { status: "done" }, 404, "Update missing task");
  const list = status(await admin.request("/api/tasks"), 200, "List tasks").tasks;
  assert.ok(list.some((t) => t.id === task.id));
  console.log("✓ Tasks: assign, validate, partial update, status lifecycle and reassignment");

  const conflict = status(await admin.request(`/api/employees/${editor.id}`, { method: "DELETE" }), 409, "Employee with unfinished work kept");
  assert.match(conflict.error, /1 ta tugallanmagan/);
  await patchTask(task.id, { status: "done" });
  status(await admin.request(`/api/employees/${editor.id}`, { method: "DELETE" }), 200, "Delete employee");
  const roster = status(await admin.request("/api/employees"), 200, "List employees").employees;
  assert.ok(!roster.some((e) => e.id === editor.id), "Deleted employee hidden from roster");
  const history = status(await admin.request("/api/tasks"), 200, "Done task kept").tasks.find((t) => t.id === task.id);
  assert.equal(history.assigneeName, editor.name, "Done task keeps the deleted employee's name");
  await patchTask(task.id, { title: `QA ${runId} vazifa tahrir` });
  const other = await createTask(designer.id);
  await patchTask(other.id, { assigneeId: editor.id }, 400, "Cannot assign to deleted employee");
  status(await admin.request(`/api/employees/${editor.id}`, { method: "DELETE" }), 404, "Delete employee twice");
  console.log("✓ Employee deletion: blocked by unfinished work, keeps task history");

  status(await admin.request(`/api/tasks/${other.id}`, { method: "DELETE" }), 200, "Delete task");
  status(await admin.request(`/api/tasks/${other.id}`, { method: "DELETE" }), 404, "Delete task twice");
  status(await admin.request("/api/me", { method: "PATCH", body: { currentPassword: `${adminPassword}-wrong`, newPassword: "abcdef123" } }), 400, "Wrong current password");
  status(await admin.request("/api/me", { method: "PATCH", body: { currentPassword: adminPassword, newPassword: "123" } }), 400, "Short new password");
  const loggedOut = await login(adminUsername, adminPassword);
  status(await loggedOut.request("/api/auth/logout", { method: "POST" }), 200, "Logout");
  status(await loggedOut.request("/api/me"), 401, "Logged-out session rejected");
  console.log("✓ Task deletion, password validation and logout");
  console.log(`PASS: ${checks} HTTP checks plus data assertions`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unexpected test failure"}`);
  process.exitCode = 1;
} finally {
  if (admin) {
    for (const id of fixtures.tasks)
      await admin.request(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
    for (const id of fixtures.employees)
      await admin.request(`/api/employees/${id}`, { method: "DELETE" }).catch(() => {});
  }
  console.log(`FIXTURES ${JSON.stringify({ prefix: runId, employeeIds: fixtures.employees, taskIds: fixtures.tasks })}`);
}
