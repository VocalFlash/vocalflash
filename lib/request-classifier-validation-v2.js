const DECISIONS = new Set([
  "CLASSIFIED_SINGLE",
  "CLASSIFIED_MULTI",
  "AMBIGUOUS",
  "UNCLASSIFIED"
]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function confidence(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

// Validate model output against the active business workflow catalogue.
// Fail closed: invalid or internally contradictory classifications are rejected.
export function validateRequestClassification(result, workflows) {
  if (!result || typeof result !== "object" || !DECISIONS.has(result.decision)) {
    throw new Error("Invalid decision");
  }
  if (!Array.isArray(workflows) || !Array.isArray(result.routes) ||
      !Array.isArray(result.candidate_workflow_ids) ||
      !nonEmpty(result.reason) ||
      typeof result.needs_clarification !== "boolean" ||
      !(typeof result.clarification_question === "string" || result.clarification_question === null) ||
      !confidence(result.confidence)) {
    throw new Error("Invalid classification shape");
  }

  const allowed = new Map(workflows.map(workflow => [workflow.id, workflow]));
  const routeIds = new Set();
  for (const route of result.routes) {
    if (!route || typeof route !== "object") throw new Error("Invalid route");
    const workflow = allowed.get(route.workflow_id);
    if (!workflow || workflow.workflow_key !== route.workflow_key ||
        !nonEmpty(route.work_type) || !nonEmpty(route.reason) ||
        !confidence(route.confidence)) {
      throw new Error("Invalid route");
    }
    if (routeIds.has(route.workflow_id)) throw new Error("Duplicate route");
    routeIds.add(route.workflow_id);
  }

  const candidateIds = new Set();
  for (const id of result.candidate_workflow_ids) {
    if (typeof id !== "string" || !allowed.has(id)) throw new Error("Invalid candidate");
    if (candidateIds.has(id)) throw new Error("Duplicate candidate");
    candidateIds.add(id);
  }

  if (result.decision === "CLASSIFIED_SINGLE" &&
      (result.routes.length !== 1 || result.needs_clarification ||
       result.candidate_workflow_ids.length !== 0 || result.clarification_question !== null)) {
    throw new Error("Invalid single");
  }
  if (result.decision === "CLASSIFIED_MULTI" &&
      (result.routes.length < 2 || result.needs_clarification ||
       result.candidate_workflow_ids.length !== 0 || result.clarification_question !== null)) {
    throw new Error("Invalid multi");
  }
  if (result.decision === "AMBIGUOUS" &&
      (result.routes.length !== 0 || !result.needs_clarification ||
       result.candidate_workflow_ids.length < 2 ||
       !nonEmpty(result.clarification_question))) {
    throw new Error("Invalid ambiguous");
  }
  if (result.decision === "UNCLASSIFIED" &&
      (result.routes.length !== 0 || result.needs_clarification ||
       result.candidate_workflow_ids.length !== 0 ||
       result.clarification_question !== null)) {
    throw new Error("Invalid unclassified");
  }

  return result;
}
