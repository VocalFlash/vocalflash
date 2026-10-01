import decomposer from "./message-decomposer-dry-run-v2.js";
import resolver from "./work-resolver-dry-run.js";

// VocalFlash Write Path V2 - MATCH links + immutable routing audit.
// Work-item links are allowed ONLY for resolver MATCH decisions.
// NEW / AMBIGUOUS never create work-item links, but their routing outcome is audit-committed.
// One immutable automatic routing decision is committed exactly once per event, across software versions.
// Resolver history is read from active reversible work_event_links.

const MIN_AUTO_MATCH_CONFIDENCE = 0.90;
const PIPELINE_VERSION = "routing-v1-decomposer-v2-resolver-active-links-v1-writer-v2";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function keys(){return (process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean);}
function clean(v,max=12000){if(typeof v!=="string")return "";return v.trim().slice(0,max);}
function capture(){const c={statusCode:200,body:null};const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};return{r,c};}
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
 for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
 const r=await fetch(url,{headers:{apikey:secret,Accept:"application/json"}});
 const raw=await r.text();
 if(!r.ok)throw new Error(`DB GET ${table} HTTP ${r.status}`);
 return raw?JSON.parse(raw):[];
}
async function rpc(name,body){
 const {base,secret}=dbConfig();
 const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
  method:"POST",headers:{apikey:secret,"Content-Type":"application/json",Accept:"application/json"},
  body:JSON.stringify(body)
 });
 const raw=await r.text();
 if(!r.ok)throw new Error(`DB RPC ${name} HTTP ${r.status}: ${raw.slice(0,180)}`);
 return raw?JSON.parse(raw):null;
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
 if(!base||!secret||!process.env.OPENAI_API_KEY)return res.status(500).json({error:"Configurazione server incompleta"});

 const started=Date.now();
 try{
  const events=await dbGet("work_events",{
   select:"id,business_id,contact_id,actor_type,direction,event_type,content_type,normalized_text,occurred_at",
   id:`eq.${eventId}`,business_id:`eq.${businessId}`,limit:1
  });
  const event=events[0];
  if(!event)return res.status(404).json({error:"Evento non trovato nel business"});
  if(event.direction!=="inbound"||event.actor_type!=="customer"||!event.contact_id){
   return res.status(422).json({error:"Write Path V2 accetta solo eventi inbound customer con contact_id"});
  }
  const normalizedText=clean(event.normalized_text);
  if(!normalizedText)return res.status(422).json({error:"Evento senza normalized_text"});

  // Exactly-once fast path: automatic routing is once per event across all software versions.
  // A deployment/version change must never reroute an old Meta event or spend AI again.
  const existingDecisions=await dbGet("event_routing_decisions",{
   select:"id,pipeline_version,decision_payload,created_at",
   business_id:`eq.${businessId}`,
   event_id:`eq.${eventId}`,
   limit:1
  });
  if(existingDecisions[0]){
   const replay=await rpc("vf_commit_routing_decision_v1",{
    p_business_id:businessId,
    p_event_id:eventId,
    p_pipeline_version:PIPELINE_VERSION,
    p_decision_payload:existingDecisions[0].decision_payload,
    p_matches:[]
   });
   const replayLinks=Array.isArray(replay?.links)?replay.links:[];
   console.log(`[VF WRITE MATCH V2] event=${eventId} replay=true links=${replayLinks.length}`);
   return res.status(200).json({
    ok:true,mode:"write_path_match_v2",scope:"MATCH_LINKS_ONLY_ROUTING_AUDIT_ALWAYS",
    pipeline_version:replay?.pipeline_version||existingDecisions[0].pipeline_version,
    current_pipeline_version:PIPELINE_VERSION,replayed:true,
    safety:{min_auto_match_confidence:MIN_AUTO_MATCH_CONFIDENCE,new_work_links_enabled:false,ambiguous_work_links_enabled:false},
    routing_decision_id:replay?.decision_id||existingDecisions[0].id,
    routing_decision_created:false,
    decision_payload:replay?.decision_payload||existingDecisions[0].decision_payload,
    write_result:replayLinks,
    writes_performed:false,
    work_links_created_count:0,
    duration_ms:Date.now()-started
   });
  }

  const d=await invoke(decomposer,{method:"POST",headers:{"x-api-key":key},body:{normalized_text:normalizedText}});
  if(d.statusCode!==200||!d.body?.result)throw new Error("Decomposer failed");

  const units=[];
  const matches=[];
  for(const unit of d.body.result.units){
   const rr=await invoke(resolver,{
    method:"POST",headers:{"x-api-key":key},
    body:{business_id:businessId,contact_id:event.contact_id,new_event:{
     actor_type:event.actor_type,content_type:event.content_type||"text",normalized_text:unit.routing_text
    }}
   });
   if(rr.statusCode!==200||!rr.body?.result)throw new Error(`Resolver failed unit ${unit.unit_id}`);
   const result=rr.body.result;
   const eligible=result.decision==="MATCH"&&result.needs_clarification===false&&result.confidence>=MIN_AUTO_MATCH_CONFIDENCE;
   units.push({
    unit_id:unit.unit_id,routing_text:unit.routing_text,
    resolver:{decision:result.decision,work_item_id:result.work_item_id,confidence:result.confidence,
     needs_clarification:result.needs_clarification,clarification_question:result.clarification_question},
    write_eligible:eligible,
    write_skip_reason:result.decision==="MATCH"&&!eligible?"MATCH_BELOW_SAFETY_THRESHOLD":null
   });
   if(eligible){
    matches.push({
     unit_id:unit.unit_id,routing_text:unit.routing_text,work_item_id:result.work_item_id,
     confidence:result.confidence,reason:result.reason,evidence:result.evidence||[]
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

  // Commit routing outcome even when there are zero MATCH links.
  // The DB RPC makes event + pipeline_version exactly-once and commits links atomically.
  const commitResult=await rpc("vf_commit_routing_decision_v1",{
   p_business_id:businessId,
   p_event_id:eventId,
   p_pipeline_version:PIPELINE_VERSION,
   p_decision_payload:decisionPayload,
   p_matches:matches
  });
  const writeResult=Array.isArray(commitResult?.links)?commitResult.links:[];
  const createdCount=writeResult.filter(x=>x.created===true).length;
  const routingDecisionCreated=commitResult?.created===true;

  // If another worker committed after our initial replay check, never return
  // this worker's losing local AI result. Return only the immutable DB decision.
  if(!routingDecisionCreated){
   console.log(`[VF WRITE MATCH V2] event=${eventId} concurrent_replay=true active_links=${writeResult.length}`);
   return res.status(200).json({
    ok:true,mode:"write_path_match_v2",scope:"MATCH_LINKS_ONLY_ROUTING_AUDIT_ALWAYS",
    stored_pipeline_version:commitResult?.pipeline_version||null,
    current_pipeline_version:PIPELINE_VERSION,
    replayed:true,replay_reason:"CONCURRENT_COMMIT_WON",
    safety:{min_auto_match_confidence:MIN_AUTO_MATCH_CONFIDENCE,new_work_links_enabled:false,ambiguous_work_links_enabled:false},
    routing_decision_id:commitResult?.decision_id||null,
    routing_decision_created:false,
    decision_payload:commitResult?.decision_payload||null,
    write_result:writeResult,
    writes_performed:false,
    work_links_created_count:0,
    duration_ms:Date.now()-started
   });
  }

  console.log(`[VF WRITE MATCH V2] event=${eventId} units=${units.length} eligible=${matches.length} decision_created=${routingDecisionCreated} links_created=${createdCount}`);

  return res.status(200).json({
   ok:true,mode:"write_path_match_v2",scope:"MATCH_LINKS_ONLY_ROUTING_AUDIT_ALWAYS",
   pipeline_version:PIPELINE_VERSION,replayed:false,
   safety:{min_auto_match_confidence:MIN_AUTO_MATCH_CONFIDENCE,new_work_links_enabled:false,ambiguous_work_links_enabled:false},
   decomposition:{mode:d.body.result.mode,confidence:d.body.result.confidence},
   units,
   routing_decision_id:commitResult?.decision_id||null,
   routing_decision_created:routingDecisionCreated,
   write_result:writeResult,
   writes_performed:routingDecisionCreated||createdCount>0,
   work_links_created_count:createdCount,
   duration_ms:Date.now()-started
  });
 }catch(e){
  console.error("[VF WRITE MATCH V2] error:",e?.message||"unknown");
  return res.status(500).json({ok:false,mode:"write_path_match_v2",error:"Write Path MATCH V2 failed"});
 }
}
