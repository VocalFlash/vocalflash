const INTENTS = new Set(["consult","add_note","schedule_action"]);
const MODES = new Set(["auto","confirm","professional_only","forbidden"]);
const text = value => typeof value === "string" && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(text);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const instant = value => typeof value === "string" &&
  /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const result = (status, reason, extra = {}) => ({
  mode: "local_policy_dry_run", status, reason,
  writes_performed: false, notifications_scheduled: false, ...extra
});

export function evaluateCommand(command, context) {
  const member = context?.member;
  if (!context?.businessId || context.originVerified !== true ||
      member?.verified !== true || member.active !== true || !member.id ||
      member.businessId !== context.businessId) {
    return result("DENIED", "IDENTITY_NOT_VERIFIED");
  }
  if (member.sharedAccount === true) return result("IDENTITY_REQUIRED", "INDIVIDUAL_IDENTITY_REQUIRED");
  if (!Array.isArray(command?.units) || command.units.length === 0) return result("INVALID", "EMPTY_COMMAND");
  if (!strings(member.permissions) || !strings(member.workItemIds) ||
      !Array.isArray(context.workItems) || context.workItems.some(w =>
        !object(w) || !text(w.id) || !text(w.businessId) || !text(w.label)) ||
      !object(context.policiesByWorkItem)) {
    return result("CONFIG_REQUIRED", "INVALID_AUTHORIZATION_CONTEXT");
  }
  const permissions = member.permissions;
  const reports = command.units.map(unit => {
    if (!unit || !INTENTS.has(unit.intent)) return { status:"UNSUPPORTED", reason:"INTENT_NOT_SUPPORTED" };
    if (!permissions.includes("consult") || !permissions.includes(unit.intent)) return { status:"DENIED", reason:"PERMISSION_REQUIRED" };
    if (unit.candidateIds !== undefined && !strings(unit.candidateIds)) return { status:"INVALID", reason:"INVALID_CANDIDATES" };
    const ids = unit.candidateIds ?? [];
    if (ids.length === 0) return { status:"CLARIFICATION_REQUIRED", reason:"WORK_ITEM_REQUIRED" };
    const candidates = context.workItems.filter(w =>
      w.businessId === context.businessId && ids.includes(w.id) && member.workItemIds.includes(w.id));
    const unique = [...new Map(candidates.map(w => [w.id, w])).values()];
    if (unique.length === 0) return { status:"DENIED", reason:"NO_ACCESSIBLE_TARGET" };
    if (unique.length > 1) return { status:"CLARIFICATION_REQUIRED", reason:"AMBIGUOUS_TARGET", choices:unique.map(w=>({id:w.id,label:w.label})) };
    const target = unique[0];
    const policies = context.policiesByWorkItem[target.id]?.[unit.intent];
    if (!Array.isArray(policies) || policies.length === 0 || policies.some(p => !MODES.has(p))) {
      return { status:"CONFIG_REQUIRED", reason:"POLICY_NOT_RESOLVED" };
    }
    if (policies.includes("forbidden")) return { status:"DENIED", reason:"POLICY_FORBIDDEN" };
    if (policies.includes("professional_only")) return { status:"HANDOFF_REQUIRED", reason:"PROFESSIONAL_ONLY" };
    if (unit.intent !== "consult" && target.writable !== true) return { status:"DENIED", reason:"TARGET_NOT_WRITABLE" };
    const missing=[];
    if (unit.intent==="add_note" && !text(unit.note)) missing.push("note");
    if (unit.intent==="schedule_action") {
      if (!text(unit.title)) missing.push("title");
      if (!instant(unit.dueAt)) missing.push("dueAt");
      if (!instant(context.now) || !instant(context.receivedAt)) return { status:"CONFIG_REQUIRED", reason:"TIME_CONTEXT_REQUIRED" };
      if (instant(unit.dueAt) && Date.parse(unit.dueAt) <= Math.max(Date.parse(context.now),Date.parse(context.receivedAt))) missing.push("futureDueAt");
      if (unit.assigneeId && unit.assigneeId !== member.id) return { status:"UNSUPPORTED", reason:"OTHER_ASSIGNEE_NOT_SUPPORTED" };
    }
    if (missing.length) return { status:"CLARIFICATION_REQUIRED", reason:"MISSING_DATA", missing };
    const proposal={intent:unit.intent,workItemId:target.id};
    if (unit.intent==="add_note") { proposal.note=unit.note.trim(); proposal.provenance="member_statement"; }
    if (unit.intent==="schedule_action") { proposal.title=unit.title.trim(); proposal.dueAt=unit.dueAt; proposal.assigneeId=member.id; }
    return { status:policies.includes("confirm")?"CONFIRMATION_REQUIRED":"ELIGIBLE", reason:"PROPOSAL_ONLY", proposal };
  });
  const blocked=reports.some(r=>r.status!=="ELIGIBLE");
  return result(blocked?"NOT_READY":"ELIGIBLE",blocked?"RESOLVE_ALL_UNITS":"PROPOSAL_ONLY",{units:reports});
}
