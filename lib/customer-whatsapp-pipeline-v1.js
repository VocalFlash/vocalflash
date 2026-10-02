import {createCustomerWhatsappIngest} from "./customer-whatsapp-ingest-v1.js";
import routingProcessor from "./event-routing-processor-v2.js";

function capture(){
  const c={statusCode:200,body:null};
  const res={setHeader(){return res;},status(x){c.statusCode=x;return res;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
  return {res,c};
}

export async function processCustomerWhatsappMessage(input){
  const baseUrl=input?.baseUrl||process.env.VF_ASSISTANT_SUPABASE_URL;
  const secret=input?.secret||process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  const apiKey=input?.apiKey||(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
  if(!baseUrl||!secret||!apiKey)throw new Error("CUSTOMER_PIPELINE_CONFIG_MISSING");

  const ingest=createCustomerWhatsappIngest({baseUrl,secret});
  const persisted=await ingest.ingest({
    externalAccountId:input.externalAccountId,
    senderWaId:input.senderWaId,
    externalMessageId:input.externalMessageId,
    normalizedText:input.normalizedText,
    occurredAt:input.occurredAt||null,
    contentType:input.contentType||"text",
    payload:input.payload||{}
  });

  if(persisted?.ok!==true||!persisted?.business_id||!persisted?.event_id){
    return {ok:false,stage:"ingest",ingest:persisted,routing:null};
  }

  const {res,c}=capture();
  await routingProcessor({
    method:"POST",
    headers:{"x-api-key":apiKey},
    body:{business_id:persisted.business_id,event_id:persisted.event_id}
  },res);

  if(c.statusCode!==200){
    return {ok:false,stage:"routing",ingest:persisted,routing:c.body,routing_status:c.statusCode};
  }

  return {ok:true,stage:"complete",ingest:persisted,routing:c.body};
}
