import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";

const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
if(!baseUrl||!secret)throw new Error("OWNER_COMMAND_DB_CONFIG_MISSING");

const store=createOwnerCommandPersistence({baseUrl,secret});
const common={
  businessId:"71111111-1111-4111-8111-111111111111",
  memberId:"71333333-3333-4333-8333-333333333333",
  channelId:"71222222-2222-4222-8222-222222222222"
};

const first=await store.recordReceived({
  ...common,
  externalMessageId:"owner-persistence-smoke-msg-1",
  normalizedText:"Ricordami domani alle 10 di chiamare Rossi",
  occurredAt:"2026-10-02T08:00:00+02:00",
  payload:{fixture:"owner-persistence-smoke"}
});
if(first?.status!=="RECEIVED_RECORDED"||!first?.event_id)throw new Error("RECEIVE_FIRST_FAILED");

const retryReceive=await store.recordReceived({
  ...common,
  externalMessageId:"owner-persistence-smoke-msg-1",
  normalizedText:"Ricordami domani alle 10 di chiamare Rossi",
  occurredAt:"2026-10-03T08:00:00+02:00",
  payload:{fixture:"owner-persistence-smoke",retry:true}
});
if(retryReceive?.status!=="RECEIVED_EXISTS"||retryReceive?.event_id!==first.event_id)throw new Error("RECEIVE_RETRY_FAILED");

const proposal=await store.recordProposal({
  businessId:common.businessId,
  memberId:common.memberId,
  workItemId:"71666666-6666-4666-8666-666666666666",
  sourceEventId:first.event_id,
  payload:{
    intent:"schedule_action",
    title:"Chiamare Rossi",
    due_at:"2026-10-03T10:00:00+02:00",
    policy:"auto"
  }
});
if(proposal?.status!=="PROPOSAL_RECORDED"||!proposal?.proposal_event_id)throw new Error("PROPOSAL_FIRST_FAILED");

const proposalRetry=await store.recordProposal({
  businessId:common.businessId,
  memberId:common.memberId,
  workItemId:"71666666-6666-4666-8666-666666666666",
  sourceEventId:first.event_id,
  payload:{
    intent:"schedule_action",
    title:"Chiamare Rossi MODIFICATO",
    due_at:"2026-10-04T10:00:00+02:00",
    policy:"auto"
  }
});
if(proposalRetry?.status!=="PROPOSAL_EXISTS"||proposalRetry?.proposal_event_id!==proposal.proposal_event_id)throw new Error("PROPOSAL_RETRY_FAILED");

const action=await store.commitScheduleAction({
  businessId:common.businessId,
  memberId:common.memberId,
  workItemId:"71666666-6666-4666-8666-666666666666",
  sourceEventId:first.event_id,
  title:"Chiamare Rossi",
  dueAt:"2026-10-03T10:00:00+02:00",
  confirmed:false
});
if(action?.status!=="ACTION_CREATED"||!action?.action_id||action?.notification_scheduled!==false)throw new Error("ACTION_FIRST_FAILED");

const actionRetry=await store.commitScheduleAction({
  businessId:common.businessId,
  memberId:common.memberId,
  workItemId:"71666666-6666-4666-8666-666666666666",
  sourceEventId:first.event_id,
  title:"Chiamare Rossi",
  dueAt:"2026-10-04T10:00:00+02:00",
  confirmed:false
});
if(actionRetry?.status!=="ACTION_EXISTS"||actionRetry?.action_id!==action.action_id||actionRetry?.notification_scheduled!==false)throw new Error("ACTION_RETRY_FAILED");

console.log("OWNER_COMMAND_PERSISTENCE_SMOKE_PASS");
