import assert from "node:assert/strict";
import {dispatchAssistantWhatsappMessage} from "../lib/assistant-whatsapp-dispatch-v1.js";

const input={externalAccountId:"wa-account",senderWaId:"39333",externalMessageId:"wamid.1",normalizedText:"test"};

let customerCalls=0,ownerCalls=0;
const customer=async()=>{customerCalls++;return {ok:true,kind:"customer"};};
const owner=async x=>{ownerCalls++;return {ok:true,kind:"owner",input:x};};

const ownerResult=await dispatchAssistantWhatsappMessage(input,{
  originResolver:{resolve:async()=>({ok:true,origin:"owner",businessId:"b1",channelId:"c1",memberId:"m1",identityVerified:true})},
  processCustomer:customer,processOwner:owner
});
assert.equal(ownerResult.ok,true);
assert.equal(ownerCalls,1);
assert.equal(customerCalls,0);
assert.equal(ownerResult.owner.input.memberId,"m1");
assert.equal(ownerResult.owner.input.originVerified,true);

const customerResult=await dispatchAssistantWhatsappMessage(input,{
  originResolver:{resolve:async()=>({ok:true,origin:"customer",businessId:"b1",channelId:"c1",memberId:null,identityVerified:false})},
  processCustomer:customer,processOwner:owner
});
assert.equal(customerResult.ok,true);
assert.equal(customerCalls,1);
assert.equal(ownerCalls,1);

const denied=await dispatchAssistantWhatsappMessage(input,{
  originResolver:{resolve:async()=>({ok:false,status:"CONFIG_REQUIRED",origin:"unknown",reason:"OWNER_IDENTITY_RESOLUTION_FAILED"})},
  processCustomer:customer,processOwner:owner
});
assert.equal(denied.ok,false);
assert.equal(denied.stage,"origin");
assert.equal(customerCalls,1);
assert.equal(ownerCalls,1);

console.log("ASSISTANT_WHATSAPP_DISPATCH_V1_PASS 12/12");
