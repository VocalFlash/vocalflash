import test from "node:test";
import assert from "node:assert/strict";
import {processCustomerWhatsappMessage} from "./customer-whatsapp-pipeline-v1.js";

const input = {
  baseUrl:"https://supabase.example",
  secret:"test-secret",
  apiKey:"test-api-key",
  externalAccountId:"wa-business-account",
  senderWaId:"393331234567",
  externalMessageId:"wamid.test.1",
  normalizedText:"Il rubinetto perde"
};

function dependencies({ingestResult,routingStatus=200,routingBody={units:[]},coordinatorResult,coordinatorError,trace=[]}={}){
  return {
    createIngest:()=>({ingest:async value=>{trace.push(["ingest",value]);return ingestResult??{ok:true,business_id:"business-1",event_id:"event-1"};}}),
    routingProcessor:async(req,res)=>{
      trace.push(["routing",req.body]);
      res.status(routingStatus).json(routingBody);
    },
    processNewWorkFromRouting:async value=>{
      trace.push(["coordinator",value]);
      if(coordinatorError)throw coordinatorError;
      return coordinatorResult??{ok:true,status:"NO_NEW_WORK_TO_PROCESS",writes_performed:false};
    },
    buildCustomerAssistantReply:({routing,newWork})=>{
      trace.push(["reply",newWork.status]);
      return "Risposta di test";
    }
  };
}

test("runs ingest, routing, coordinator, and reply in order",async()=>{
  const trace=[];
  const deps=dependencies({trace,routingBody:{units:[{unit_id:"u1"}]},coordinatorResult:{ok:true,status:"WORK_ITEM_CREATED",writes_performed:true}});
  const result=await processCustomerWhatsappMessage(input,deps);
  assert.equal(result.ok,true);
  assert.equal(result.stage,"complete");
  assert.equal(result.assistant_message,"Risposta di test");
  assert.deepEqual(trace.map(x=>x[0]),["ingest","routing","coordinator","reply"]);
  assert.deepEqual(trace[1][1],{business_id:"business-1",event_id:"event-1"});
});

test("does not route or run coordinator when ingestion fails",async()=>{
  const trace=[];
  const result=await processCustomerWhatsappMessage(input,dependencies({
    trace,ingestResult:{ok:false,status:"REPLAY_CONFLICT",reason:"MESSAGE_REPLAY_MISMATCH"}
  }));
  assert.equal(result.ok,false);
  assert.equal(result.stage,"ingest");
  assert.equal(result.ingest.status,"REPLAY_CONFLICT");
  assert.deepEqual(trace.map(x=>x[0]),["ingest"]);
});

test("does not run coordinator when routing fails",async()=>{
  const trace=[];
  const result=await processCustomerWhatsappMessage(input,dependencies({
    trace,routingStatus:503,routingBody:{error:"routing unavailable"}
  }));
  assert.equal(result.ok,false);
  assert.equal(result.stage,"routing");
  assert.equal(result.routing_status,503);
  assert.deepEqual(trace.map(x=>x[0]),["ingest","routing"]);
});

test("preserves successful ingest and routing when coordinator throws",async()=>{
  const trace=[];
  const sensitiveError="temporary failure https://db.internal.example/rest/v1?apikey=secret-value";
  const result=await processCustomerWhatsappMessage(input,dependencies({
    trace,routingBody:{units:[]},coordinatorError:new Error(sensitiveError)
  }));
  assert.equal(result.ok,true);
  assert.equal(result.stage,"complete");
  assert.equal(result.new_work.status,"COORDINATOR_ERROR");
  assert.equal(result.new_work.writes_performed,false);
  assert.equal(result.new_work.reason,"NEW_WORK_COORDINATOR_FAILED");
  assert.equal(result.new_work.error_type,"Error");
  assert.equal(JSON.stringify(result).includes(sensitiveError),false);
  assert.equal(JSON.stringify(result).includes("secret-value"),false);
  assert.equal(result.assistant_message,"Risposta di test");
  assert.deepEqual(trace.map(x=>x[0]),["ingest","routing","coordinator","reply"]);
});

test("fails closed when required service configuration is missing",async()=>{
  await assert.rejects(
    processCustomerWhatsappMessage({...input,apiKey:""},dependencies()),
    /CUSTOMER_PIPELINE_CONFIG_MISSING/
  );
});


import {createCustomerWhatsappIngest} from "./customer-whatsapp-ingest-v1.js";
import {createNewWorkPersistence} from "./new-work-persistence-v1.js";

function fakeResponse({ok=true,status=200,body={ok:true}}={}) {
  return {
    ok,
    status,
    async text(){ return typeof body === "string" ? body : JSON.stringify(body); }
  };
}

test("customer ingest uses Supabase REST headers and returns sanitized HTTP errors", async () => {
  let request;
  const ingest = createCustomerWhatsappIngest({
    baseUrl:"https://supabase.example/",
    secret:"sb_secret_test",
    fetchImpl:async (url,options) => {
      request={url:String(url),options};
      return fakeResponse({ok:false,status:403,body:{message:"secret-value private detail"}});
    }
  });
  await assert.rejects(
    ingest.ingest({
      externalAccountId:"account-1",
      senderWaId:"sender-1",
      externalMessageId:"message-1",
      normalizedText:"rubinetto perde"
    }),
    error => {
      assert.equal(error.message,"CUSTOMER_INGEST_RPC_HTTP_403");
      assert.equal(error.message.includes("secret-value"),false);
      return true;
    }
  );
  assert.equal(request.url,"https://supabase.example/rest/v1/rpc/vf_ingest_customer_whatsapp_event_v1");
  assert.equal(request.options.headers.apikey,"sb_secret_test");
  assert.equal("Authorization" in request.options.headers,false);
});

test("new-work persistence uses Supabase REST headers and does not expose RPC error bodies", async () => {
  let request;
  const persistence = createNewWorkPersistence({
    baseUrl:"https://supabase.example",
    secret:"sb_secret_test",
    fetchImpl:async (url,options) => {
      request={url:String(url),options};
      return fakeResponse({ok:false,status:500,body:{message:"private database details secret-value"}});
    }
  });
  await assert.rejects(
    persistence.commit({
      businessId:"business-1",
      eventId:"event-1",
      unitId:"unit-1",
      workflowId:"workflow-1",
      providedData:[]
    }),
    error => {
      assert.equal(error.message,"NEW_WORK_RPC_vf_commit_new_work_item_v1_HTTP_500");
      assert.equal(error.message.includes("secret-value"),false);
      return true;
    }
  );
  assert.equal(request.url,"https://supabase.example/rest/v1/rpc/vf_commit_new_work_item_v1");
  assert.equal(request.options.headers.apikey,"sb_secret_test");
  assert.equal("Authorization" in request.options.headers,false);
});

test("new-work persistence keeps modern secret key out of Bearer authorization", async () => {
  let headers;
  const persistence = createNewWorkPersistence({
    baseUrl:"https://supabase.example",
    secret:"sb_secret_test",
    fetchImpl:async (_url,options) => {
      headers=options.headers;
      return fakeResponse({body:{status:"WORK_ITEM_CREATED",work_item_id:"work-1"}});
    }
  });
  const result = await persistence.commit({
    businessId:"business-1",
    eventId:"event-1",
    unitId:"unit-1",
    workflowId:"workflow-1",
    providedData:[]
  });
  assert.equal(result.status,"WORK_ITEM_CREATED");
  assert.equal(headers.apikey,"sb_secret_test");
  assert.equal("Authorization" in headers,false);
});
