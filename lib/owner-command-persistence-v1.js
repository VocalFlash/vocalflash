const cleanBase=v=>String(v||"").trim().replace(/\/+$/,"");

async function parse(r,label){
  const text=await r.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!r.ok)throw new Error(`OWNER_COMMAND_${label}_HTTP_${r.status}`);
  return body;
}

async function rpc(baseUrl,secret,name,args){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("OWNER_COMMAND_DB_CONFIG_MISSING");
  return parse(await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{apikey:secret,"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify(args)
  }),`RPC_${name}`);
}

async function rows(baseUrl,secret,table,params){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("OWNER_COMMAND_DB_CONFIG_MISSING");
  const u=new URL(`${base}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params||{})) if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  const body=await parse(await fetch(u,{headers:{apikey:secret,Accept:"application/json"}}),`GET_${table}`);
  return Array.isArray(body)?body:[];
}

const sameInstant=(a,b)=>Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Date.parse(a)===Date.parse(b);
const conflict=(kind,details={})=>({ok:false,status:"REPLAY_CONFLICT",reason:`${kind}_REPLAY_MISMATCH`,...details});

export function createOwnerCommandPersistence({baseUrl,secret}){
  return {
    resolveMember(input){
      return rpc(baseUrl,secret,"vf_resolve_owner_member_by_sender_v1",{
        p_sender_wa_id:input.senderWaId,
        p_business_id:input.businessId||null
      });
    },

    async recordReceived(input){
      const result=await rpc(baseUrl,secret,"vf_record_owner_command_received_v1",{
        p_business_id:input.businessId,p_member_id:input.memberId,p_channel_id:input.channelId,
        p_external_message_id:input.externalMessageId,p_normalized_text:input.normalizedText||null,
        p_occurred_at:input.occurredAt,p_payload:input.payload||{}
      });
      if(result?.status!=="RECEIVED_EXISTS")return result;
      const found=await rows(baseUrl,secret,"work_events",{
        select:"id,business_id,business_member_id,business_channel_id,event_type,external_message_id,normalized_text",
        id:`eq.${result.event_id}`,limit:1
      });
      const e=found[0];
      if(!e||e.business_id!==input.businessId||e.business_member_id!==input.memberId||
         e.business_channel_id!==input.channelId||e.event_type!=="owner_command_received"||
         e.external_message_id!==input.externalMessageId||
         String(e.normalized_text||"").trim()!==String(input.normalizedText||"").trim()){
        return conflict("RECEIVED");
      }
      return {...result,replay_verified:true};
    },

    async recordConfirmation(input){
      const result=await rpc(baseUrl,secret,"vf_record_owner_command_confirmation_v1",{
        p_business_id:input.businessId,p_member_id:input.memberId,p_channel_id:input.channelId,
        p_external_message_id:input.externalMessageId,p_proposal_event_id:input.proposalEventId,
        p_normalized_text:input.normalizedText||null,p_occurred_at:input.occurredAt,p_payload:input.payload||{}
      });
      if(result?.status!=="CONFIRMATION_EXISTS")return result;
      const found=await rows(baseUrl,secret,"work_events",{
        select:"id,business_id,business_member_id,business_channel_id,event_type,external_message_id,payload",
        id:`eq.${result.confirmation_event_id}`,limit:1
      });
      const e=found[0];
      if(!e||e.business_id!==input.businessId||e.business_member_id!==input.memberId||
         e.business_channel_id!==input.channelId||e.event_type!=="owner_command_confirmation"||
         e.external_message_id!==input.externalMessageId||
         e.payload?.proposal_event_id!==input.proposalEventId){
        return conflict("CONFIRMATION");
      }
      return {...result,replay_verified:true};
    },

    async recordProposal(input){
      const result=await rpc(baseUrl,secret,"vf_record_owner_command_proposal_v1",{
        p_business_id:input.businessId,p_work_item_id:input.workItemId,p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,p_payload:input.payload||{}
      });
      if(result?.status!=="PROPOSAL_EXISTS")return result;
      const found=await rows(baseUrl,secret,"work_events",{
        select:"id,business_id,work_item_id,business_member_id,event_type,payload",
        id:`eq.${result.proposal_event_id}`,limit:1
      });
      const e=found[0],p=input.payload||{};
      const same=e&&e.business_id===input.businessId&&e.work_item_id===input.workItemId&&
        e.business_member_id===input.memberId&&e.event_type==="owner_command_proposal"&&
        e.payload?.owner_command_source_event_id===input.sourceEventId&&
        e.payload?.intent===p.intent&&String(e.payload?.note||"")===String(p.note||"")&&
        String(e.payload?.title||"")===String(p.title||"")&&String(e.payload?.due_at||"")===String(p.due_at||"");
      if(!same)return conflict("PROPOSAL");
      return {...result,replay_verified:true};
    },

    async commitNote(input){
      const result=await rpc(baseUrl,secret,"vf_commit_owner_note_v1",{
        p_business_id:input.businessId,p_work_item_id:input.workItemId,p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,p_note:input.note,p_confirmed:input.confirmed===true,
        p_proposal_event_id:input.proposalEventId||null
      });
      if(result?.status!=="NOTE_EXISTS")return result;
      const found=await rows(baseUrl,secret,"work_events",{
        select:"id,business_id,work_item_id,business_member_id,event_type,normalized_text,payload",
        id:`eq.${result.note_event_id}`,limit:1
      });
      const e=found[0];
      if(!e||e.business_id!==input.businessId||e.work_item_id!==input.workItemId||
         e.business_member_id!==input.memberId||e.event_type!=="owner_command_note_added"||
         String(e.normalized_text||"").trim()!==String(input.note||"").trim()||
         e.payload?.owner_command_source_event_id!==input.sourceEventId){
        return conflict("NOTE");
      }
      return {...result,replay_verified:true};
    },

    async commitScheduleAction(input){
      const result=await rpc(baseUrl,secret,"vf_commit_owner_schedule_action_v1",{
        p_business_id:input.businessId,p_work_item_id:input.workItemId,p_member_id:input.memberId,
        p_source_event_id:input.sourceEventId,p_title:input.title,p_due_at:input.dueAt,
        p_confirmed:input.confirmed===true,p_proposal_event_id:input.proposalEventId||null
      });
      if(result?.status!=="ACTION_EXISTS")return result;
      const found=await rows(baseUrl,secret,"open_actions",{
        select:"id,business_id,work_item_id,assigned_member_id,title,due_at,metadata",
        id:`eq.${result.action_id}`,limit:1
      });
      const a=found[0];
      if(!a||a.business_id!==input.businessId||a.work_item_id!==input.workItemId||
         a.assigned_member_id!==input.memberId||String(a.title||"").trim()!==String(input.title||"").trim()||
         !sameInstant(a.due_at,input.dueAt)||a.metadata?.owner_command_source_event_id!==input.sourceEventId){
        return conflict("ACTION");
      }
      return {...result,replay_verified:true};
    }
  };
}
