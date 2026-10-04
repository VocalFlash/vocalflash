const cleanBase=v=>String(v||"").trim().replace(/\/+$/,"");

async function rpc(baseUrl,secret,name,args){
  const base=cleanBase(baseUrl);
  if(!base||!secret)throw new Error("CUSTOMER_INGEST_DB_CONFIG_MISSING");
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{
      apikey:secret,
      ...(String(secret).startsWith("sb_secret_")?{}:{Authorization:`Bearer ${secret}`}),
      "Content-Type":"application/json",
      Accept:"application/json"
    },
    body:JSON.stringify(args)
  });
  const raw=await r.text();
  let body=null;
  try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
  if(!r.ok)throw new Error(`CUSTOMER_INGEST_RPC_HTTP_${r.status}`);
  return body;
}

export function createCustomerWhatsappIngest({baseUrl,secret}){
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
      });
    }
  };
}
