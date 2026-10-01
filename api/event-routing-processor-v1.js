import decomposer from "./message-decomposer-dry-run-v2.js";
import resolver from "./work-resolver-dry-run.js";
import intakeGate from "./intake-gate-dry-run.js";
import classifier from "./request-classifier-dry-run-v2.js";

// VocalFlash Event Routing Processor V1
// Event-centric pipeline:
// persisted work_event -> Decomposer V2 -> Resolver active-links
// -> Intake Gate only for Resolver NEW
// -> Classifier V2 only for NEW_WORK_CANDIDATE
// -> immutable exactly-once routing audit + safe MATCH links only.
//
// SAFETY:
// - never creates work_items
// - never links NEW / AMBIGUOUS / UNCERTAIN to a work_item
// - automatic routing is exactly once per event across software versions
// - replay short-circuits before any AI call
// - only high-confidence Resolver MATCH can create a work_event_link

const MIN_AUTO_MATCH_CONFIDENCE=0.90;
const PIPELINE_VERSION="event-routing-v1-decomposer-v2-resolver-active-links-intake-v1-classifier-v2";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function keys(){return (process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean);}
function clean(v,max=12000){if(typeof v!=="string")return "";return v.trim().slice(0,max);}
function capture(){
 const c={statusCode:200,body:null};
 const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
 return {r,c};
}
async function invoke(handler,req){const {r,c}=capture();await handler(req,r);return c;}
function dbConfig(){
 return {
  base:clean(process.env.VF_ASSISTANT_SUPABASE_URL).replace(/\/+$/,""),
  secret:process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||""
 };
}
async function dbGet(table,params){
 const {base,secret}=dbConfig();
 const url=new URL(`${base}/rest/v1/${table}`);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));
 const r=await fetch(url,{headers:{apikey:secret,Accept:"application/json"}});
 const raw=await r.text();
 if(!r.ok)throw new Error(`DB GET ${table} HTTP ${r.status}: ${raw.slice(0,180)}`);
 return raw?JSON.parse(raw):[];
}
async function rpc(name,body){
 const {base,secret}=dbConfig();
 const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
  method:"POST",
  headers:{apikey:secret,"Content-Type":"application/json",Accept:"application/json"},
  body:JSON.stringify(body)
 });
 const raw=await r.text();
 if(!r.ok)throw new Error(`DB RPC ${name} HTTP ${r.status}: ${raw.slice(0,180)}`);
 return raw?JSON.parse(raw):null;
}

function nextAction(resolverResult,gateResult,classifierResult,eligible){
 if(resolverResult.decision==="MATCH")return eligible?"LINK_EXISTING_WORK":"REVIEW_MATCH";
 if(resolverResult.decision==="AMBIGUOUS")return "CLARIFY_EXISTING_WORK";
 if(resolverResult.decision!=="NEW")return "REVIEW_ROUTING";
 if(!gateResult)return "REVIEW_NEW";
 if(gateResult.decision==="NO_NEW_WORK")return "NO_NEW_WORK";
 if(gateResult.decision==="UNCERTAIN")return "CLARIFY_NEW_NEED";
 if(gateResult.decision!=="NEW_WORK_CANDIDATE")return "REVIEW_NEW";
 if(!classifierResult)return "REVIEW_CLASSIFICATION";
 if(classifierResult.decision==="AMBIGUOUS")return "CLARIFY_WORKFLOW";
 if(classifierResult.decision==="UNCLASSIFIED")return "REVIEW_UNCLASSIFIED";
 if(classifierResult.decision==="CLASSIFIED_SINGLE"||classifierResult.decision==="CLASSIFIED_MULTI")return "NEW_WORK_CANDIDATE_CLASSIFIED";
 return "REVIEW_CLASSIFICATION";
}

