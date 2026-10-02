const INTENTS = new Set(["consult","add_note","schedule_action"]);
const MODES = new Set(["auto","confirm","professional_only","forbidden"]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const unique=a=>[...new Set(a)];

export function parseMemberPermissions(raw){
  if(!isObject(raw)||raw.version!==1||!Array.isArray(raw.grants)||!isObject(raw.work_items)){
    return {ok:false,reason:"INVALID_PERMISSIONS_SCHEMA"};
  }
  if(raw.grants.some(x=>typeof x!=="string"||!INTENTS.has(x))||unique(raw.grants).length!==raw.grants.length){
    return {ok:false,reason:"INVALID_PERMISSION_GRANTS"};
  }
  const mode=raw.work_items.mode;
  if(!["business","explicit"].includes(mode)) return {ok:false,reason:"INVALID_WORK_ITEM_SCOPE"};
  const ids=raw.work_items.ids;
  if(mode==="explicit"){
    if(!Array.isArray(ids)||ids.some(x=>!UUID_RE.test(x))||unique(ids).length!==ids.length){
      return {ok:false,reason:"INVALID_WORK_ITEM_IDS"};
    }
  } else if(ids!==undefined && (!Array.isArray(ids)||ids.length!==0)){
    return {ok:false,reason:"BUSINESS_SCOPE_MUST_NOT_CARRY_IDS"};
  }
  return {ok:true,permissions:{version:1,grants:[...raw.grants],workItems:{mode,ids:mode==="explicit"?[...ids]:[]}}};
}

export function resolveAccessibleWorkItems(member,businessId,workItems,parsedPermissions){
  if(!member||member.is_active!==true||member.business_id!==businessId) return {ok:false,reason:"MEMBER_NOT_ACTIVE_IN_BUSINESS"};
  const rows=(workItems||[]).filter(w=>w&&w.business_id===businessId&&w.lifecycle_status==="open");
  const {mode,ids}=parsedPermissions.workItems;
  const allowed=mode==="business"?rows:rows.filter(w=>ids.includes(w.id));
  return {ok:true,items:allowed.map(w=>({
    id:w.id,businessId:w.business_id,workflowId:w.workflow_id||null,
    label:w.title||w.summary||w.work_type||w.id,
    writable:true
  }))};
}

export function resolvePoliciesByWorkItem(workItems,policyRows){
  const result={};
  for(const item of workItems){
    result[item.id]={};
    for(const intent of INTENTS){
      const business=(policyRows||[]).filter(p=>p&&p.is_active===true&&p.business_id===item.businessId&&p.scope==="business"&&p.policy_key===intent);
      const workflow=(policyRows||[]).filter(p=>p&&p.is_active===true&&p.business_id===item.businessId&&p.scope==="workflow"&&p.workflow_id===item.workflowId&&p.policy_key===intent);
      if(business.length>1||workflow.length>1){
        return {ok:false,reason:"DUPLICATE_POLICY",workItemId:item.id,intent};
      }
      const applicable=[...business,...workflow];
      if(applicable.length===0){
        result[item.id][intent]=null;
        continue;
      }
      const modes=applicable.map(p=>p.autonomy_mode);
      if(modes.some(m=>!MODES.has(m))){
        return {ok:false,reason:"INVALID_POLICY_MODE",workItemId:item.id,intent};
      }
      result[item.id][intent]=modes;
    }
  }
  return {ok:true,policiesByWorkItem:result};
}

export function buildAuthorizationContext({businessId,originVerified,member,workItems,policyRows}){
  if(originVerified!==true) return {ok:false,status:"DENIED",reason:"IDENTITY_NOT_VERIFIED"};
  if(!member||member.business_id!==businessId||member.is_active!==true) return {ok:false,status:"DENIED",reason:"MEMBER_NOT_ACTIVE_IN_BUSINESS"};
  const parsed=parseMemberPermissions(member.permissions);
  if(!parsed.ok) return {ok:false,status:"CONFIG_REQUIRED",reason:parsed.reason};
  const access=resolveAccessibleWorkItems(member,businessId,workItems,parsed.permissions);
  if(!access.ok) return {ok:false,status:"DENIED",reason:access.reason};
  const policies=resolvePoliciesByWorkItem(access.items,policyRows);
  if(!policies.ok) return {ok:false,status:"CONFIG_REQUIRED",reason:policies.reason,details:{work_item_id:policies.workItemId,intent:policies.intent}};
  return {
    ok:true,status:"READY",
    context:{
      businessId,originVerified:true,
      member:{
        id:member.id,businessId:member.business_id,verified:true,active:true,sharedAccount:false,
        permissions:[...parsed.permissions.grants],
        workItemIds:access.items.map(x=>x.id)
      },
      workItems:access.items,
      policiesByWorkItem:policies.policiesByWorkItem
    }
  };
}
