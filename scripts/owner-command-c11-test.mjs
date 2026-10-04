import assert from "node:assert/strict";
import {planOwnerCommand,executeOwnerCommandPlan} from "../lib/owner-command-orchestrator-v1.js";

const context={
  businessId:"business-A",originVerified:true,
  receivedAt:"2026-10-02T11:00:00+02:00",now:"2026-10-02T11:05:00+02:00",
  member:{id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,
    permissions:["consult","add_note","schedule_action"],workItemIds:["rossi","bianchi-a","bianchi-b"]},
  workItems:[
    {id:"rossi",businessId:"business-A",label:"Prenotazione Rossi",writable:true},
    {id:"bianchi-a",businessId:"business-A",label:"Bianchi - evento aziendale",writable:true},
    {id:"bianchi-b",businessId:"business-A",label:"Bianchi - cena privata",writable:true}
  ],
  policiesByWorkItem:{
    "rossi":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]},
    "bianchi-a":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]},
    "bianchi-b":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}
  }
};

const command={units:[
  {intent:"add_note",candidateIds:["rossi"],note:"25 persone"},
  {intent:"schedule_action",candidateIds:["bianchi-a","bianchi-b"],title:"Chiamare Bianchi",dueAt:"2026-10-03T10:00:00+02:00"}
]};

const plan=planOwnerCommand(command,context);
assert.equal(plan.status,"NOT_READY");
assert.equal(plan.writes_performed,false);
assert.equal(plan.policy.units[1].reason,"AMBIGUOUS_TARGET");

let calls=0;
const persistence={
  commitNote(){calls++;throw new Error("PARTIAL_NOTE_WRITE");},
  commitScheduleAction(){calls++;throw new Error("PARTIAL_ACTION_WRITE");}
};
const executed=await executeOwnerCommandPlan(plan,{persistence,sourceEventId:"source",businessId:"business-A",memberId:"member-A"});
assert.equal(calls,0);
assert.equal(executed.writes_performed,false);
console.log("OWNER_COMMAND_C11_NO_PARTIAL_WRITE_PASS 5/5");
