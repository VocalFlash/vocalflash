// VocalFlash NEW Work Creation Policy V1
// Read-only policy gate. It never creates a work_item.

const POLICY_KEY="create_work_item";
const MODES=new Set(["auto","confirm","professional_only","forbidden"]);

function asArray(v){return Array.isArray(v)?v:[];}

export function evaluateNewWorkCreationPolicy({businessId,workflowId,intakePlan,dataCollectionPlan,policies}={}){
  if(!businessId||!workflowId){
    return {ok:false,status:"INVALID",creation_authorized:false,writes_performed:false,reason:"BUSINESS_AND_WORKFLOW_REQUIRED"};
  }
  if(!intakePlan||intakePlan.ok!==true||intakePlan.status!=="WORKFLOW_IDENTIFIED"){
    return {ok:false,status:"INTAKE_NOT_READY",creation_authorized:false,writes_performed:false};
  }
  if(intakePlan.workflow?.id!==workflowId){
    return {ok:false,status:"WORKFLOW_MISMATCH",creation_authorized:false,writes_performed:false};
  }
  if(!dataCollectionPlan||dataCollectionPlan.ok!==true){
    return {ok:false,status:"DATA_PLAN_REQUIRED",creation_authorized:false,writes_performed:false};
  }
  if(dataCollectionPlan.status==="DATA_COLLECTION_REQUIRED"){
    return {ok:true,status:"DATA_COLLECTION_REQUIRED",creation_authorized:false,writes_performed:false};
  }
  if(dataCollectionPlan.status!=="CREATION_POLICY_REQUIRED"){
    return {ok:false,status:"DATA_PLAN_NOT_READY",creation_authorized:false,writes_performed:false};
  }

  const applicable=asArray(policies).filter(p=>{
    if(!p||p.is_active===false||p.business_id!==businessId||p.policy_key!==POLICY_KEY)return false;
    if(p.scope==="business")return p.workflow_id==null;
    if(p.scope==="workflow")return p.workflow_id===workflowId;
    return false;
  });

  if(applicable.length===0){
    return {
      ok:true,status:"CONFIG_REQUIRED",creation_authorized:false,writes_performed:false,
      policy_key:POLICY_KEY,reason:"Nessuna policy attiva create_work_item risolta per business/workflow."
    };
  }

  for(const p of applicable){
    if(!MODES.has(p.autonomy_mode)){
      return {ok:false,status:"CONFIG_REQUIRED",creation_authorized:false,writes_performed:false,policy_key:POLICY_KEY,reason:"AUTONOMY_MODE_INVALID"};
    }
  }

  const modes=applicable.map(p=>p.autonomy_mode);
  let effective="auto";
  if(modes.includes("forbidden"))effective="forbidden";
  else if(modes.includes("professional_only"))effective="professional_only";
  else if(modes.includes("confirm"))effective="confirm";

  if(effective==="forbidden"){
    return {ok:true,status:"DENIED",creation_authorized:false,writes_performed:false,policy_key:POLICY_KEY,effective_mode:effective};
  }
  if(effective==="professional_only"){
    return {ok:true,status:"HANDOFF_REQUIRED",creation_authorized:false,writes_performed:false,policy_key:POLICY_KEY,effective_mode:effective};
  }
  if(effective==="confirm"){
    return {ok:true,status:"CONFIRMATION_REQUIRED",creation_authorized:false,writes_performed:false,policy_key:POLICY_KEY,effective_mode:effective};
  }
  return {
    ok:true,status:"ELIGIBLE_AUTO",creation_authorized:true,writes_performed:false,
    policy_key:POLICY_KEY,effective_mode:effective,
    reason:"La policy consente la creazione automatica, ma questo gate non esegue alcuna scrittura."
  };
}

export {POLICY_KEY as NEW_WORK_CREATION_POLICY_KEY};
