import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {evaluateCommand} from "../lib/owner-command-policy-v1.js";
if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
const ctx={businessId:"business-A",originVerified:true,receivedAt:"2026-10-02T08:00:00+02:00",now:"2026-10-02T08:30:00+02:00",timezone:"Europe/Rome",
member:{id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,permissions:["consult","add_note","schedule_action"],workItemIds:["work-A"]},
workItems:[{id:"work-A",label:"Pratica Rossi",businessId:"business-A",writable:true}],
policiesByWorkItem:{"work-A":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}}};
const ai=await interpretOwnerCommand({message:"Ricordami domani alle 10 di chiamare Rossi",context:ctx,openAiApiKey:process.env.OPENAI_API_KEY});
const out=evaluateCommand(ai.result,ctx);
console.log("C07_RESULT",JSON.stringify({ai:ai.result,status:out.status,units:out.units}));
if(!(ai.result.units.length===1&&ai.result.units[0].intent==="schedule_action"&&ai.result.units[0].dueAt==="2026-10-03T10:00:00+02:00"&&out.status==="ELIGIBLE"))throw new Error("C07_RELATIVE_TIME_ORIGINAL_TIMESTAMP");
console.log("C07_PASS");
