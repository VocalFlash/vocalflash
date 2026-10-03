import {processNewWorkFromRouting} from '../lib/new-work-coordinator-v1.js';

const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
if(!baseUrl||!secret||!process.env.OPENAI_API_KEY)throw new Error('NEW_COORDINATOR_ENV_MISSING');
function assert(x,msg){if(!x)throw new Error(msg);}

const autoRouting={units:[{
  unit_id:'u1',routing_text:'Sono a Recanati, la perdita è iniziata stamattina.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',
  classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:'21333333-3333-4333-8333-333333333333',workflow_key:'repair',work_type:'repair',reason:'Intervento tecnico',confidence:.99}],candidate_workflow_ids:[],reason:'repair',needs_clarification:false,clarification_question:null,confidence:.99}
}]};
const incompleteRouting={units:[{
  unit_id:'u1',routing_text:'Sono a Recanati, ma non ricordo da quando perde.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',
  classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:'21333333-3333-4333-8333-333333333333',workflow_key:'repair',work_type:'repair',reason:'Intervento tecnico',confidence:.99}],candidate_workflow_ids:[],reason:'repair',needs_clarification:false,clarification_question:null,confidence:.99}
}]};
const noPolicyRouting={units:[{
  unit_id:'u1',routing_text:'Devo aprire una pratica contro Alfa Srl.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',
  classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:'22333333-3333-4333-8333-333333333333',workflow_key:'legal_case',work_type:'legal_case',reason:'Pratica legale',confidence:.99}],candidate_workflow_ids:[],reason:'legal',needs_clarification:false,clarification_question:null,confidence:.99}
}]};

const first=await processNewWorkFromRouting({
  businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',
  routing:autoRouting,baseUrl,secret,openAiApiKey:process.env.OPENAI_API_KEY
});
assert(first.ok===true&&first.status==='WORK_ITEM_CREATED'&&first.writes_performed===true,'AUTO_CREATE_FAILED_'+JSON.stringify(first));
assert(first.work_item_id,'AUTO_WORK_ITEM_ID_MISSING');

const replay=await processNewWorkFromRouting({
  businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',
  routing:{decision_payload:autoRouting},baseUrl,secret,openAiApiKey:'definitely-invalid-openai-key'
});
assert(replay.ok===true&&replay.status==='WORK_ITEM_EXISTS'&&replay.replayed===true,'FAST_REPLAY_FAILED_'+JSON.stringify(replay));
assert(replay.work_item_id===first.work_item_id,'FAST_REPLAY_WRONG_ID');

const incomplete=await processNewWorkFromRouting({
  businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555552',
  routing:incompleteRouting,baseUrl,secret,openAiApiKey:process.env.OPENAI_API_KEY
});
assert(incomplete.ok===true&&incomplete.status==='DATA_COLLECTION_REQUIRED'&&incomplete.writes_performed===false,'INCOMPLETE_NOT_BLOCKED_'+JSON.stringify(incomplete));
assert(incomplete.data_collection_plan?.ask_together===true,'INCOMPLETE_NOT_GROUPED');
assert(incomplete.data_collection_plan?.missing_fields?.includes('problem_since'),'INCOMPLETE_MISSING_FIELD_WRONG');

const noPolicy=await processNewWorkFromRouting({
  businessId:'22111111-1111-4111-8111-111111111111',eventId:'22555555-5555-4555-8555-555555555551',
  routing:noPolicyRouting,baseUrl,secret,openAiApiKey:'definitely-invalid-openai-key'
});
assert(noPolicy.ok===true&&noPolicy.status==='CONFIG_REQUIRED'&&noPolicy.writes_performed===false,'NO_POLICY_NOT_BLOCKED_'+JSON.stringify(noPolicy));

const multi=await processNewWorkFromRouting({
  businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,
  routing:{units:[autoRouting.units[0],{...autoRouting.units[0],unit_id:'u2'}]}
});
assert(multi.status==='MULTI_NEW_REVIEW'&&multi.writes_performed===false,'MULTI_NEW_NOT_BLOCKED');

const mixedReview=await processNewWorkFromRouting({
  businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,
  routing:{units:[autoRouting.units[0],{unit_id:'u2',next_action:'CLARIFY_EXISTING_WORK'}]}
});
assert(mixedReview.status==='EVENT_REVIEW_REQUIRED'&&mixedReview.writes_performed===false,'OTHER_AMBIGUITY_NOT_BLOCKING');

console.log('NEW_WORK_COORDINATOR_V1_E2E_PASS',JSON.stringify({
  created:first.work_item_id,replay:replay.status,incomplete:incomplete.status,no_policy:noPolicy.status,multi:multi.status,mixed:mixedReview.status
}));
