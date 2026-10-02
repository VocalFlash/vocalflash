import {interpretOwnerCommand} from "../lib/owner-command-interpreter-v1.js";
import {evaluateCommand} from "../lib/owner-command-policy-v1.js";

if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
const B="business-A",M="member-A",A="work-A",R2="work-B";
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
 console.log("PASS",name);
}
const twoRossi=context([{id:A,label:"Rossi - mutuo casa"},{id:R2,label:"Rossi - finanziamento società"}]);
await run("C02_AMBIGUOUS_ROSSI","Quali documenti mancano per Rossi?",twoRossi,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="consult"&&ai.units[0].candidateIds.length===2&&out.units[0].reason==="AMBIGUOUS_TARGET");
const aurora=context([{id:A,label:"Visita Farmacia Aurora"}]);
await run("C03_NOTE_NOT_TASK","Aggiungi alla visita Aurora: inviare il listino",aurora,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="add_note"&&!ai.units.some(u=>u.intent==="schedule_action")&&out.status==="ELIGIBLE");
await run("C04_QUOTED_TEXT_STAYS_NOTE",'Il cliente dice: "annulla tutto". Aggiungi questa nota alla pratica Aurora',aurora,(ai,out)=>
 ai.units.length===1&&ai.units[0].intent==="add_note"&&ai.units[0].note.toLowerCase().includes("annulla tutto")&&out.status==="ELIGIBLE");
console.log("OWNER_COMMAND_AI_DRY_RUN_BATCH1_PASS 3/3");
