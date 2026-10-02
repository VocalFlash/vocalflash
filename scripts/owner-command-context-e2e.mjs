import handler from "../lib/owner-command-context-handler-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
if(!apiKey||!process.env.VF_ASSISTANT_SUPABASE_URL||!process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY){
  throw new Error("E2E_ENV_MISSING");
}
function capture(){
  const c={statusCode:200,body:null};
  const res={setHeader(){return res;},status(x){c.statusCode=x;return res;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
  return {res,c};
}
async function invoke(body){
  const {res,c}=capture();
  await handler({method:"POST",headers:{"x-api-key":apiKey},body},res);
  return c;
}
const B="91111111-1111-4111-8111-111111111111";
const OWNER="92222222-2222-4222-8222-222222222222";
const OWNER_EMPTY="93333333-3333-4333-8333-333333333333";
const A="94444444-4444-4444-8444-444444444444";
const C="95555555-5555-4555-8555-555555555555";

let r=await invoke({business_id:B,member_id:OWNER,origin_verified:true});
if(r.statusCode!==200)throw new Error("AUTHORIZED_CONTEXT_HTTP");
if(r.body?.context?.member?.workItemIds?.length!==2)throw new Error("AUTHORIZED_SCOPE_COUNT");
if(!r.body.context.member.workItemIds.includes(A)||!r.body.context.member.workItemIds.includes(C))throw new Error("AUTHORIZED_IDS_WRONG");
if(JSON.stringify(r.body).includes("RISERVATA NON AUTORIZZATA"))throw new Error("PRIVATE_ITEM_EXPOSED");
if(JSON.stringify(r.body).includes("98888888-8888-4888-8888-888888888888"))throw new Error("PRIVATE_ID_EXPOSED");
if(JSON.stringify(r.body.context.policiesByWorkItem[A]?.add_note)!==JSON.stringify(["confirm"]))throw new Error("POLICY_A_WRONG");
if(JSON.stringify(r.body.context.policiesByWorkItem[C]?.add_note)!==JSON.stringify(["confirm","forbidden"]))throw new Error("POLICY_B_WRONG");
if(r.body?.writes_performed!==false||r.body?.safety?.ai_called!==false)throw new Error("DRY_RUN_SAFETY_WRONG");

r=await invoke({business_id:B,member_id:OWNER,origin_verified:false});
if(r.statusCode!==403||r.body?.reason!=="IDENTITY_NOT_VERIFIED")throw new Error("UNVERIFIED_IDENTITY_ALLOWED");

r=await invoke({business_id:B,member_id:OWNER_EMPTY,origin_verified:true});
if(r.statusCode!==422||r.body?.status!=="CONFIG_REQUIRED")throw new Error("OWNER_ROLE_GRANTED_IMPLICITLY");

console.log("OWNER_COMMAND_CONTEXT_DB_E2E_PASS 3/3");
