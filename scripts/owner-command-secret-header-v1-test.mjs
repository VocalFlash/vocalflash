import assert from "node:assert/strict";
import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";

const originalFetch=globalThis.fetch;
let captured=null;
globalThis.fetch=async (url,options)=>{
  captured={url:String(url),options};
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:false,status:"NOT_VERIFIED"})};
};

try{
  const p=createOwnerCommandPersistence({baseUrl:"https://example.supabase.co",secret:"sb_secret_test_only"});
  await p.resolveMember({senderWaId:"393331234567",businessId:null});
  assert.equal(captured.options.headers.apikey,"sb_secret_test_only");
  assert.equal("Authorization" in captured.options.headers,false);
  assert.equal(captured.options.method,"POST");
  console.log("OWNER_COMMAND_SECRET_HEADER_V1_PASS 3/3");
}finally{
  globalThis.fetch=originalFetch;
}
