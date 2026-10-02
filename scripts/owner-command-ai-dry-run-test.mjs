import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {evaluateCommand} from "../lib/owner-command-policy-v1.js";

if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
const B="business-A",M="member-A",A="work-A";
function context(workItems){return {
 businessId:B,originVerified:true,receivedAt:"2026-10-02T08:00:00+02:00",now:"2026-10-02T08:30:00+02:00",timezone:"Europe/Rome",
 member:{id:M,businessId:B,verified:true,active:true,sharedAccount:false,permissions:["consult","add_note","schedule_action"],workItemIds:workItems.map(x=>x.id)},
 workItems:workItems.map(x=>({...x,businessId:B,writable:true})),
 policiesByWorkItem:Object.fromEntries(workItems.map(x=>[x.id,{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}]))
};}
async function run(name,message,ctx,check){
 const ai=await interpretOwnerCommand({message,context:ctx,openAiApiKey:process.env.OPENAI_API_KEY});
 const out=evaluateCommand(ai.result,ctx);
 if(!check(ai.result,out))throw new Error(name);
 console.log("PASS",name,JSON.stringify({units:ai.result.units.map(u=>({intent:u.intent,candidateIds:u.candidateIds,dueAt:u.dueAt})),status:out.status}));
}
const rossi=context([{id:A,label:"Pratica Rossi"}]);
await run("C07_RELATIVE_TIME_ORIGINAL_TIMESTAMP","Ricordami domani alle 10 di chiamare Rossi",rossi,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="schedule_action"&&ai.units[0].dueAt==="2026-10-03T10:00:00+02:00"&&out.status==="ELIGIBLE");
await run("C09_NO_WORK_ITEM_NOT_INVENTED","Ricordami di chiamare il commercialista",rossi,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="schedule_action"&&ai.units[0].candidateIds.length===0&&out.units[0].reason==="WORK_ITEM_REQUIRED");
const onlyA=context([{id:A,label:"Immobile Rossi - Via Etnea"}]);
await run("C14_INACCESSIBLE_TARGET_NOT_EXPOSED","Mostrami i dati della pratica Bianchi di Via Roma",onlyA,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="consult"&&ai.units[0].candidateIds.length===0&&out.units[0].reason==="WORK_ITEM_REQUIRED");
console.log("OWNER_COMMAND_AI_DRY_RUN_BATCH2_PASS 3/3");
