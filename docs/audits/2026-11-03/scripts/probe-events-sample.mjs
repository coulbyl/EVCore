import { writeFileSync } from "node:fs";
const BASE="https://v3.football.api-sports.io"; const KEY=process.env.API_FOOTBALL_KEY; const OUT=process.argv[2];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let calls=0;
async function get(p){for(let a=0;a<4;a++){try{calls++;const r=await fetch(BASE+p,{headers:{"x-apisports-key":KEY}});const b=await r.json();await sleep(1100);if(b.errors&&Object.keys(b.errors).length)console.error("ERR",p,JSON.stringify(b.errors));return b;}catch(e){console.error("retry",a,p,e.code);await sleep(3000*(a+1));}}return {response:[],results:0};}
const LEAGUES=[39,140,135,78,61,94,88,2,253,71];
const fixtures=[];
for(const l of LEAGUES){const r=await get(`/fixtures?league=${l}&season=2026&last=40`); for(const f of r.response||[]) if(f.fixture.status.short==="FT") fixtures.push(f.fixture.id);}
console.log("finished fixtures", fixtures.length);
const full=[];
for(let i=0;i<fixtures.length;i+=20){const r=await get(`/fixtures?ids=${fixtures.slice(i,i+20).join("-")}`); full.push(...(r.response||[]));}
console.log("full fixtures", full.length, "with events", full.filter(f=>f.events?.length).length, "with players", full.filter(f=>f.players?.length).length);
writeFileSync(`${OUT}/fixtures-full.json`, JSON.stringify(full));
// Are pre-match odds still served for finished fixtures? Bet365 = bookmaker 8, anytime scorer = bet 92.
const oddsKept=[];
for(const id of fixtures.slice(0,25)){const r=await get(`/odds?fixture=${id}&bookmaker=8&bet=92`); if(r.results>0) oddsKept.push({id, r:r.response}); }
console.log("finished fixtures with scorer odds still served:", oddsKept.length, "/ 25");
writeFileSync(`${OUT}/scorer-odds-finished.json`, JSON.stringify(oddsKept));
const st=await get("/status"); console.log("calls", calls, "quota", JSON.stringify(st.response?.requests));
