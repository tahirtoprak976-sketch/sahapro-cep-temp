import assert from "node:assert/strict";
import { saveTaskProposal, transitionTask, TASK_KEY } from "../js/assistant-task.js";

const values = { assistant_conversation_v1: { id: "CHAT", turns: [] } }, drafts = {};
const clone = x => x == null ? x : structuredClone(x);
const db = {
  metaGet: async k => clone(values[k]),
  metaTxn: async (keys, fn) => { const out = fn(clone(values)); Object.assign(values, clone(out.set)); return out.result; },
  draftSave: async (id, value) => { drafts[id] = clone(value); },
  draftGet: async id => clone(drafts[id]),
  draftClear: async id => { delete drafts[id]; },
};
const { listTaskCenter, activateTaskCenter, commonQuestions, CENTER_KEY, MAX_OPEN_TASKS } = await import("../js/assistant-task-center.js");
const { savePendingFiles, attachFilesToTask, loadTaskFiles } = await import("../js/assistant-task-files.js");
const { CAPABILITY_CATALOG, capabilitiesForTools } = await import("../js/assistant-capabilities.js");
const { AGENT_TOOLS } = await import("../js/assistant-agent-core.js");

const tasks = [];
let previous = null;
for (let i = 0; i < MAX_OPEN_TASKS; i++) {
  previous = await saveTaskProposal(db, { epoch: "CHAT", previous, result: { goal: "Görev " + i, plan: { works: [{ quantity: i + 1 }], questions: ["Ortak tarih?"] } }, source: "kaynak " + i });
  tasks.push(previous);
}
assert.equal(listTaskCenter(values[CENTER_KEY]).open.length, MAX_OPEN_TASKS);
assert.equal(new Set(listTaskCenter(values[CENTER_KEY]).items.map(x => x.id)).size, MAX_OPEN_TASKS);
await assert.rejects(
  saveTaskProposal(db, { epoch: "CHAT", previous: tasks.at(-1), result: { goal: "Altıncı", plan: { works: [{}] } }, source: "yeni" }),
  /En fazla 5 açık görev/,
);
assert.equal(listTaskCenter(values[CENTER_KEY]).items.length, MAX_OPEN_TASKS, "sınırda mevcutlar korunur");

const selected = tasks[1], other = tasks[2];
const activated = await activateTaskCenter(db, selected.id);
assert.equal(activated.id, selected.id);
assert.equal(values[TASK_KEY].id, selected.id);
const revised = await saveTaskProposal(db, { epoch: "CHAT", previous: activated, result: { mode: "continue", task_id: activated.id, plan: { works: [{ quantity: 99 }] } }, source: activated.source + "\nikinci satır düzeltmesi" });
assert.equal(revised.rev, selected.rev + 1);
assert.equal(revised.plan.works[0].quantity, 99);
assert.equal(listTaskCenter(values[CENTER_KEY]).items.find(x => x.id === other.id).rev, other.rev, "öteki görev değişmez");
assert.equal(listTaskCenter(values[CENTER_KEY]).items.find(x => x.id === other.id).source, other.source, "öteki kaynak aynı");
const applying = await transitionTask(db, revised, "applying");
const done = await transitionTask(db, applying, "complete", "Gerçek commit ID 123");
assert.equal(done.status, "complete");
assert.equal(listTaskCenter(values[CENTER_KEY]).open.length, MAX_OPEN_TASKS - 1);
assert.match(listTaskCenter(values[CENTER_KEY]).items.find(x => x.id === done.id).receipt, /123/);

const questions = Array.from({ length: 20 }, (_, i) => i % 3 === 0 ? "Müşteri?" : i % 3 === 1 ? "Araç?" : "Tarih?");
assert.deepEqual(commonQuestions(questions), ["Müşteri?", "Araç?", "Tarih?"]);

const pdf = new File(["%PDF-1.4\nstartxref\n0\n%%EOF"], "safe.pdf", { type: "application/pdf" });
await savePendingFiles(db, [pdf]);
await attachFilesToTask(db, other.id);
const restored = await loadTaskFiles(db, other.id);
assert.equal(restored.length, 1);
assert.equal(await restored[0].text(), await pdf.text());
assert.equal(drafts["assistant-pending-files"], undefined);

const failing = Object.create(db);
failing.draftSave = async () => { throw Error("QuotaExceeded"); };
await assert.rejects(savePendingFiles(failing, [pdf]), /QuotaExceeded/);
assert.equal(drafts["assistant-task-files:" + other.id] !== undefined, true, "başarısız yeni yazım önceki taslağı silmez");

assert.ok(CAPABILITY_CATALOG.length >= 10);
for (const c of CAPABILITY_CATALOG) {
  assert.ok(c.id && c.read && c.draft && c.evidence && c.commit);
  assert.equal(c.model_write, false);
}
const mapped = capabilitiesForTools(AGENT_TOOLS);
assert.equal(mapped.length, AGENT_TOOLS.length);
assert.ok(mapped.every(x => x.read && x.model_write === false));
assert.equal(values[CENTER_KEY].items.length, MAX_OPEN_TASKS);
console.log("assistant task center PASS: five independent tasks, targeted revision, max3 shared questions, persistent files/quota, capability catalog and no model write");
