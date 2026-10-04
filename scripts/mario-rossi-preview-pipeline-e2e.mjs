import {createWhatsappOriginResolver,dispatchAssistantWhatsappMessage} from "../lib/assistant-whatsapp-dispatch-v1.js";
import {processCustomerWhatsappMessage} from "../lib/customer-whatsapp-pipeline-v1.js";

const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
if(!baseUrl||!secret)throw new Error("MARIO_PIPELINE_DB_CONFIG_MISSING");
const originResolver=createWhatsappOriginResolver({baseUrl,secret});
const deps={
  originResolver,
  processCustomer:processCustomerWhatsappMessage,
  processOwner:async()=>{throw new Error("MARIO_TEST_MUST_NOT_ROUTE_TO_OWNER");}
};
async function run(externalMessageId,normalizedText){
  const result=await dispatchAssistantWhatsappMessage({
    externalAccountId:"1318571384677144",senderWaId:"390000000000",
    externalMessageId,normalizedText,contentType:"text",
    payload:{fixture:true,fixture_key:"mario_rossi_customer_test_v1",source:"preview_pipeline_e2e"}
  },deps);
  if(result?.ok!==true)throw new Error("MARIO_PIPELINE_NOT_OK_"+String(result?.stage||"unknown"));
  if(result?.route?.origin!=="customer")throw new Error("MARIO_PIPELINE_WRONG_ORIGIN");
  if(result?.customer?.stage!=="complete")throw new Error("MARIO_PIPELINE_CUSTOMER_NOT_COMPLETE");
  return result;
}
const continuation=await run(
  "vf-test-mario-003",
  "Confermo che domani mattina posso essere richiamato tra le 09:00 e le 11:00."
);
const separate=await run(
  "vf-test-mario-004",
  "Ho anche una richiesta diversa: vorrei un preventivo per rifare completamente il bagno di un altro immobile."
);
console.log("MARIO_ROSSI_PREVIEW_PIPELINE_TWO_SCENARIOS_PASS");
console.log("MARIO_CONTINUATION_INGEST="+String(continuation.customer.ingest?.status||"unknown"));
console.log("MARIO_SEPARATE_INGEST="+String(separate.customer.ingest?.status||"unknown"));
