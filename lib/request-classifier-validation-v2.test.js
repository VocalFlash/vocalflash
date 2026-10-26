import test from "node:test";
import assert from "node:assert/strict";
import {validateRequestClassification} from "./request-classifier-validation-v2.js";

const workflows = [
  {id:"wf-a", workflow_key:"repair", name:"Riparazione"},
  {id:"wf-b", workflow_key:"inspection", name:"Sopralluogo"}
];
const routeA = {
  workflow_id:"wf-a", workflow_key:"repair", work_type:"riparazione",
  reason:"Il cliente segnala una perdita.", confidence:0.92
};
function result(overrides={}) {
  return {
    decision:"CLASSIFIED_SINGLE",
    routes:[{...routeA}],
    candidate_workflow_ids:[],
    reason:"La richiesta descrive una riparazione.",
    needs_clarification:false,
    clarification_question:null,
    confidence:0.92,
    ...overrides
  };
}

test("accepts a valid single-workflow classification", () => {
  assert.equal(validateRequestClassification(result(), workflows).decision, "CLASSIFIED_SINGLE");
});

test("accepts a valid simultaneous multi-workflow classification", () => {
  const multi = result({
    decision:"CLASSIFIED_MULTI",
    routes:[{...routeA},{workflow_id:"wf-b",workflow_key:"inspection",work_type:"sopralluogo",reason:"Serve anche un sopralluogo.",confidence:0.88}]
  });
  assert.equal(validateRequestClassification(multi, workflows).routes.length, 2);
});

test("accepts ambiguity only with two known candidates and a question", () => {
  const ambiguous = result({
    decision:"AMBIGUOUS", routes:[], candidate_workflow_ids:["wf-a","wf-b"],
    needs_clarification:true, clarification_question:"Si tratta di una riparazione o di un sopralluogo?"
  });
  assert.equal(validateRequestClassification(ambiguous, workflows).decision, "AMBIGUOUS");
});

test("rejects workflow IDs and keys not in the active catalogue", () => {
  assert.throws(() => validateRequestClassification(result({routes:[{...routeA,workflow_id:"wf-x"}]}), workflows));
  assert.throws(() => validateRequestClassification(result({routes:[{...routeA,workflow_key:"wrong"}]}), workflows));
  assert.throws(() => validateRequestClassification(result({decision:"AMBIGUOUS",routes:[],candidate_workflow_ids:["wf-a","wf-x"],needs_clarification:true,clarification_question:"Quale?",confidence:0.5}), workflows));
});

test("rejects duplicate workflow routes and candidate IDs", () => {
  assert.throws(() => validateRequestClassification(result({decision:"CLASSIFIED_MULTI",routes:[{...routeA},{...routeA}]}), workflows));
  assert.throws(() => validateRequestClassification(result({candidate_workflow_ids:["wf-a","wf-a"]}), workflows));
});

test("rejects a single classification with stray ambiguity fields", () => {
  assert.throws(() => validateRequestClassification(result({candidate_workflow_ids:["wf-a"]}), workflows));
  assert.throws(() => validateRequestClassification(result({clarification_question:"Quale?"}), workflows));
});

test("rejects a multi classification with stray ambiguity fields", () => {
  const multi = result({decision:"CLASSIFIED_MULTI",routes:[{...routeA},{workflow_id:"wf-b",workflow_key:"inspection",work_type:"sopralluogo",reason:"Serve anche un sopralluogo.",confidence:0.88}]});
  assert.throws(() => validateRequestClassification({...multi,needs_clarification:true}, workflows));
  assert.throws(() => validateRequestClassification({...multi,candidate_workflow_ids:["wf-a"]}, workflows));
});

test("rejects a single classification that requests clarification", () => {
  assert.throws(() => validateRequestClassification(result({needs_clarification:true}), workflows));
});

test("rejects ambiguous classification without a usable clarification question", () => {
  assert.throws(() => validateRequestClassification(result({
    decision:"AMBIGUOUS",routes:[],candidate_workflow_ids:["wf-a","wf-b"],
    needs_clarification:true,clarification_question:"   "
  }), workflows));
});

test("rejects contradictory unclassified results and invalid confidence", () => {
  assert.throws(() => validateRequestClassification(result({decision:"UNCLASSIFIED"}), workflows));
  assert.throws(() => validateRequestClassification(result({confidence:1.2}), workflows));
  assert.throws(() => validateRequestClassification(result({routes:[{...routeA,confidence:NaN}]}), workflows));
});
