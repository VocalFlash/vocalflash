import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {evaluateCommand} from "../lib/owner-command-policy-v1.js";
if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
const ctx={businessId:"business-A",originVerified:true,receivedAt:"2026-10-02T08:00:00+02:00",now:"2026-10-02T08:30:00+02:00",timezone:"Europe/Rome",
member:{id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,permissions:["consult","add_note","schedule_action"],workItemIds:["work-A"]},
workItems:[{id:"work-A",label:"Immobile Rossi - Via Etnea",businessId:"business-A",writable:true}],
policiesByWorkItem:{"work-A":{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}}};
const ai=await interpretOwnerCommand({message:"Mostrami i dati della pratica Bianchi di Via Roma",context:ctx,openAiApiKey:process.env.OPENAI_API_KEY});
const out=evaluateCommand(ai.result,ctx);
console.log("C14_RESULT",JSON.stringify({ai:ai.result,out}));
if(!(ai.result.units.length===1&&ai.result.units[0].intent==="consult"&&ai.result.units[0].candidateIds.length===0&&out.units[0].reason==="WORK_ITEM_REQUIRED"))throw new Error("C14_INACCESSIBLE_TARGET_NOT_EXPOSED");
console.log("C14_PASS");