export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Headers","X-API-Key, Content-Type");
 res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="POST")return res.status(405).json({error:"Usa POST"});

 const key=req.headers["x-api-key"],valid=keys();
 if(!key||typeof key!=="string"||valid.length===0||!valid.includes(key))return res.status(401).json({error:"API Key non valida"});

 const businessId=req.body?.business_id,eventId=req.body?.event_id;
 if(!UUID_RE.test(businessId||"")||!UUID_RE.test(eventId||""))return res.status(400).json({error:"business_id ed event_id devono essere UUID validi"});

 const {base,secret}=dbConfig();
 if(!base||!secret)return res.status(500).json({error:"Configurazione DB server incompleta"});

 const started=Date.now();
 try{
  const events=await dbGet("work_events",{
   select:"id,business_id,contact_id,actor_type,direction,event_type,content_type,normalized_text,occurred_at",
   id:`eq.${eventId}`,business_id:`eq.${businessId}`,limit:1
  });
  const event=events[0];
  if(!event)return res.status(404).json({error:"Evento non trovato nel business"});
  if(event.direction!=="inbound"||event.actor_type!=="customer"||!event.contact_id){
   return res.status(422).json({error:"Event Routing V1 accetta solo eventi inbound customer con contact_id"});
  }
  const normalizedText=clean(event.normalized_text);
  if(!normalizedText)return res.status(422).json({error:"Evento senza normalized_text"});

  // Global exactly-once replay guard. This runs before checking OPENAI_API_KEY:
  // a processed event must remain replayable even if AI is temporarily unavailable.
  const existing=await dbGet("event_routing_decisions",{
   select:"id,pipeline_version,decision_payload,created_at",
   business_id:`eq.${businessId}`,event_id:`eq.${eventId}`,limit:1
  });
  if(existing[0]){
   const replay=await rpc("vf_commit_routing_decision_v1",{
    p_business_id:businessId,
    p_event_id:eventId,
    p_pipeline_version:PIPELINE_VERSION,
    p_decision_payload:existing[0].decision_payload,
    p_matches:[]
   });
   return res.status(200).json({
    ok:true,
    mode:"event_routing_processor_v1",
    replayed:true,
    stored_pipeline_version:replay?.pipeline_version||existing[0].pipeline_version,
    current_pipeline_version:PIPELINE_VERSION,
    routing_decision_id:replay?.decision_id||existing[0].id,
    routing_decision_created:false,
    decision_payload:replay?.decision_payload||existing[0].decision_payload,
    active_links:Array.isArray(replay?.links)?replay.links:[],
    work_links_created_count:0,
    duration_ms:Date.now()-started
   });
  }

  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"Configurazione AI server incompleta"});

  const d=await invoke(decomposer,{
   method:"POST",headers:{"x-api-key":key},body:{normalized_text:normalizedText}
  });
  if(d.statusCode!==200||!d.body?.result)throw new Error("Decomposer failed");

  const units=[];
  const matches=[];

  for(const unit of d.body.result.units){
   const rr=await invoke(resolver,{
    method:"POST",headers:{"x-api-key":key},
    body:{
     business_id:businessId,
     contact_id:event.contact_id,
     new_event:{
      actor_type:event.actor_type,
      content_type:event.content_type||"text",
      normalized_text:unit.routing_text
     }
    }
   });
   if(rr.statusCode!==200||!rr.body?.result)throw new Error(`Resolver failed unit ${unit.unit_id}`);
   const r=rr.body.result;

   let g=null;
   let c=null;

   if(r.decision==="NEW"){
    const gr=await invoke(intakeGate,{
     method:"POST",headers:{"x-api-key":key},
     body:{business_id:businessId,normalized_text:unit.routing_text}
    });
    if(gr.statusCode!==200||!gr.body?.result)throw new Error(`Intake Gate failed unit ${unit.unit_id}`);
    g=gr.body.result;

    if(g.decision==="NEW_WORK_CANDIDATE"){
     const cr=await invoke(classifier,{
      method:"POST",headers:{"x-api-key":key},
      body:{business_id:businessId,normalized_text:unit.routing_text}
     });
     if(cr.statusCode!==200||!cr.body?.result)throw new Error(`Classifier failed unit ${unit.unit_id}`);
     c=cr.body.result;
    }
   }

   const eligible=r.decision==="MATCH"&&r.needs_clarification===false&&r.confidence>=MIN_AUTO_MATCH_CONFIDENCE;
   const routedUnit={
    unit_id:unit.unit_id,
    routing_text:unit.routing_text,
    resolver:{
     decision:r.decision,
     work_item_id:r.work_item_id,
     confidence:r.confidence,
     reason:r.reason,
     evidence:r.evidence||[],
     needs_clarification:r.needs_clarification,
     clarification_question:r.clarification_question
    },
    intake_gate:g?{
     decision:g.decision,
     confidence:g.confidence,
     reason:g.reason,
     needs_clarification:g.needs_clarification,
     clarification_question:g.clarification_question
    }:null,
    classifier:c?{
     decision:c.decision,
     routes:c.routes||[],
     candidate_workflow_ids:c.candidate_workflow_ids||[],
     confidence:c.confidence,
     needs_clarification:c.needs_clarification,
     clarification_question:c.clarification_question
    }:null,
    write_eligible:eligible,
    next_action:nextAction(r,g,c,eligible)
   };
   units.push(routedUnit);

   if(eligible){
    matches.push({
     unit_id:unit.unit_id,
     routing_text:unit.routing_text,
     work_item_id:r.work_item_id,
     confidence:r.confidence,
     reason:r.reason,
     evidence:r.evidence||[]
    });
   }
  }

  const decisionPayload={
   decomposition:{
    mode:d.body.result.mode,
    confidence:d.body.result.confidence,
    reason:d.body.result.reason,
    shared_context:d.body.result.shared_context||[]
   },
   units
  };

  const committed=await rpc("vf_commit_routing_decision_v1",{
   p_business_id:businessId,
   p_event_id:eventId,
   p_pipeline_version:PIPELINE_VERSION,
   p_decision_payload:decisionPayload,
   p_matches:matches
  });
  const links=Array.isArray(committed?.links)?committed.links:[];
  const createdLinks=links.filter(x=>x.created===true).length;

  console.log(`[VF EVENT ROUTING V1] event=${eventId} mode=${d.body.result.mode} units=${units.length} links_created=${createdLinks} actions=${units.map(x=>x.next_action).join(",")}`);

  return res.status(200).json({
   ok:true,
   mode:"event_routing_processor_v1",
   replayed:false,
   pipeline_version:PIPELINE_VERSION,
   routing_decision_id:committed?.decision_id||null,
   routing_decision_created:committed?.created===true,
   decomposition:{mode:d.body.result.mode,confidence:d.body.result.confidence},
   units,
   active_links:links,
   work_links_created_count:createdLinks,
   new_work_items_created_count:0,
   duration_ms:Date.now()-started
  });
 }catch(e){
  console.error("[VF EVENT ROUTING V1] error:",e?.message||"unknown");
  return res.status(500).json({ok:false,mode:"event_routing_processor_v1",error:"Event Routing Processor V1 failed"});
 }
}
