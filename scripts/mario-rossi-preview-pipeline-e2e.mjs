import {createWhatsappOriginResolver,dispatchAssistantWhatsappMessage} from "../lib/assistant-whatsapp-dispatch-v1.js";
import {processCustomerWhatsappMessage} from "../lib/customer-whatsapp-pipeline-v1.js";

const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
if(!baseUrl||!secret)throw new Error("MARIO_PIPELINE_DB_CONFIG_MISSING");

const result=await dispatchAssistantWhatsappMessage({
  externalAccountId:"1318571384677144",
  senderWaId:"390000000000",
  externalMessageId:"vf-test-mario-003",
  normalizedText:"Confermo che domani mattina posso essere richiamato tra le 09:00 e le 11:00.",
  contentType:"text",
  payload:{fixture:true,fixture_key:"mario_rossi_customer_test_v1",source:"preview_pipeline_e2e"}
},{
  originResolver:createWhatsappOriginResolver({baseUrl,secret}),
  processCustomer:processCustomerWhatsappMessage,
  processOwner:async()=>{throw new Error("MARIO_TEST_MUST_NOT_ROUTE_TO_OWNER");}
});

if(result?.ok!==true)throw new Error("MARIO_PIPELINE_NOT_OK_"+String(result?.stage||"unknown"));
if(result?.route?.origin!=="customer")throw new Error("MARIO_PIPELINE_WRONG_ORIGIN");
if(result?.customer?.stage!=="complete")throw new Error("MARIO_PIPELINE_CUSTOMER_NOT_COMPLETE");

console.log("MARIO_ROSSI_PREVIEW_PIPELINE_E2E_PASS");
console.log("MARIO_ROUTE_ORIGIN="+result.route.origin);
console.log("MARIO_INGEST_STATUS="+String(result.customer.ingest?.status||"unknown"));
console.log("MARIO_ROUTING_STATUS="+String(result.customer.routing?.status||result.customer.routing?.result?.status||"ok"));
