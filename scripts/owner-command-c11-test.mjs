import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {planOwnerCommand,executeOwnerCommandPlan} from "../lib/owner-command-orchestrator-v1.js";

if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");

const context={
  businessId:"business-A",
  originVerified:true,
  receivedAt:"2026-10-02T11:00:00+02:00",
  now:"2026-10-02T11:05:00+02:00",
  timezone:"Europe/Rome",
  member:{
    id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,
    permissions:["consult","add_note","schedule_action"],
    workItemIds:["rossi","bianchi-a","bianchi-b"]
  },
  workItems:[
    {id:"rossi",businessId:"business-A",label:"Prenotazione Rossi",writable:true},
    {id:"bianchi-a",businessId:"business-A",label:"Bianchi - evento aziendale",writable:true},
    {id:"bianchi-b",businessId:"business-A",label:"Bianchi - cena privata",writable:true}
  ],
  policiesByWorkItem:{
    "rossi":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]},
    "bianchi-a":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]},
    "bianchi-b":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}
  }
};

const ai=await interpretOwnerCommand({
  message:"Segna 25 persone per Rossi e ricordami domani di chiamare Bianchi",
  context,
  openAiApiKey:process.env.OPENAI_API_KEY
});

if(ai.result.units.length<2)throw new Error("C11_NOT_DECOMPOSED");

const note=ai.result.units.find(u=>u.intent==="add_note");
const reminder=ai.result.units.find(u=>u.intent==="schedule_action");
if(!note||!reminder)throw new Error("C11_INTENTS_WRONG");
if(!(note.candidateIds.length===1&&note.candidateIds[0]==="rossi"))throw new Error("C11_ROSSI_TARGET_WRONG");
if(!(reminder.candidateIds.includes("bianchi-a")&&reminder.candidateIds.includes("bianchi-b")&&reminder.candidateIds.length===2))throw new Error("C11_BIANCHI_NOT_AMBIGUOUS");

const plan=planOwnerCommand(ai.result,context);
if(plan.status!=="NOT_READY"||plan.writes_performed!==false)throw new Error("C11_PLAN_NOT_BLOCKED");

let persistenceCalled=false;
const persistence={
  commitNote(){persistenceCalled=true;throw new Error("C11_PARTIAL_NOTE_WRITE");},
  commitScheduleAction(){persistenceCalled=true;throw new Error("C11_PARTIAL_ACTION_WRITE");}
};
const executed=await executeOwnerCommandPlan(plan,{
  persistence,sourceEventId:"source",businessId:"business-A",memberId:"member-A"
});
if(persistenceCalled||executed.writes_performed!==false)throw new Error("C11_PARTIAL_WRITE_OCCURRED");

console.log("OWNER_COMMAND_C11_NO_PARTIAL_WRITE_PASS");
