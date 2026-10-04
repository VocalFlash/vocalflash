import {evaluateCommand} from "./owner-command-policy-v1.js";

export function planOwnerCommand(command,context){
  const policy=evaluateCommand(command,context);
  if(policy.status!=="ELIGIBLE"){
    return {
      status:"NOT_READY",
      reason:policy.reason,
      writes_performed:false,
      policy
    };
  }

  const writable=(policy.units||[])
    .filter(u=>u?.proposal&&["add_note","schedule_action"].includes(u.proposal.intent));

  if(writable.length>1){
    return {
      status:"NOT_READY",
      reason:"MULTI_WRITE_ATOMICITY_REQUIRED",
      writes_performed:false,
      policy
    };
  }

  if(writable.length===0){
    return {
      status:"READ_ONLY",
      reason:"NO_WRITE_REQUIRED",
      writes_performed:false,
      policy
    };
  }

  return {
    status:"READY",
    reason:"SINGLE_WRITE_READY",
    writes_performed:false,
    policy,
    write:writable[0].proposal
  };
}

export async function executeOwnerCommandPlan(plan,{persistence,sourceEventId,businessId,memberId}){
  if(plan?.status!=="READY"||!plan?.write){
    return {
      status:plan?.status||"NOT_READY",
      reason:plan?.reason||"PLAN_NOT_READY",
      writes_performed:false
    };
  }
  if(!persistence)throw new Error("OWNER_COMMAND_PERSISTENCE_REQUIRED");

  const w=plan.write;
  if(w.intent==="add_note"){
    const result=await persistence.commitNote({
      businessId,memberId,workItemId:w.workItemId,sourceEventId,
      note:w.note,confirmed:false
    });
    return {status:result?.status||"UNKNOWN",writes_performed:result?.status==="NOTE_ADDED",result};
  }
  if(w.intent==="schedule_action"){
    const result=await persistence.commitScheduleAction({
      businessId,memberId,workItemId:w.workItemId,sourceEventId,
      title:w.title,dueAt:w.dueAt,confirmed:false
    });
    return {status:result?.status||"UNKNOWN",writes_performed:result?.status==="ACTION_CREATED",result};
  }
  return {status:"NOT_READY",reason:"INTENT_NOT_EXECUTABLE",writes_performed:false};
}
