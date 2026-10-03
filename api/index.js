import {processNewWorkFromRouting} from '../lib/new-work-coordinator-v1.js';

const DIAG='new-coordinator-v1-20261003';

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

async function runDiag(){
  const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
  const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  const out={};
  for(const [name,fn] of Object.entries({
    replay:()=>processNewWorkFromRouting({businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',routing:{decision_payload:autoRouting},baseUrl,secret,openAiApiKey:'definitely-invalid-openai-key'}),
    incomplete:()=>processNewWorkFromRouting({businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555552',routing:incompleteRouting,baseUrl,secret,openAiApiKey:process.env.OPENAI_API_KEY}),
    noPolicy:()=>processNewWorkFromRouting({businessId:'22111111-1111-4111-8111-111111111111',eventId:'22555555-5555-4555-8555-555555555551',routing:noPolicyRouting,baseUrl,secret,openAiApiKey:'definitely-invalid-openai-key'}),
    multi:()=>processNewWorkFromRouting({businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,routing:{units:[autoRouting.units[0],{...autoRouting.units[0],unit_id:'u2'}]}}),
    mixed:()=>processNewWorkFromRouting({businessId:'21111111-1111-4111-8111-111111111111',eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,routing:{units:[autoRouting.units[0],{unit_id:'u2',next_action:'CLARIFY_EXISTING_WORK'}]}})
  })){
    try{out[name]={ok:true,result:await fn()};}
    catch(e){out[name]={ok:false,error:e?.message||String(e)};}
  }
  return out;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.query?.vf_eval===DIAG)return res.status(200).json(await runDiag());
  return res.status(200).json({name:'VocalFlash API',status:'online',docs:'Richiedi API Key a info@vocalflash.it',endpoints:{'POST /api/v1/transcribe':'Trascrive vocale in testo + sintesi'}});
}
