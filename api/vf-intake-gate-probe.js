import gate from "./intake-gate-dry-run.js";
const BRANCH="intake-gate-dry-run-v1", BUSINESS="c6a9d101-e843-4c50-8133-cf484e996c80";
const CASES=[
{id:"L1",e:"NEW_WORK_CANDIDATE",t:"Ho ricevuto una comunicazione formale da un fornitore e vorrei fissare un appuntamento per farvela esaminare."},
{id:"L2",e:"NO_NEW_WORK",t:"Un mio collega ha ricevuto una comunicazione simile; io non ho problemi e ne parlavamo soltanto."},
{id:"L3",e:"UNCERTAIN",t:"Avrei una domanda su una clausola del contratto, quando possiamo sentirci?"},
{id:"I1",e:"NEW_WORK_CANDIDATE",t:"Vorrei vendere il mio appartamento a Roma. Possiamo fissare una valutazione?"},
{id:"I2",e:"NO_NEW_WORK",t:"Mia sorella ha appena venduto casa tramite un'altra agenzia. Io per ora non vendo nulla."},
{id:"I3",e:"UNCERTAIN",t:"Quanto valgono più o meno gli appartamenti in questa zona?"},
{id:"P1",e:"NEW_WORK_CANDIDATE",t:"Abbiamo ricevuto una segnalazione di evento relativo a un nostro prodotto e vorremmo che la prendeste in carico."},
{id:"P2",e:"NO_NEW_WORK",t:"Sto preparando una presentazione universitaria sulla sicurezza dei farmaci, non devo segnalare nessun caso."},
{id:"P3",e:"UNCERTAIN",t:"Avrei un dubbio su un possibile evento relativo a un prodotto, posso parlarne con qualcuno?"},
{id:"F1",e:"NEW_WORK_CANDIDATE",t:"Ho dolore alla spalla da una settimana e vorrei prenotare una valutazione fisioterapica."},
{id:"F2",e:"NO_NEW_WORK",t:"Mio padre aveva dolore alla spalla ma sta già facendo fisioterapia altrove. Io sto bene."},
{id:"F3",e:"UNCERTAIN",t:"Secondo voi questo dolore alla spalla richiede fisioterapia?"},
{id:"C1",e:"NEW_WORK_CANDIDATE",t:"Dobbiamo ristrutturare un locale commerciale e vorremmo un sopralluogo per un preventivo."},
{id:"C2",e:"NO_NEW_WORK",t:"Passavo davanti a un cantiere e parlavamo di ristrutturazioni. Non ho lavori da fare."},
{id:"C3",e:"UNCERTAIN",t:"Sto pensando a una ristrutturazione, ma non so ancora se procederò. Possiamo sentirci per capire meglio?"},
{id:"M1",e:"NO_NEW_WORK",t:"Il mio inquilino dice che perde il rubinetto, ma vi sto solo aggiornando: se ne occupa già il manutentore del condominio."},
{id:"M2",e:"NEW_WORK_CANDIDATE",t:"Il mio inquilino dice che perde il rubinetto. Potete contattarlo voi e organizzare l'intervento?"},
{id:"M3",e:"NO_NEW_WORK",t:"Citazione dal documento: presenza di infiltrazioni e distacco dell'intonaco. È solo il testo della perizia che sto trascrivendo."},
{id:"M4",e:"NO_NEW_WORK",t:"Se decidessi di vendere casa, probabilmente mi rivolgerei a voi. Al momento però non voglio metterla sul mercato."},
{id:"M5",e:"NEW_WORK_CANDIDATE",t:"Non voglio vendere la casa di Roma; voglio invece affidarvi quella di Milano per la locazione."}
]
function cap(){const c={statusCode:200,body:null};const r={setHeader(){return r;},status(x){c.statusCode=x;return r;},json(x){c.body=x;return c;},end(){return c;}};return{r,c};}
async function one(tc,key){const {r,c}=cap();await gate({method:"POST",headers:{"x-api-key":key},body:{business_id:BUSINESS,normalized_text:tc.t}},r);const a=c.body?.result;return{id:tc.id,expected:tc.e,actual:a?.decision||null,pass:c.statusCode===200&&a?.decision===tc.e,status:c.statusCode,confidence:a?.confidence,question:a?.clarification_question||null,reason:a?.reason||null};}
async function pool(items,n,fn){const out=new Array(items.length);let next=0;async function w(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}await Promise.all(Array.from({length:Math.min(n,items.length)},()=>w()));return out;}
export default async function handler(req,res){res.setHeader("Cache-Control","no-store");if(req.method!=="GET")return res.status(405).json({error:"GET only"});if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!==BRANCH)return res.status(403).json({error:"Preview only"});const key=(process.env.VOCALFLASH_API_KEYS||"").split(",").map(v=>v.trim()).filter(Boolean)[0];if(!key)return res.status(500).json({error:"No key"});const results=await pool(CASES,4,tc=>one(tc,key));return res.status(200).json({passed:results.filter(x=>x.pass).length,total:results.length,failures:results.filter(x=>!x.pass),results});}
// redeploy after automation bypass activation
