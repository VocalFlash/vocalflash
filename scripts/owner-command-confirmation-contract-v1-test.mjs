import assert from "node:assert/strict";
import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";

const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async (url,options)=>{
  calls.push({url:String(url),body:JSON.parse(options.body)});
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,status:"TEST"})};
};

try{
  const p=createOwnerCommandPersistence({baseUrl:"https://example.supabase.co",secret:"sb_secret_test_only"});
  const proposal="11111111-1111-4111-8111-111111111111";
  const source="22222222-2222-4222-8222-222222222222";

  await p.recordConfirmation({
    businessId:"33333333-3333-4333-8333-333333333333",
    memberId:"44444444-4444-4444-8444-444444444444",
    channelId:"55555555-5555-4555-8555-555555555555",
    externalMessageId:"wamid.confirm",
    proposalEventId:proposal,
    normalizedText:"confermo",
    occurredAt:"2026-10-04T21:00:00+02:00"
  });
  assert.ok(calls[0].url.endsWith("/vf_record_owner_command_confirmation_v1"));
  assert.equal(calls[0].body.p_proposal_event_id,proposal);

  await p.commitNote({
    businessId:"33333333-3333-4333-8333-333333333333",
    memberId:"44444444-4444-4444-8444-444444444444",
    workItemId:"66666666-6666-4666-8666-666666666666",
    sourceEventId:source,note:"25 persone",confirmed:true,proposalEventId:proposal
  });
  assert.ok(calls[1].url.endsWith("/vf_commit_owner_note_v1"));
  assert.equal(calls[1].body.p_confirmed,true);
  assert.equal(calls[1].body.p_proposal_event_id,proposal);

  await p.commitScheduleAction({
    businessId:"33333333-3333-4333-8333-333333333333",
    memberId:"44444444-4444-4444-8444-444444444444",
    workItemId:"66666666-6666-4666-8666-666666666666",
    sourceEventId:source,title:"Chiamare Rossi",dueAt:"2026-10-05T10:00:00+02:00",
    confirmed:true,proposalEventId:proposal
  });
  assert.ok(calls[2].url.endsWith("/vf_commit_owner_schedule_action_v1"));
  assert.equal(calls[2].body.p_confirmed,true);
  assert.equal(calls[2].body.p_proposal_event_id,proposal);

  console.log("OWNER_COMMAND_CONFIRMATION_CONTRACT_V1_PASS 8/8");
}finally{
  globalThis.fetch=originalFetch;
}
