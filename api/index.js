import {processNewWorkFromRouting} from '../lib/new-work-coordinator-v1.js';

const DIAG='new-coordinator-deterministic-20261003';
const A='21111111-1111-4111-8111-111111111111';
const AW='21333333-3333-4333-8333-333333333333';
const L='22111111-1111-4111-8111-111111111111';
const LW='22333333-3333-4333-8333-333333333333';
const auto={units:[{unit_id:'u1',routing_text:'Sono a Recanati, la perdita è iniziata stamattina.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:AW,workflow_key:'repair',work_type:'repair',reason:'Intervento tecnico',confidence:.99}],candidate_workflow_ids:[],reason:'repair',needs_clarification:false,clarification_question:null,confidence:.99}}]};
const incomplete={units:[{unit_id:'u1',routing_text:'Sono a Recanati, ma non ricordo da quando perde.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:AW,workflow_key:'repair',work_type:'repair',reason:'Intervento tecnico',confidence:.99}],candidate_workflow_ids:[],reason:'repair',needs_clarification:false,clarification_question:null,confidence:.99}}]};
const legal={units:[{unit_id:'u1',routing_text:'Devo aprire una pratica contro Alfa Srl.',next_action:'NEW_WORK_CANDIDATE_CLASSIFIED',classifier:{decision:'CLASSIFIED_SINGLE',routes:[{workflow_id:LW,workflow_key:'legal_case',work_type:'legal_case',reason:'Pratica legale',confidence:.99}],candidate_workflow_ids:[],reason:'legal',needs_clarification:false,clarification_question:null,confidence:.99}}]};
const fields=[{key:'location',label:'Zona o indirizzo',description:null,type:null},{key:'problem_since',label:'Da quando è presente il problema',description:null,type:null}];
const row=(key,status,value,evidence)=>({key,status,value,evidence,confidence:.99});
async function extractor({normalizedText,workflow}){
  if(workflow.id===LW)return {ok:true,status:'NO_REQUIRED_DATA_CONFIGURED',writes_performed:false,model_called:false,required_data:{ok:true,configured:false,shape:'object',fields:[]},extraction:{fields:[],provided:[],missing:[],uncertain:[],complete:false,reason:'fixture'}};
  const location=row('location','PROVIDED','Recanati','Sono a Recanati');
  if(normalizedText.includes('non ricordo')){
    const missing=row('problem_since','MISSING',null,'non ricordo da quando perde');
    return {ok:true,status:'REQUIRED_DATA_INCOMPLETE',writes_performed:false,model_called:false,required_data:{ok:true,configured:true,shape:'fields_array',fields},extraction:{fields:[location,missing],provided:[location],missing:[missing],uncertain:[],complete:false,reason:'fixture'}};
  }
  const since=row('problem_since','PROVIDED','stamattina','la perdita è iniziata stamattina');
  return {ok:true,status:'REQUIRED_DATA_COMPLETE',writes_performed:false,model_called:false,required_data:{ok:true,configured:true,shape:'fields_array',fields},extraction:{fields:[location,since],provided:[location,since],missing:[],uncertain:[],complete:true,reason:'fixture'}};
}

async function run(){
  const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
  const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  const out={};
  async function capture(name,fn){try{out[name]={ok:true,result:await fn()};}catch(e){out[name]={ok:false,error:e?.message||String(e)}}}
  await capture('first',()=>processNewWorkFromRouting({businessId:A,eventId:'21555555-5555-4555-8555-555555555551',routing:auto,baseUrl,secret,extractRequiredData:extractor}));
  await capture('replay',()=>processNewWorkFromRouting({businessId:A,eventId:'21555555-5555-4555-8555-555555555551',routing:{decision_payload:auto},baseUrl,secret,extractRequiredData:async()=>{throw new Error('EXTRACTOR_MUST_NOT_RUN_ON_REPLAY')}}));
  await capture('incomplete',()=>processNewWorkFromRouting({businessId:A,eventId:'21555555-5555-4555-8555-555555555552',routing:incomplete,baseUrl,secret,extractRequiredData:extractor}));
  await capture('noPolicy',()=>processNewWorkFromRouting({businessId:L,eventId:'22555555-5555-4555-8555-555555555551',routing:legal,baseUrl,secret,extractRequiredData:extractor}));
  await capture('multi',()=>processNewWorkFromRouting({businessId:A,eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,routing:{units:[auto.units[0],{...auto.units[0],unit_id:'u2'}]},extractRequiredData:extractor}));
  await capture('mixed',()=>processNewWorkFromRouting({businessId:A,eventId:'21555555-5555-4555-8555-555555555551',baseUrl,secret,routing:{units:[auto.units[0],{unit_id:'u2',next_action:'CLARIFY_EXISTING_WORK'}]},extractRequiredData:extractor}));
  return out;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.query?.vf_eval===DIAG)return res.status(200).json(await run());
  return res.status(200).json({name:'VocalFlash API',status:'online',docs:'Richiedi API Key a info@vocalflash.it',endpoints:{'POST /api/v1/transcribe':'Trascrive vocale in testo + sintesi'}});
}
