import decomposer from "./message-decomposer-dry-run-v2.js";
import resolver from "./work-resolver-dry-run.js";
import classifier from "./request-classifier-dry-run-v2.js";
import intakeGate from "./intake-gate-dry-run.js";

// VocalFlash Routing Orchestrator Dry-Run V1
// Decomposer -> Resolver per unit -> Intake Gate only for NEW -> Classifier V2 only for NEW_WORK_CANDIDATE.
// No writes.

function capture(){
 const c={statusCode:200,body:null};
 const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
 return {r,c};
}
async function invoke(handler,req){
 const {r,c}=capture();
 await handler(req,r);
 return c;
}
function validKeys(){return (process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean);}

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Headers","X-API-Key, Content-Type");
 res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="POST")return res.status(405).json({error:"Usa POST"});

 const key=req.headers["x-api-key"],keys=validKeys();
 if(!key||typeof key!=="string"||keys.length===0||!keys.includes(key))return res.status(401).json({error:"API Key non valida"});

 const businessId=req.body?.business_id;
 const contactId=req.body?.contact_id;
 const normalizedText=typeof req.body?.normalized_text==="string"?req.body.normalized_text.trim():"";
 if(!businessId||!contactId||!normalizedText)return res.status(400).json({error:"business_id, contact_id e normalized_text obbligatori"});

 const started=Date.now();

 const d=await invoke(decomposer,{method:"POST",headers:{"x-api-key":key},body:{normalized_text:normalizedText}});
 if(d.statusCode!==200||!d.body?.result)return res.status(500).json({error:"Decomposer dry-run failed",detail:d.body});

 const routed=[];
 for(const unit of d.body.result.units){
  const r=await invoke(resolver,{
   method:"POST",headers:{"x-api-key":key},
   body:{business_id:businessId,contact_id:contactId,new_event:{actor_type:"customer",content_type:"text",normalized_text:unit.routing_text}}
  });
  if(r.statusCode!==200||!r.body?.result){
   return res.status(500).json({error:"Resolver dry-run failed",unit_id:unit.unit_id,detail:r.body});
  }

  let g=null;
  let c=null;
  if(r.body.result.decision==="NEW"){
   g=await invoke(intakeGate,{
    method:"POST",headers:{"x-api-key":key},
    body:{business_id:businessId,normalized_text:unit.routing_text}
   });
   if(g.statusCode!==200||!g.body?.result){
    return res.status(500).json({error:"Intake Gate dry-run failed",unit_id:unit.unit_id,detail:g.body});
   }
   if(g.body.result.decision==="NEW_WORK_CANDIDATE"){
    c=await invoke(classifier,{
     method:"POST",headers:{"x-api-key":key},
     body:{business_id:businessId,normalized_text:unit.routing_text}
    });
    if(c.statusCode!==200||!c.body?.result){
     return res.status(500).json({error:"Classifier V2 dry-run failed",unit_id:unit.unit_id,detail:c.body});
    }
   }
  }

  routed.push({
   unit_id:unit.unit_id,
   routing_text:unit.routing_text,
   resolver:{
    decision:r.body.result.decision,
    work_item_id:r.body.result.work_item_id,
    confidence:r.body.result.confidence,
    needs_clarification:r.body.result.needs_clarification,
    clarification_question:r.body.result.clarification_question
   },
   intake_gate:g?{
    decision:g.body.result.decision,
    confidence:g.body.result.confidence,
    needs_clarification:g.body.result.needs_clarification,
    clarification_question:g.body.result.clarification_question
   }:null,
   classifier:c?{
    decision:c.body.result.decision,
    routes:c.body.result.routes,
    candidate_workflow_ids:c.body.result.candidate_workflow_ids,
    confidence:c.body.result.confidence,
    needs_clarification:c.body.result.needs_clarification,
    clarification_question:c.body.result.clarification_question
   }:null
  });
 }

 console.log(`[VF ROUTING ORCHESTRATOR] decomposition=${d.body.result.mode} units=${routed.length} decisions=${routed.map(x=>x.resolver.decision).join(",")}`);

 return res.status(200).json({
  ok:true,mode:"routing_orchestrator_v2_dry_run",writes_performed:false,
  decomposition:{mode:d.body.result.mode,confidence:d.body.result.confidence},
  units:routed,duration_ms:Date.now()-started
 });
}
