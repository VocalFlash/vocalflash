const base=String(process.env.VF_ASSISTANT_SUPABASE_URL||"").replace(/\/+$/,"");
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY||"";
if(!base||!secret)throw new Error("OWNER_PREVIEW_DB_CONFIG_MISSING");

const h={apikey:secret,Accept:"application/json"};
const channels=await fetch(base+"/rest/v1/business_channels?select=id,business_id,external_account_id,is_active&channel_type=eq.whatsapp&is_active=eq.true&limit=2",{headers:h});
if(!channels.ok)throw new Error("OWNER_PREVIEW_CHANNEL_READ_FAILED_"+channels.status);
const rows=await channels.json();
if(!Array.isArray(rows)||rows.length<1)throw new Error("OWNER_PREVIEW_NO_ACTIVE_WHATSAPP_CHANNEL");

const identity=await fetch(base+"/rest/v1/rpc/vf_resolve_owner_member_by_sender_v1",{
  method:"POST",headers:{...h,"Content-Type":"application/json"},
  body:JSON.stringify({p_sender_wa_id:"390000000000",p_business_id:rows[0].business_id})
});
if(!identity.ok)throw new Error("OWNER_PREVIEW_IDENTITY_RPC_FAILED_"+identity.status);
const result=await identity.json();
if(result?.ok!==false||result?.status!=="NOT_VERIFIED")throw new Error("OWNER_PREVIEW_IDENTITY_FAIL_CLOSED_EXPECTED");

console.log("OWNER_PREVIEW_READ_ONLY_CONFIG_SMOKE_PASS 4/4");
