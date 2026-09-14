const { createClient } = require("genlayer-js");
const { testnetAsimov } = require("genlayer-js/chains");
const gl = createClient({ chain: testnetAsimov });
const H = "0x9246c636f0f59ef66f819cae82bfc15a167d26c4a8934bfdcbd7b2bd25ffa29c";
const T = "0x8407D207e1B1FcF93BCCE2e9ABE0d708EB108f4a";
const ADDR = "0xE26f7DFeA81AC9E5b130608B4C074A4E3F57A0AD";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...m) => console.log(new Date().toISOString().slice(11,19), ...m);
(async () => {
  let last = "";
  const t0 = Date.now();
  for (let i = 0; i < 120; i++) {          // theo doi toi da 40 phut
    let t; try { t = await gl.getTransaction({ hash: H }); } catch { await sleep(20000); continue; }
    const s = `${t.statusName}/${t.txExecutionResultName}`;
    if (s !== last) { last = s; log(`TRANGTHAI ${s} (sau ${((Date.now()-t0)/1000|0)}s)`); }
    if (t.statusName === "ACCEPTED" || t.statusName === "FINALIZED") {
      const f = await gl.readContract({ address: ADDR, functionName: "get_facts", args: [T] }).then(r=>r,()=>null);
      log("FACTS " + JSON.stringify(f, (k,v)=>typeof v==="bigint"?v.toString():v));
      break;
    }
    await sleep(20000);
  }
  log("KETTHUC theo doi");
})();
