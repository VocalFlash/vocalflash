import {isExplicitOwnerConfirmation} from "./owner-command-confirmation-v1.js";
import {planOwnerCommand,executeOwnerCommandPlan} from "./owner-command-orchestrator-v1.js";

export async function processOwnerCommandMessage(input,deps){
  if(input?.originVerified!==true)return {ok:false,stage:"identity",status:"DENIED",reason:"IDENTITY_NOT_VERIFIED",writes_performed:false};
  if(!deps?.persistence)throw new Error("OWNER_COMMAND_RUNTIME_DEPENDENCY_MISSING");

  const receivedAt=input.occurredAt||input.now;
  if(isExplicitOwnerConfirmation(input?.normalizedText)){
    const persistence=deps.persistence;
    if(typeof persistence.resolvePendingProposal!=="function"||
       typeof persistence.recordConfirmation!=="function"||
       typeof persistence.commitConfirmedProposal!=="function"){
      return {ok:false,stage:"confirmation",status:"ATOMIC_CONFIRMATION_NOT_ENABLED",
        reason:"ATOMIC_CONFIRMATION_PERSISTENCE_UNAVAILABLE",writes_performed:false};
    }
    if(!input.businessId||!input.memberId||!input.channelId||!input.externalMessageId||!receivedAt){
      return {ok:false,stage:"confirmation",status:"INVALID",reason:"CONFIRMATION_BINDING_REQUIRED",writes_performed:false};
    }
    const pending=await persistence.resolvePendingProposal({
      businessId:input.businessId,memberId:input.memberId,channelId:input.channelId,
      externalMessageId:input.externalMessageId
    });
    if(pending?.ok!==true||!["PENDING_PROPOSAL","EXISTING_CONFIRMATION"].includes(pending?.status)){
      const handled=["NO_PENDING_PROPOSAL","AMBIGUOUS_PENDING_PROPOSAL","REPLAY_CONFLICT","DENIED","CONFIG_REQUIRED","INVALID"].includes(pending?.status);
      return {ok:handled,stage:"confirmation",status:pending?.status||"FAILED",
        reason:pending?.reason||null,writes_performed:false,effect_applied:false};
    }
    const proposalEventId=pending.proposal_event_id;
    if(!proposalEventId){
      return {ok:false,stage:"confirmation",status:"DENIED",reason:"PROPOSAL_BINDING_MISSING",writes_performed:false};
    }
    const confirmation=await persistence.recordConfirmation({
      businessId:input.businessId,memberId:input.memberId,channelId:input.channelId,
      externalMessageId:input.externalMessageId,proposalEventId,
      normalizedText:input.normalizedText,occurredAt:receivedAt,payload:input.payload||{}
    });
    if(confirmation?.ok!==true||
       !["CONFIRMATION_RECORDED","CONFIRMATION_EXISTS"].includes(confirmation?.status)||
       !confirmation?.confirmation_event_id){
      const handled=["REPLAY_CONFLICT","DENIED","INVALID"].includes(confirmation?.status);
      return {ok:handled,stage:"confirmation",status:confirmation?.status||"FAILED",
        reason:confirmation?.reason||"CONFIRMATION_EVENT_NOT_RECORDED",writes_performed:false,effect_applied:false};
    }
    const committed=await persistence.commitConfirmedProposal({
      businessId:input.businessId,memberId:input.memberId,channelId:input.channelId,
      confirmationEventId:confirmation.confirmation_event_id,proposalEventId
    });
    const commitHandled=committed?.status==="CONFIRMATION_COMMITTED"||
      ["DENIED","CONFIG_REQUIRED","INVALID","REPLAY_CONFLICT","COMMIT_REJECTED"].includes(committed?.status);
    return {
      ok:commitHandled,
      stage:"confirmation",status:committed?.status||"FAILED",
      reason:committed?.reason||null,
      writes_performed:committed?.writes_performed===true,
      effect_applied:committed?.ok===true&&committed?.status==="CONFIRMATION_COMMITTED",
      replayed:committed?.replayed===true,
      result:committed?.result||null,proposal_event_id:proposalEventId,
      confirmation_event_id:confirmation.confirmation_event_id
    };
  }
  if(!deps?.loadContext||!deps?.interpret)throw new Error("OWNER_COMMAND_RUNTIME_DEPENDENCY_MISSING");

  const received=await deps.persistence.recordReceived({
    businessId:input.businessId,memberId:input.memberId,channelId:input.channelId,
    externalMessageId:input.externalMessageId,normalizedText:input.normalizedText,
    occurredAt:receivedAt,payload:input.payload||{}
  });
  if(received?.ok!==true||received?.status==="REPLAY_CONFLICT"){
    return {ok:false,stage:"received",status:received?.status||"FAILED",reason:received?.reason||null,writes_performed:false};
  }

  const built=await deps.loadContext({
    businessId:input.businessId,memberId:input.memberId,originVerified:true,
    receivedAt,now:input.now
  });
  if(built?.ok!==true)return {ok:false,stage:"context",status:built?.status||"FAILED",reason:built?.reason||null,writes_performed:false};

  const interpreted=await deps.interpret({message:input.normalizedText,context:built.context});
  const plan=(deps.plan||planOwnerCommand)(interpreted.result,built.context);

  if(plan.status==="CONFIRMATION_REQUIRED"&&plan.proposal){
    const p=plan.proposal;
    const ttl=Number(deps.confirmationTtlSeconds);
    if(!Number.isSafeInteger(ttl)||ttl<=0||ttl>86400){
      return {ok:true,stage:"proposal",status:"CONFIG_REQUIRED",
        reason:"OWNER_CONFIRMATION_TTL_NOT_CONFIGURED",writes_performed:false,
        source_event_id:received.event_id};
    }
    const clockValue=typeof deps.clock==="function"?deps.clock():Date.now();
    const expiresAt=new Date(Number(clockValue)+ttl*1000);
    if(!Number.isFinite(expiresAt.getTime())){
      return {ok:true,stage:"proposal",status:"CONFIG_REQUIRED",
        reason:"OWNER_CONFIRMATION_CLOCK_INVALID",writes_performed:false,
        source_event_id:received.event_id};
    }
    const proposal=await deps.persistence.recordProposal({
      businessId:input.businessId,memberId:input.memberId,workItemId:p.workItemId,
      sourceEventId:received.event_id,
      payload:{intent:p.intent,note:p.note||null,title:p.title||null,due_at:p.dueAt||null,
        assignee_id:p.assigneeId||null,expires_at:expiresAt.toISOString()}
    });
    if(proposal?.ok!==true||proposal?.status==="REPLAY_CONFLICT"){
      return {ok:false,stage:"proposal",status:proposal?.status||"FAILED",reason:proposal?.reason||null,writes_performed:false};
    }
    return {ok:true,stage:"confirmation",status:"CONFIRMATION_REQUIRED",writes_performed:false,
      source_event_id:received.event_id,proposal_event_id:proposal.proposal_event_id,proposal:p,
      replayed:received.replayed===true||proposal.replayed===true};
  }

  if(plan.status==="READY"){
    const executed=await (deps.execute||executeOwnerCommandPlan)(plan,{
      persistence:deps.persistence,sourceEventId:received.event_id,businessId:input.businessId,memberId:input.memberId
    });
    return {ok:executed?.effect_applied===true,stage:"write",status:executed?.status||"FAILED",
      writes_performed:executed?.writes_performed===true,effect_applied:executed?.effect_applied===true,
      replayed:executed?.replayed===true,source_event_id:received.event_id};
  }

  if(plan.status==="READ_ONLY"){
    return {ok:true,stage:"read",status:"READ_ONLY_READY",writes_performed:false,
      source_event_id:received.event_id,reads:plan.reads||[],context:built.context};
  }

  return {ok:true,stage:"plan",status:plan.status,reason:plan.reason,writes_performed:false,
    source_event_id:received.event_id,policy:plan.policy};
}
