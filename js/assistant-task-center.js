// Bounded independent assistant tasks. Each item has its own proposal and chat snapshot.
import { nowISO } from "./core.js";
import { cleanAgentPlan } from "./assistant-agent-core.js";
import { cleanConversation, chatText } from "./assistant-conversation.js";

export const CENTER_KEY = "assistant_tasks_v1";
export const MAX_OPEN_TASKS = 5;
const states = new Set(["draft", "clarify", "applying", "complete", "review", "cancelled"]);
const openStates = new Set(["draft", "clarify"]);

function cleanItem(raw) {
  if (!raw || typeof raw.id !== "string" || typeof raw.chat_id !== "string" || !Number.isInteger(raw.rev) || raw.rev < 1 || !states.has(raw.status)) return null;
  try {
    return {
      version: 1, id: raw.id.slice(0, 80), chat_id: raw.chat_id.slice(0, 80), rev: raw.rev,
      status: raw.status, native: !!raw.native, goal: chatText(raw.goal, 240), source: chatText(raw.source, 12000),
      plan: cleanAgentPlan(raw.plan), updated_at: String(raw.updated_at || "").slice(0, 35),
      created_at: String(raw.created_at || raw.updated_at || "").slice(0, 35), receipt: chatText(raw.receipt, 1000),
      chat: cleanConversation(raw.chat),
    };
  } catch { return null; }
}
export function cleanTaskCenter(raw) {
  const rows = Array.isArray(raw?.items) ? raw.items : [];
  const byId = new Map();
  for (const row of rows) {
    const item = cleanItem(row);
    if (item) byId.set(item.id, item);
  }
  const items = [...byId.values()];
  // Only completed/cancelled history is bounded; unfinished/recovery tasks survive.
  return { version: 1, items: [...items.filter(x => !['complete','cancelled'].includes(x.status)), ...items.filter(x => ['complete','cancelled'].includes(x.status)).slice(-20)] };
}
export function listTaskCenter(raw) {
  const center = cleanTaskCenter(raw);
  return { ...center, open: center.items.filter(x => openStates.has(x.status)), recovery: center.items.filter(x => ['applying','review'].includes(x.status)), closed: center.items.filter(x => ['complete','cancelled'].includes(x.status)) };
}
export function upsertTaskCenter(raw, task, chat) {
  const center = cleanTaskCenter(raw), index = center.items.findIndex(x => x.id === task.id);
  if (openStates.has(task.status) && center.items.some(x => x.id !== task.id && openStates.has(x.status)) && center.items.filter(x => x.id !== task.id && openStates.has(x.status)).length >= MAX_OPEN_TASKS)
    throw Error("En fazla 5 açık görev olabilir. Önce bir görevi tamamlayın veya kapatın; mevcut görevler korundu.");
  const old = index >= 0 ? center.items[index] : null;
  const item = cleanItem({ ...task, created_at: old?.created_at || task.created_at || task.updated_at || nowISO(), chat });
  if (!item) throw Error("Görev koleksiyonu saklanamadı.");
  if (index >= 0) center.items[index] = item; else center.items.push(item);
  return cleanTaskCenter(center);
}
export async function activateTaskCenter(db, id) {
  return db.metaTxn([CENTER_KEY, "assistant_task_v1", "assistant_conversation_v1"], values => {
    const center = listTaskCenter(values[CENTER_KEY]), selected = center.open.find(x => x.id === id);
    if (!selected) throw Error("Görev açık değil veya artık listede yok.");
    const current = values.assistant_task_v1;
    let updated = center;
    if (current?.id && current.id !== selected.id && openStates.has(current.status) && center.items.some(x => x.id === current.id))
      updated = upsertTaskCenter(center, current, values.assistant_conversation_v1);
    const selectedFresh = updated.items.find(x => x.id === selected.id);
    return { set: { [CENTER_KEY]: updated, assistant_task_v1: selectedFresh, assistant_conversation_v1: selectedFresh.chat }, result: selectedFresh };
  });
}
export function commonQuestions(questions = []) {
  const seen = new Set(), out = [];
  for (const question of questions) {
    const text = chatText(question, 240).trim();
    const key = text.toLocaleLowerCase("tr-TR");
    if (!text || seen.has(key)) continue;
    seen.add(key); out.push(text);
    if (out.length === 3) break;
  }
  return out;
}
