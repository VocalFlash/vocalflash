import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {evaluateCommand} from "../lib/owner-command-policy-v1.js";
if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
function context(workItems){return {
 businessId:"business-A",originVerified:true,receivedAt:"2026-10-02T08:00:00+02:00",now:"2026-10-02T08:30:00+02:00",timezone:"Europe/Rome",
 member:{id:"member-A",businessId:"business-A",verified:true,active:true,sharedAccount:false,permissions:["consult","add_note","schedule_action"],workItemIds:workItems.map(x=>x.id)},
 workItems:workItems.map(x=>({...x,businessId:"business-A",writable:true})),
 policiesByWorkItem:Object.fromEntries(workItems.map(x=>[x.id,{consult:["auto"],add_note:["auto"],schedule_action:["auto"]}]))
};}
async function run(name,message,ctx,check){
 const ai=await interpretOwnerCommand({message,context:ctx,openAiApiKey:process.env.OPENAI_API_KEY});
 const out=evaluateCommand(ai.result,ctx);
 console.log(name,JSON.stringify({ai:ai.result,out}));
 if(!check(ai.result,out))throw new Error(name);
}
const rossi=context([{id:"work-A",label:"Pratica Rossi"}]);
await run("C09_NO_WORK_ITEM_NOT_INVENTED","Ricordami di chiamare il commercialista",rossi,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="schedule_action"&&ai.units[0].candidateIds.length===0&&out.units[0].reason==="WORK_ITEM_REQUIRED");
const onlyA=context([{id:"work-A",label:"Immobile Rossi - Via Etnea"}]);
await run("C14_INACCESSIBLE_TARGET_NOT_EXPOSED","Mostrami i dati della pratica Bianchi di Via Roma",onlyA,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="consult"&&ai.units[0].candidateIds.length===0&&out.units[0].reason==="WORK_ITEM_REQUIRED");
console.log("C09_C14_PASS 2/2");
