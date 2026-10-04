import assert from "node:assert/strict";
import {buildAuthorizationContext,parseMemberPermissions,resolvePoliciesByWorkItem} from "../lib/owner-command-authz-v1.js";

const B="11111111-1111-4111-8111-111111111111";
const M="22222222-2222-4222-8222-222222222222";
const A="33333333-3333-4333-8333-333333333333";
const C="44444444-4444-4444-8444-444444444444";
const W1="55555555-5555-4555-8555-555555555555";
const W2="66666666-6666-4666-8666-666666666666";

const member={id:M,business_id:B,is_active:true,permissions:{version:1,grants:["consult","add_note","schedule_action"],work_items:{mode:"explicit",ids:[A,C]}}};
const items=[
 {id:A,business_id:B,workflow_id:W1,title:"Pratica A",lifecycle_status:"open"},
 {id:C,business_id:B,workflow_id:W2,title:"Pratica C",lifecycle_status:"open"},
 {id:"77777777-7777-4777-8777-777777777777",business_id:B,workflow_id:W1,title:"Non autorizzata",lifecycle_status:"open"},
 {id:"88888888-8888-4888-8888-888888888888",business_id:B,workflow_id:W1,title:"Chiusa",lifecycle_status:"closed"}
];
const policies=[
 {business_id:B,scope:"business",workflow_id:null,policy_key:"consult",autonomy_mode:"auto",is_active:true},
 {business_id:B,scope:"business",workflow_id:null,policy_key:"add_note",autonomy_mode:"confirm",is_active:true},
 {business_id:B,scope:"business",workflow_id:null,policy_key:"schedule_action",autonomy_mode:"confirm",is_active:true},
 {business_id:B,scope:"workflow",workflow_id:W2,policy_key:"add_note",autonomy_mode:"forbidden",is_active:true}
];

let r=buildAuthorizationContext({businessId:B,originVerified:true,member,workItems:items,policyRows:policies});
assert.equal(r.status,"READY");
assert.deepEqual(r.context.member.workItemIds,[A,C]);
assert.equal(r.context.workItems.length,2);
assert.deepEqual(r.context.policiesByWorkItem[A].add_note,["confirm"]);
assert.deepEqual(r.context.policiesByWorkItem[C].add_note,["confirm","forbidden"]);
assert.equal(JSON.stringify(r).includes("Non autorizzata"),false);

r=buildAuthorizationContext({businessId:B,originVerified:false,member,workItems:items,policyRows:policies});
assert.equal(r.reason,"IDENTITY_NOT_VERIFIED");

r=buildAuthorizationContext({businessId:B,originVerified:true,member:{...member,is_active:false},workItems:items,policyRows:policies});
assert.equal(r.reason,"MEMBER_NOT_ACTIVE_IN_BUSINESS");

r=buildAuthorizationContext({businessId:B,originVerified:true,member:{...member,permissions:{}},workItems:items,policyRows:policies});
assert.equal(r.status,"CONFIG_REQUIRED");

r=buildAuthorizationContext({businessId:B,originVerified:true,member:{...member,role_key:"owner",permissions:{}},workItems:items,policyRows:policies});
assert.equal(r.status,"CONFIG_REQUIRED");

r=buildAuthorizationContext({businessId:B,originVerified:true,member:{...member,permissions:{version:1,grants:["consult"],work_items:{mode:"business",ids:[A]}}},workItems:items,policyRows:policies});
assert.equal(r.status,"CONFIG_REQUIRED");

const p=parseMemberPermissions({version:1,grants:["consult","consult"],work_items:{mode:"explicit",ids:[A]}});
assert.equal(p.ok,false);

const dup=resolvePoliciesByWorkItem(
 [{id:A,businessId:B,workflowId:W1}],
 [...policies,{business_id:B,scope:"business",workflow_id:null,policy_key:"consult",autonomy_mode:"confirm",is_active:true}]
);
assert.equal(dup.ok,false);
assert.equal(dup.reason,"DUPLICATE_POLICY");

const noPolicy=buildAuthorizationContext({
 businessId:B,originVerified:true,member,workItems:items,policyRows:policies.filter(x=>x.policy_key!=="schedule_action")
});
assert.equal(noPolicy.status,"READY");
assert.equal(noPolicy.context.policiesByWorkItem[A].schedule_action,null);

console.log("OWNER_COMMAND_AUTHZ_V1_PASS 9/9");
