import decomposer from "./message-decomposer-dry-run-v2.js";
import resolver from "./work-resolver-dry-run.js";

// VocalFlash Write Path V1 - MATCH ONLY
// Real write allowed ONLY for resolver MATCH decisions.
// NEW / AMBIGUOUS remain read-only.
// All MATCH links for one event are committed atomically by Postgres RPC.

const MIN_AUTO_MATCH_CONFIDENCE = 0.90;
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
   return res.status(422).json({error:"Write Path V1 accetta solo eventi inbound customer con contact_id"});
  }
  const normalizedText=clean(event.normalized_text);
  if(!normalizedText)return res.status(422).json({error:"Evento senza normalized_text"});

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

  let writeResult=[];
  if(matches.length>0){
   writeResult=await rpc("vf_write_match_links_v1",{
    p_business_id:businessId,p_event_id:eventId,p_matches:matches
   });
  }

  const createdCount=Array.isArray(writeResult)?writeResult.filter(x=>x.created===true).length:0;
  console.log(`[VF WRITE MATCH V1] event=${eventId} units=${units.length} eligible=${matches.length} created=${createdCount}`);

  return res.status(200).json({
   ok:true,mode:"write_path_match_v1",scope:"MATCH_ONLY",
   safety:{min_auto_match_confidence:MIN_AUTO_MATCH_CONFIDENCE,new_writes_enabled:false,ambiguous_writes_enabled:false},
   decomposition:{mode:d.body.result.mode,confidence:d.body.result.confidence},
   units,write_result:writeResult,writes_performed:createdCount>0,created_count:createdCount,
   duration_ms:Date.now()-started
  });
 }catch(e){
  console.error("[VF WRITE MATCH V1] error:",e?.message||"unknown");
  return res.status(500).json({ok:false,mode:"write_path_match_v1",error:"Write Path MATCH V1 failed"});
 }
}
