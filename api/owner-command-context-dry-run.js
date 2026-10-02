import { buildAuthorizationContext } from "../lib/owner-command-authz-v1.js";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(v,max=8000)=>typeof v==="string"?v.trim().slice(0,max):"";
const keys=()=>clean(process.env.VOCALFLASH_API_KEYS,12000).split(",").map(x=>x.trim()).filter(Boolean);

function cfg(){
  return {
    base:clean(process.env.VF_ASSISTANT_SUPABASE_URL).replace(/\/+$/,""),
    secret:process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||""
  };
}
async function get(table,params){
  const {base,secret}=cfg();
  const u=new URL(`${base}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params||{})) if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:{apikey:secret,Accept:"application/json"}});
  const t=await r.text();
  if(!r.ok) throw new Error(`DB_GET_${table}_${r.status}`);
  return t?JSON.parse(t):[];
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","X-API-Key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"Usa POST"});
  const key=req.headers["x-api-key"];
  const valid=keys();
  if(!key||typeof key!=="string"||valid.length===0||!valid.includes(key))return res.status(401).json({error:"API Key non valida"});
  const businessId=req.body?.business_id,memberId=req.body?.member_id;
  if(!UUID_RE.test(businessId||"")||!UUID_RE.test(memberId||""))return res.status(400).json({error:"business_id e member_id devono essere UUID validi"});
  if(req.body?.origin_verified!==true)return res.status(403).json({ok:false,mode:"owner_command_context_dry_run",writes_performed:false,status:"DENIED",reason:"IDENTITY_NOT_VERIFIED"});
  const {base,secret}=cfg();
  if(!base||!secret)return res.status(500).json({error:"Configurazione Assistant DB mancante"});
  try{
    const members=await get("business_members",{
      select:"id,business_id,role_key,permissions,is_active",
      id:`eq.${memberId}`,business_id:`eq.${businessId}`,is_active:"eq.true",limit:1
    });
    const member=members[0];
    if(!member)return res.status(403).json({ok:false,mode:"owner_command_context_dry_run",writes_performed:false,status:"DENIED",reason:"MEMBER_NOT_ACTIVE_IN_BUSINESS"});
    const [workItems,policies]=await Promise.all([
      get("work_items",{
        select:"id,business_id,workflow_id,title,work_type,lifecycle_status,summary",
        business_id:`eq.${businessId}`,lifecycle_status:"eq.open",order:"updated_at.desc"
      }),
      get("assistant_policies",{
        select:"id,business_id,workflow_id,scope,policy_key,autonomy_mode,is_active",
        business_id:`eq.${businessId}`,is_active:"eq.true"
      })
    ]);
    const built=buildAuthorizationContext({businessId,originVerified:true,member,workItems,policyRows:policies});
    if(!built.ok)return res.status(built.status==="DENIED"?403:422).json({ok:false,mode:"owner_command_context_dry_run",writes_performed:false,...built});
    return res.status(200).json({
      ok:true,mode:"owner_command_context_dry_run",writes_performed:false,notifications_scheduled:false,
      context:built.context,
      safety:{
        role_grants_implicit_permissions:false,
        unauthorized_work_items_exposed:false,
        db_writes_enabled:false,
        ai_called:false
      }
    });
  }catch(e){
    console.error("[VF OWNER COMMAND AUTHZ] error",e?.message||"unknown");
    return res.status(500).json({ok:false,mode:"owner_command_context_dry_run",writes_performed:false,error:"Authorization context dry-run failed"});
  }
}
