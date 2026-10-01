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

const legal1=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal1.decomposition?.mode==="SINGLE","LEGAL_NOT_SINGLE");
assert(legal1.units?.length===1&&legal1.units[0].resolver?.decision==="MATCH","LEGAL_NOT_MATCH");
assert(legal1.units[0].resolver?.work_item_id==="64388afe-6eac-4698-9264-750b75b34975","LEGAL_WRONG_TARGET");
assert(legal1.units[0].write_eligible===true,"LEGAL_NOT_WRITE_ELIGIBLE");
assert(legal1.routing_decision_created===true&&legal1.work_links_created_count===1,"LEGAL_WRITE_FAILED");
results.push(["LEGAL_MATCH",decisions(legal1),legal1.work_links_created_count]);

const legal2=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal2.replayed===true,"RETRY_NOT_REPLAYED");
assert(legal2.routing_decision_created===false&&legal2.work_links_created_count===0,"RETRY_WROTE_AGAIN");
assert(Array.isArray(legal2.write_result)&&legal2.write_result.length===1&&legal2.write_result[0].created===false,"RETRY_LINK_STATE_WRONG");
results.push(["EXACTLY_ONCE_RETRY",legal2.replayed,legal2.work_links_created_count]);

const narrative=await invoke("be2e89d7-bb7f-4ed1-8c3a-6cef724ea078","48e1501a-80ae-40d6-92b9-661db974e77a");
assert(narrative.work_links_created_count===0,"NARRATIVE_FALSE_MATCH_WRITE");
assert((narrative.units||[]).every(x=>x.write_eligible!==true),"NARRATIVE_WRITE_ELIGIBLE");
results.push(["NO_FALSE_MATCH_NARRATIVE",decisions(narrative),0]);

const ambiguous=await invoke("7ceb9e12-d746-45df-afb2-0f549274554d","6ddab61a-650b-47cd-849c-94b0386f7624");
assert(ambiguous.decomposition?.mode==="SINGLE","AMBIGUOUS_NOT_SINGLE");
assert(ambiguous.units?.length===1&&ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS_DID_NOT_STOP");
assert(ambiguous.work_links_created_count===0,"AMBIGUOUS_WROTE");
results.push(["TWO_PLAUSIBLE_WORKS",decisions(ambiguous),0]);

const mixed=await invoke("76c06164-2cdd-4763-98d3-e84c76d428a2","b7ae1efc-49ee-490a-842d-702cbd7b4834");
const md=decisions(mixed);
assert(mixed.decomposition?.mode==="MULTI_INDEPENDENT","MIXED_NOT_MULTI");
assert(md.filter(x=>x==="MATCH").length===1&&md.filter(x=>x==="NEW").length===1,"MIXED_DECISIONS_WRONG");
const eligible=(mixed.units||[]).filter(x=>x.write_eligible===true);
assert(eligible.length===1&&eligible[0].resolver?.work_item_id==="0d97b103-b90b-4285-844e-c064e4abb127","MIXED_TARGET_WRONG");
assert(mixed.work_links_created_count===1,"MIXED_WRITE_COUNT_WRONG");
results.push(["MIXED_MATCH_NEW",md,mixed.work_links_created_count]);

console.log("VF_MATCH_WRITE_V2_E2E_PASS",JSON.stringify(results));\nprocess.exit(0);
