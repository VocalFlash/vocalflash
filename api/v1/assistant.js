import {processCustomerWhatsappMessage} from "../../lib/customer-whatsapp-pipeline-v1.js";

function assistantKeys(){
  return (process.env.VOCALFLASH_ASSISTANT_API_KEYS||"")
    .split(",")
    .map(v=>v.trim())
    .filter(Boolean);
}

function clean(v,max=12000){
  if(typeof v!=="string")return "";
  return v.trim().slice(0,max);
}

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

  const externalAccountId=clean(req.body?.external_account_id,256);
  const senderWaId=clean(req.body?.sender_wa_id,64);
  const externalMessageId=clean(req.body?.external_message_id,256);
  const normalizedText=clean(req.body?.normalized_text,12000);
  const occurredAt=clean(req.body?.occurred_at,64)||null;
  const contentType=clean(req.body?.content_type,32)||"text";

  if(!externalAccountId||!senderWaId||!externalMessageId||!normalizedText){
    return res.status(400).json({
      error:"external_account_id, sender_wa_id, external_message_id e normalized_text sono obbligatori"
    });
  }

  try{
    const result=await processCustomerWhatsappMessage({
      externalAccountId,
      senderWaId,
      externalMessageId,
      normalizedText,
      occurredAt,
      contentType,
      payload:{source:"internal_assistant_api"}
    });

    if(result?.ok!==true){
      const status=result?.stage==="ingest"?422:500;
      return res.status(status).json({
        ok:false,
        mode:"customer_assistant_v1",
        stage:result?.stage||"unknown",
        result
      });
    }

    return res.status(200).json({
      ok:true,
      mode:"customer_assistant_v1",
      ingest:result.ingest,
      routing:result.routing
    });
  }catch(error){
    console.error("[VF CUSTOMER ASSISTANT V1] error",error?.message||"unknown");
    return res.status(500).json({
      ok:false,
      mode:"customer_assistant_v1",
      error:"Customer Assistant V1 failed"
    });
  }
}
