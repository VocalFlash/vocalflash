import assert from "node:assert/strict";
import {createCustomerWhatsappIngest} from "../lib/customer-whatsapp-ingest-v1.js";

const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async (_url,options)=>{
  calls.push(options.headers);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,business_id:"b",event_id:"e"})};
};
try{
  const input={externalAccountId:"a",senderWaId:"39",externalMessageId:"m",normalizedText:"test"};
  await createCustomerWhatsappIngest({baseUrl:"https://example.supabase.co",secret:"sb_secret_test"}).ingest(input);
  assert.equal(calls[0].apikey,"sb_secret_test");
  assert.equal("Authorization" in calls[0],false);

  const legacy="eyJlegacy.test.jwt";
  await createCustomerWhatsappIngest({baseUrl:"https://example.supabase.co",secret:legacy}).ingest(input);
  assert.equal(calls[1].apikey,legacy);
  assert.equal(calls[1].Authorization,`Bearer ${legacy}`);

  console.log("SUPABASE_SECRET_HEADER_COMPAT_V1_PASS 4/4");
}finally{globalThis.fetch=originalFetch;}
