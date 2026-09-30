// TEMPORARY branch-only E2E probe for Write Path MATCH V1. Delete after test.
import writePath from "./write-path-match-v1.js";
const BRANCH="write-path-match-v1";
const BUSINESS="033bef27-e463-4857-9ddd-72c34e2eec59";
const EVENT="eb279a80-7a15-413c-a73c-b8f7cce8e355";
function cap(){const c={statusCode:200,body:null};const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},end(){return c;}};return{r,c};}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!==BRANCH)return res.status(403).json({error:"Preview branch only"});
 const key=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean)[0];
 if(!key)return res.status(500).json({error:"No internal API key"});
 const {r,c}=cap();
 await writePath({method:"POST",headers:{"x-api-key":key},body:{business_id:BUSINESS,event_id:EVENT}},r);
 return res.status(c.statusCode).json(c.body);
}