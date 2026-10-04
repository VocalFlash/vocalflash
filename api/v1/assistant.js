import {processCustomerWhatsappMessage} from "../../lib/customer-whatsapp-pipeline-v1.js";
import {createWhatsappOriginResolver,dispatchAssistantWhatsappMessage} from "../../lib/assistant-whatsapp-dispatch-v1.js";
import {processOwnerCommandMessage} from "../../lib/owner-command-runtime-v1.js";
import {createOwnerRuntimeDependencies} from "../../lib/owner-command-runtime-adapter-v1.js";

function assistantKeys(){
  return (process.env.VOCALFLASH_ASSISTANT_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean);
}
function clean(v,max=12000){return typeof v==="string"?v.trim().slice(0,max):"";}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","X-VocalFlash-Assistant-Key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"Usa POST"});

  const key=req.headers["x-vocalflash-assistant-key"];
  const valid=assistantKeys();
  if(!key||typeof key!=="string"||valid.length===0||!valid.includes(key)){
    return res.status(401).json({error:"Assistant API Key non valida"});
  }

  const action=clean(req.body?.action,64);
  if(action==="health")return res.status(200).json({ok:true,action,auth:true});

  const input={
    externalAccountId:clean(req.body?.external_account_id,256),
    senderWaId:clean(req.body?.sender_wa_id,64),
    externalMessageId:clean(req.body?.external_message_id,256),
    normalizedText:clean(req.body?.normalized_text,12000),
    occurredAt:clean(req.body?.occurred_at,64)||null,
    contentType:clean(req.body?.content_type,32)||"text",
    payload:{source:"internal_assistant_api"}
  };
  if(!input.externalAccountId||!input.senderWaId||!input.externalMessageId||!input.normalizedText){
    return res.status(400).json({error:"external_account_id, sender_wa_id, external_message_id e normalized_text sono obbligatori"});
  }

  const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
  const apiSecret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  const openAiApiKey=process.env.OPENAI_API_KEY;
  if(!baseUrl||!apiSecret)return res.status(503).json({ok:false,stage:"config",error:"Assistant DB non configurato"});

  try{
    const originResolver=createWhatsappOriginResolver({baseUrl,secret:apiSecret});
    const ownerDeps=createOwnerRuntimeDependencies({baseUrl,apiSecret,openAiApiKey});
    const result=await dispatchAssistantWhatsappMessage(input,{
      originResolver,
      processCustomer:processCustomerWhatsappMessage,
      processOwner:x=>processOwnerCommandMessage({...x,now:new Date().toISOString()},ownerDeps)
    });

    if(result?.ok!==true){
      const status=result?.stage==="origin"?422:500;
      return res.status(status).json({ok:false,mode:"assistant_whatsapp_dispatch_v1",stage:result?.stage||"unknown",result});
    }
    return res.status(200).json({ok:true,mode:"assistant_whatsapp_dispatch_v1",origin:result.route?.origin,result});
  }catch(error){
    console.error("[VF ASSISTANT DISPATCH V1] error",error?.message||"unknown");
    return res.status(500).json({ok:false,mode:"assistant_whatsapp_dispatch_v1",error:"Assistant dispatch failed"});
  }
}
