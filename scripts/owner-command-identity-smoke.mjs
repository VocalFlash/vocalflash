import {createOwnerCommandPersistence} from "../lib/owner-command-persistence-v1.js";

const baseUrl=process.env.VF_ASSISTANT_SUPABASE_URL;
const secret=process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
if(!baseUrl||!secret)throw new Error("OWNER_COMMAND_DB_CONFIG_MISSING");

const store=createOwnerCommandPersistence({baseUrl,secret});

const invalid=await store.resolveMember({senderWaId:"abc"});
if(invalid?.status!=="INVALID"||invalid?.reason!=="SENDER_WA_ID_INVALID"){
  throw new Error("OWNER_IDENTITY_INVALID_SENDER_FAIL");
}

const unknown=await store.resolveMember({senderWaId:"393331234567"});
if(unknown?.status!=="NOT_VERIFIED"||unknown?.reason!=="NO_ACTIVE_VERIFIED_MEMBER_MATCH"){
  throw new Error("OWNER_IDENTITY_FAIL_CLOSED_FAIL");
}

console.log("OWNER_COMMAND_IDENTITY_FAIL_CLOSED_PASS 2/2");
