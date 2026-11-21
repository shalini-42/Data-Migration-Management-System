import {lazy,Suspense,useState,useEffect,useRef} from "react";import {Link} from 'react-router-dom';import {Upload,Play,Pause,Square,Download} from 'lucide-react';

import {useStore,toast,clearAll} from './store.js';import {Confirm} from './Crud.jsx';import {exportData,exportWorkbook,readFile,validate} from './exporter.js';
const C=['#2563eb','#16a34a','#dc2626','#f59e0b','#64748b'];
const DashboardCharts=lazy(()=>import("./DashboardCharts.jsx"));
export function Dashboard(){const [p]=useStore('projects');const [e]=useStore('errors');const n=s=>p.filter(x=>x.status==s).length;const tot=p.reduce((a,x)=>a+x.total,0);
const stats=[['Projects',p.length],['Successful',n('Completed')],['Failed',n('Failed')],['Running',n('Running')],['Records',tot.toLocaleString()],['Data Transferred',(tot*0.5/1024).toFixed(1)+' MB']];
const dist=['Completed','Running','Failed','Pending','Cancelled'].map(s=>({name:s,value:n(s)}));const wk=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>{const item=p.length?p[i%p.length]:{};return{d,ok:((item.success||0)/1000)|0,fail:((item.failed||0)/100)|0}});
return <><div className="grid6">{stats.map(([a,b])=><div className="card stat" key={a}><small>{a}</small><h2>{b}</h2></div>)}</div>
<Suspense fallback={<div className="card">Loading dashboard charts...</div>}>
<DashboardCharts dist={dist} wk={wk} colors={C}/>
</Suspense>
<div className="grid2"><div className="card"><h4>Recent projects</h4>{p.slice(0,5).map(x=><div key={x.id} className="prog"><span>{x.name}</span><div className="bar"><i style={{width:x.progress+'%'}}/></div><small>{x.progress}%</small></div>)}</div>
<div className="card"><h4>Latest errors</h4>{e.slice(0,4).map(x=><p key={x.id}><span className={'badge '+x.severity.toLowerCase()}>{x.severity}</span> {x.message}</p>)}<div className="row"><Link className="btn" to="/jobs">New job</Link><Link className="btn ghost" to="/validation">Validate file</Link><Link className="btn ghost" to="/reports">Reports</Link></div></div></div></>}

export function Validation(){const [up,setUp]=useStore('upload');const [req,setReq]=useState('customer_name,customer_email');const [res,setRes]=useState(null);const [busy,setBusy]=useState(0);const [d,setD]=useState(false);
const load=async f=>{try{setBusy(10);const rows=await readFile(f);for(let i=20;i<=100;i+=20){await new Promise(r=>setTimeout(r,60));setBusy(i)}setUp({name:f.name,size:f.size,rows:rows.slice(0,5000)});setRes(null);toast(`${f.name} loaded (${rows.length} rows)`)}catch(x){toast(x.message,'err')}setBusy(0)};
const run=()=>up&&setRes(validate(up.rows,req.split(',').map(s=>s.trim()).filter(Boolean)));
const sum=res&&['Valid','Warning','Invalid'].map(s=>[s,res.out.filter(r=>r.status==s).length]);
return <div className="card"><div className={'drop'+(d?' on':'')} onDragOver={e=>{e.preventDefault();setD(true)}} onDragLeave={()=>setD(false)} onDrop={e=>{e.preventDefault();setD(false);e.dataTransfer.files[0]&&load(e.dataTransfer.files[0])}}><Upload/><p>Drag & drop CSV / JSON / XLSX / XLS (max 10 MB)</p><input type="file" accept=".csv,.json,.xlsx,.xls" onChange={e=>e.target.files[0]&&load(e.target.files[0])}/>{busy>0&&<div className="bar"><i style={{width:busy+'%'}}/></div>}</div>
{up&&<><p><b>{up.name}</b> Â· {up.rows.length} rows Â· {up.rows[0]?Object.keys(up.rows[0]).length:0} columns Â· processed locally in your browser</p>
<div className="row"><label>Required columns<input value={req} onChange={e=>setReq(e.target.value)}/></label><button className="btn" onClick={run}>Run validation</button></div>
{!res&&<Preview rows={up.rows}/>}</>}
{!up&&<p className="empty">Upload a file to preview and validate it.</p>}
{res&&<><div className="grid6">{sum.map(([a,b])=><div key={a} className="card stat"><span className={'badge '+a.toLowerCase()}>{a}</span><h2>{b}</h2></div>)}</div>
{res.missing.length>0&&<p className="er">Missing required columns: {res.missing.join(', ')}</p>}
<div className="row">{['csv','xlsx','json','pdf'].map(f=><button key={f} className="btn ghost" onClick={()=>exportData(f,'validation-report',res.out)}><Download size={14}/>{f.toUpperCase()}</button>)}</div><Preview rows={res.out}/></>}</div>}
function Preview({rows}){const c=rows[0]?Object.keys(rows[0]):[];return <div className="tw"><table><thead><tr>{c.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i}>{c.map(x=><td key={x}>{x=='status'?<span className={'badge '+String(r[x]).toLowerCase()}>{r[x]}</span>:String(r[x])}</td>)}</tr>)}</tbody></table></div>}

