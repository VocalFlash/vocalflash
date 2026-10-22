// VocalFlash NEW Work Intake Plan V1
// Deterministic, read-only guardrail between Classifier V2 and any future NEW write path.
// It never creates work_items, never writes work_data, never sends messages and never
// invents required fields that are not configured on the selected workflow.

import {normalizeRequiredFields} from "./new-work-required-data-extractor-v1.js";

function asArray(value){return Array.isArray(value)?value:[];}
function requiredDataSummary(requiredData){
  const normalized=normalizeRequiredFields(requiredData);
  return {
    ok:normalized.ok,
    configured:normalized.configured,
    shape:normalized.shape,
    fields:normalized.fields,
    reason:normalized.reason||null
  };
}

function workflowMap(workflows){
  return new Map(asArray(workflows).filter(w=>w&&typeof w.id==="string").map(w=>[w.id,w]));
}

export function buildNewWorkIntakePlan({classifierResult,workflows}={}){
  const result=classifierResult||{};
  const decision=result.decision;
  const routes=asArray(result.routes);
  const candidates=asArray(result.candidate_workflow_ids);
  const byId=workflowMap(workflows);

  if(decision==="AMBIGUOUS"){
    return {
      ok:true,
      status:"CLARIFICATION_REQUIRED",
      creation_allowed:false,
      writes_performed:false,
      candidate_workflow_ids:candidates,
      clarification_question:result.clarification_question||null,
      reason:result.reason||null
    };
  }

  if(decision==="UNCLASSIFIED"){
    return {
      ok:true,
      status:"UNCLASSIFIED_REVIEW",
      creation_allowed:false,
      writes_performed:false,
      routes:[],
      reason:result.reason||null
    };
  }

  if(decision==="CLASSIFIED_MULTI"){
    const resolvedRoutes=routes.map(route=>({
      ...route,
      workflow:byId.get(route.workflow_id)||null
    }));
    return {
      ok:true,
      status:"MULTI_WORKFLOW_REVIEW",
      creation_allowed:false,
      writes_performed:false,
      auto_split_allowed:false,
      routes:resolvedRoutes,
      reason:result.reason||null
    };
  }

  if(decision==="CLASSIFIED_SINGLE"){
    if(routes.length!==1){
      return {ok:false,status:"INVALID_CLASSIFIER_RESULT",creation_allowed:false,writes_performed:false};
    }
    const route=routes[0];
    const workflow=byId.get(route.workflow_id)||null;
    if(!workflow){
      return {
        ok:false,
        status:"WORKFLOW_NOT_AVAILABLE",
        creation_allowed:false,
        writes_performed:false,
        workflow_id:route.workflow_id||null
      };
    }
    if(typeof route.workflow_key==="string"&&workflow.workflow_key&&route.workflow_key!==workflow.workflow_key){
      return {
        ok:false,
        status:"WORKFLOW_NOT_AVAILABLE",
        creation_allowed:false,
        writes_performed:false,
        workflow_id:route.workflow_id,
        reason:"WORKFLOW_KEY_MISMATCH"
      };
    }
    const required=requiredDataSummary(workflow.required_data);
    if(!required.ok){
      return {
        ok:false,
        status:"CONFIG_REQUIRED",
        creation_allowed:false,
        writes_performed:false,
        requires_creation_policy:true,
        route,
        workflow:{
          id:workflow.id,
          workflow_key:workflow.workflow_key||null,
          name:workflow.name||null,
          required_data:required
        },
        data_extraction_required:false,
        reason:required.reason||"REQUIRED_DATA_CONFIGURATION_INVALID"
      };
    }
    return {
      ok:true,
      status:"WORKFLOW_IDENTIFIED",
      creation_allowed:false,
      writes_performed:false,
      requires_creation_policy:true,
      route,
      workflow:{
        id:workflow.id,
        workflow_key:workflow.workflow_key||null,
        name:workflow.name||null,
        required_data:required
      },
      data_extraction_required:required.configured,
      reason:result.reason||null
    };
  }

  return {
    ok:false,
    status:"INVALID_CLASSIFIER_DECISION",
    creation_allowed:false,
    writes_performed:false
  };
}
