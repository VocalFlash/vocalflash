import test from "node:test";
import assert from "node:assert/strict";
import {evaluateNewWorkCreationPolicy} from "./new-work-creation-policy-v1.js";

const intakePlan = {
  ok: true,
  status: "WORKFLOW_IDENTIFIED",
  workflow: {id: "wf-maintenance"}
};
const completeDataPlan = {
  ok: true,
  status: "CREATION_POLICY_REQUIRED",
  required_fields: [
    {key: "problem_description", status: "PROVIDED"},
    {key: "service_location", status: "PROVIDED"},
    {key: "availability_window", status: "PROVIDED"}
  ]
};
const policy = (overrides = {}) => ({
  id: "policy-1",
  business_id: "business-1",
  workflow_id: "wf-maintenance",
  scope: "workflow",
  policy_key: "create_work_item",
  autonomy_mode: "confirm",
  is_active: true,
  ...overrides
});
function evaluate(policies, overrides = {}) {
  return evaluateNewWorkCreationPolicy({
    businessId: "business-1",
    workflowId: "wf-maintenance",
    intakePlan,
    dataCollectionPlan: completeDataPlan,
    policies,
    ...overrides
  });
}

test("confirm policy blocks automatic creation even when all required data is complete", () => {
  const result = evaluate([policy()]);
  assert.equal(result.status, "CONFIRMATION_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
  assert.equal(result.effective_mode, "confirm");
});

test("missing creation policy fails closed", () => {
  const result = evaluate([]);
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
});

test("workflow-level forbidden policy overrides business-level auto policy", () => {
  const result = evaluate([
    policy({scope: "business", workflow_id: null, autonomy_mode: "auto"}),
    policy({autonomy_mode: "forbidden", id: "policy-2"})
  ]);
  assert.equal(result.status, "DENIED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
  assert.equal(result.effective_mode, "forbidden");
});

test("missing or uncertain data prevents policy authorization", () => {
  const result = evaluate([policy()], {
    dataCollectionPlan: {ok: true, status: "DATA_COLLECTION_REQUIRED"}
  });
  assert.equal(result.status, "DATA_COLLECTION_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
});

test("unknown autonomy mode fails closed", () => {
  const result = evaluate([policy({autonomy_mode: "unreviewed_mode"})]);
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
});

test("policy must be explicitly active; missing or null activity fails closed", () => {
  for (const overrides of [
    {is_active: undefined, autonomy_mode: "auto"},
    {is_active: null, autonomy_mode: "auto"},
    {is_active: false, autonomy_mode: "auto"}
  ]) {
    const candidate = {...policy(), ...overrides};
    if (overrides.is_active === undefined) delete candidate.is_active;
    const result = evaluate([candidate]);
    assert.equal(result.status, "CONFIG_REQUIRED");
    assert.equal(result.creation_authorized, false);
    assert.equal(result.writes_performed, false);
  }
});

test("malformed applicable policy cannot be bypassed by a permissive business policy", () => {
  const result = evaluate([
    policy({scope: "business", workflow_id: null, autonomy_mode: "auto"}),
    policy({is_active: null, autonomy_mode: "forbidden", id: "malformed-workflow-policy"})
  ]);
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
});

test("unknown policy scope fails closed instead of falling back to business auto", () => {
  const result = evaluate([
    policy({scope: "business", workflow_id: null, autonomy_mode: "auto"}),
    policy({scope: "unrecognized", autonomy_mode: "forbidden", id: "unknown-scope-policy"})
  ]);
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.creation_authorized, false);
  assert.equal(result.writes_performed, false);
});
