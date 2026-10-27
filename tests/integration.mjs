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
const fixtures = { members: [], tasks: [] };
let checks = 0;
let admin;
let pm;
let manager;

// 1×1 PNG — haqiqiy rasm sifatida yuklanadi.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function client() {
  let cookie = "";
  return {
    async request(path, { method = "GET", body, origin = base.origin } = {}) {
      const headers = { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) };
      if (method !== "GET") headers.Origin = origin;
      if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
      const response = await fetch(new URL(path, base), {
        method, headers,
        body: body === undefined ? undefined : body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body),
        redirect: "manual", signal: AbortSignal.timeout(30000),
      });
      const setCookies = response.headers.getSetCookie?.() || [response.headers.get("set-cookie")].filter(Boolean);
      if (setCookies.length) cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
      const bytes = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get("content-type") || "";
      const data = type.includes("application/json") ? JSON.parse(bytes.toString("utf8")) : bytes.toString("utf8");
      return { status: response.status, data, bytes, headers: response.headers, setCookies };
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
  const data = status(result, 200, `Login ${username}`);
  assert.equal(data.user.password_hash, undefined, "Account profile must not leak the password hash");
  assert.ok(result.setCookies.some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)), "Session cookie needs HttpOnly and SameSite=Lax");
  const expires = Date.parse(result.setCookies.join(";").match(/Expires=([^;]+)/i)?.[1] || "");
  assert.ok(expires > Date.now() + 170 * 864e5, "Session cookie persists for about 180 days");
  return session;
}

/** Admin hodim qo‘shadi, hodim esa o‘zi parol yaratadi. Chekka holatlar faqat birinchisida tekshiriladi. */
async function addMember(suffix, role, edgeCases = false, register = true) {
  const username = `${runId}.${suffix}`;
  const data = status(await admin.request("/api/members", { method: "POST", body: { name: `QA ${runId} ${suffix}`, role, username } }), 201, `Create ${role}`);
  assert.equal(data.member.activated, false, "New member has no password yet");
  fixtures.members.push(data.member.id);
  const password = randomBytes(12).toString("base64url");
  if (!register) return { id: data.member.id, username, password };
  if (edgeCases) {
    status(await client().request("/api/auth/login", { method: "POST", body: { username, password } }), 409, "Login before registration explains next step");
    const check = status(await client().request("/api/auth/register", { method: "POST", body: { username } }), 200, "Registration finds login");
    assert.equal(check.member.name, `QA ${runId} ${suffix}`);
    status(await client().request("/api/auth/register", { method: "POST", body: { username, password: "short" } }), 400, "Short password rejected");
  }
  const session = client();
  const activated = status(await session.request("/api/auth/register", { method: "POST", body: { username, password } }), 200, "Registration sets password");
  assert.equal(activated.user.role, role);
  if (edgeCases)
    status(await client().request("/api/auth/register", { method: "POST", body: { username } }), 409, "Second registration rejected");
  status(await session.request("/api/me"), 200, "Registration opens a session");
  return { id: data.member.id, username, password, session };
}

async function upload(session, name, bytes, assignmentId) {
  const form = new FormData();
  form.set("file", new Blob([bytes]), name);
  if (assignmentId) form.set("assignmentId", assignmentId);
  return session.request("/api/files", { method: "POST", body: form });
}

const act = (session, id, action, extra = {}, expected = 200, label = `Task ${action}`) =>
  session.request(`/api/tasks/${id}`, { method: "PATCH", body: { action, ...extra } }).then((r) => status(r, expected, label).task);

