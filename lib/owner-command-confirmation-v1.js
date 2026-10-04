const normalize=v=>String(v||"")
  .trim()
  .toLocaleLowerCase("it-IT")
  .replace(/[,:;]+/g," ")
  .replace(/[.!?]+$/g,"")
  .replace(/\s+/g," ");
const EXACT=new Set(["confermo","si confermo","sì confermo","ok confermo","confermo ok"]);
export function isExplicitOwnerConfirmation(text){return EXACT.has(normalize(text));}
