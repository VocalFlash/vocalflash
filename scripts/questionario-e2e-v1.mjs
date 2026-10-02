import submit from "../api/questionario-submit.js";
import results from "../api/questionario-results.js";

const marker="__VF_QUESTIONARIO_E2E_20261002_V1__";

function capture(){
  const c={statusCode:200,body:null};
  const res={
    status(code){c.statusCode=code;return res;},
    json(body){c.body=body;return c;},
    end(){return c;}
  };
  return {res,c};
}

async function invoke(handler,req){
  const {res,c}=capture();
  await handler(req,res);
  return c;
}

const submitResult=await invoke(submit,{
  method:"POST",
  body:{
    q1:"E2E_TEST",
    q2:"E2E_TEST",
    q3:"E2E_TEST",
    q4:"E2E_TEST",
    q5:"E2E_TEST",
    q6:["E2E_TEST"],
    q7:"E2E_TEST",
    q8:"E2E_TEST",
    q9:marker
  }
});

if(submitResult.statusCode!==200||submitResult.body?.ok!==true){
  throw new Error("QUESTIONARIO_SUBMIT_E2E_FAILED_"+submitResult.statusCode+"_"+JSON.stringify(submitResult.body));
}

const adminPassword=process.env.SURVEY_ADMIN_PASSWORD;
if(!adminPassword) throw new Error("SURVEY_ADMIN_PASSWORD_MISSING");

const resultsResult=await invoke(results,{
  method:"POST",
  body:{password:adminPassword}
});

if(resultsResult.statusCode!==200||!Array.isArray(resultsResult.body?.responses)){
  throw new Error("QUESTIONARIO_RESULTS_E2E_FAILED_"+resultsResult.statusCode+"_"+JSON.stringify(resultsResult.body));
}

const found=resultsResult.body.responses.some(row=>row?.q9===marker);
if(!found) throw new Error("QUESTIONARIO_E2E_MARKER_NOT_FOUND");

console.log("QUESTIONARIO_E2E_PASS");
