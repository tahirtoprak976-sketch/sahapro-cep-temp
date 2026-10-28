import assert from "node:assert/strict";
import { savePendingFiles, saveTaskFiles, attachFilesToTask } from "../js/assistant-task-files.js";

const drafts = {}, values = { assistant_conversation_v1: { id: "CHAT", turns: [] } };
const clone = value => value == null ? value : structuredClone(value);
const db = {
  metaGet: async key => clone(values[key]),
  metaTxn: async (keys, fn) => { const out = fn(clone(values)); Object.assign(values, clone(out.set)); return out.result; },
  draftSave: async (id, value) => { drafts[id] = clone(value); },
  draftGet: async id => clone(drafts[id]),
  draftClear: async id => { delete drafts[id]; },
};
const pdf = new File(["%PDF-1.4\nstartxref\n0\n%%EOF"], "safe.pdf", { type: "application/pdf" });

await savePendingFiles(db, [pdf]);
assert.equal(drafts["assistant-pending-files"].files.length, 1);
await savePendingFiles(db, []);
assert.equal(drafts["assistant-pending-files"], undefined, "Ekler temizlenince kalıcı boş dosya taslağı kalmamalı");

await attachFilesToTask(db, "empty-task");
assert.equal(drafts["assistant-task-files:empty-task"], undefined, "Dosyasız görev için boş dosya taslağı üretilmemeli");
await saveTaskFiles(db, "empty-task", []);
assert.equal(drafts["assistant-task-files:empty-task"], undefined, "Görev değiştirmede boş ek taslağı kalıcı yazılmamalı");

await saveTaskFiles(db, "task-a", [pdf]);
await saveTaskFiles(db, "task-b", [pdf]);
await saveTaskFiles(db, "task-a", []);
assert.equal(drafts["assistant-task-files:task-a"], undefined, "Var olan dosya seçimi boşaltıldığında taslak silinmeli");
assert.equal(await drafts["assistant-task-files:task-b"].files[0].text(), await pdf.text(), "Başka görevin orijinal dosyası korunmalı");

console.log("assistant empty task files PASS: clearing selection deletes pending draft and creates no empty task draft");
