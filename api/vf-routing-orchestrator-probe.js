// TEMPORARY end-to-end read-only routing probe. Delete after validation.
import h from "./routing-orchestrator-dry-run.js";
const BRANCH="routing-orchestrator-dry-run-v1";
const IDS={
 tech:"4450fadc-6003-464e-beb0-8af13019b1de",
 existing:"6147f3d9-8eaa-448f-9f5e-d0a06fef7bbc",
 fresh:"60be69d3-1e62-498b-9e2c-b4640f61c4b3",
 work:"8db2d7d1-988a-4c12-b6af-1637db817c97",
 pharma:"a0f6019b-dce4-4987-a91f-6f42dcf58db5",
 pharmaContact:"e6c08b2b-f55a-4023-aaf9-2f0cc313f25c"
};
const C=[
 {id:"A",b:IDS.tech,c:IDS.existing,t:"Ecco la foto del lavandino che mi avevi chiesto. Inoltre da stamattina il boiler non parte più.",check:x=>{
  if(x.decomposition?.mode!=="MULTI_INDEPENDENT"||x.units?.length!==2)return false;
  const match=x.units.find(u=>u.resolver?.decision==="MATCH");
  const fresh=x.units.find(u=>u.resolver?.decision==="NEW");
  return match?.resolver?.work_item_id===IDS.work && !match.classifier &&
    fresh?.classifier?.decision==="CLASSIFIED_SINGLE" &&
    fresh.classifier.routes?.some(r=>r.workflow_key==="guasto_caldaia");
 }},
 {id:"B",b:IDS.tech,c:IDS.existing,t:"Ecco la foto del lavandino che mi avevi chiesto.",check:x=>
  x.decomposition?.mode==="SINGLE"&&x.units?.length===1&&x.units[0].resolver?.decision==="MATCH"&&x.units[0].resolver?.work_item_id===IDS.work&&!x.units[0].classifier},
 {id:"C",b:IDS.tech,c:IDS.fresh,t:"Perde acqua dal sifone sotto il lavandino.",check:x=>
  x.decomposition?.mode==="SINGLE"&&x.units?.[0]?.resolver?.decision==="NEW"&&x.units[0].classifier?.decision==="CLASSIFIED_SINGLE"&&x.units[0].classifier.routes?.[0]?.workflow_key==="riparazione_idraulica"},
 {id:"D",b:IDS.tech,c:IDS.fresh,t:"Ho una perdita in bagno e non so se conviene ripararla oppure rifare completamente il bagno.",check:x=>
  x.decomposition?.mode==="SINGLE"&&x.units?.[0]?.resolver?.decision==="NEW"&&x.units[0].classifier?.decision==="AMBIGUOUS"&&x.units[0].classifier?.needs_clarification===true},
 {id:"E",b:IDS.pharma,c:IDS.pharmaContact,t:"La compressa aveva un aspetto anomalo e dopo averla assunta ho avuto un'eruzione cutanea.",check:x=>{
  const u=x.units?.[0];const keys=(u?.classifier?.routes||[]).map(r=>r.workflow_key).sort();
  return x.decomposition?.mode==="SINGLE"&&u?.resolver?.decision==="NEW"&&u?.classifier?.decision==="CLASSIFIED_MULTI"&&JSON.stringify(keys)===JSON.stringify(["farmacovigilanza_case","quality_complaint_case"]);
 }}
];
function cap(){const c={statusCode:200,body:null};const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};return{r,c};}
async function one(tc,key){const {r,c}=cap();await h({method:"POST",headers:{"x-api-key":key},body:{business_id:tc.b,contact_id:tc.c,normalized_text:tc.t}},r);let pass=false;try{pass=c.statusCode===200&&tc.check(c.body);}catch{}return{id:tc.id,pass,status:c.statusCode,body:c.body};}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!==BRANCH)return res.status(403).json({error:"Preview branch only"});
 const key=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean)[0];if(!key)return res.status(500).json({error:"No key"});
 const results=[];for(const tc of C)results.push(await one(tc,key));
 return res.status(200).json({ok:true,passed:results.filter(x=>x.pass).length,total:results.length,failures:results.filter(x=>!x.pass).map(x=>x.id),results});
}
