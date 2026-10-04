const text=v=>typeof v==="string"&&v.trim().length>0;

export function decideWhatsappMessageOrigin({businessContext,memberResolution}){
  if(!businessContext||businessContext.active!==true||!text(businessContext.businessId)||!text(businessContext.channelId)){
    return {ok:false,status:"DENIED",origin:"unknown",reason:"CHANNEL_NOT_ACTIVE"};
  }

  if(memberResolution?.ok===true&&memberResolution?.status==="RESOLVED"){
    if(memberResolution.business_id!==businessContext.businessId||!text(memberResolution.member_id)){
      return {ok:false,status:"CONFIG_REQUIRED",origin:"unknown",reason:"OWNER_BUSINESS_CONTEXT_MISMATCH"};
    }
    return {
      ok:true,status:"ROUTED",origin:"owner",
      businessId:businessContext.businessId,
      channelId:businessContext.channelId,
      memberId:memberResolution.member_id,
      identityVerified:true
    };
  }

  if(memberResolution?.ok===false&&memberResolution?.status==="NOT_VERIFIED"){
    return {
      ok:true,status:"ROUTED",origin:"customer",
      businessId:businessContext.businessId,
      channelId:businessContext.channelId,
      memberId:null,
      identityVerified:false
    };
  }

  return {
    ok:false,status:"CONFIG_REQUIRED",origin:"unknown",
    reason:memberResolution?.reason||memberResolution?.status||"OWNER_IDENTITY_RESOLUTION_FAILED"
  };
}
