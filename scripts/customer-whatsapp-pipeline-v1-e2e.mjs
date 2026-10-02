import {processCustomerWhatsappMessage} from "../lib/customer-whatsapp-pipeline-v1.js";

const replay=await processCustomerWhatsappMessage({
  externalAccountId:"wa-phone-id-ingest-test",
  senderWaId:"+39 333 123 4567",
  externalMessageId:"wamid-test-match-3",
  normalizedText:"TESTO CAMBIATO CHE NON DEVE ESSERE REINTERPRETATO",
  occurredAt:"2026-10-02T16:11:00+02:00",
  contentType:"text",
  payload:{fixture:"customer-ingest-v1",case:"full_pipeline_match_replay"}
});

if(replay?.ok!==true)throw new Error("PIPELINE_REPLAY_NOT_OK_"+JSON.stringify(replay));
if(replay.ingest?.status!=="EVENT_EXISTS")throw new Error("PIPELINE_REPLAY_INGEST_STATUS");
if(replay.ingest?.event_id!=="27c0002d-131e-4a66-804e-f5776058832d")throw new Error("PIPELINE_REPLAY_EVENT_CHANGED");
if(replay.ingest?.contact_id!=="a96f8f18-1299-446d-a9e9-5cb9301570cf")throw new Error("PIPELINE_REPLAY_CONTACT_CHANGED");
if(replay.routing?.replayed!==true)throw new Error("PIPELINE_REPLAY_ROUTING_FALSE");
if(replay.routing?.routing_decision_created!==false)throw new Error("PIPELINE_REPLAY_DECISION_CREATED");
if(replay.routing?.work_links_created_count!==0)throw new Error("PIPELINE_REPLAY_LINK_CREATED");
if(!replay.routing?.routing_decision_id)throw new Error("PIPELINE_REPLAY_DECISION_MISSING");

console.log("CUSTOMER_WHATSAPP_PIPELINE_REPLAY_PASS");
