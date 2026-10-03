import {buildNewWorkIntakePlan} from './new-work-intake-plan-v1.js';
import {extractNewWorkRequiredData} from './new-work-required-data-extractor-v1.js';
import {buildNewWorkDataCollectionPlan} from './new-work-data-collection-plan-v1.js';
import {evaluateNewWorkCreationPolicy} from './new-work-creation-policy-v1.js';
import {createNewWorkPersistence} from './new-work-persistence-v1.js';

const cleanBase=v=>String(v||'').trim().replace(/\/+$/,'');
const NEW_ACTION='NEW_WORK_CANDIDATE_CLASSIFIED';

async function dbGet(baseUrl,secret,table,params={}){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error('NEW_WORK_DB_CONFIG_MISSING');
  const url=new URL(`${base}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v));
  const r=await fetch(url,{
    headers:{apikey:secret,Authorization:`Bearer ${secret}`,Accept:'application/json'}
  });
  const raw=await r.text();
  if(!r.ok)throw new Error(`NEW_WORK_DB_GET_${table}_HTTP_${r.status}`);
  return raw?JSON.parse(raw):[];
}

function routingUnits(routing){
  if(Array.isArray(routing?.units))return routing.units;
  if(Array.isArray(routing?.decision_payload?.units))return routing.decision_payload.units;
  return [];
}

function providedPayload(extractionResult){
  const labels=new Map((extractionResult?.required_data?.fields||[]).map(f=>[f.key,f.label||f.key]));
  return (extractionResult?.extraction?.provided||[]).map(x=>({
    key:x.key,
    label:labels.get(x.key)||x.key,
    value:x.value,
    evidence:x.evidence??null,
    confidence:x.confidence??null
  }));
}

function blockingUnit(unit){
  const action=String(unit?.next_action||'');
  return action.startsWith('CLARIFY_')||action.startsWith('REVIEW_');
}

function singleRoute(classifier){
  const routes=Array.isArray(classifier?.routes)?classifier.routes:[];
  return classifier?.decision==='CLASSIFIED_SINGLE'&&routes.length===1&&routes[0]?.workflow_id?routes[0]:null;
}

export async function processNewWorkFromRouting(input={}){
  const businessId=input.businessId;
  const eventId=input.eventId;
  const routing=input.routing;
  const baseUrl=input.baseUrl||process.env.VF_ASSISTANT_SUPABASE_URL;
  const secret=input.secret||process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  const openAiApiKey=input.openAiApiKey||process.env.OPENAI_API_KEY;
  if(!businessId||!eventId||!routing)return {ok:false,status:'INVALID',writes_performed:false,reason:'BUSINESS_EVENT_ROUTING_REQUIRED'};
  if(!baseUrl||!secret)return {ok:false,status:'CONFIG_REQUIRED',writes_performed:false,reason:'DB_CONFIG_REQUIRED'};

  const units=routingUnits(routing);
  const newUnits=units.filter(u=>u?.next_action===NEW_ACTION);
  if(newUnits.length===0){
    return {ok:true,status:'NO_NEW_WORK_TO_PROCESS',writes_performed:false,units:[]};
  }

  if(newUnits.length>1){
    return {
      ok:true,status:'MULTI_NEW_REVIEW',writes_performed:false,
      reason:'BATCH_ATOMICITY_REQUIRED',unit_ids:newUnits.map(u=>u.unit_id)
    };
  }

  const otherBlocking=units.filter(u=>u!==newUnits[0]&&blockingUnit(u));
  if(otherBlocking.length>0){
    return {
      ok:true,status:'EVENT_REVIEW_REQUIRED',writes_performed:false,
      reason:'OTHER_UNIT_REQUIRES_CLARIFICATION_OR_REVIEW',
      blocking_unit_ids:otherBlocking.map(u=>u.unit_id)
    };
  }

  const unit=newUnits[0];
  const classifier=unit.classifier||{};
  const route=singleRoute(classifier);

  // Exactly-once fast replay guard: if the DB already contains the work item created
  // from this immutable event/unit/workflow tuple, do not call AI again.
  if(route){
    const dedupeKey=`${eventId}:${String(unit.unit_id||'').trim()}:${route.workflow_id}`;
    const existing=await dbGet(baseUrl,secret,'work_items',{
      select:'id,workflow_id,metadata',
      business_id:`eq.${businessId}`,
      'metadata->>new_work_dedupe_key':`eq.${dedupeKey}`,
      limit:1
    });
    if(existing[0]){
      return {
        ok:true,status:'WORK_ITEM_EXISTS',writes_performed:false,replayed:true,
        unit_id:unit.unit_id,workflow_id:existing[0].workflow_id,
        work_item_id:existing[0].id
      };
    }
  }

  const routeIds=(classifier.routes||[]).map(r=>r.workflow_id).filter(Boolean);
  const workflows=await dbGet(baseUrl,secret,'workflows',{
    select:'id,business_id,workflow_key,name,description,required_data,is_active',
    business_id:`eq.${businessId}`,is_active:'eq.true',limit:20
  });
  const intakePlan=buildNewWorkIntakePlan({classifierResult:classifier,workflows});
  if(!intakePlan.ok||intakePlan.status!=='WORKFLOW_IDENTIFIED'){
    return {ok:intakePlan.ok===true,status:intakePlan.status,writes_performed:false,unit_id:unit.unit_id,intake_plan:intakePlan};
  }

  const workflow=workflows.find(w=>w.id===intakePlan.workflow.id)||null;
  if(!workflow||!routeIds.includes(workflow.id)){
    return {ok:false,status:'WORKFLOW_NOT_AVAILABLE',writes_performed:false,unit_id:unit.unit_id};
  }

  const extractionResult=await extractNewWorkRequiredData({
    normalizedText:unit.routing_text,
    workflow,
    openAiApiKey
  });
  if(!extractionResult.ok){
    return {ok:false,status:extractionResult.status||'EXTRACTION_FAILED',writes_performed:false,unit_id:unit.unit_id,extraction:extractionResult};
  }

  const dataCollectionPlan=buildNewWorkDataCollectionPlan({intakePlan,extractionResult});
  if(!dataCollectionPlan.ok){
    return {ok:false,status:dataCollectionPlan.status,writes_performed:false,unit_id:unit.unit_id,intake_plan:intakePlan,extraction:extractionResult,data_collection_plan:dataCollectionPlan};
  }

  const policies=await dbGet(baseUrl,secret,'assistant_policies',{
    select:'id,business_id,workflow_id,scope,policy_key,autonomy_mode,is_active',
    business_id:`eq.${businessId}`,policy_key:'eq.create_work_item',is_active:'eq.true',limit:20
  });
  const policyPlan=evaluateNewWorkCreationPolicy({
    businessId,workflowId:workflow.id,intakePlan,dataCollectionPlan,policies
  });

  const common={
    ok:true,
    status:policyPlan.status,
    writes_performed:false,
    unit_id:unit.unit_id,
    workflow_id:workflow.id,
    intake_plan:intakePlan,
    extraction:extractionResult,
    data_collection_plan:dataCollectionPlan,
    creation_policy:policyPlan
  };

  if(policyPlan.status!=='ELIGIBLE_AUTO'||policyPlan.creation_authorized!==true)return common;

  const persistence=input.persistence||createNewWorkPersistence({baseUrl,secret});
  const committed=await persistence.commit({
    businessId,eventId,unitId:unit.unit_id,workflowId:workflow.id,
    providedData:providedPayload(extractionResult)
  });

  return {
    ...common,
    status:committed?.status||'UNKNOWN',
    writes_performed:committed?.status==='WORK_ITEM_CREATED',
    replayed:committed?.replayed===true,
    work_item_id:committed?.work_item_id||null,
    commit:committed
  };
}
