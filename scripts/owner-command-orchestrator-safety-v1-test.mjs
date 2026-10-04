import assert from "node:assert/strict";
import {planOwnerCommand,executeOwnerCommandPlan} from "../lib/owner-command-orchestrator-v1.js";

const base={
  businessId:"business-A",originVerified:true,
  receivedAt:"2026-10-04T20:00:00+02:00",now:"2026-10-04T20:01:00+02:00",
  member:{id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,
    permissions:["consult","add_note","schedule_action"],workItemIds:["rossi"]},
  workItems:[{id:"rossi",businessId:"business-A",label:"Rossi",writable:true}],
  policiesByWorkItem:{rossi:{consult:["auto"],add_note:["confirm"],schedule_action:["auto"]}}
};

const confirm=planOwnerCommand({units:[{
  intent:"add_note",candidateIds:["rossi"],note:"25 persone",title:null,dueAt:null,assigneeId:null
}]},base);
assert.equal(confirm.status,"CONFIRMATION_REQUIRED");
assert.equal(confirm.writes_performed,false);
assert.equal(confirm.proposal.intent,"add_note");
assert.equal(confirm.proposal.note,"25 persone");

const mixed={...base,policiesByWorkItem:{rossi:{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}}};
const mixedPlan=planOwnerCommand({units:[
  {intent:"consult",candidateIds:["rossi"],note:null,title:null,dueAt:null,assigneeId:null},
  {intent:"add_note",candidateIds:["rossi"],note:"25 persone",title:null,dueAt:null,assigneeId:null}
]},mixed);
assert.equal(mixedPlan.status,"NOT_READY");
assert.equal(mixedPlan.reason,"MULTI_UNIT_ATOMICITY_REQUIRED");
assert.equal(mixedPlan.writes_performed,false);

let calls=0;
const replayPlan=planOwnerCommand({units:[{
  intent:"add_note",candidateIds:["rossi"],note:"25 persone",title:null,dueAt:null,assigneeId:null
}]},mixed);
const replay=await executeOwnerCommandPlan(replayPlan,{
  persistence:{commitNote:async()=>{calls++;return {ok:true,status:"NOTE_EXISTS",replayed:true};}},
  sourceEventId:"source-1",businessId:"business-A",memberId:"member-A"
});
assert.equal(calls,1);
assert.equal(replay.writes_performed,false);
assert.equal(replay.effect_applied,true);
assert.equal(replay.replayed,true);

console.log("OWNER_COMMAND_ORCHESTRATOR_SAFETY_V1_PASS 12/12");
