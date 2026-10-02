import processor from "../lib/event-routing-processor-v2.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
if(!apiKey||!process.env.VF_ASSISTANT_SUPABASE_URL||!process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY){
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
for(const id of [
  "b6111111-1111-4111-8111-111111111111",
  "b6222222-2222-4222-8222-222222222222",
  "b6333333-3333-4333-8333-333333333333"
]){
  const r=await invoke(id);
  if(r.replayed!==true)throw new Error("NOT_REPLAY_"+id);
  if(r.routing_decision_created!==false)throw new Error("REPLAY_CREATED_DECISION_"+id);
  if(r.work_links_created_count!==0)throw new Error("REPLAY_CREATED_LINK_"+id);
  if(!r.routing_decision_id)throw new Error("REPLAY_MISSING_DECISION_"+id);
}
console.log("EVENT_ROUTING_V2_REPLAY_PASS 3/3");
