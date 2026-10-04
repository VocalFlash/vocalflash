import assert from "node:assert/strict";
import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";
const originalFetch=globalThis.fetch,queue=[];
globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(queue.shift())});
const p=createOwnerCommandPersistence({baseUrl:"https://example.supabase.co",secret:"sb_secret_test"});
try{
  queue.push({ok:true,status:"RECEIVED_EXISTS",event_id:"e1",replayed:true});
  queue.push([{id:"e1",business_id:"b",business_member_id:"m",business_channel_id:"c",event_type:"owner_command_received",external_message_id:"x",normalized_text:"nota"}]);
  assert.equal((await p.recordReceived({businessId:"b",memberId:"m",channelId:"c",externalMessageId:"x",normalizedText:"nota"})).replay_verified,true);

  queue.push({ok:true,status:"PROPOSAL_EXISTS",proposal_event_id:"p1",replayed:true});
  queue.push([{id:"p1",business_id:"b",work_item_id:"w",business_member_id:"m",event_type:"owner_command_proposal",
    payload:{owner_command_source_event_id:"s",intent:"add_note",note:"nota"}}]);
  assert.equal((await p.recordProposal({businessId:"b",memberId:"m",workItemId:"w",sourceEventId:"s",payload:{intent:"add_note",note:"nota"}})).replay_verified,true);

  queue.push({ok:true,status:"NOTE_EXISTS",note_event_id:"n1",replayed:true});
  queue.push([{id:"n1",business_id:"b",work_item_id:"w",business_member_id:"m",event_type:"owner_command_note_added",normalized_text:"nota",
    payload:{owner_command_source_event_id:"s"}}]);
  assert.equal((await p.commitNote({businessId:"b",memberId:"m",workItemId:"w",sourceEventId:"s",note:"nota"})).replay_verified,true);

  queue.push({ok:true,status:"ACTION_EXISTS",action_id:"a1",replayed:true});
  queue.push([{id:"a1",business_id:"b",work_item_id:"w",assigned_member_id:"m",title:"Chiamare Rossi",
    due_at:"2026-10-05T10:00:00+02:00",metadata:{owner_command_source_event_id:"s"}}]);
  assert.equal((await p.commitScheduleAction({businessId:"b",memberId:"m",workItemId:"w",sourceEventId:"s",
    title:"Chiamare Rossi",dueAt:"2026-10-05T10:00:00+02:00"})).replay_verified,true);

  queue.push({ok:true,status:"CONFIRMATION_EXISTS",confirmation_event_id:"c1",replayed:true});
  queue.push([{id:"c1",business_id:"b",business_member_id:"m",business_channel_id:"c",event_type:"owner_command_confirmation",
    external_message_id:"confirm-1",payload:{proposal_event_id:"p1"}}]);
  assert.equal((await p.recordConfirmation({businessId:"b",memberId:"m",channelId:"c",externalMessageId:"confirm-1",proposalEventId:"p1"})).replay_verified,true);

  console.log("OWNER_COMMAND_REPLAY_VERIFIED_V1_PASS 5/5");
}finally{globalThis.fetch=originalFetch;}
