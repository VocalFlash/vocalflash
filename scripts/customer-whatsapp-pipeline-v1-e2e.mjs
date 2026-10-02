import {processCustomerWhatsappMessage} from "../lib/customer-whatsapp-pipeline-v1.js";

const common={
  externalAccountId:"wa-phone-id-ingest-test",
  senderWaId:"+39 333 123 4567",
  externalMessageId:"wamid-test-match-3",
  normalizedText:"Ti mando la foto della cerniera della persiana che mi avevi chiesto.",
  occurredAt:"2026-10-02T16:10:00+02:00",
  contentType:"text",
  payload:{fixture:"customer-ingest-v1",case:"full_pipeline_match"}
};

const first=await processCustomerWhatsappMessage(common);
if(first?.ok!==true)throw new Error("PIPELINE_FIRST_NOT_OK_"+JSON.stringify(first));
if(first.ingest?.status!=="EVENT_RECORDED")throw new Error("PIPELINE_FIRST_INGEST");
if(first.ingest?.contact_id!=="a96f8f18-1299-446d-a9e9-5cb9301570cf")throw new Error("PIPELINE_WRONG_CONTACT");
if(first.routing?.replayed!==false)throw new Error("PIPELINE_FIRST_ROUTING_REPLAY");
if(first.routing?.units?.length!==1)throw new Error("PIPELINE_UNIT_COUNT");
if(first.routing.units[0]?.resolver?.decision!=="MATCH")throw new Error("PIPELINE_NOT_MATCH");
if(first.routing.units[0]?.resolver?.work_item_id!=="41444444-4444-4444-8444-444444444444")throw new Error("PIPELINE_WRONG_WORK");
if(first.routing?.work_links_created_count!==1)throw new Error("PIPELINE_LINK_COUNT");

const retry=await processCustomerWhatsappMessage({
  ...common,
  normalizedText:"TESTO CAMBIATO CHE NON DEVE ESSERE REINTERPRETATO",
  occurredAt:"2026-10-02T16:11:00+02:00"
});
if(retry?.ok!==true)throw new Error("PIPELINE_RETRY_NOT_OK");
if(retry.ingest?.status!=="EVENT_EXISTS"||retry.ingest?.event_id!==first.ingest?.event_id)throw new Error("PIPELINE_RETRY_INGEST");
if(retry.routing?.replayed!==true)throw new Error("PIPELINE_RETRY_ROUTING");
if(retry.routing?.routing_decision_created!==false)throw new Error("PIPELINE_RETRY_DECISION");
if(retry.routing?.work_links_created_count!==0)throw new Error("PIPELINE_RETRY_LINK");

console.log("CUSTOMER_WHATSAPP_PIPELINE_V1_PASS");
// retrigger: same assertions, no functional change
