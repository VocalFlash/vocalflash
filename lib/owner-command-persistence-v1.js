const cleanBase=v=>String(v||"").trim().replace(/\/+$/,"");

async function rpc(baseUrl,secret,name,args){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("OWNER_COMMAND_DB_CONFIG_MISSING");
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{
      apikey:secret,
      "Content-Type":"application/json",
      Accept:"application/json"
    },
    body:JSON.stringify(args)
  });
  const text=await r.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!r.ok)throw new Error(`OWNER_COMMAND_RPC_${name}_HTTP_${r.status}`);
  return body;
}

export function createOwnerCommandPersistence({baseUrl,secret}){
  return {
    resolveMember(input){
      return rpc(baseUrl,secret,"vf_resolve_owner_member_by_sender_v1",{
        p_sender_wa_id:input.senderWaId,
        p_business_id:input.businessId||null
      });
    },

    recordReceived(input){
      return rpc(baseUrl,secret,"vf_record_owner_command_received_v1",{
        p_business_id:input.businessId,
        p_member_id:input.memberId,
        p_channel_id:input.channelId,
        p_external_message_id:input.externalMessageId,
        p_normalized_text:input.normalizedText||null,
        p_occurred_at:input.occurredAt,
        p_payload:input.payload||{}
      });
    },

    recordConfirmation(input){
      return rpc(baseUrl,secret,"vf_record_owner_command_confirmation_v1",{
        p_business_id:input.businessId,
        p_member_id:input.memberId,
        p_channel_id:input.channelId,
        p_external_message_id:input.externalMessageId,
        p_proposal_event_id:input.proposalEventId,
        p_normalized_text:input.normalizedText||null,
        p_occurred_at:input.occurredAt,
        p_payload:input.payload||{}
      });
    },

    recordProposal(input){
      return rpc(baseUrl,secret,"vf_record_owner_command_proposal_v1",{
        p_business_id:input.businessId,
        p_work_item_id:input.workItemId,
        p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,
        p_payload:input.payload||{}
      });
    },

    commitNote(input){
      return rpc(baseUrl,secret,"vf_commit_owner_note_v1",{
        p_business_id:input.businessId,
        p_work_item_id:input.workItemId,
        p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,
        p_note:input.note,
        p_confirmed:input.confirmed===true,
        p_proposal_event_id:input.proposalEventId||null
      });
    },

    commitScheduleAction(input){
      return rpc(baseUrl,secret,"vf_commit_owner_schedule_action_v1",{
        p_business_id:input.businessId,
        p_work_item_id:input.workItemId,
        p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,
        p_title:input.title,
        p_due_at:input.dueAt,
        p_confirmed:input.confirmed===true,
        p_proposal_event_id:input.proposalEventId||null
      });
    }
  };
}
