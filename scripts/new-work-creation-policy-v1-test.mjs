import {evaluateNewWorkCreationPolicy,NEW_WORK_CREATION_POLICY_KEY} from "../lib/new-work-creation-policy-v1.js";

function assert(x,msg){if(!x)throw new Error(msg);}
const businessId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const workflowId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const intake={ok:true,status:"WORKFLOW_IDENTIFIED",workflow:{id:workflowId}};
const ready={ok:true,status:"CREATION_POLICY_REQUIRED"};
const collecting={ok:true,status:"DATA_COLLECTION_REQUIRED"};

let r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[]});
assert(r.ok&&r.status==="CONFIG_REQUIRED"&&!r.creation_authorized,"missing policy fails closed");
assert(r.policy_key===NEW_WORK_CREATION_POLICY_KEY,"policy key");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:collecting,policies:[{business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"auto",is_active:true}]});
assert(r.status==="DATA_COLLECTION_REQUIRED"&&!r.creation_authorized,"missing data blocks auto");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[{business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"forbidden",is_active:true}]});
assert(r.status==="DENIED"&&!r.creation_authorized,"forbidden");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[{business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"professional_only",is_active:true}]});
assert(r.status==="HANDOFF_REQUIRED"&&!r.creation_authorized,"professional only");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[{business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"confirm",is_active:true}]});
assert(r.status==="CONFIRMATION_REQUIRED"&&!r.creation_authorized,"confirm");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[{business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"auto",is_active:true}]});
assert(r.status==="ELIGIBLE_AUTO"&&r.creation_authorized===true&&r.writes_performed===false,"auto eligible no write");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:intake,dataCollectionPlan:ready,policies:[
  {business_id:businessId,scope:"business",workflow_id:null,policy_key:"create_work_item",autonomy_mode:"auto",is_active:true},
  {business_id:businessId,scope:"workflow",workflow_id:workflowId,policy_key:"create_work_item",autonomy_mode:"confirm",is_active:true}
]});
assert(r.status==="CONFIRMATION_REQUIRED"&&!r.creation_authorized,"strictest policy wins");

r=evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan:{ok:true,status:"WORKFLOW_IDENTIFIED",workflow:{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}},dataCollectionPlan:ready,policies:[]});
assert(!r.ok&&r.status==="WORKFLOW_MISMATCH","workflow mismatch blocked");

console.log("NEW_WORK_CREATION_POLICY_V1_PASS");
