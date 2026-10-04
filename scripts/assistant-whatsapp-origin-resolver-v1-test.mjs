import assert from "node:assert/strict";
import {createWhatsappOriginResolver} from "../lib/assistant-whatsapp-dispatch-v1.js";

const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async (url,options)=>{
  calls.push({url:String(url),headers:options?.headers||{},body:options?.body?JSON.parse(options.body):null});
  if(String(url).includes("/rest/v1/business_channels")){
    return {ok:true,status:200,text:async()=>JSON.stringify([{id:"channel-1",business_id:"business-1",is_active:true}])};
  }
  if(String(url).includes("/rest/v1/rpc/vf_resolve_owner_member_by_sender_v1")){
    return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,status:"RESOLVED",member_id:"member-1",business_id:"business-1"})};
  }
  throw new Error("UNEXPECTED_FETCH");
};
try{
  const resolver=createWhatsappOriginResolver({baseUrl:"https://example.supabase.co",secret:"sb_secret_test"});
  const r=await resolver.resolve({externalAccountId:"account-1",senderWaId:"393331234567"});
  assert.equal(r.ok,true);
  assert.equal(r.origin,"owner");
  assert.equal(r.businessId,"business-1");
  assert.equal(r.channelId,"channel-1");
  assert.equal(r.memberId,"member-1");
  assert.equal(calls.length,2);
  assert.equal(calls[0].headers.apikey,"sb_secret_test");
  assert.equal("Authorization" in calls[0].headers,false);
  assert.equal(calls[1].body.p_business_id,"business-1");
  console.log("ASSISTANT_WHATSAPP_ORIGIN_RESOLVER_V1_PASS 9/9");
}finally{globalThis.fetch=originalFetch;}
