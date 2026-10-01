import writer from "../api/write-path-match-v1.js";

const apiKey=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
const base=(process.env.VF_ASSISTANT_SUPABASE_URL||"").replace(/\/+$/,"");
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||"";
if(!apiKey||!base||!secret) throw new Error("verification env missing");

const BIZ=[
 "b5a21511-cb99-40bc-a742-1c395f7a69d2",
 "be2e89d7-bb7f-4ed1-8c3a-6cef724ea078",
 "7ceb9e12-d746-45df-afb2-0f549274554d",
 "76c06164-2cdd-4763-98d3-e84c76d428a2"
];
const EVENTS={
 legal:"e895cf98-7314-4dfc-97b3-6d9b229cf8d3",
 narrative:"48e1501a-80ae-40d6-92b9-661db974e77a",
 ambiguous:"6ddab61a-650b-47cd-849c-94b0386f7624",
 mixed:"b7ae1efc-49ee-490a-842d-702cbd7b4834"
};

function assert(ok,msg){if(!ok)throw new Error(msg);}
async function db(table,params){
 const u=new URL(`${base}/rest/v1/${table}`);
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u,{headers:{apikey:secret,Accept:"application/json"}});
 const raw=await r.text();
 if(!r.ok)throw new Error(`DB ${table} ${r.status}: ${raw}`);
 return raw?JSON.parse(raw):[];
}
function capture(){
 const c={statusCode:200,body:null};
 const res={setHeader(){return res;},status(x){c.statusCode=x;return res;},json(x){c.body=x;return c;},send(x){c.body=x;return c;},end(){return c;}};
 return {res,c};
}
async function invoke(business_id,event_id){
 const {res,c}=capture();
 await writer({method:"POST",headers:{"x-api-key":apiKey},body:{business_id,event_id}},res);
 if(c.statusCode!==200)throw new Error(`writer replay HTTP ${c.statusCode}: ${JSON.stringify(c.body)}`);
 return c.body;
}

const decisions=await db("event_routing_decisions",{
 select:"id,business_id,event_id,pipeline_version,decision_payload",
 business_id:`in.(${BIZ.join(",")})`
});
assert(decisions.length===4,`expected 4 immutable decisions, got ${decisions.length}`);
const byEvent=Object.fromEntries(decisions.map(x=>[x.event_id,x]));
for(const id of Object.values(EVENTS))assert(byEvent[id],`missing decision for ${id}`);

const legal=byEvent[EVENTS.legal].decision_payload;
assert(legal.decomposition?.mode==="SINGLE","LEGAL mode");
assert(legal.units?.length===1&&legal.units[0].resolver?.decision==="MATCH","LEGAL decision");
assert(legal.units[0].resolver?.work_item_id==="64388afe-6eac-4698-9264-750b75b34975","LEGAL target");
assert(legal.units[0].write_eligible===true,"LEGAL eligibility");

const narrative=byEvent[EVENTS.narrative].decision_payload;
assert(narrative.decomposition?.mode==="SINGLE","NARRATIVE mode");
assert(narrative.units?.length===1&&narrative.units[0].resolver?.decision==="NEW","NARRATIVE expected NEW");
assert(narrative.units[0].write_eligible===false,"NARRATIVE must not be write eligible");

const ambiguous=byEvent[EVENTS.ambiguous].decision_payload;
assert(ambiguous.decomposition?.mode==="SINGLE","AMBIGUOUS mode");
assert(ambiguous.units?.length===1&&ambiguous.units[0].resolver?.decision==="AMBIGUOUS","AMBIGUOUS decision");
assert(ambiguous.units[0].resolver?.needs_clarification===true,"AMBIGUOUS clarification flag");
assert(ambiguous.units[0].write_eligible===false,"AMBIGUOUS must not be write eligible");

const mixed=byEvent[EVENTS.mixed].decision_payload;
const md=(mixed.units||[]).map(x=>x.resolver?.decision);
assert(mixed.decomposition?.mode==="MULTI_INDEPENDENT","MIXED mode");
assert(md.filter(x=>x==="MATCH").length===1&&md.filter(x=>x==="NEW").length===1,"MIXED decisions");
const eligible=(mixed.units||[]).filter(x=>x.write_eligible===true);
assert(eligible.length===1&&eligible[0].resolver?.work_item_id==="0d97b103-b90b-4285-844e-c064e4abb127","MIXED eligible target");

const links=await db("work_event_links",{
 select:"id,business_id,event_id,work_item_id,decision_type,metadata",
 business_id:`in.(${BIZ.join(",")})`
});
const writerLinks=links.filter(x=>x.decision_type==="link"&&x.metadata?.writer_version==="routing_commit_v1");
assert(writerLinks.length===2,`expected 2 writer links, got ${writerLinks.length}`);
assert(writerLinks.some(x=>x.event_id===EVENTS.legal&&x.work_item_id==="64388afe-6eac-4698-9264-750b75b34975"),"LEGAL physical link missing");
assert(writerLinks.some(x=>x.event_id===EVENTS.mixed&&x.work_item_id==="0d97b103-b90b-4285-844e-c064e4abb127"),"MIXED physical link missing");
assert(!writerLinks.some(x=>x.event_id===EVENTS.narrative||x.event_id===EVENTS.ambiguous),"unsafe physical link exists");

// Real application replay path: must short-circuit before Decomposer/Resolver and create nothing.
const replay=await invoke("b5a21511-cb99-40bc-a742-1c395f7a69d2",EVENTS.legal);
assert(replay.replayed===true,"writer did not use replay fast path");
assert(replay.routing_decision_created===false,"replay created routing decision");
assert(replay.work_links_created_count===0,"replay created work link");
assert(replay.write_result?.length===1&&replay.write_result[0].created===false,"replay did not return existing active link");

console.log("VF_MATCH_WRITE_V2_CERTIFIED_PASS",JSON.stringify({
 decisions:decisions.length,
 writer_links:writerLinks.length,
 replay:true,
 cases:["LEGAL_MATCH","NO_FALSE_MATCH_NARRATIVE","TWO_PLAUSIBLE_WORKS","MIXED_MATCH_NEW"]
}));
