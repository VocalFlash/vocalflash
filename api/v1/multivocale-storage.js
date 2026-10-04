import crypto from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const OBJECT_RE=/^tmp\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(ogg|mp3|m4a|wav|webm|flac)$/i;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assistantKeys(){
  return (process.env.VOCALFLASH_ASSISTANT_API_KEYS||"")
    .split(",")
    .map(v=>v.trim())
    .filter(Boolean);
}

function clean(v,max=512){
  if(typeof v!=="string")return "";
  return v.trim().slice(0,max);
}

function storageConfig(){
  return {
    url:clean(process.env.VF_ASSISTANT_SUPABASE_URL,512).replace(/\/+$/, ""),
    secret:process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||"",
    bucket:clean(process.env.VF_MULTIVOCALE_STORAGE_BUCKET,128),
  };
}

function extFromMime(mime){
  const m=clean(mime,80).toLowerCase();
  if(m.includes("mpeg")||m.includes("mp3"))return "mp3";
  if(m.includes("mp4")||m.includes("m4a"))return "m4a";
  if(m.includes("wav"))return "wav";
  if(m.includes("webm"))return "webm";
  if(m.includes("flac"))return "flac";
  return "ogg";
}

function makeObjectKey(batchId,messageId,mime){
  const digest=crypto.createHash("sha256").update(messageId).digest("hex");
  return `tmp/${batchId}/${digest}.${extFromMime(mime)}`;
}

function validObjectKey(value){
  return typeof value==="string"&&OBJECT_RE.test(value);
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","X-VocalFlash-Assistant-Key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"Usa POST"});

  const key=req.headers["x-vocalflash-assistant-key"];
  const valid=assistantKeys();
  if(!key||typeof key!=="string"||valid.length===0||!valid.includes(key)){
    return res.status(401).json({error:"Assistant API Key non valida"});
  }

  const {url,secret,bucket}=storageConfig();
  if(!url||!secret||!bucket){
    return res.status(500).json({error:"Configurazione storage MultiVocale incompleta"});
  }

  const action=clean(req.body?.action,64);
  const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const store=supabase.storage.from(bucket);

  try{
    if(action==="health"){
      const {data,error}=await supabase.storage.getBucket(bucket);
      if(error)throw error;
      return res.status(200).json({
        ok:true,
        action,
        storage:true,
        bucket_private:data?.public===false,
      });
    }

    if(action==="prepare_upload"){
      const batchId=clean(req.body?.batch_id,64);
      const messageId=clean(req.body?.message_id,256);
      const mimeType=clean(req.body?.mime_type,80)||"audio/ogg";
      if(!UUID_RE.test(batchId)||!messageId){
        return res.status(400).json({error:"batch_id/message_id non validi"});
      }
      const objectKey=makeObjectKey(batchId,messageId,mimeType);
      const {data,error}=await store.createSignedUploadUrl(objectKey,{upsert:false});
      if(error)throw error;
      return res.status(200).json({
        ok:true,
        action,
        object_key:objectKey,
        signed_upload:data,
      });
    }

    if(action==="prepare_download"){
      const objectKey=clean(req.body?.object_key,512);
      if(!validObjectKey(objectKey)){
        return res.status(400).json({error:"object_key non valida"});
      }
      const {data,error}=await store.createSignedUrl(objectKey,300,{download:false});
      if(error)throw error;
      return res.status(200).json({
        ok:true,
        action,
        object_key:objectKey,
        signed_url:data?.signedUrl||null,
        expires_in_seconds:300,
      });
    }

    if(action==="delete"){
      const objectKey=clean(req.body?.object_key,512);
      if(!validObjectKey(objectKey)){
        return res.status(400).json({error:"object_key non valida"});
      }
      const {error}=await store.remove([objectKey]);
      if(error)throw error;
      return res.status(200).json({ok:true,action,object_key:objectKey});
    }

    return res.status(400).json({error:"Azione storage non supportata"});
  }catch(error){
    console.error("[VF MULTIVOCALE STORAGE] error",error?.message||"unknown");
    return res.status(500).json({
      ok:false,
      action:action||null,
      error:"Operazione storage MultiVocale non riuscita",
    });
  }
}
