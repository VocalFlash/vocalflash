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
