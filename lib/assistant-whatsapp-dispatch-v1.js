import {createOwnerCommandPersistence} from "./owner-command-persistence-v1.js";
import {decideWhatsappMessageOrigin} from "./message-origin-router-v1.js";

const cleanBase=v=>String(v||"").trim().replace(/\/+$/,"");

async function getJson(baseUrl,secret,path,params){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("MESSAGE_ORIGIN_DB_CONFIG_MISSING");
  const u=new URL(`${base}/rest/v1/${path}`);
  for(const [k,v] of Object.entries(params||{})) if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:{apikey:secret,Accept:"application/json"}});
  const raw=await r.text();
  let body=null;
  try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
  if(!r.ok)throw new Error(`MESSAGE_ORIGIN_DB_HTTP_${r.status}`);
  return Array.isArray(body)?body:[];
}

export function createWhatsappOriginResolver({baseUrl,secret}){
  const owner=createOwnerCommandPersistence({baseUrl,secret});
  return {
    async resolve({externalAccountId,senderWaId}){
      const channels=await getJson(baseUrl,secret,"business_channels",{
        select:"id,business_id,is_active",
        channel_type:"eq.whatsapp",
        external_account_id:`eq.${externalAccountId}`,
        is_active:"eq.true",
        limit:2
      });
      if(channels.length===0)return {ok:false,status:"DENIED",origin:"unknown",reason:"CHANNEL_NOT_ACTIVE"};
      if(channels.length!==1)return {ok:false,status:"CONFIG_REQUIRED",origin:"unknown",reason:"MULTIPLE_ACTIVE_CHANNELS"};
      const channel=channels[0];
      const memberResolution=await owner.resolveMember({senderWaId,businessId:channel.business_id});
      return decideWhatsappMessageOrigin({
        businessContext:{active:true,businessId:channel.business_id,channelId:channel.id},
        memberResolution
      });
    }
  };
}

export async function dispatchAssistantWhatsappMessage(input,{originResolver,processCustomer,processOwner}){
  if(!originResolver||!processCustomer||!processOwner)throw new Error("MESSAGE_DISPATCH_DEPENDENCY_MISSING");
  const route=await originResolver.resolve({
    externalAccountId:input.externalAccountId,
    senderWaId:input.senderWaId
  });
  if(route?.ok!==true)return {ok:false,stage:"origin",route};

  if(route.origin==="owner"){
    const owner=await processOwner({
      ...input,
      businessId:route.businessId,
      channelId:route.channelId,
      memberId:route.memberId,
      originVerified:route.identityVerified===true
    });
    return {ok:owner?.ok===true,stage:"owner",route,owner};
  }

  if(route.origin==="customer"){
    const customer=await processCustomer(input);
    return {ok:customer?.ok===true,stage:"customer",route,customer};
  }

  return {ok:false,stage:"origin",route:{...route,reason:"ORIGIN_NOT_SUPPORTED"}};
}
