import writer from "../api/write-path-match-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
const base=(process.env.VF_ASSISTANT_SUPABASE_URL||"").replace(/\/+$/,"");
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||"";
if(!apiKey||!base||!secret||!process.env.OPENAI_API_KEY) throw new Error("E2E env missing");

function capture(){
  const c={statusCode:200,body:null};
  const res={
    setHeader(){return res;},
    status(x){c.statusCode=x;return res;},
    json(x){c.body=x;return c;},
    send(x){c.body=x;return c;},
    end(){return c;}
  };
  return {res,c};
}
async function invoke(business_id,event_id){
  const {res,c}=capture();
  await writer({method:"POST",headers:{"x-api-key":apiKey},body:{business_id,event_id}},res);
  if(c.statusCode!==200) throw new Error(`writer HTTP ${c.statusCode}: ${JSON.stringify(c.body)}`);
  return c.body;
}
async function db(table,params){
  const u=new URL(`${base}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{apikey:secret,Accept:"application/json"}});
  const raw=await r.text();
  if(!r.ok)throw new Error(`DB ${table} ${r.status}: ${raw}`);
  return raw?JSON.parse(raw):[];
}
function assert(ok,msg){if(!ok)throw new Error(msg);}
function decisions(body){return (body.units||[]).map(x=>x.resolver?.decision);}
const results=[];

// 1. LEGAL: explicit response to a prior request must MATCH the right practice.
const legal1=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal1.decomposition?.mode==="SINGLE","LEGAL expected SINGLE");
assert(legal1.units?.length===1,"LEGAL expected one unit");
assert(legal1.units[0].resolver?.decision==="MATCH","LEGAL expected MATCH");
assert(legal1.units[0].resolver?.work_item_id==="64388afe-6eac-4698-9264-750b75b34975","LEGAL wrong target");
assert(legal1.units[0].write_eligible===true,"LEGAL MATCH below safety threshold");
assert(legal1.routing_decision_created===true,"LEGAL routing decision not created");
assert(legal1.work_links_created_count===1,"LEGAL expected exactly one work link");
results.push({case:"LEGAL_MATCH",decisions:decisions(legal1),links:legal1.work_links_created_count});

// 2. Same Meta event retry: must replay without rerunning/rewriting.
const legal2=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal2.replayed===true,"RETRY did not use exactly-once fast path");
assert(legal2.routing_decision_created===false,"RETRY created another routing decision");
assert(legal2.work_links_created_count===0,"RETRY created another work link");
assert(Array.isArray(legal2.write_result)&&legal2.write_result.length===1&&legal2.write_result[0].created===false,"RETRY did not return existing active link");
results.push({case:"EXACTLY_ONCE_RETRY",replayed:legal2.replayed,links_created:legal2.work_links_created_count});

// 3. REAL ESTATE: third-party narrative must not auto-link to user's existing sale.
const narrative=await invoke("be2e89d7-bb7f-4ed1-8c3a-6cef724ea078","48e1501a-80ae-40d6-92b9-661db974e77a");
assert(narrative.work_links_created_count===0,"NARRATIVE false MATCH created a work link");
assert((narrative.units||[]).every(x=>x.write_eligible!==true),"NARRATIVE produced write-eligible MATCH");
results.push({case:"NO_FALSE_MATCH_NARRATIVE",decisions:decisions(narrative),links:narrative.work_links_created_count});

// 4. CONSTRUCTION: generic requested photo with two plausible practices must stop as AMBIGUOUS.
const ambiguous=await invoke("7ceb9e12-d746-45df-afb2-0f549274554d","6ddab61a-650b-47cd-849c-94b0386f7624");
assert(ambiguous.decomposition?.mode==="SINGLE","AMBIGUOUS expected SINGLE");
assert(ambiguous.units?.length===1&&ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS resolver did not stop");
assert(ambiguous.work_links_created_count===0,"AMBIGUOUS created a work link");
results.push({case:"TWO_PLAUSIBLE_WORKS",decisions:decisions(ambiguous),links:ambiguous.work_links_created_count});

// 5. REAL ESTATE mixed: requested plan for existing valuation + new distinct property valuation.
const mixed=await invoke("76c06164-2cdd-4763-98d3-e84c76d428a2","b7ae1efc-49ee-490a-842d-702cbd7b4834");
const md=decisions(mixed);
assert(mixed.decomposition?.mode==="MULTI_INDEPENDENT","MIXED expected MULTI_INDEPENDENT");
assert(md.filter(x=>x==="MATCH").length===1,"MIXED expected one MATCH");
assert(md.filter(x=>x==="NEW").length===1,"MIXED expected one NEW");
const eligible=(mixed.units||[]).filter(x=>x.write_eligible===true);
assert(eligible.length===1,"MIXED expected exactly one write-eligible unit");
assert(eligible[0].resolver?.work_item_id==="0d97b103-b90b-4285-844e-c064e4abb127","MIXED MATCH wrong work item");
assert(mixed.work_links_created_count===1,"MIXED expected exactly one work link");
results.push({case:"MIXED_MATCH_NEW",decisions:md,links:mixed.work_links_created_count});

// Physical DB verification: 4 inbound events = 4 immutable routing decisions.
// Work links created by writer: legal + mixed only = 2.
const decisionRows=await db("event_routing_decisions",{
 select:"id,event_id,pipeline_version",
 business_id:"in.(b5a21511-cb99-40bc-a742-1c395f7a69d2,be2e89d7-bb7f-4ed1-8c3a-6cef724ea078,7ceb9e12-d746-45df-afb2-0f549274554d,76c06164-2cdd-4763-98d3-e84c76d428a2)"
});
assert(decisionRows.length===4,`DB expected 4 routing decisions, got ${decisionRows.length}`);
const writerLinks=await db("work_event_links",{
 select:"id,event_id,work_item_id,metadata",
 business_id:"in.(b5a21511-cb99-40bc-a742-1c395f7a69d2,be2e89d7-bb7f-4ed1-8c3a-6cef724ea078,7ceb9e12-d746-45df-afb2-0f549274554d,76c06164-2cdd-4763-98d3-e84c76d428a2)",
 "metadata->>writer_version":"eq.routing_commit_v1"
});
assert(writerLinks.length===2,`DB expected 2 writer links, got ${writerLinks.length}`);

console.log("VF_MATCH_WRITE_V2_E2E_PASS",JSON.stringify({results,decision_rows:decisionRows.length,writer_links:writerLinks.length}));
