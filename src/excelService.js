import * as XLSX from 'xlsx';
export const OPS=['equals','not equals','contains','starts with','ends with','greater than','less than','between','empty','not empty'];
const enc=XLSX.utils.encode_cell,tick=()=>new Promise(r=>setTimeout(r,0));
export const norm=v=>v==null?'':v instanceof Date?(isNaN(v)?'':v.toISOString().slice(0,10)):String(v).trim();
export const cleanName=s=>{s=String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,100)||'Blank';return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)?'_'+s:s};
export const cleanSheet=s=>String(s).replace(/[\[\]:*?/\\]/g,'_').replace(/^'+|'+$/g,'').slice(0,31)||'Sheet';
export const baseName=n=>n.replace(/\.[^.]+$/,'');
export function readWorkbook(buf,name){const csv=/\.csv$/i.test(name);const wb=XLSX.read(buf,{type:'array',cellDates:true,cellFormula:true,raw:csv});
return wb.SheetNames.map(n=>{const ws=wb.Sheets[n];if(!ws['!ref'])return{name:n,cols:[],rows:[],ws,r0:0,c0:0};const rg=XLSX.utils.decode_range(ws['!ref']),cols=[];
for(let c=rg.s.c;c<=rg.e.c;c++){let h=norm(ws[enc({r:rg.s.r,c})]?.v)||'Column '+(c+1);while(cols.includes(h))h+='_';cols.push(h)}
const rows=[];for(let r=rg.s.r+1;r<=rg.e.r;r++){const vals=cols.map((_,i)=>ws[enc({r,c:rg.s.c+i})]?.v);if(vals.some(v=>v!==undefined&&v!==''))rows.push({r,vals})}
return{name:n,cols,rows,ws,r0:rg.s.r,c0:rg.s.c}})}
export function colType(sh,col){const i=sh.cols.indexOf(col);const v=sh.rows.slice(0,300).map(r=>r.vals[i]).filter(x=>x!==undefined&&x!=='');return !v.length?'text':v.every(x=>x instanceof Date)?'date':v.every(x=>typeof x=='number')?'number':'text'}
export function uniqueValues(list,col){const m=new Map();list.forEach(({sh})=>{const i=sh.cols.indexOf(col);if(i<0)return;sh.rows.forEach(r=>{const d=norm(r.vals[i]),k=d.toLowerCase(),e=m.get(k);e?e.count++:m.set(k,{v:d,count:1})})});return[...m.values()].sort((a,b)=>a.v.localeCompare(b.v))}
export const validCond=c=>c.on!==false&&c.col&&(c.op=='empty'||c.op=='not empty'||c.vals?.length||String(c.v1??'')!==''&&(c.op!='between'||String(c.v2??'')!==''));
export const describe=(cs,j)=>cs.filter(validCond).map(c=>`${c.col} ${c.op}${c.op=='empty'||c.op=='not empty'?'':' '+(c.vals?.length?c.vals.join(' | '):c.v1)+(c.op=='between'?' and '+c.v2:'')}`).join(` ${j} `)||'No filters';
function test(c,row,sh,type){const i=sh.cols.indexOf(c.col);if(i<0)return false;const x=row.vals[i],s=norm(x),L=s.toLowerCase(),v=String(c.v1??'').trim().toLowerCase();
const key=y=>type=='number'?(typeof y=='number'?y:parseFloat(y)):type=='date'?(y instanceof Date?+y:Date.parse(y)):String(norm(y)).toLowerCase();
switch(c.op){case'empty':return s==='';case'not empty':return s!=='';
case'equals':case'not equals':{const r=c.vals?.length?c.vals.some(a=>norm(a).toLowerCase()==L):L==v;return c.op=='equals'?r:!r}
case'contains':return L.includes(v);case'starts with':return L.startsWith(v);case'ends with':return L.endsWith(v);
default:{const a=key(x),b=key(c.v1),e=key(c.v2);if(s===''||a!=a||b!=b)return false;return c.op=='greater than'?a>b:c.op=='less than'?a<b:e==e&&a>=b&&a<=e}}}
export function applyFilters(sh,conds,joiner){const cs=conds.filter(validCond);if(!cs.length)return sh.rows;const ty=Object.fromEntries(cs.map(c=>[c.col,colType(sh,c.col)]));
return sh.rows.filter(r=>joiner=='OR'?cs.some(c=>test(c,r,sh,ty[c.col])):cs.every(c=>test(c,r,sh,ty[c.col])))}
const shiftF=(f,o,n)=>{if(/[!:$]/.test(f))return null;let ok=true;const out=f.replace(/\b([A-Z]{1,3})(\d+)\b(?!\()/g,(m,c,r)=>{if(+r!==o){ok=false;return m}return c+n});return ok?out:null};
export function buildSheet(sh,rows,formulas){const ws={};sh.cols.forEach((_,c)=>{const h=sh.ws[enc({r:sh.r0,c:sh.c0+c})];ws[enc({r:0,c})]=h&&h.v!==undefined?{t:h.t,v:h.v,z:h.z}:{t:'s',v:sh.cols[c]}});
rows.forEach((row,i)=>sh.cols.forEach((_,c)=>{const o=sh.ws[enc({r:row.r,c:sh.c0+c})];if(!o||o.v===undefined)return;const cell={t:o.t,v:o.v};if(o.z)cell.z=o.z;if(formulas&&o.f){const f=shiftF(o.f,row.r+1,i+2);if(f)cell.f=f}ws[enc({r:i+1,c})]=cell}));
ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:Math.max(sh.cols.length-1,0)}});return ws}
const sheetNames=parts=>{const used=new Set();return parts.map(p=>{let n=cleanSheet(p.sh.name),k=2;if(used.has(n.toLowerCase()))n=cleanSheet(baseName(p.file)+'_'+p.sh.name);while(used.has(n.toLowerCase()))n=cleanSheet(n.slice(0,27)+'_'+k++);used.add(n.toLowerCase());return n})};
export async function buildPlan(o,onP=()=>{}){const{sheets,conds,joiner,splitCols,prefix='',suffix=''}=o;const mode=splitCols.length?o.mode:'perSheet';
const groups=new Map(),skipped=[];let done=0;const tot=sheets.reduce((a,s)=>a+s.sh.rows.length,0)||1;
for(const{file,sh}of sheets){const idx=splitCols.map(c=>sh.cols.indexOf(c));if(idx.includes(-1)){skipped.push({file,sheet:sh.name,reason:'Missing split column: '+splitCols.filter((c,i)=>idx[i]<0).join(', ')});continue}
const kept=applyFilters(sh,conds,joiner);if(!kept.length){skipped.push({file,sheet:sh.name,reason:'No rows match the filters'});done+=sh.rows.length;continue}
for(let i=0;i<kept.length;i++){const row=kept[i],parts=idx.map(j=>norm(row.vals[j]));const key=(mode=='perSheet'?file+'\0'+sh.name+'\0':'')+parts.map(p=>p.toLowerCase()).join('\0');
let g=groups.get(key);if(!g){g={label:parts.map(p=>p||'Blank').join('_'),parts:new Map(),n:0};groups.set(key,g)}let p=g.parts.get(sh);if(!p)g.parts.set(sh,p=({file,sh,rows:[]}));p.rows.push(row);g.n++;if(i%20000==19999){onP((done+i)/tot);await tick()}}
done+=sh.rows.length;onP(done/tot);await tick()}
const used=new Set(),outputs=[];for(const g of groups.values()){const parts=[...g.parts.values()];const core=g.label?prefix+g.label+suffix:'';
const base=mode=='combined'?core:[core,baseName(parts[0].file),parts[0].sh.name].filter(Boolean).join('_');let b=cleanName(base),n=b+'.xlsx',k=2;while(used.has(n.toLowerCase()))n=`${b} (${k++}).xlsx`;used.add(n.toLowerCase());
const sn=sheetNames(parts);outputs.push({name:n,rows:g.n,parts,sheets:parts.map((p,i)=>({name:sn[i],source:p.file+' › '+p.sh.name,rows:p.rows.length}))})}
return{outputs,skipped,mode,totalRows:outputs.reduce((a,x)=>a+x.rows,0)}}
export function makeBytes(out,formulas=false){const wb=XLSX.utils.book_new();out.parts.forEach((p,i)=>XLSX.utils.book_append_sheet(wb,buildSheet(p.sh,p.rows,formulas),out.sheets[i].name));return XLSX.write(wb,{type:'array',bookType:'xlsx',cellDates:true})}
export async function makeZip(outs,formulas,onP=()=>{}){const{default:JSZip}=await import('jszip');const z=new JSZip();for(let i=0;i<outs.length;i++){z.file(outs[i].name,makeBytes(outs[i],formulas));onP((i+1)/outs.length);await tick()}return z.generateAsync({type:'uint8array',compression:'DEFLATE'})}
export function filteredBytes(list,conds,joiner,formulas){const wb=XLSX.utils.book_new(),used=new Set();list.forEach(({file,sh})=>{let n=cleanSheet(sh.name),k=2;while(used.has(n.toLowerCase()))n=cleanSheet(n.slice(0,27)+'_'+k++);used.add(n.toLowerCase());XLSX.utils.book_append_sheet(wb,buildSheet(sh,applyFilters(sh,conds,joiner),formulas),n)});return XLSX.write(wb,{type:'array',bookType:'xlsx',cellDates:true})}
export const filteredCsv=(sh,conds,joiner)=>XLSX.utils.sheet_to_csv(buildSheet(sh,applyFilters(sh,conds,joiner),false));
