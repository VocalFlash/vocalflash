import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import handler from "./multivocale-storage.js";

const ENV=[
  "VOCALFLASH_ASSISTANT_API_KEYS",
  "VOCALFLASH_ASSISTANT_API_KEY_SCOPES",
  "VF_ASSISTANT_SUPABASE_URL",
  "VF_ASSISTANT_SUPABASE_SECRET_KEY",
  "VF_MULTIVOCALE_STORAGE_BUCKET"
];

function responseRecorder(){
  const state={status:200,body:null,headers:{}};
  const res={
    setHeader(name,value){state.headers[name]=value;return res;},
    status(value){state.status=value;return res;},
    json(value){state.body=value;return state;},
    end(){return state;}
  };
  return {res,state};
}

async function call(action,objectKey,key="staging-test-key"){
  const {res,state}=responseRecorder();
  await handler({method:"POST",headers:{"x-vocalflash-assistant-key":key},body:{action,object_key:objectKey}},res);
  return state;
}

function scopeSegment(scope){
  const hex=crypto.createHash("sha256").update("vocalflash-storage-scope:"+scope).digest("hex").slice(0,32);
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-4"+hex.slice(13,16)+"-a"+hex.slice(17,20)+"-"+hex.slice(20,32);
}

function configure(t,scopes={"staging-test-key":"staging-bot"}){
  const previous=Object.fromEntries(ENV.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of ENV)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];});
  process.env.VOCALFLASH_ASSISTANT_API_KEYS="staging-test-key,production-test-key";
  process.env.VOCALFLASH_ASSISTANT_API_KEY_SCOPES=JSON.stringify(Object.fromEntries(
    Object.entries(scopes).map(([key,scope])=>[crypto.createHash("sha256").update(key).digest("hex"),scope])
  ));
  process.env.VF_ASSISTANT_SUPABASE_URL="https://example.supabase.co";
  process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY="test-only-secret";
  process.env.VF_MULTIVOCALE_STORAGE_BUCKET="test-audio";
}

test("storage fails closed when authenticated key has no server-side scope mapping",async t=>{
  configure(t,{});
  const result=await call("prepare_download","tmp/00000000-0000-4000-a000-000000000000/11111111-1111-4111-a111-111111111111/"+"a".repeat(64)+".ogg");
  assert.equal(result.status,503);
  assert.match(result.body.error,/Scope credenziale/);
});

test("storage denies cross-scope download before any storage request",async t=>{
  configure(t);
  const foreignKey="tmp/"+scopeSegment("production-bot")+"/11111111-1111-4111-a111-111111111111/"+ "a".repeat(64)+".ogg";
  const originalFetch=globalThis.fetch;let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error("unexpected network call");};
  t.after(()=>{globalThis.fetch=originalFetch;});
  const result=await call("prepare_download",foreignKey);
  assert.equal(result.status,403);assert.equal(called,false);
});

test("storage denies cross-scope deletion before any storage request",async t=>{
  configure(t);
  const foreignKey="tmp/"+scopeSegment("production-bot")+"/11111111-1111-4111-a111-111111111111/"+ "a".repeat(64)+".ogg";
  const originalFetch=globalThis.fetch;let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error("unexpected network call");};
  t.after(()=>{globalThis.fetch=originalFetch;});
  const result=await call("delete",foreignKey);
  assert.equal(result.status,403);assert.equal(called,false);
});

test("storage rejects legacy unscoped object keys",async t=>{
  configure(t);
  const legacyKey="tmp/11111111-1111-4111-a111-111111111111/"+"a".repeat(64)+".ogg";
  const result=await call("prepare_download",legacyKey);
  assert.equal(result.status,400);
});