async function main() {
  const anonymous = client();
  status(await anonymous.request("/login"), 200, "Login page");
  for (const path of ["/api/me", "/api/tasks", "/api/members", "/api/stats"])
    status(await anonymous.request(path), 401, `Anonymous ${path}`);
  for (const path of ["/api/users", "/api/employees"])
    status(await anonymous.request(path), 404, `Retired endpoint ${path}`);
  admin = await login(adminUsername, adminPassword);
  status(await admin.request("/api/members", { method: "POST", body: { name: "QA", role: "designer", username: `${runId}x` }, origin: "https://example.invalid" }), 403, "Cross-site mutation rejected");
  status(await admin.request("/api/members", { method: "POST", body: { name: "QA", role: "admin", username: `${runId}x` } }), 400, "Admin cannot create administrators");
  status(await admin.request("/api/members", { method: "POST", body: { name: "QA", role: "designer", username: "Bad Login!" } }), 400, "Invalid login rejected");
  status(await admin.request("/api/tasks"), 403, "Admin has no task access");

  manager = await addMember("pm", "pm", true);
  pm = manager.session;
  const designerA = await addMember("dizayner-a", "designer");
  const designerB = await addMember("dizayner-b", "designer");
  status(await admin.request("/api/members", { method: "POST", body: { name: "QA dup", role: "designer", username: designerA.username } }), 409, "Duplicate login rejected");
  console.log("✓ Admin adds members with a login; each member creates their own password");

  const entry = await anonymous.request("/");
  status(entry, 307, "Signed-out visitor is redirected");
  assert.match(entry.headers.get("location") || "", /\/login$/);
  const signedIn = await pm.request("/login");
  status(signedIn, 307, "Signed-in member skips the login page");
  assert.match(signedIn.headers.get("location") || "", /\/$/);
  console.log("✓ Server redirects: login page skipped while signed in");

  status(await pm.request("/api/members"), 200, "PM reads designers");
  status(await designerA.session.request("/api/members"), 403, "Designer cannot read the roster");
  status(await pm.request("/api/stats?period=7"), 200, "PM has statistics of own tasks");
  status(await designerA.session.request("/api/tasks", { method: "POST", body: { title: "X", brief: "X", imageCount: 1 } }), 403, "Designer cannot create tasks");
  const valid = { title: `QA ${runId} karusel`, brief: "5 slaydli karusel.", imageCount: 2 };
  for (const [body, label] of [
    [{ title: valid.title, imageCount: 2 }, "TZ is required (text or file)"],
    [{ title: valid.title, brief: "x" }, "Image count is required"],
    [{ ...valid, imageCount: 0 }, "Image count must be positive"],
    [{ ...valid, priority: 6 }, "At most five stars"],
    [{ ...valid, dueDate: "2026-02-30" }, "Impossible date"],
    [{ ...valid, title: "" }, "Title is required"],
  ]) status(await pm.request("/api/tasks", { method: "POST", body }), 400, label);

  const brief = status(await upload(pm, "tz.txt", Buffer.from(`TZ ${runId}`)), 201, "PM uploads TZ file");
  const created = status(await pm.request("/api/tasks", { method: "POST", body: { ...valid, brief: "", fileIds: [brief.file.id], priority: 4, dueDate: "2099-12-31" } }), 201, "PM posts a task with only a TZ file").task;
  fixtures.tasks.push(created.id);
  assert.equal(created.assigneeId, null, "New task is not assigned to anyone");
  assert.equal(created.status, "todo");
  assert.equal(created.briefFiles.length, 1);
  status(await pm.request("/api/tasks", { method: "POST", body: { ...valid, fileIds: [brief.file.id] } }), 400, "A TZ file links to one task only");
  const refImage = status(await upload(pm, "namuna.png", PNG), 201, "PM uploads a reference image").file;
  status(await pm.request("/api/tasks", { method: "POST", body: { ...valid, links: ["javascript:alert(1)"] } }), 400, "Only http(s) links");
  const withRefs = status(await pm.request("/api/tasks", {
    method: "POST",
    body: { ...valid, title: `QA ${runId} referensli`, referenceIds: [refImage.id], links: ["https://www.pinterest.com/pin/1/", "https://www.behance.net/gallery/2"] },
  }), 201, "PM posts a task with references").task;
  fixtures.tasks.push(withRefs.id);
  assert.equal(withRefs.referenceFiles.length, 1);
  assert.equal(withRefs.referenceFiles[0].kind, "reference");
  assert.deepEqual(withRefs.links.map((l) => l.url), ["https://www.pinterest.com/pin/1/", "https://www.behance.net/gallery/2"]);
  const relinked = status(await pm.request(`/api/tasks/${withRefs.id}`, {
    method: "PATCH",
    body: { action: "edit", links: ["https://dribbble.com/shots/3"], removeFileIds: [refImage.id] },
  }), 200, "PM edits references").task;
  assert.deepEqual(relinked.links.map((l) => l.url), ["https://dribbble.com/shots/3"], "Links are replaced on edit");
  assert.equal(relinked.referenceFiles.length, 0, "Reference image removed");
  status(await pm.request(refImage.url), 404, "Removed reference image is gone");
  const page = status(await pm.request("/"), 200, "PM panel renders on the server");
  assert.ok(page.includes(`QA ${runId} karusel`), "Task list arrives with the first HTML");

  for (const designer of [designerA, designerB]) {
    const visible = status(await designer.session.request("/api/tasks"), 200, "Designer sees open tasks").tasks;
    assert.ok(visible.some((t) => t.id === created.id), "Open task is visible to every designer");
    const file = await designer.session.request(brief.file.url);
    status(file, 200, "Designer reads an open task's TZ before claiming");
    assert.equal(file.bytes.toString(), `TZ ${runId}`);
  }
  status(await upload(designerA.session, "early.png", PNG, created.id), 404, "No upload before claiming");

  const claims = await Promise.all([designerA, designerB].map((d) =>
    d.session.request(`/api/tasks/${created.id}`, { method: "PATCH", body: { action: "claim" } })));
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409], "Exactly one designer gets the task");
  checks += 2;
  const winner = claims[0].status === 200 ? designerA : designerB;
  const loser = winner === designerA ? designerB : designerA;
  const loserView = status(await loser.session.request("/api/tasks"), 200, "Loser's list").tasks;
  assert.ok(!loserView.some((t) => t.id === created.id), "Claimed task leaves the other designer's list");
  status(await loser.session.request(brief.file.url), 404, "Claimed task's TZ is private to the winner");
  await act(loser.session, created.id, "complete", {}, 404, "Other designer cannot touch the task");
  console.log("✓ Tasks are posted unassigned; two designers claiming at once — exactly one wins");

  status(await upload(loser.session, "x.png", PNG, created.id), 404, "Other designer cannot upload");
  const result = status(await upload(winner.session, "slayd-1.png", PNG, created.id), 201, "Optional result upload").file;
  status(await winner.session.request(`/api/files/${result.id}`, { method: "DELETE" }), 200, "Designer removes an image while working");
  for (const action of ["submit", "accept", "return"])
    await act(action === "submit" ? winner.session : pm, created.id, action, { message: "x" }, 400, `Review step is off (${action})`);
  await act(pm, created.id, "complete", {}, 403, "Only the designer marks the work finished");
  let task = await act(winner.session, created.id, "complete", { message: "PM bilan kelishildi" });
  assert.equal(task.status, "done", "Designer finishes the task without a review step");
  assert.ok(task.completedAt && task.submittedAt);
  assert.equal(task.resultNote, "PM bilan kelishildi");
  assert.deepEqual(task.events.map((e) => e.action), ["created", "claim", "complete"]);
  status(await upload(winner.session, "late.png", PNG, created.id), 409, "No upload after finishing");
  task = await act(pm, created.id, "edit", { title: `QA ${runId} karusel (tahrir)`, priority: 5 });
  assert.equal(task.status, "done", "PM can still edit a finished task");
  await act(pm, created.id, "cancel", {}, 409, "A finished task cannot be cancelled");
  console.log("✓ Designer marks the task finished; PM can still edit it");

  const second = status(await pm.request("/api/tasks", { method: "POST", body: { ...valid, title: `QA ${runId} banner` } }), 201, "PM posts a second task").task;
  fixtures.tasks.push(second.id);
  await act(loser.session, second.id, "claim");
  status(await upload(loser.session, "draft.png", PNG, second.id), 201, "Draft upload");
  let released = await act(loser.session, second.id, "release");
  assert.equal(released.status, "todo");
  assert.equal(released.assigneeId, null, "Released task is open again");
  assert.equal(released.resultFiles.length, 0, "Release removes draft uploads");
  await act(winner.session, second.id, "claim");
  status(await admin.request(`/api/members/${winner.id}`, { method: "DELETE" }), 409, "Designer with work in progress is kept");
  released = await act(pm, second.id, "release");
  assert.equal(released.assigneeId, null, "PM can return a task to the open pool");
  await act(pm, second.id, "edit", { title: `QA ${runId} banner 2`, imageCount: 3, priority: null });
  console.log("✓ Release by designer or PM returns a task to the open pool");

  await act(loser.session, second.id, "claim");
  await act(loser.session, second.id, "cancel", {}, 403, "Designer cannot cancel");
  const cancelled = await act(pm, second.id, "cancel", { message: "Kampaniya bekor bo‘ldi" });
  assert.equal(cancelled.status, "cancelled");
  const designerView = status(await loser.session.request("/api/tasks"), 200, "Designer still sees a cancelled task").tasks;
  assert.equal(designerView.find((t) => t.id === second.id)?.status, "cancelled");
  await act(loser.session, second.id, "complete", {}, 409, "Cancelled task cannot be finished");
  await act(pm, second.id, "edit", { title: `QA ${runId} banner 3` });
  const reopened = await act(pm, second.id, "reopen");
  assert.equal(reopened.status, "todo");
  assert.equal(reopened.assigneeId, null, "Reopened task goes back to the open pool");
  console.log("✓ PM cancels with a reason and can reopen the task");

  const stats = status(await admin.request("/api/stats?period=all"), 200, "Admin statistics").stats;
  const row = stats.designers.find((d) => d.id === winner.id);
  assert.equal(row.done, 1);
  assert.equal(row.images, 2, "Images = ordered images of finished tasks");
  assert.equal(row.onTime, 1, "Finished before the deadline");
  assert.equal(row.returns, 0);
  assert.equal(stats.managers.find((m) => m.id === manager.id).accepted, 1);
  const own = status(await winner.session.request("/api/stats?period=7"), 200, "Designer sees own statistics").stats;
  assert.equal(own.scope, "designer");
  assert.deepEqual(own.designers.map((d) => d.id), [winner.id], "Designer sees only themselves");
  assert.equal(own.daily.length, 7, "Seven daily points");
  assert.equal(own.daily[own.daily.length - 1].images, 2, "Today's designs are counted");
  const pmStats = status(await pm.request("/api/stats?period=30"), 200, "PM sees statistics of own tasks").stats;
  assert.equal(pmStats.scope, "pm");
  assert.ok(pmStats.totals.created >= 2, "PM sees how many TZ they posted");
  assert.equal(pmStats.totals.images, 2, "PM sees designs made on their tasks");
  assert.ok(pmStats.dailyBy && !Object.keys(pmStats.dailyBy).length, "Per-designer charts are admin-only");
  const teamStats = status(await admin.request("/api/stats?period=30"), 200, "Admin sees the whole team").stats;
  assert.equal(teamStats.dailyBy[winner.id].length, 30, "Admin gets a daily chart per designer");
  console.log("✓ Statistics: designer sees own days, PM own tasks, admin the whole team");

  const renamed = `${runId}.y1`;
  const renameResult = status(await admin.request(`/api/members/${winner.id}`, { method: "PATCH", body: { username: renamed.toUpperCase() } }), 200, "Admin changes a login").member;
  assert.equal(renameResult.username, renamed, "Logins are stored lower-case");
  const stillIn = status(await winner.session.request("/api/me"), 200, "Open session survives a login change").user;
  assert.equal(stillIn.username, renamed);
  status(await client().request("/api/auth/login", { method: "POST", body: { username: winner.username, password: winner.password } }), 401, "Old login stops working");
  await login(renamed, winner.password);
  status(await admin.request(`/api/members/${loser.id}`, { method: "PATCH", body: { username: renamed } }), 409, "Taken login is rejected");
  winner.username = renamed;
  const late = await addMember("kechikkan", "designer", false, false);
  const lateLogin = `${runId}.k2`;
  status(await admin.request(`/api/members/${late.id}`, { method: "PATCH", body: { username: lateLogin } }), 200, "Rename before registration");
  status(await client().request("/api/auth/register", { method: "POST", body: { username: late.username } }), 404, "Old login cannot register");
  const lateSession = client();
  status(await lateSession.request("/api/auth/register", { method: "POST", body: { username: lateLogin, password: late.password } }), 200, "New login registers");
  console.log("✓ Login changes: open sessions stay, old login stops, new login works");

  status(await admin.request(`/api/members/${loser.id}/reset`, { method: "POST" }), 200, "Admin resets a password");
  status(await loser.session.request("/api/me"), 401, "Reset signs the member out");
  status(await client().request("/api/auth/login", { method: "POST", body: { username: loser.username, password: loser.password } }), 409, "Old password no longer works");
  status(await client().request("/api/auth/register", { method: "POST", body: { username: loser.username } }), 200, "Member can register again");
  status(await pm.request("/api/me", { method: "PATCH", body: { currentPassword: "wrong-password", newPassword: "abcdefgh1" } }), 400, "Wrong current password");
  status(await winner.session.request("/api/auth/logout", { method: "POST" }), 200, "Logout");
  status(await winner.session.request("/api/me"), 401, "Logged-out session rejected");
  console.log("✓ Password reset, password change validation and logout");
  console.log(`PASS: ${checks} HTTP checks plus workflow assertions`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unexpected test failure"}`);
  process.exitCode = 1;
} finally {
  if (pm) for (const id of fixtures.tasks) await pm.request(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  if (admin) for (const id of fixtures.members) await admin.request(`/api/members/${id}`, { method: "DELETE" }).catch(() => {});
  console.log(`FIXTURES ${JSON.stringify({ prefix: runId, memberIds: fixtures.members, taskIds: fixtures.tasks })}`);
}
