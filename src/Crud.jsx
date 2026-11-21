import {useState,useMemo} from 'react';import {Plus,Eye,Pencil,Trash2,Search,X} from 'lucide-react';import {useStore,toast} from './store.js';
export function Modal({title,children,onClose}){return <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="mh"><h3>{title}</h3><button className="ic" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}
export function Confirm({text,onYes,onNo}){return <Modal title="Please confirm" onClose={onNo}><p>{text}</p><div className="row end"><button className="btn ghost" onClick={onNo}>Cancel</button><button className="btn danger" onClick={onYes}>Confirm</button></div></Modal>}
export default function Crud({k,title,prefix,fields,cols,statusKey='status',extra,rowExtra}){
const [rows,setRows]=useStore(k);const [q,setQ]=useState('');const [f,setF]=useState('');const [sort,setSort]=useState({c:cols[0],d:1});const [pg,setPg]=useState(0);const [m,setM]=useState(null);const [err,setErr]=useState({});
const statuses=[...new Set(rows.map(r=>r[statusKey]).filter(Boolean))];const PS=8;
const list=useMemo(()=>rows.filter(r=>(!f||r[statusKey]===f)&&JSON.stringify(r).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(a[sort.c]>b[sort.c]?1:-1)*sort.d),[rows,q,f,sort]);
const pages=Math.max(1,Math.ceil(list.length/PS));const cur=Math.min(pg,pages-1);const view=list.slice(cur*PS,cur*PS+PS);
const save=()=>{const e={};fields.forEach(x=>{if(x.req&&!String(m.d[x.k]||'').trim())e[x.k]='Required'});setErr(e);if(Object.keys(e).length)return;
if(m.t=='add')setRows([{...m.d,id:prefix+'-'+(Date.now()%100000)},...rows]);else setRows(rows.map(r=>r.id==m.d.id?m.d:r));toast(title+' saved');setM(null)};
const th=c=><th key={c} onClick={()=>setSort({c,d:sort.c==c?-sort.d:1})}>{c}{sort.c==c?(sort.d>0?' ▲':' ▼'):''}</th>;
return <div className="card"><div className="row"><div className="search"><Search size={16}/><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
<select value={f} onChange={e=>setF(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><span className="grow"/>{extra}
<button className="btn" onClick={()=>{setErr({});setM({t:'add',d:{}})}}><Plus size={16}/>Add</button></div>
<div className="tw"><table><thead><tr>{cols.map(th)}<th>Actions</th></tr></thead><tbody>
{view.map(r=><tr key={r.id}>{cols.map(c=><td key={c}>{c==statusKey?<span className={'badge '+String(r[c]).toLowerCase()}>{r[c]}</span>:String(r[c]??'')}</td>)}
<td className="act">{rowExtra&&rowExtra(r,rows,setRows)}<button className="ic" onClick={()=>setM({t:'view',d:r})}><Eye size={16}/></button><button className="ic" onClick={()=>{setErr({});setM({t:'edit',d:{...r}})}}><Pencil size={16}/></button><button className="ic" onClick={()=>setM({t:'del',d:r})}><Trash2 size={16}/></button></td></tr>)}
{!view.length&&<tr><td colSpan={cols.length+1} className="empty">No records found</td></tr>}</tbody></table></div>
<div className="row end"><button className="btn ghost" disabled={cur==0} onClick={()=>setPg(cur-1)}>Prev</button><span>Page {cur+1} / {pages}</span><button className="btn ghost" disabled={cur+1>=pages} onClick={()=>setPg(cur+1)}>Next</button></div>
{m&&m.t=='del'&&<Confirm text={`Delete ${m.d.id}?`} onNo={()=>setM(null)} onYes={()=>{setRows(rows.filter(r=>r.id!=m.d.id));toast('Deleted');setM(null)}}/>}
{m&&m.t=='view'&&<Modal title={title+' details'} onClose={()=>setM(null)}><dl>{Object.entries(m.d).map(([a,b])=><div key={a}><dt>{a}</dt><dd>{String(b)}</dd></div>)}</dl></Modal>}
{m&&(m.t=='add'||m.t=='edit')&&<Modal title={(m.t=='add'?'Add ':'Edit ')+title} onClose={()=>setM(null)}><div className="form">{fields.map(x=><label key={x.k}>{x.label||x.k}{x.opts?<select value={m.d[x.k]||''} onChange={e=>setM({...m,d:{...m.d,[x.k]:e.target.value}})}><option value="">Select…</option>{x.opts.map(o=><option key={o}>{o}</option>)}</select>:<input type={x.type||'text'} value={m.d[x.k]||''} onChange={e=>setM({...m,d:{...m.d,[x.k]:x.type=='number'?+e.target.value:e.target.value}})}/>}{err[x.k]&&<small className="er">{err[x.k]}</small>}</label>)}</div>
<div className="row end"><button className="btn ghost" onClick={()=>setM(null)}>Cancel</button><button className="btn" onClick={save}>Save</button></div></Modal>}</div>}
