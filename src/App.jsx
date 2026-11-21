import {useState,useEffect} from 'react';import {NavLink,Routes,Route,useLocation,useNavigate} from 'react-router-dom';
import {FileSpreadsheet,X,LayoutDashboard,FolderKanban,Database,Server,GitCompare,Play,ShieldCheck,AlertTriangle,History,FileText,Bell,Settings as Cog,Menu,Search,Filter,LogOut,User} from 'lucide-react';
import ExcelFilterSplit from './ExcelFilterSplit.jsx';
import Crud from './Crud.jsx';import Compare from './Compare.jsx';import {Dashboard,Validation,Mapping,Jobs,Reports,Settings} from './pages.jsx';import {useStore,toast} from './store.js';
const P=['Completed','Running','Failed','Pending','Cancelled'],S=['Open','Resolved'];
const R=[
['/','Dashboard',LayoutDashboard,<Dashboard/>],
['/projects','Migration Projects',FolderKanban,<Crud k="projects" title="Project" prefix="PRJ" rowExtra={(r,rows,set)=>[<button key="d" className="btn ghost" onClick={()=>{set(p=>[{...r,id:'PRJ-'+Date.now()%100000,name:r.name+' (copy)',status:'Pending',progress:0},...p]);toast('Project duplicated')}}>Copy</button>]} cols={['id','name','source','target','type','created','status','progress','total','success','failed']} fields={[{k:'name',req:1},{k:'description'},{k:'source',req:1},{k:'target',req:1},{k:'type',opts:['Full','Incremental']},{k:'created',type:'date'},{k:'status',opts:P},{k:'progress',type:'number'},{k:'total',type:'number'},{k:'success',type:'number'},{k:'failed',type:'number'}]}/>],
['/sources','Data Sources',Database,<Crud k="sources" title="Source" prefix="SRC" cols={['id','name','type','file','size','uploaded','status']} fields={[{k:'name',req:1},{k:'type',opts:['CSV','JSON','Excel']},{k:'file'},{k:'size'},{k:'uploaded',type:'date'},{k:'status',opts:['Simulated','Disconnected']},{k:'description'}]}/>],
['/compare','Compare Files',FileSpreadsheet,<Compare/>],
['/targets','Target Databases',Server,<Crud k="targets" title="Target" prefix="TGT" rowExtra={(r,rows,set)=>[<button key="t" className="btn ghost" onClick={()=>{set(p=>p.map(x=>x.id==r.id?{...x,status:'Testing'}:x));setTimeout(()=>{set(p=>p.map(x=>x.id==r.id?{...x,status:'Connected'}:x));toast('Simulated connection test passed (no real connection)')},900)}}>Test</button>]} cols={['id','name','type','host','port','database','username','status']} fields={[{k:'name',req:1},{k:'type',opts:['PostgreSQL','MySQL','MongoDB','Oracle']},{k:'host',req:1},{k:'port',req:1},{k:'database',req:1},{k:'username'},{k:'status',opts:['Connected','Untested','Failed']}]}/>],
['/mapping','Data Mapping',GitCompare,<Mapping/>],
['/jobs','Migration Jobs',Play,<Jobs/>],
['/validation','Data Validation',ShieldCheck,<Validation/>],
['/errors','Error Logs',AlertTriangle,<Crud k="errors" title="Error" prefix="ERR" cols={['id','project','severity','message','time','status']} fields={[{k:'project',req:1},{k:'severity',opts:['Critical','High','Medium','Low']},{k:'message',req:1},{k:'time'},{k:'status',opts:S}]}/>],
['/history','Migration History',History,<Crud k="projects" title="Project" prefix="PRJ" cols={['id','name','created','status','total','success','failed']} fields={[{k:'name',req:1},{k:'status',opts:P}]}/>],
['/reports','Reports & Downloads',FileText,<Reports/>],
['/notifications','Notifications',Bell,<Crud k="notifications" title="Notification" prefix="N" cols={['id','title','message','time','status']} fields={[{k:'title',req:1},{k:'message'},{k:'status',opts:['Unread','Read']}]}/>],
['/excel-filter-split','Excel Filter & Split',Filter,<ExcelFilterSplit/>],
['/settings','Settings',Cog,<Settings/>]];
export default function App(){const [col,setCol]=useState(false);const [drawer,setDrawer]=useState(false);const mq='(min-width:1024px)';const [wide,setWide]=useState(()=>window.matchMedia(mq).matches);const [t,setT]=useState(null);const [um,setUm]=useState(false);const [pf]=useStore('prefs');const [n]=useStore('notifications');const loc=useLocation();const nav=useNavigate();const [q,setQ]=useState('');
useEffect(()=>{const h=e=>{setT(e.detail);setTimeout(()=>setT(null),2800)};window.addEventListener('toast',h);return()=>window.removeEventListener('toast',h)},[]);
useEffect(()=>{const m=window.matchMedia(mq),h=()=>{setWide(m.matches);if(m.matches)setDrawer(false)};m.addEventListener('change',h);return()=>m.removeEventListener('change',h)},[]);
useEffect(()=>{setDrawer(false)},[loc.pathname]);
useEffect(()=>{if(!drawer)return;const k=e=>e.key=='Escape'&&setDrawer(false);document.addEventListener('keydown',k);const prev=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',k);document.body.style.overflow=prev}},[drawer]);
const cur=R.find(r=>r[0]==loc.pathname)||R[0];
return <div className={'app '+pf.theme+(col?' collapsed':'')+(drawer?' drawer':'')}><aside id="sidebar" aria-hidden={!wide&&!drawer}><div className="brand"><h1>MigrateHub</h1><button className="ic close" aria-label="Close menu" onClick={()=>setDrawer(false)}><X size={20}/></button></div>{R.map(([p,l,I])=><NavLink key={p} to={p} end={p=='/'} onClick={()=>setDrawer(false)}><I size={18}/><span>{l}</span></NavLink>)}</aside>{drawer&&!wide&&<div className="scrim" onClick={()=>setDrawer(false)}/>}
<main><header><button className="ic" aria-label="Toggle menu" aria-controls="sidebar" onClick={()=>wide?setCol(!col):setDrawer(!drawer)}><Menu/></button><span className="crumb">Home / <b>{cur[1]}</b></span><span className="grow"/>
<form className="search" onSubmit={e=>{e.preventDefault();const m=R.find(r=>r[1].toLowerCase().includes(q.toLowerCase()));m&&nav(m[0]);setQ('')}}><Search size={16}/><input placeholder="Go to pageâ€¦" value={q} onChange={e=>setQ(e.target.value)}/></form>
<button className="ic bell" onClick={()=>nav('/notifications')}><Bell/>{n.filter(x=>x.status=='Unread').length>0&&<i>{n.filter(x=>x.status=='Unread').length}</i>}</button>
<div className="um"><button className="ic" onClick={()=>setUm(!um)}><User/></button>{um&&<div className="dd"><button onClick={()=>{setUm(false);nav('/settings')}}>Profile</button><button onClick={()=>{setUm(false);location.reload()}}><LogOut size={14}/> Logout</button></div>}</div></header>
<section><h2>{cur[1]}</h2><Routes>{R.map(([p,,,el])=><Route key={p} path={p} element={el}/>)}</Routes></section></main>
{t&&<div className={'toast '+t.t}>{t.m}</div>}</div>}