export function Mapping(){const [up]=useStore('upload');const [maps,setMaps]=useStore('mappings');const [tgt,setTgt]=useState('name,email,phone');const [cur,setCur]=useState({});
const src=up&&up.rows[0]?Object.keys(up.rows[0]):['customer_name','customer_email','customer_phone'];const t=tgt.split(',').map(s=>s.trim()).filter(Boolean);
const miss=t.filter(x=>!Object.values(cur).includes(x));
return <div className="card"><p>Source columns come from your uploaded file (or demo columns). Target columns are editable.</p><label>Target columns<input value={tgt} onChange={e=>setTgt(e.target.value)}/></label>
<div className="tw"><table><thead><tr><th>Source</th><th>Maps to</th></tr></thead><tbody>{src.map(s=><tr key={s}><td>{s}</td><td><select value={cur[s]||''} onChange={e=>setCur({...cur,[s]:e.target.value})}><option value="">â€” unmapped â€”</option>{t.map(x=><option key={x}>{x}</option>)}</select></td></tr>)}</tbody></table></div>
<p className={miss.length?'er':'ok'}>{miss.length?'Unmapped targets: '+miss.join(', '):'All target columns mapped'}</p>
{up&&<><h4>Preview</h4><Preview rows={up.rows.slice(0,5).map(r=>Object.fromEntries(Object.entries(cur).filter(([,v])=>v).map(([k,v])=>[v,r[k]])))}/></>}
<div className="row"><button className="btn" onClick={()=>{if(!Object.values(cur).some(Boolean))return toast('Map at least one column','err');setMaps([{id:'MAP-'+Date.now()%10000,name:'Mapping '+(maps.length+1),map:cur,complete:!miss.length},...maps]);toast('Mapping saved')}}>Save mapping</button></div>
{maps.length>0&&<p>Saved mappings: {maps.map(m=>m.name+(m.complete?' âœ“':' (incomplete)')).join(', ')}</p>}</div>}

