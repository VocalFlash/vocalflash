import {buildNewWorkIntakePlan} from "../lib/new-work-intake-plan-v1.js";

const wfA={id:"11111111-1111-4111-8111-111111111111",workflow_key:"repair",name:"Repair",required_data:{zone:{label:"Zone"},photo:{label:"Photo"}}};
const wfB={id:"22222222-2222-4222-8222-222222222222",workflow_key:"quote",name:"Quote",required_data:{}};

function assert(condition,message){if(!condition)throw new Error(message);}

let r=buildNewWorkIntakePlan({classifierResult:{decision:"CLASSIFIED_SINGLE",routes:[{workflow_id:wfA.id,workflow_key:wfA.workflow_key,work_type:"repair",confidence:.98}],candidate_workflow_ids:[],reason:"single"},workflows:[wfA]});
assert(r.ok===true,"single ok");
assert(r.status==="WORKFLOW_IDENTIFIED","single status");
assert(r.creation_allowed===false,"single must not create");
assert(r.requires_creation_policy===true,"single policy gate");
assert(r.workflow.required_data.configured===true,"required data configured");
assert(r.data_extraction_required===true,"single requires extraction");

r=buildNewWorkIntakePlan({classifierResult:{decision:"CLASSIFIED_SINGLE",routes:[{workflow_id:wfB.id,workflow_key:wfB.workflow_key,work_type:"quote",confidence:.97}],candidate_workflow_ids:[],reason:"single no required"},workflows:[wfB]});
assert(r.status==="WORKFLOW_IDENTIFIED","single no required status");
assert(r.workflow.required_data.configured===false,"no invented required data");
assert(r.data_extraction_required===false,"no extraction required without config");

r=buildNewWorkIntakePlan({classifierResult:{decision:"CLASSIFIED_MULTI",routes:[{workflow_id:wfA.id},{workflow_id:wfB.id}],candidate_workflow_ids:[],reason:"multi"},workflows:[wfA,wfB]});
assert(r.status==="MULTI_WORKFLOW_REVIEW","multi status");
assert(r.creation_allowed===false,"multi no create");
assert(r.auto_split_allowed===false,"multi no auto split");
assert(r.routes.length===2,"multi routes preserved");

r=buildNewWorkIntakePlan({classifierResult:{decision:"AMBIGUOUS",routes:[],candidate_workflow_ids:[wfA.id,wfB.id],reason:"ambiguous",clarification_question:"Quale richiesta intendi?"},workflows:[wfA,wfB]});
assert(r.status==="CLARIFICATION_REQUIRED","ambiguous status");
assert(r.creation_allowed===false,"ambiguous no create");
assert(r.candidate_workflow_ids.length===2,"candidates preserved");

r=buildNewWorkIntakePlan({classifierResult:{decision:"UNCLASSIFIED",routes:[],candidate_workflow_ids:[],reason:"none"},workflows:[wfA,wfB]});
assert(r.status==="UNCLASSIFIED_REVIEW","unclassified status");
assert(r.creation_allowed===false,"unclassified no create");

r=buildNewWorkIntakePlan({classifierResult:{decision:"CLASSIFIED_SINGLE",routes:[{workflow_id:"33333333-3333-4333-8333-333333333333"}],candidate_workflow_ids:[],reason:"missing"},workflows:[wfA,wfB]});
assert(r.ok===false,"missing workflow invalid");
assert(r.status==="WORKFLOW_NOT_AVAILABLE","missing workflow status");
assert(r.creation_allowed===false,"missing workflow no create");

console.log("NEW_WORK_INTAKE_PLAN_V1_PASS");
