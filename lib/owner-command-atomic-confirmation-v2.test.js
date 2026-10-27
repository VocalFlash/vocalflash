import test from "node:test";
import assert from "node:assert/strict";
import {processOwnerCommandMessage} from "./owner-command-runtime-v1.js";

const baseInput={
  originVerified:true,
  businessId:"business-1",
  memberId:"member-1",
  channelId:"channel-1",
  externalMessageId:"wamid.confirm-1",
  normalizedText:"sì confermo",
  occurredAt:"2026-10-27T08:00:00.000Z"
};

test("explicit confirmation resolves one proposal, records the bound event, then atomically commits",async()=>{
  const calls=[];
  const persistence={
    async resolvePendingProposal(input){calls.push(["resolve",input]);return {ok:true,status:"PENDING_PROPOSAL",proposal_event_id:"proposal-1"};},
    async recordConfirmation(input){calls.push(["record",input]);return {ok:true,status:"CONFIRMATION_RECORDED",confirmation_event_id:"confirmation-1"};},
    async commitConfirmedProposal(input){calls.push(["commit",input]);return {ok:true,status:"CONFIRMATION_COMMITTED",result:{ok:true,status:"NOTE_ADDED"},writes_performed:true,replayed:false};},
    async recordReceived(){throw new Error("confirmation must not be double-recorded as received");}
  };
  const result=await processOwnerCommandMessage(baseInput,{persistence});
  assert.equal(result.ok,true);
  assert.equal(result.status,"CONFIRMATION_COMMITTED");
  assert.equal(result.effect_applied,true);
  assert.equal(result.writes_performed,true);
  assert.deepEqual(calls.map(c=>c[0]),["resolve","record","commit"]);
  assert.equal(calls[0][1].externalMessageId,baseInput.externalMessageId);
  assert.equal(calls[1][1].proposalEventId,"proposal-1");
  assert.equal(calls[2][1].confirmationEventId,"confirmation-1");
  assert.equal(calls[2][1].proposalEventId,"proposal-1");
});

test("explicit confirmation with no pending proposal performs no confirmation or effect write",async()=>{
  let recordCalls=0,commitCalls=0;
  const persistence={
    async resolvePendingProposal(){return {ok:true,status:"NO_PENDING_PROPOSAL"};},
    async recordConfirmation(){recordCalls++;return {ok:true,status:"CONFIRMATION_RECORDED",confirmation_event_id:"c1"};},
    async commitConfirmedProposal(){commitCalls++;return {ok:true,status:"CONFIRMATION_COMMITTED"};}
  };
  const result=await processOwnerCommandMessage(baseInput,{persistence});
  assert.equal(result.ok,false);
  assert.equal(result.status,"NO_PENDING_PROPOSAL");
  assert.equal(result.writes_performed,false);
  assert.equal(recordCalls,0);
  assert.equal(commitCalls,0);
});

test("ambiguous pending proposals fail closed without recording a confirmation",async()=>{
  let recordCalls=0;
  const persistence={
    async resolvePendingProposal(){return {ok:false,status:"AMBIGUOUS_PENDING_PROPOSAL",reason:"EXPLICIT_PROPOSAL_SELECTION_REQUIRED"};},
    async recordConfirmation(){recordCalls++;return {ok:true,status:"CONFIRMATION_RECORDED",confirmation_event_id:"c1"};},
    async commitConfirmedProposal(){throw new Error("must not commit");}
  };
  const result=await processOwnerCommandMessage(baseInput,{persistence});
  assert.equal(result.ok,false);
  assert.equal(result.status,"AMBIGUOUS_PENDING_PROPOSAL");
  assert.equal(result.writes_performed,false);
  assert.equal(recordCalls,0);
});

test("replayed explicit confirmation uses the exact existing confirmation event",async()=>{
  const calls=[];
  const persistence={
    async resolvePendingProposal(input){calls.push(["resolve",input]);return {ok:true,status:"EXISTING_CONFIRMATION",proposal_event_id:"proposal-1"};},
    async recordConfirmation(input){calls.push(["record",input]);return {ok:true,status:"CONFIRMATION_EXISTS",confirmation_event_id:"confirmation-1",replay_verified:true};},
    async commitConfirmedProposal(input){calls.push(["commit",input]);return {ok:true,status:"CONFIRMATION_COMMITTED",result:{status:"NOTE_ADDED"},writes_performed:false,replayed:true};}
  };
  const result=await processOwnerCommandMessage(baseInput,{persistence});
  assert.equal(result.ok,true);
  assert.equal(result.replayed,true);
  assert.equal(result.writes_performed,false);
  assert.deepEqual(calls.map(c=>c[0]),["resolve","record","commit"]);
});

test("proposal creation requires explicit TTL configuration and fails closed if missing",async()=>{
  let proposalCalls=0;
  const persistence={
    async recordReceived(){return {ok:true,event_id:"source-1"};},
    async recordProposal(){proposalCalls++;return {ok:true,status:"PROPOSAL_RECORDED",proposal_event_id:"proposal-1"};}
  };
  const result=await processOwnerCommandMessage({...baseInput,normalizedText:"aggiungi una nota"},{
    persistence,
    async loadContext(){return {ok:true,context:{}};},
    async interpret(){return {result:{intent:"add_note"}};},
    plan(){return {status:"CONFIRMATION_REQUIRED",proposal:{intent:"add_note",workItemId:"work-1",note:"25 persone"}};}
  });
  assert.equal(result.status,"CONFIG_REQUIRED");
  assert.equal(result.reason,"OWNER_CONFIRMATION_TTL_NOT_CONFIGURED");
  assert.equal(proposalCalls,0);
});

test("proposal persists a server-generated expiry when a positive TTL is configured",async()=>{
  let proposalInput;
  const persistence={
    async recordReceived(){return {ok:true,event_id:"source-1"};},
    async recordProposal(input){proposalInput=input;return {ok:true,status:"PROPOSAL_RECORDED",proposal_event_id:"proposal-1",replayed:false};}
  };
  const result=await processOwnerCommandMessage({...baseInput,normalizedText:"aggiungi una nota"},{
    persistence,confirmationTtlSeconds:600,clock:()=>Date.parse("2026-10-27T08:00:00.000Z"),
    async loadContext(){return {ok:true,context:{}};},
    async interpret(){return {result:{intent:"add_note"}};},
    plan(){return {status:"CONFIRMATION_REQUIRED",proposal:{intent:"add_note",workItemId:"work-1",note:"25 persone"}};}
  });
  assert.equal(result.status,"CONFIRMATION_REQUIRED");
  assert.equal(proposalInput.payload.expires_at,"2026-10-27T08:10:00.000Z");
  assert.equal(proposalInput.payload.owner_command_source_event_id,undefined);
});