export function Jobs(){const [jobs,setJobs]=useStore('jobs');const [pr]=useStore('projects');const [maps]=useStore('mappings');const [n,setN]=useStore('notifications');const [sel,setSel]=useState('');const ref=useRef(jobs);ref.current=jobs;
const add=t=>setN(x=>[{id:'N-'+Date.now(),title:t.title,message:t.message,time:new Date().toLocaleString(),status:'Unread'},...x]);
useEffect(()=>{const iv=setInterval(()=>{if(!ref.current.some(j=>j.status=='Running'))return;setJobs(js=>js.map(j=>{if(j.status!='Running')return j;const step=Math.min(j.total-j.processed,Math.ceil(j.total/40));const bad=Math.random()<.06?Math.ceil(step*.1):0;const p=j.processed+step;const done=p>=j.total;if(done)add({title:'Migration completed',message:j.project});return{...j,processed:p,failed:j.failed+bad,success:j.success+step-bad,status:done?'Completed':'Running'}}))},500);return()=>clearInterval(iv)},[]);
const set=(id,status)=>setJobs(js=>js.map(j=>j.id==id?{...j,status}:j));
const create=()=>{const p=pr.find(x=>x.id==sel);if(!p)return toast('Select a project','err');setJobs([{id:'JOB-'+Date.now()%100000,project:p.id+' '+p.name,mapping:maps[0]?.name||'None',total:p.total,processed:0,success:0,failed:0,status:'Pending'},...jobs]);toast('Job created')};
return <div className="card"><div className="row"><select value={sel} onChange={e=>setSel(e.target.value)}><option value="">Select projectâ€¦</option>{pr.map(p=><option key={p.id} value={p.id}>{p.id} â€“ {p.name}</option>)}</select><button className="btn" onClick={create}>Create job</button></div>
{!jobs.length&&<p className="empty">No jobs yet. Simulated migrations run entirely in your browser.</p>}
{jobs.map(j=><div className="job" key={j.id}><div className="row"><b>{j.id}</b><span>{j.project}</span><span className={'badge '+j.status.toLowerCase()}>{j.status}</span><span className="grow"/>
{['Pending','Paused'].includes(j.status)&&<button className="btn" onClick={()=>{set(j.id,'Running');add({title:'Migration started',message:j.project})}}><Play size={14}/>{j.status=='Paused'?'Resume':'Start'}</button>}
{j.status=='Running'&&<button className="btn ghost" onClick={()=>set(j.id,'Paused')}><Pause size={14}/>Pause</button>}
{['Running','Paused','Pending'].includes(j.status)&&<button className="btn danger" onClick={()=>set(j.id,'Cancelled')}><Square size={14}/>Cancel</button>}</div>
<div className="bar"><i style={{width:(j.processed/j.total*100)+'%'}}/></div><small>Processed {j.processed.toLocaleString()} / {j.total.toLocaleString()} Â· Success {j.success.toLocaleString()} Â· Failed {j.failed.toLocaleString()}</small></div>)}</div>}

export function Reports(){const D={projects:useStore('projects')[0],sources:useStore('sources')[0],targets:useStore('targets')[0],errors:useStore('errors')[0],jobs:useStore('jobs')[0]};const hist=D.projects.filter(p=>['Completed','Failed','Cancelled'].includes(p.status));const up=useStore('upload')[0];
const stats=[{metric:'Projects',value:D.projects.length},{metric:'Total records',value:D.projects.reduce((a,x)=>a+x.total,0)},{metric:'Failed records',value:D.projects.reduce((a,x)=>a+x.failed,0)}];
const items=[['Complete migration report',D.projects],['Migration history report',hist],['Error log report',D.errors],['Source data export',D.sources],['Target data export',D.targets],['Dashboard statistics',stats],['Uploaded data export',up?up.rows:[]]];
return <div className="card"><p>All exports use your current data.</p>{items.map(([n,r])=><div className="row rep" key={n}><b>{n}</b><span className="grow"/>{['pdf','xlsx','csv','json'].map(f=><button key={f} className="btn ghost" onClick={()=>exportData(f,n.toLowerCase().replace(/ /g,'-'),r)}><Download size={14}/>{f.toUpperCase()}</button>)}</div>)}
<div className="row rep"><b>Full workbook (multi-sheet)</b><span className="grow"/><button className="btn" onClick={()=>exportWorkbook('full-migration-report',{Summary:stats,Projects:D.projects,Errors:D.errors,Jobs:D.jobs,Sources:D.sources,Targets:D.targets})}><Download size={14}/>XLSX</button></div><h4>Project export</h4><div className="row rep"><span>Bundles the app's own source files (generated in your browser).</span><span className="grow"/><button className="btn" onClick={async()=>{try{const {downloadProjectZip}=await import('./zipExport.js');await downloadProjectZip()}catch(e){toast(e.message,'err')}}}><Download size={14}/>Download Complete Project (ZIP)</button></div></div>}

export function Settings(){const [pf,setPf]=useStore('prefs');const [c,setC]=useState(false);
return <div className="card"><h4>Application</h4><p>MigrateHub v1.0 â€“ frontend-only demo. No data leaves your browser.</p><h4>Theme</h4><select value={pf.theme} onChange={e=>setPf({...pf,theme:e.target.value})}><option>light</option><option>dark</option></select>
<h4>Demo data</h4><button className="btn danger" onClick={()=>setC(true)}>Clear demo data</button>
{c&&<Confirm text="Remove all saved data and restore defaults?" onNo={()=>setC(false)} onYes={()=>{clearAll();location.reload()}}/>}</div>}


