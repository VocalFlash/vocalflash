import writer from "../api/write-path-match-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
if(!apiKey) throw new Error("VOCALFLASH_API_KEYS missing");

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
function assert(ok,msg){if(!ok)throw new Error(msg);}
function decisions(body){return (body.units||[]).map(x=>x.resolver?.decision);}
function eligible(body){return (body.units||[]).filter(x=>x.write_eligible===true);}

const out=[];

// 1) LEGAL: explicit response to a prior request -> MATCH and one real audit link.
const legal1=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal1.decomposition?.mode==="SINGLE","LEGAL expected SINGLE");
assert(legal1.units?.length===1,"LEGAL expected one unit");
assert(legal1.units[0].resolver?.decision==="MATCH","LEGAL expected MATCH");
assert(legal1.units[0].resolver?.work_item_id==="64388afe-6eac-4698-9264-750b75b34975","LEGAL wrong target");
assert(legal1.units[0].write_eligible===true,"LEGAL MATCH below writer safety threshold");
assert(legal1.created_count===1 && legal1.writes_performed===true,"LEGAL expected exactly one created link");
out.push({case:"LEGAL_MATCH",decisions:decisions(legal1),created:legal1.created_count});

// 2) DUPLICATE: same event again -> no duplicate link.
const legal2=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2","e895cf98-7314-4dfc-97b3-6d9b229cf8d3");
assert(legal2.created_count===0 && legal2.writes_performed===false,"DUPLICATE created another link");
assert(Array.isArray(legal2.write_result) && legal2.write_result.some(x=>x.created===false),"DUPLICATE did not report existing active link");
out.push({case:"DUPLICATE_IDEMPOTENT",decisions:decisions(legal2),created:legal2.created_count});

// 3) REAL ESTATE narrative about a third party -> must never auto-write to the user's existing sale.
const narrative=await invoke("be2e89d7-bb7f-4ed1-8c3a-6cef724ea078","48e1501a-80ae-40d6-92b9-661db974e77a");
assert(narrative.created_count===0 && narrative.writes_performed===false,"NARRATIVE false MATCH wrote a link");
assert(eligible(narrative).length===0,"NARRATIVE produced write-eligible MATCH");
out.push({case:"NO_FALSE_MATCH_NARRATIVE",decisions:decisions(narrative),created:narrative.created_count});

// 4) CONSTRUCTION: generic requested photo with two equally plausible jobs -> AMBIGUOUS and no write.
const ambiguous=await invoke("7ceb9e12-d746-45df-afb2-0f549274554d","6ddab61a-650b-47cd-849c-94b0386f7624");
assert(ambiguous.decomposition?.mode==="SINGLE","AMBIGUOUS expected SINGLE");
assert(ambiguous.units?.length===1 && ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS resolver did not stop");
assert(ambiguous.created_count===0 && ambiguous.writes_performed===false,"AMBIGUOUS wrote a link");
out.push({case:"TWO_PLAUSIBLE_WORKS",decisions:decisions(ambiguous),created:ambiguous.created_count});

// 5) REAL ESTATE mixed: requested plan for existing valuation + new distinct property valuation.
const mixed=await invoke("76c06164-2cdd-4763-98d3-e84c76d428a2","b7ae1efc-49ee-490a-842d-702cbd7b4834");
const mixedDecisions=decisions(mixed);
assert(mixed.decomposition?.mode==="MULTI_INDEPENDENT","MIXED expected MULTI_INDEPENDENT");
assert(mixedDecisions.filter(x=>x==="MATCH").length===1,"MIXED expected one MATCH");
assert(mixedDecisions.filter(x=>x==="NEW").length===1,"MIXED expected one NEW");
assert(eligible(mixed).length===1,"MIXED expected exactly one write-eligible unit");
assert(eligible(mixed)[0].resolver?.work_item_id==="0d97b103-b90b-4285-844e-c064e4abb127","MIXED MATCH wrong work item");
assert(mixed.created_count===1 && mixed.writes_performed===true,"MIXED expected exactly one created link");
out.push({case:"MIXED_MATCH_NEW",decisions:mixedDecisions,created:mixed.created_count});

console.log("VF_MATCH_ACTIVE_LINKS_E2E_PASS",JSON.stringify(out));
