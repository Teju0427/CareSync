// Local-date helpers. (toISOString() is UTC and gives the wrong "today" for
// anyone ahead of UTC between midnight and their UTC offset.)
export function toISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export const todayISO = () => toISODate(new Date());

export function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function formatDate(iso, opts = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  return parseDate(iso).toLocaleDateString("en-IN", opts);
}
export function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}
export function relativeDay(iso) {
  const diff = Math.round((parseDate(iso) - parseDate(todayISO())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDate(iso, { weekday: "long", day: "numeric", month: "short" });
}
export function initials(name = "") {
  return name.replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
}
const PALETTE = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be185d", "#0369a1", "#4d7c0f"];
export function colorFor(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
export function riskLevel(score) {
  if (score == null) return null;
  return score >= 0.6 ? "high" : score >= 0.3 ? "medium" : "low";
}
export function calcAge(dob) {
  if (!dob) return null;
  const b = parseDate(dob);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age -= 1;
  return age;
}
export const CATEGORY_LABEL = {
  general_consultation: "General consultation",
  follow_up: "Follow-up",
  routine_checkup: "Routine check-up",
  specialist_consultation: "Specialist consultation",
};
export const STATUS_LABEL = {
  scheduled: "Scheduled", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show",
};
