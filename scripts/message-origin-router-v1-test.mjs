import assert from "node:assert/strict";
import {decideWhatsappMessageOrigin} from "../lib/message-origin-router-v1.js";

const B="11111111-1111-4111-8111-111111111111";
const C="22222222-2222-4222-8222-222222222222";
const M="33333333-3333-4333-8333-333333333333";
const ctx={active:true,businessId:B,channelId:C};

let r=decideWhatsappMessageOrigin({businessContext:ctx,memberResolution:{ok:true,status:"RESOLVED",business_id:B,member_id:M}});
assert.equal(r.origin,"owner");
assert.equal(r.identityVerified,true);

r=decideWhatsappMessageOrigin({businessContext:ctx,memberResolution:{ok:false,status:"NOT_VERIFIED",reason:"NO_ACTIVE_VERIFIED_MEMBER_MATCH"}});
assert.equal(r.origin,"customer");

r=decideWhatsappMessageOrigin({businessContext:null,memberResolution:{ok:false,status:"NOT_VERIFIED"}});
assert.equal(r.status,"DENIED");
assert.equal(r.reason,"CHANNEL_NOT_ACTIVE");

r=decideWhatsappMessageOrigin({businessContext:ctx,memberResolution:{ok:true,status:"RESOLVED",business_id:"44444444-4444-4444-8444-444444444444",member_id:M}});
assert.equal(r.status,"CONFIG_REQUIRED");
assert.equal(r.reason,"OWNER_BUSINESS_CONTEXT_MISMATCH");

r=decideWhatsappMessageOrigin({businessContext:ctx,memberResolution:{ok:false,status:"CONFIG_REQUIRED",reason:"MULTIPLE_MEMBER_MATCHES_IN_BUSINESS"}});
assert.equal(r.origin,"unknown");
assert.equal(r.status,"CONFIG_REQUIRED");

r=decideWhatsappMessageOrigin({businessContext:ctx,memberResolution:{ok:false,status:"INVALID",reason:"SENDER_WA_ID_INVALID"}});
assert.equal(r.origin,"unknown");
assert.equal(r.status,"CONFIG_REQUIRED");

console.log("MESSAGE_ORIGIN_ROUTER_V1_PASS 6/6");
