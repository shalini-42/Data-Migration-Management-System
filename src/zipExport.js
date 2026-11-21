import JSZip from 'jszip';import {toast} from './store.js';
import pkg from '../package.json?raw';import idx from '../index.html?raw';import vc from '../vite.config.js?raw';import rd from '../README.md?raw';
const src=import.meta.glob('/src/**/*.{js,jsx,css}',{query:'?raw',import:'default',eager:true});
export async function downloadProjectZip(){const z=new JSZip(),r=z.folder('data-migration-frontend');
Object.entries(src).forEach(([p,c])=>r.file(p.slice(1),c));r.file('package.json',pkg);r.file('index.html',idx);r.file('vite.config.js',vc);r.file('README.md',rd);r.folder('public');
const b=await z.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='data-migration-frontend.zip';a.click();URL.revokeObjectURL(a.href);toast(`ZIP created with ${Object.keys(src).length+4} files`)}
