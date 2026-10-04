function isObject(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function normalizeRequiredData(raw){
  if(!isObject(raw))return {configured:false,fields:[]};
  const candidates=Array.isArray(raw.fields)?raw.fields:Array.isArray(raw.required)?raw.required:null;
  if(!candidates||candidates.length===0)return {configured:false,fields:[]};
  const fields=candidates.map(x=>{
    if(typeof x==="string")return {key:x,label:x};
    if(isObject(x)&&typeof x.key==="string"&&x.key.trim())return {key:x.key.trim(),label:String(x.label||x.key).trim()};
    return null;
  }).filter(Boolean);
  return {configured:fields.length>0,fields};
}

export function buildWorkConsultation({workItem,workflow,workData}){
  if(!workItem||!workItem.id)return {ok:false,status:"INVALID",reason:"WORK_ITEM_REQUIRED"};
  const required=normalizeRequiredData(workflow?.required_data);

  const facts=(workData||[]).filter(x=>x?.work_item_id===workItem.id).map(x=>({
    key:x.field_key,
    label:x.field_label||x.field_key,
    value:x.value,
    status:x.data_status,
    sensitivityLevel:x.sensitivity_level
  }));

  if(!required.configured){
    return {
      ok:true,status:"AVAILABLE_FACTS_ONLY",
      workItem:{id:workItem.id,title:workItem.title||null,summary:workItem.summary||null},
      facts,
      completeness:{
        evaluable:false,
        reason:"REQUIRED_DATA_NOT_CONFIGURED",
        missing:[]
      }
    };
  }

  const current=new Map(facts
    .filter(x=>["collected","confirmed"].includes(x.status))
    .map(x=>[x.key,x]));
  const missing=required.fields
    .filter(f=>!current.has(f.key))
    .map(f=>({key:f.key,label:f.label}));

  return {
    ok:true,status:"COMPLETENESS_EVALUATED",
    workItem:{id:workItem.id,title:workItem.title||null,summary:workItem.summary||null},
    facts,
    completeness:{evaluable:true,reason:null,missing}
  };
}
