import {isExplicitOwnerConfirmation} from "./owner-command-confirmation-v1.js";
import {planOwnerCommand,executeOwnerCommandPlan} from "./owner-command-orchestrator-v1.js";

export async function processOwnerCommandMessage(input,deps){
  if(input?.originVerified!==true)return {ok:false,stage:"identity",status:"DENIED",reason:"IDENTITY_NOT_VERIFIED",writes_performed:false};
  if(isExplicitOwnerConfirmation(input?.normalizedText)){
    return {ok:false,stage:"confirmation",status:"ATOMIC_CONFIRMATION_NOT_ENABLED",reason:"CONFIRMATION_MUST_BE_APPLIED_ATOMICALLY",writes_performed:false};
  }
  if(!deps?.persistence||!deps?.loadContext||!deps?.interpret)throw new Error("OWNER_COMMAND_RUNTIME_DEPENDENCY_MISSING");

  const receivedAt=input.occurredAt||input.now;
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
    const proposal=await deps.persistence.recordProposal({
      businessId:input.businessId,memberId:input.memberId,workItemId:p.workItemId,
      sourceEventId:received.event_id,
      payload:{intent:p.intent,note:p.note||null,title:p.title||null,due_at:p.dueAt||null,assignee_id:p.assigneeId||null}
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
