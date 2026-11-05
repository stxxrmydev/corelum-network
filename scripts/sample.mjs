import { zipSync, strToU8 } from "fflate";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
let base = process.env.BASE_COMMIT;
try {
  base ||= execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {}
if (!/^[a-f0-9]{40}$/.test(base || ""))
  throw Error(
    "Set BASE_COMMIT to the channel source SHA displayed in Development & Updates.",
  );
const feature = `import { useState } from 'react';
import { Lightbulb, Plus, Check, Trash2 } from 'lucide-react';
import type { Feature } from '../../core/types';
function Ideas(){
 const [ideas,setIdeas]=useState<{text:string;done:boolean}[]>(()=>{try{return JSON.parse(localStorage.getItem('nimbus.ideas.v1')||'[]')}catch{return []}}),[text,setText]=useState('');
 const save=(next:typeof ideas)=>{localStorage.setItem('nimbus.ideas.v1',JSON.stringify(next));setIdeas(next)};
 return <><div className="page-heading"><div><span className="eyebrow">A NEW CHAPTER · VERSION 1.0.1</span><h1>A place for bright ideas.</h1><p>Your first feature, delivered through a signed update.</p></div><span className="icon-box"><Lightbulb size={21}/></span></div><section className="panel settings-panel"><h3>Capture what comes next</h3><p className="subtle">Ideas are saved on this device and preserved across updates.</p><form className="button-row" onSubmit={e=>{e.preventDefault();if(text.trim()){save([...ideas,{text:text.trim(),done:false}]);setText('')}}}><input style={{flex:1}} aria-label="New idea" placeholder="What would you like to build?" maxLength={500} value={text} onChange={e=>setText(e.target.value)}/><button className="primary"><Plus size={15}/>Save idea</button></form>{!ideas.length&&<p style={{padding:'40px',textAlign:'center'}}>Your next great idea starts here.</p>}{ideas.map((idea,i)=><div className="setting-row" key={i}><button className="text-button" onClick={()=>save(ideas.map((x,n)=>n===i?{...x,done:!x.done}:x))}><Check size={15}/><span style={{textDecoration:idea.done?'line-through':'none'}}>{idea.text}</span></button><button className="icon-button" aria-label="Delete idea" onClick={()=>save(ideas.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>)}</section></>
}
export default {id:'ideas',title:'Ideas',description:'Capture your next big idea.',component:Ideas} satisfies Feature;
`;
const manifest = {
  schema: 1,
  version: "1.0.1",
  baseVersion: "1.0.0",
  baseCommit: base,
  channel: "stable",
  minShellVersion: "1.0.0",
  notes:
    "Introducing Ideas: capture, complete, and organise ideas in a new workspace page. Your notes remain on your device.",
  remove: [],
  urgent: false,
};
mkdirSync("samples", { recursive: true });
writeFileSync(
  "samples/ideas-1.0.1.zip",
  zipSync(
    {
      "update.json": strToU8(JSON.stringify(manifest, null, 2)),
      "src/features/ideas/index.tsx": strToU8(feature),
    },
    { level: 6 },
  ),
);
writeFileSync(
  "samples/update.example.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Created samples/ideas-1.0.1.zip using channel base " + base);
