import writer from "../api/write-path-match-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
if(!apiKey||!process.env.VF_ASSISTANT_SUPABASE_URL||!process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||!process.env.OPENAI_API_KEY){
  throw new Error("E2E_ENV_MISSING");
}
function capture(){
  const c={statusCode:200,body:null};
  const res={setHeader(){return res;},status(x){c.statusCode=x;return res;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
  return {res,c};
}
async function invoke(business_id,event_id){
  const {res,c}=capture();
  await writer({method:"POST",headers:{"x-api-key":apiKey},body:{business_id,event_id}},res);
  if(c.statusCode!==200) throw new Error(`WRITER_HTTP_${c.statusCode} ${JSON.stringify(c.body)}`);
  return c.body;
}
function assert(ok,msg){if(!ok)throw new Error(msg);}
const decisions=b=>(b.units||[]).map(x=>x.resolver?.decision);
const results=[];

const legal1=await invoke("a1100000-0000-4000-8000-000000000001","d1100000-0000-4000-8000-000000000001");
assert(legal1.decomposition?.mode==="SINGLE","LEGAL_NOT_SINGLE");
assert(legal1.units?.length===1&&legal1.units[0].resolver?.decision==="MATCH","LEGAL_NOT_MATCH");
assert(legal1.units[0].resolver?.work_item_id==="c1100000-0000-4000-8000-000000000001","LEGAL_WRONG_TARGET");
assert(legal1.units[0].write_eligible===true,"LEGAL_NOT_WRITE_ELIGIBLE");
assert(legal1.routing_decision_created===true&&legal1.work_links_created_count===1,"LEGAL_WRITE_FAILED");
results.push(["LEGAL_MATCH",decisions(legal1),legal1.work_links_created_count]);

const legal2=await invoke("a1100000-0000-4000-8000-000000000001","d1100000-0000-4000-8000-000000000001");
assert(legal2.replayed===true,"RETRY_NOT_REPLAYED");
assert(legal2.routing_decision_id===legal1.routing_decision_id&&Boolean(legal1.routing_decision_id),"RETRY_CHANGED_DECISION");
assert(legal2.routing_decision_created===false&&legal2.work_links_created_count===0,"RETRY_WROTE_AGAIN");
assert(Array.isArray(legal2.write_result)&&legal2.write_result.length===1&&legal2.write_result[0].created===false,"RETRY_LINK_STATE_WRONG");
results.push(["EXACTLY_ONCE_RETRY",legal2.replayed,legal2.work_links_created_count]);

const narrative=await invoke("a2200000-0000-4000-8000-000000000001","d2200000-0000-4000-8000-000000000001");
assert(Array.isArray(narrative.units)&&narrative.units.length>0,"NARRATIVE_EMPTY_UNITS");
assert(narrative.units.every(x=>["NEW","AMBIGUOUS"].includes(x.resolver?.decision)),"NARRATIVE_INVALID_OR_MATCH_DECISION");
assert(narrative.routing_decision_created===true,"NARRATIVE_DECISION_NOT_SAVED");
assert(narrative.work_links_created_count===0,"NARRATIVE_FALSE_MATCH_WRITE");
assert(narrative.units.every(x=>x.write_eligible!==true),"NARRATIVE_WRITE_ELIGIBLE");
results.push(["NO_FALSE_MATCH_NARRATIVE",decisions(narrative),0]);

const ambiguous=await invoke("a3300000-0000-4000-8000-000000000001","d3300000-0000-4000-8000-000000000001");
assert(ambiguous.decomposition?.mode==="SINGLE","AMBIGUOUS_NOT_SINGLE");
assert(ambiguous.units?.length===1&&ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS_DID_NOT_STOP");
assert(ambiguous.routing_decision_created===true,"AMBIGUOUS_DECISION_NOT_SAVED");
assert(ambiguous.work_links_created_count===0,"AMBIGUOUS_WROTE");
results.push(["TWO_PLAUSIBLE_WORKS",decisions(ambiguous),0]);

const mixed=await invoke("a4400000-0000-4000-8000-000000000001","d4400000-0000-4000-8000-000000000001");
const md=decisions(mixed);
assert(mixed.decomposition?.mode==="MULTI_INDEPENDENT","MIXED_NOT_MULTI");
assert(mixed.units?.length===2,"MIXED_WRONG_UNIT_COUNT");
assert(mixed.routing_decision_created===true,"MIXED_DECISION_NOT_SAVED");
assert(md.filter(x=>x==="MATCH").length===1&&md.filter(x=>x==="NEW").length===1,"MIXED_DECISIONS_WRONG");
const eligible=(mixed.units||[]).filter(x=>x.write_eligible===true);
assert(eligible.length===1&&eligible[0].resolver?.work_item_id==="c4400000-0000-4000-8000-000000000001","MIXED_TARGET_WRONG");
assert(mixed.work_links_created_count===1,"MIXED_WRITE_COUNT_WRONG");
results.push(["MIXED_MATCH_NEW",md,mixed.work_links_created_count]);

const markerUrl=new URL(process.env.VF_ASSISTANT_SUPABASE_URL.replace(/\/+$/,"")+"/rest/v1/businesses");
markerUrl.searchParams.set("id","eq.a1100000-0000-4000-8000-000000000001");
const marker=await fetch(markerUrl,{
  method:"PATCH",
  headers:{
    apikey:process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY,
    "Content-Type":"application/json",
    Prefer:"return=minimal"
  },
  body:JSON.stringify({settings:{fixture:"writer-v2-synthetic-20261002-v2",e2e_status:"PASS"}})
});
if(!marker.ok) throw new Error("PASS_MARKER_WRITE_FAILED");
console.log("VF_MATCH_WRITE_V2_E2E_PASS_DB_REVIEW_REQUIRED",JSON.stringify(results));
