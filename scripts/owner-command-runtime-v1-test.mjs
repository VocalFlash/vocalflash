import assert from "node:assert/strict";
import {processOwnerCommandMessage} from "../lib/owner-command-runtime-v1.js";

const baseInput={businessId:"b",memberId:"m",channelId:"c",originVerified:true,externalMessageId:"x",
  normalizedText:"nota",occurredAt:"2026-10-04T20:00:00+02:00",now:"2026-10-04T20:01:00+02:00"};
const context={businessId:"b",originVerified:true,receivedAt:baseInput.occurredAt,now:baseInput.now,
  member:{id:"m",businessId:"b",verified:true,active:true,sharedAccount:false,permissions:["consult","add_note"],workItemIds:["w"]},
  workItems:[{id:"w",businessId:"b",label:"Rossi",writable:true}],
  policiesByWorkItem:{w:{consult:["auto"],add_note:["confirm"]}}};

let proposals=0,writes=0;
const deps={
  persistence:{
    recordReceived:async()=>({ok:true,status:"RECEIVED_RECORDED",event_id:"source",replayed:false}),
    recordProposal:async()=>{proposals++;return {ok:true,status:"PROPOSAL_RECORDED",proposal_event_id:"proposal",replayed:false};},
    commitNote:async()=>{writes++;return {ok:true,status:"NOTE_ADDED"};}
  },
  loadContext:async()=>({ok:true,context}),
  interpret:async()=>({result:{units:[{intent:"add_note",candidateIds:["w"],note:"25 persone",title:null,dueAt:null,assigneeId:null}]}})
};
const confirm=await processOwnerCommandMessage(baseInput,deps);
assert.equal(confirm.ok,true);
assert.equal(confirm.status,"CONFIRMATION_REQUIRED");
assert.equal(confirm.writes_performed,false);
assert.equal(confirm.proposal_event_id,"proposal");
assert.equal(proposals,1);
assert.equal(writes,0);

const replayConflict=await processOwnerCommandMessage(baseInput,{...deps,persistence:{
  ...deps.persistence,recordReceived:async()=>({ok:false,status:"REPLAY_CONFLICT",reason:"RECEIVED_REPLAY_MISMATCH"})
}});
assert.equal(replayConflict.ok,false);
assert.equal(replayConflict.stage,"received");
assert.equal(writes,0);

const readContext={...context,policiesByWorkItem:{w:{consult:["auto"],add_note:["auto"]}}};
const read=await processOwnerCommandMessage({...baseInput,normalizedText:"come siamo messi?"},{
  ...deps,loadContext:async()=>({ok:true,context:readContext}),
  interpret:async()=>({result:{units:[{intent:"consult",candidateIds:["w"],note:null,title:null,dueAt:null,assigneeId:null}]}})
});
assert.equal(read.ok,true);
assert.equal(read.status,"READ_ONLY_READY");
assert.equal(read.reads.length,1);
assert.equal(read.writes_performed,false);

console.log("OWNER_COMMAND_RUNTIME_V1_PASS 13/13");
