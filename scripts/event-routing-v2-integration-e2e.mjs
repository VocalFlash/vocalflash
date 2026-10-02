import processor from "../api/event-routing-processor-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
if(!apiKey||!process.env.VF_ASSISTANT_SUPABASE_URL||!process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||!process.env.OPENAI_API_KEY){
  throw new Error("E2E_ENV_MISSING");
}
function capture(){
  const c={statusCode:200,body:null};
  const res={setHeader(){return res;},status(x){c.statusCode=x;return res;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
  return {res,c};
}
async function invoke(eventId){
  const {res,c}=capture();
  await processor({
    method:"POST",
    headers:{"x-api-key":apiKey},
    body:{business_id:"a5111111-1111-4111-8111-111111111111",event_id:eventId}
  },res);
  if(c.statusCode!==200)throw new Error("HTTP_"+c.statusCode+"_"+JSON.stringify(c.body));
  return c.body;
}
function assert(ok,msg){if(!ok)throw new Error(msg);}

const match=await invoke("b6111111-1111-4111-8111-111111111111");
assert(match.replayed===false,"MATCH_REPLAYED_FIRST");
assert(match.routing_decision_created===true,"MATCH_DECISION_NOT_CREATED");
assert(match.units?.length===1,"MATCH_UNIT_COUNT");
assert(match.units[0].resolver?.decision==="MATCH","MATCH_NOT_MATCH");
assert(match.units[0].resolver?.work_item_id==="d5111111-1111-4111-8111-111111111111","MATCH_WRONG_WORK");
assert(match.units[0].write_eligible===true,"MATCH_NOT_ELIGIBLE");
assert(match.work_links_created_count===1,"MATCH_LINK_COUNT");

const retry=await invoke("b6111111-1111-4111-8111-111111111111");
assert(retry.replayed===true,"MATCH_RETRY_NOT_REPLAY");
assert(retry.routing_decision_created===false,"MATCH_RETRY_CREATED_DECISION");
assert(retry.work_links_created_count===0,"MATCH_RETRY_CREATED_LINK");

const narrative=await invoke("b6222222-2222-4222-8222-222222222222");
assert(narrative.replayed===false,"NARRATIVE_REPLAYED");
assert(narrative.routing_decision_created===true,"NARRATIVE_DECISION_NOT_CREATED");
assert(narrative.units?.length===1,"NARRATIVE_UNIT_COUNT");
assert(narrative.units[0].resolver?.decision==="NEW","NARRATIVE_RESOLVER_NOT_NEW");
assert(narrative.units[0].intake_gate?.decision==="NO_NEW_WORK","NARRATIVE_GATE_NOT_NO_NEW_WORK");
assert(narrative.units[0].next_action==="NO_NEW_WORK","NARRATIVE_NEXT_ACTION_WRONG");
assert(narrative.work_links_created_count===0,"NARRATIVE_FALSE_LINK");
assert(narrative.new_work_items_created_count===0,"NARRATIVE_CREATED_WORK");

const ambiguous=await invoke("b6333333-3333-4333-8333-333333333333");
assert(ambiguous.replayed===false,"AMBIGUOUS_REPLAYED");
assert(ambiguous.routing_decision_created===true,"AMBIGUOUS_DECISION_NOT_CREATED");
assert(ambiguous.units?.length===1,"AMBIGUOUS_UNIT_COUNT");
assert(ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS_NOT_AMBIGUOUS");
assert(ambiguous.units[0].resolver?.needs_clarification===true,"AMBIGUOUS_NO_CLARIFICATION");
assert(ambiguous.units[0].next_action==="CLARIFY_EXISTING_WORK","AMBIGUOUS_NEXT_ACTION_WRONG");
assert(ambiguous.work_links_created_count===0,"AMBIGUOUS_FALSE_LINK");
assert(ambiguous.new_work_items_created_count===0,"AMBIGUOUS_CREATED_WORK");

console.log("EVENT_ROUTING_V2_INTEGRATION_PASS",JSON.stringify({
  match:{decision:match.units[0].resolver.decision,links:match.work_links_created_count},
  retry:{replayed:retry.replayed,links:retry.work_links_created_count},
  narrative:{resolver:narrative.units[0].resolver.decision,gate:narrative.units[0].intake_gate.decision,links:narrative.work_links_created_count},
  ambiguous:{decision:ambiguous.units[0].resolver.decision,links:ambiguous.work_links_created_count}
}));
