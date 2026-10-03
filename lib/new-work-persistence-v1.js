const cleanBase=v=>String(v||"").trim().replace(/\/+$/,'');

async function rpc(baseUrl,secret,name,args){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error('NEW_WORK_DB_CONFIG_MISSING');
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{
      apikey:secret,
      Authorization:`Bearer ${secret}`,
      'Content-Type':'application/json',
      Accept:'application/json'
    },
    body:JSON.stringify(args)
  });
  const raw=await r.text();
  let body=null;
  try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
  if(!r.ok)throw new Error(`NEW_WORK_RPC_${name}_HTTP_${r.status}`);
  return body;
}

export function createNewWorkPersistence({baseUrl,secret}){
  return {
    commit(input){
      return rpc(baseUrl,secret,'vf_commit_new_work_item_v1',{
        p_business_id:input.businessId,
        p_event_id:input.eventId,
        p_unit_id:input.unitId,
        p_workflow_id:input.workflowId,
        p_provided_data:Array.isArray(input.providedData)?input.providedData:[]
      });
    }
  };
}
