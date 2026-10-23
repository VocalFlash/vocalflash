import {supabaseRestHeaders} from "./supabase-rest-headers-v1.js";

const cleanBase=v=>String(v||"").trim().replace(/\\/+$/, "");

async function rpc(baseUrl,secret,name,args,fetchImpl){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("CUSTOMER_INGEST_DB_CONFIG_MISSING");
  const r=await fetchImpl(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:supabaseRestHeaders(secret,{contentType:true}),
    body:JSON.stringify(args)
  });
  const raw=await r.text();
  let body=null;
  try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
  if(!r.ok)throw new Error(`CUSTOMER_INGEST_RPC_HTTP_${r.status}`);
  return body;
}

export function createCustomerWhatsappIngest({baseUrl,secret,fetchImpl=fetch}){
  return {
    ingest(input){
      return rpc(baseUrl,secret,"vf_ingest_customer_whatsapp_event_v1",{
        p_external_account_id:input.externalAccountId,
        p_sender_wa_id:input.senderWaId,
        p_external_message_id:input.externalMessageId,
        p_normalized_text:input.normalizedText,
        p_occurred_at:input.occurredAt||null,
        p_content_type:input.contentType||"text",
        p_payload:input.payload||{}
      },fetchImpl);
    }
  };
}
