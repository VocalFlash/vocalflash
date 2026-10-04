import assert from "node:assert/strict";
import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";

const originalFetch=globalThis.fetch;
const queue=[];
globalThis.fetch=async()=> {
  const body=queue.shift();
  return {ok:true,status:200,text:async()=>JSON.stringify(body)};
};
const p=createOwnerCommandPersistence({baseUrl:"https://example.supabase.co",secret:"sb_secret_test"});
try{
  queue.push({ok:true,status:"RECEIVED_EXISTS",event_id:"e1"});
  queue.push([{id:"e1",business_id:"b",business_member_id:"m",business_channel_id:"c",event_type:"customer_message",external_message_id:"x",normalized_text:"nota"}]);
  const received=await p.recordReceived({businessId:"b",memberId:"m",channelId:"c",externalMessageId:"x",normalizedText:"nota"});
  assert.equal(received.status,"REPLAY_CONFLICT");

  queue.push({ok:true,status:"PROPOSAL_EXISTS",proposal_event_id:"p1"});
  queue.push([{id:"p1",business_id:"b",work_item_id:"w2",business_member_id:"m",event_type:"owner_command_proposal",
    payload:{owner_command_source_event_id:"s",intent:"add_note",note:"diversa"}}]);
  const proposal=await p.recordProposal({businessId:"b",memberId:"m",workItemId:"w1",sourceEventId:"s",payload:{intent:"add_note",note:"nota"}});
  assert.equal(proposal.status,"REPLAY_CONFLICT");

  queue.push({ok:true,status:"NOTE_EXISTS",note_event_id:"n1"});
  queue.push([{id:"n1",business_id:"b",work_item_id:"w1",business_member_id:"m",event_type:"owner_command_note_added",
    normalized_text:"nota diversa",payload:{owner_command_source_event_id:"s"}}]);
  const note=await p.commitNote({businessId:"b",memberId:"m",workItemId:"w1",sourceEventId:"s",note:"nota"});
  assert.equal(note.status,"REPLAY_CONFLICT");

  queue.push({ok:true,status:"ACTION_EXISTS",action_id:"a1"});
  queue.push([{id:"a1",business_id:"b",work_item_id:"w1",assigned_member_id:"m",title:"Chiamare Rossi",
    due_at:"2026-10-05T11:00:00+02:00",metadata:{owner_command_source_event_id:"s"}}]);
  const action=await p.commitScheduleAction({businessId:"b",memberId:"m",workItemId:"w1",sourceEventId:"s",
    title:"Chiamare Rossi",dueAt:"2026-10-05T10:00:00+02:00"});
  assert.equal(action.status,"REPLAY_CONFLICT");

  queue.push({ok:true,status:"CONFIRMATION_EXISTS",confirmation_event_id:"c1"});
  queue.push([{id:"c1",business_id:"b",business_member_id:"m",business_channel_id:"c",event_type:"owner_command_confirmation",
    external_message_id:"confirm-1",payload:{proposal_event_id:"other"}}]);
  const confirmation=await p.recordConfirmation({businessId:"b",memberId:"m",channelId:"c",externalMessageId:"confirm-1",proposalEventId:"p1"});
  assert.equal(confirmation.status,"REPLAY_CONFLICT");

  assert.equal(queue.length,0);
  console.log("OWNER_COMMAND_REPLAY_CONFLICT_V1_PASS 6/6");
}finally{globalThis.fetch=originalFetch;}
