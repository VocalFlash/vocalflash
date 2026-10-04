import {buildAuthorizationContext} from "./owner-command-authz-v1.js";
import {interpretOwnerCommand} from "./owner-command-interpreter-v1.js";
import {createOwnerCommandPersistence} from "./owner-command-persistence-v1.js";

const base=v=>String(v||"").trim().replace(/\/+$/,"");
async function rows(baseUrl,apiSecret,table,params){
  const u=new URL(`${base(baseUrl)}/rest/v1/${table}`);
  for(const [k,v] of Object.entries(params||{})) if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:{apikey:apiSecret,Accept:"application/json"}});
  const raw=await r.text();
  if(!r.ok)throw new Error(`OWNER_CONTEXT_DB_${table}_HTTP_${r.status}`);
  const body=raw?JSON.parse(raw):[];
  return Array.isArray(body)?body:[];
}

export function createOwnerRuntimeDependencies({baseUrl,apiSecret,openAiApiKey}){
  const persistence=createOwnerCommandPersistence({baseUrl,secret:apiSecret});
  return {
    persistence,
    async loadContext({businessId,memberId,originVerified,receivedAt,now}){
      if(originVerified!==true)return {ok:false,status:"DENIED",reason:"IDENTITY_NOT_VERIFIED"};
      const members=await rows(baseUrl,apiSecret,"business_members",{
        select:"id,business_id,role_key,permissions,is_active",id:`eq.${memberId}`,
        business_id:`eq.${businessId}`,is_active:"eq.true",limit:1
      });
      const member=members[0];
      if(!member)return {ok:false,status:"DENIED",reason:"MEMBER_NOT_ACTIVE_IN_BUSINESS"};
      const [workItems,policies]=await Promise.all([
        rows(baseUrl,apiSecret,"work_items",{
          select:"id,business_id,workflow_id,title,work_type,lifecycle_status,summary",
          business_id:`eq.${businessId}`,lifecycle_status:"eq.open",order:"updated_at.desc"
        }),
        rows(baseUrl,apiSecret,"assistant_policies",{
          select:"id,business_id,workflow_id,scope,policy_key,autonomy_mode,is_active",
          business_id:`eq.${businessId}`,is_active:"eq.true"
        })
      ]);
      const built=buildAuthorizationContext({businessId,originVerified:true,member,workItems,policyRows:policies});
      if(!built.ok)return built;
      return {...built,context:{...built.context,receivedAt,now,timezone:"Europe/Rome"}};
    },
    interpret({message,context}){
      return interpretOwnerCommand({message,context,openAiApiKey});
    }
  };
}
