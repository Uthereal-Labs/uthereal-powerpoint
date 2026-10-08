/** Aurelia document/geometry/command kernel. No browser or renderer dependencies. */
export const VERSION = 1;
export const GROUNDING_CONTRACT = 3;
export const GROUNDING_CAPABILITY = 'grounding_lifecycle_v3';
/** Deck themes. Color keys resolve as @tokens; mode and fonts describe the theme to authors. */
export const THEMES = {
  studio: { name:'Terracotta', mode:'light', headingFont:'Georgia', bodyFont:'Arial', bg:'#F5F2EC', ink:'#17313A', dark:'#17313A', light:'#F5F2EC', accent:'#DA735B', secondary:'#A5B8AF', muted:'#71827F', line:'#DDDCD4', surface:'#ECE7DD', highlight:'#F3D9CF' },
  midnight: { name:'Midnight', mode:'light', headingFont:'Arial', bodyFont:'Arial', bg:'#EDF0F7', ink:'#202941', dark:'#202941', light:'#EDF0F7', accent:'#8992DF', secondary:'#B4C9E2', muted:'#7B829A', line:'#D3D7E4', surface:'#E2E6F1', highlight:'#DCDDF6' },
  forest: { name:'Botanical', mode:'light', headingFont:'Georgia', bodyFont:'Arial', bg:'#F2F3EA', ink:'#203B32', dark:'#203B32', light:'#F2F3EA', accent:'#99AA69', secondary:'#C7D4B8', muted:'#6C8271', line:'#D5DCCD', surface:'#E7E9DA', highlight:'#E3EACB' },
  cobalt: { name:'Blueprint', mode:'light', headingFont:'Arial', bodyFont:'Arial', bg:'#F3F6FF', ink:'#172B51', dark:'#172B51', light:'#F3F6FF', accent:'#446CE9', secondary:'#ADC8EF', muted:'#7183A5', line:'#D7DFF0', surface:'#E6ECFB', highlight:'#D6E0FB' },
  rose: { name:'Atelier', mode:'light', headingFont:'Georgia', bodyFont:'Arial', bg:'#FBF3F1', ink:'#4C313C', dark:'#4C313C', light:'#FBF3F1', accent:'#CC788D', secondary:'#D9BEA6', muted:'#997B85', line:'#ECD7DD', surface:'#F5E6E2', highlight:'#F2D6DD' },
  editorial: { name:'Editorial', mode:'light', headingFont:'Georgia', bodyFont:'Arial', bg:'#F5F1E8', ink:'#1D2B3A', dark:'#1D2B3A', light:'#F5F1E8', accent:'#C4622D', secondary:'#A9B4BE', muted:'#6B7480', line:'#E4DDCF', surface:'#EAE3D4', highlight:'#F6DCC8' },
  mono: { name:'Mono', mode:'light', headingFont:'Arial', bodyFont:'Arial', bg:'#FFFFFF', ink:'#111827', dark:'#111827', light:'#FFFFFF', accent:'#2563EB', secondary:'#93B4F5', muted:'#6B7280', line:'#E5E7EB', surface:'#F3F4F6', highlight:'#DBE7FD' },
  slate: { name:'Slate', mode:'dark', headingFont:'Georgia', bodyFont:'Arial', bg:'#0F1A2B', ink:'#EEF2F7', dark:'#0A1220', light:'#F5F7FA', accent:'#F2B33D', secondary:'#5B7DB1', muted:'#9AA8BC', line:'#22324A', surface:'#17253B', highlight:'#3A3420' },
  graphite: { name:'Graphite', mode:'dark', headingFont:'Arial', bodyFont:'Arial', bg:'#1A1C20', ink:'#F0F0EC', dark:'#0F1013', light:'#F4F4F0', accent:'#3FB8A8', secondary:'#5F6B78', muted:'#A1A6AD', line:'#2A2D33', surface:'#24272D', highlight:'#1F3A37' }
};
export const THEME_COLOR_TOKENS = ['bg','ink','dark','light','accent','secondary','muted','line','surface','highlight'];
export const clone = value => structuredClone(value);
export const uid = (prefix='e') => `${prefix}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now().toString(36)}`;
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const color = (value,theme='studio') => value?.startsWith('@') ? ((THEME_COLOR_TOKENS.includes(value.slice(1))&&THEMES[theme]?.[value.slice(1)]) || '#17313A') : (value || '#000000');
export const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function makeElement(type='rect', props={}) {
  return { id:uid(), type, name:({text:'Text box',rect:'Rectangle',roundRect:'Rounded rectangle',ellipse:'Ellipse',line:'Line',triangle:'Triangle',diamond:'Diamond',arrow:'Arrow',star:'Star',image:'Picture',chart:'Chart',table:'Table'})[type]||type,
    x:100,y:100,w:320,h:160,rotation:0,opacity:1,fill:'@accent',stroke:'none',strokeWidth:0,radius:22,locked:false,hidden:false,groupId:null,animation:'none',grounding:[],
    ...(type==='text'?{text:'Your next great idea',fill:'@ink',fontFamily:'Arial',fontSize:40,bold:false,italic:false,underline:false,align:'left',valign:'top',lineHeight:1.2,padding:4}:{}),...props };
}
export function makeSlide(layout='blank', theme='studio') {
  const s={id:uid('s'),name:layout==='blank'?'Blank slide':'Untitled slide',bg:'@bg',notes:'',transition:'fade',duration:0.45,elements:[]};
  if(layout==='title') s.elements=[makeElement('text',{name:'Title',x:88,y:215,w:1100,h:160,text:'A new perspective.',fontSize:92,bold:true}),makeElement('text',{name:'Subtitle',x:94,y:415,w:1000,h:80,text:'An idea worth sharing.',fontSize:28,fill:'@muted'})];
  if(layout==='content'||layout==='split') {
    s.elements.push(makeElement('text',{name:'Title',x:78,y:65,w:1110,h:100,text:'Make your point.',fontSize:62,bold:true}));
    s.elements.push(makeElement('text',{name:'Content',x:82,y:225,w:layout==='split'?515:1100,h:385,text:'Start with what matters.\n\nConnect the dots.\n\nGive your audience a reason to care.',fontSize:31,fill:'@muted'}));
    if(layout==='split')s.elements.push(makeElement('roundRect',{name:'Visual',x:660,y:222,w:530,h:380,fill:'@secondary',radius:24}));
  }
  if(layout==='quote') s.elements=[makeElement('text',{x:90,y:110,w:180,h:180,text:'“',fontSize:180,fill:'@accent',fontFamily:'Georgia'}),makeElement('text',{name:'Quote',x:120,y:270,w:1000,h:240,text:'Great stories make\ncomplex ideas feel simple.',fontSize:64,fontFamily:'Georgia'}),makeElement('text',{x:125,y:570,w:700,h:50,text:'YOUR NAME  /  YOUR PERSPECTIVE',fontSize:18,fill:'@muted'})];
  return s;
}
export function makeDocument() { return {format:'aurelia',version:VERSION,grounding_contract:GROUNDING_CONTRACT,id:uid('deck'),title:'Untitled presentation',width:1280,height:720,theme:'studio',slides:[makeSlide('title')]}; }
// String indices are UTF-16 offsets, including astral characters and newlines.
export function elementText(element) {
  if(element.type==='text')return String(element.text??'');
  if(element.type==='table')return element.cells.map(row=>row.join('\t')).join('\n');
  return '';
}
function contentSignature(element) {
  return element.type==='table'?JSON.stringify(element.cells):elementText(element);
}
const validIdentity=value=>typeof value==='string'&&value.length>0&&value.length<=200;
export function validateGroundingOrigin(origin) {
  if(!origin||typeof origin!=='object'||Array.isArray(origin))throw new Error('Invalid grounding origin.');
  if(origin.kind==='saved'&&validIdentity(origin.revision_id)&&validIdentity(origin.association_id))
    return {kind:'saved',revision_id:origin.revision_id,association_id:origin.association_id};
  if(origin.kind==='agent'&&validIdentity(origin.job_id)&&Number.isInteger(origin.steering_revision)&&origin.steering_revision>=0&&Number.isInteger(origin.sequence)&&origin.sequence>=0&&validIdentity(origin.declaration_id))
    return {kind:'agent',job_id:origin.job_id,steering_revision:origin.steering_revision,sequence:origin.sequence,declaration_id:origin.declaration_id};
  throw new Error('Invalid grounding origin.');
}
export function resolveGrounding(element, declarations) {
    const text = elementText(element);
    if (!Array.isArray(declarations)) throw new Error('Invalid native grounding declarations.');
    const diagnostics = [];
    const annotations = declarations.map(declaration => {
        if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration) ||
            Object.keys(declaration).some(key => !['id', 'claim_ids', 'relation', 'origin', 'passage'].includes(key)))
            throw new Error('Invalid native grounding declaration fields.');
        let anchor = { scope: 'object' };
        if (declaration.passage !== undefined) {
            if (typeof declaration.passage !== 'string' || !declaration.passage.length || declaration.passage.length > 32000)
                throw new Error('Invalid optional grounding passage.');
            const start = text.indexOf(declaration.passage);
            const reason = start < 0 ? 'passage_not_found' : text.indexOf(declaration.passage, start + 1) >= 0 ? 'passage_ambiguous' : null;
            if (reason) {
                if (diagnostics.length < 20) diagnostics.push({ annotation_id: declaration.id, reason, scope: 'object' });
            } else anchor = { scope: 'passage', quote: declaration.passage, start, end: start + declaration.passage.length };
        }
        return { id: declaration.id, anchor, claim_ids: declaration.claim_ids, relation: declaration.relation, origin: declaration.origin };
    });
    return { annotations: validateGrounding(element, annotations), diagnostics };
}

export function validateCitationAnchor(anchor, text) {
    if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) throw new Error('Invalid native citation anchor.');
    const keys = Object.keys(anchor);
    if (anchor.scope === 'object' && keys.length === 1) return { scope: 'object' };
    if (anchor.scope !== 'passage' || keys.length !== 4 || !keys.every(key => ['scope', 'quote', 'start', 'end'].includes(key)) ||
        !Number.isSafeInteger(anchor.start) || !Number.isSafeInteger(anchor.end) || anchor.start < 0 ||
        anchor.end <= anchor.start || anchor.end > text.length || typeof anchor.quote !== 'string' ||
        !anchor.quote.length || anchor.quote.length > 32000 || text.slice(anchor.start, anchor.end) !== anchor.quote)
        throw new Error('Citation passage does not match its exact UTF-16 span.');
    return { scope: 'passage', quote: anchor.quote, start: anchor.start, end: anchor.end };
}
/** Carry associations only on the same surviving authored element. */
function continueGrounding(element) {
  const text=elementText(element);
  const annotations=(element.grounding||[]).map(annotation=>{
    const anchor=annotation.anchor;
    if(anchor?.scope!=='passage')return annotation;
    if(Object.keys(anchor).length!==4||!Object.keys(anchor).every(key=>['scope','quote','start','end'].includes(key))||
      typeof anchor.quote!=='string'||!anchor.quote.length||anchor.quote.length>32000||!Number.isSafeInteger(anchor.start)||!Number.isSafeInteger(anchor.end)||anchor.start<0||anchor.end<=anchor.start||anchor.end-anchor.start!==anchor.quote.length)
      throw new Error('Invalid original citation passage.');
    if(text.slice(anchor.start,anchor.end)===anchor.quote)return annotation;
    const start=text.indexOf(anchor.quote);
    return {...annotation,anchor:start>=0&&text.indexOf(anchor.quote,start+1)<0?{scope:'passage',quote:anchor.quote,start,end:start+anchor.quote.length}:{scope:'object'}};
  });
  return validateGrounding(element,annotations);
}
export function validateGrounding(element, annotations, seen=new Set()) {
  if(!Array.isArray(annotations)||annotations.length>2000)throw new Error('Invalid grounding annotations.');
  if(annotations.length&&!['text','table'].includes(element.type))throw new Error('Only text and table objects can contain grounding.');
  const text=elementText(element);
  return annotations.map(annotation=>{
    if(!annotation||!validIdentity(annotation.id)||seen.has(annotation.id))throw new Error('Grounding annotation IDs must be unique.');
    if(Object.keys(annotation).some(key=>!['id','anchor','claim_ids','relation','origin'].includes(key)))throw new Error('Invalid native annotation fields.');
    const anchor=validateCitationAnchor(annotation.anchor,text);
    if(!Array.isArray(annotation.claim_ids)||!annotation.claim_ids.length||annotation.claim_ids.length>12||annotation.claim_ids.some(id=>!validIdentity(id))||new Set(annotation.claim_ids).size!==annotation.claim_ids.length)
      throw new Error('Invalid grounding claims.');
    if(!['supports','derived'].includes(annotation.relation))throw new Error('Invalid grounding relation.');
    const origin=validateGroundingOrigin(annotation.origin);seen.add(annotation.id);if(seen.size>2000)throw new Error('Presentation exceeds the 2,000-annotation limit.');
    return {id:annotation.id,anchor,claim_ids:[...annotation.claim_ids],relation:annotation.relation,origin};
  });
}
// Exported Office packages and clipboard payloads never expose evidence metadata.
export function stripGrounding(doc,{keepContract=false}={}) {
  const out=clone(doc);if(!keepContract)delete out.grounding_contract;
  for(const slide of out.slides)for(const element of slide.elements){if(keepContract)element.grounding=[];else delete element.grounding;}
  return out;
}
export function copyElements(elements,{retainGrounding=true,offset=0,unlock=false}={}) {
  const groups=new Map();return clone(elements).map(element=>{
    element.id=uid();element.x+=offset;element.y+=offset;if(unlock)element.locked=false;
    element.grounding=retainGrounding?(element.grounding||[]).map(annotation=>({...annotation,id:uid('a')})):[];
    if(element.groupId){if(!groups.has(element.groupId))groups.set(element.groupId,uid('g'));element.groupId=groups.get(element.groupId);}
    return element;
  });
}
// External files are content imports. No submitted evidence association is trusted.
export function importExternalDocument(raw) {
  const out=clone(raw);out.grounding_contract=GROUNDING_CONTRACT;out.id=uid('deck');
  if(!Array.isArray(out.slides))throw new Error('Invalid presentation slides.');
  out.slides=out.slides.map(slide=>({...slide,id:uid('s'),elements:copyElements(slide.elements,{retainGrounding:false})}));
  return validateDocument(out);
}
const VALID_TYPES=new Set(['rect','roundRect','ellipse','triangle','diamond','arrow','star','line','text','image','chart','table']);
const VALID_COLORS=/^(?:@[a-z]+|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|none)$/;
const fontName=v=>String(v).replace(/[^a-zA-Z0-9 ,\-]/g,'').slice(0,100);
/** Optional chart/table styling; absent properties stay absent so older documents round-trip unchanged. */
function validateDataStyle(e,v){
  if(typeof v.fontFamily==='string'&&fontName(v.fontFamily))e.fontFamily=fontName(v.fontFamily);
  if(e.type==='chart'&&Number.isInteger(v.highlight))e.highlight=clamp(v.highlight,-1,29);
}
function validateTableStyle(e,v){
  const cols=Math.max(1,...e.cells.map(r=>r.length));
  if(Array.isArray(v.columnWidths)&&v.columnWidths.length===cols&&v.columnWidths.every(w=>Number.isFinite(+w)&&+w>0))e.columnWidths=v.columnWidths.map(w=>clamp(+w,0.01,1000));
  if(Array.isArray(v.columnAlign)&&v.columnAlign.length===cols)e.columnAlign=v.columnAlign.map(a=>['left','center','right'].includes(a)?a:'left');
  if(Array.isArray(v.highlightRows))e.highlightRows=[...new Set(v.highlightRows.filter(r=>Number.isInteger(r)&&r>0&&r<e.cells.length))].sort((a,b)=>a-b);
  if(typeof v.banded==='boolean')e.banded=v.banded;
  if(typeof v.headerColor==='string'&&VALID_COLORS.test(v.headerColor))e.headerColor=v.headerColor;
}
export function validateDocument(raw) {
  if(!raw||raw.format!=='aurelia'||raw.version!==VERSION||raw.grounding_contract!==GROUNDING_CONTRACT)throw new Error('Incompatible presentation format: grounding contract 3 is required.');
  if(!Array.isArray(raw.slides)||raw.slides.length<1||raw.slides.length>500)throw new Error('A presentation must contain 1–500 slides.');
  const d=makeDocument(); d.id=String(raw.id||d.id);d.title=String(raw.title||'Untitled presentation').slice(0,200);d.width=clamp(Number(raw.width)||1280,320,4096);d.height=clamp(Number(raw.height)||720,240,4096);d.theme=THEMES[raw.theme]?raw.theme:'studio';
  if(!validIdentity(raw.id))throw new Error('Invalid presentation identity.');
  const seen=new Set([d.id]),annotationsSeen=new Set();
  function safeId(id){if(!validIdentity(id)||seen.has(id))throw new Error('Presentation object IDs must be unique.');seen.add(id);return id;}
  const safeColor=(v,fallback)=>typeof v==='string'&&VALID_COLORS.test(v)?v:fallback;
  d.slides=raw.slides.map((s,index)=>{
    if(!Array.isArray(s.elements)||s.elements.length>5000)throw new Error(`Slide ${index+1} exceeds the 5,000-object limit.`);
    const out={id:safeId(s.id),name:String(s.name||`Slide ${index+1}`).slice(0,200),bg:safeColor(s.bg,'@bg'),notes:String(s.notes||'').slice(0,100000),transition:['none','fade','push','zoom'].includes(s.transition)?s.transition:'none',duration:clamp(+s.duration||0.45,0.1,5),elements:[]};
    out.elements=s.elements.map(v=>{
      if(!VALID_TYPES.has(v.type))throw new Error(`Unsupported object type: ${v.type}`);
      const e=makeElement(v.type);e.id=safeId(v.id);e.name=String(v.name||e.name).slice(0,200);
      for(const p of ['x','y','w','h','rotation','opacity','strokeWidth','radius'])if(Number.isFinite(v[p]))e[p]=clamp(v[p],-100000,100000);
      e.w=clamp(e.w,1,16384);e.h=clamp(e.h,1,16384);e.opacity=clamp(e.opacity,0,1);e.strokeWidth=clamp(e.strokeWidth,0,100);
      e.fill=safeColor(v.fill,e.fill);e.stroke=safeColor(v.stroke,'none');e.locked=!!v.locked;e.hidden=!!v.hidden;e.groupId=typeof v.groupId==='string'?v.groupId.slice(0,100):null;e.animation=['none','fade','rise','zoom'].includes(v.animation)?v.animation:'none';
      if(e.type==='text') {e.text=String(v.text||'').slice(0,100000);e.fontFamily=String(v.fontFamily||'Arial').replace(/[^a-zA-Z0-9 ,\-]/g,'').slice(0,100);e.fontSize=clamp(+v.fontSize||40,4,600);e.bold=!!v.bold;e.italic=!!v.italic;e.underline=!!v.underline;e.align=['left','center','right'].includes(v.align)?v.align:'left';e.valign=['top','middle','bottom'].includes(v.valign)?v.valign:'top';e.lineHeight=clamp(+v.lineHeight||1.2,0.8,3);e.padding=clamp(+v.padding||0,0,200);}
      if(e.type==='image'){if(typeof v.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.src)||v.src.length>30000000)throw new Error('Pictures must be embedded PNG, JPEG or WebP files, at most 22 MB each.');e.src=v.src;e.fit=v.fit==='contain'?'contain':'cover';}
      if(e.type==='chart'){validateDataStyle(e,v);e.chartType=['bar','line','donut'].includes(v.chartType)?v.chartType:'bar';e.labels=(v.labels||['A','B','C']).slice(0,30).map(x=>String(x).slice(0,80));e.values=(v.values||[20,40,70]).slice(0,e.labels.length).map(x=>clamp(Number(x)||0,0,1e12));while(e.values.length<e.labels.length)e.values.push(0);e.showValues=v.showValues!==false;}
      if(e.type==='table'){if(!Array.isArray(v.cells)||!v.cells.length)throw new Error('Invalid table.');e.cells=v.cells.slice(0,30).map(r=>Array.isArray(r)?r.slice(0,12).map(c=>String(c).slice(0,1000)):['']);e.fontSize=clamp(+v.fontSize||22,8,100);validateDataStyle(e,v);validateTableStyle(e,v);}
      e.grounding=validateGrounding(e,v.grounding,annotationsSeen);return e;
    });return out;
  });return d;
}
export function localPoint(e,p) {
  const a=-(e.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=p.x-e.x-e.w/2,dy=p.y-e.y-e.h/2;
  return {x:dx*c-dy*s+e.w/2,y:dx*s+dy*c+e.h/2};
}
export function hitElement(e,p,tolerance=4) {
  if(e.hidden)return false;
  const q=localPoint(e,p),cx=q.x-e.w/2,cy=q.y-e.h/2;
  if(e.type==='ellipse')return (cx/(e.w/2+tolerance))**2+(cy/(e.h/2+tolerance))**2<=1;
  if(e.type==='diamond')return Math.abs(cx)/(e.w/2+tolerance)+Math.abs(cy)/(e.h/2+tolerance)<=1;
  if(e.type==='line')return Math.abs(q.y-e.h/2)<=Math.max(tolerance,e.h/2)&&q.x>=-tolerance&&q.x<=e.w+tolerance;
  if(e.type==='triangle'){const allowance=(q.y/e.h)*(e.w/2)+tolerance;return q.y>=-tolerance&&q.y<=e.h+tolerance&&Math.abs(cx)<=allowance;}
  return q.x>=-tolerance&&q.y>=-tolerance&&q.x<=e.w+tolerance&&q.y<=e.h+tolerance;
}
export function elementBounds(e) {
  const a=(e.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),w=e.w*c+e.h*s,h=e.w*s+e.h*c;
  return {x:e.x+(e.w-w)/2,y:e.y+(e.h-h)/2,w,h};
}
export function unionBounds(elements) {
  if(!elements.length)return null; const bs=elements.map(elementBounds),x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));
  return {x,y,w:Math.max(...bs.map(b=>b.x+b.w))-x,h:Math.max(...bs.map(b=>b.y+b.h))-y};
}
export function rectIntersects(a,b) {return a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;}
export function snapMove(bounds,others,width,height,threshold=7) {
  const xs=[0,width/2,width],ys=[0,height/2,height];for(const e of others){const b=elementBounds(e);xs.push(b.x,b.x+b.w/2,b.x+b.w);ys.push(b.y,b.y+b.h/2,b.y+b.h);}
  function match(points,targets){let best={delta:0,line:null,d:threshold};for(const p of points)for(const t of targets){const d=Math.abs(t-p);if(d<best.d)best={delta:t-p,line:t,d};}return best;}
  const x=match([bounds.x,bounds.x+bounds.w/2,bounds.x+bounds.w],xs),y=match([bounds.y,bounds.y+bounds.h/2,bounds.y+bounds.h],ys);
  return {dx:x.delta,dy:y.delta,lines:[...(x.line===null?[]:[{axis:'x',value:x.line}]),...(y.line===null?[]:[{axis:'y',value:y.line}])]};
}
export class Store {
  constructor(doc=makeDocument()){this.doc=doc;this.active=doc.slides[0].id;this.selection=new Set();this.past=[];this.future=[];this.listeners=new Set();this.pending=null;this.clipboard=null;this.revision=0;this.maxHistory=100;this.maxHistoryBytes=40*1024*1024;}
  get slide(){return this.doc.slides.find(s=>s.id===this.active)||this.doc.slides[0];}
  get selected(){return this.slide.elements.filter(e=>this.selection.has(e.id));}
  onChange(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(kind='change'){for(const fn of this.listeners)fn(kind);}
  select(ids){this.selection=new Set(ids);this.emit('selection');}
  activate(id){if(!this.doc.slides.some(s=>s.id===id))return;this.active=id;this.selection.clear();this.emit('active');}
  snapshot(){return JSON.stringify({doc:this.doc,active:this.active});}
  begin(label='Edit'){if(!this.pending)this.pending={label,before:this.snapshot(),groundingAssignments:new Set()};}
  commit(){if(!this.pending)return false;const {label,before,groundingAssignments}=this.pending;
    const previous=new Map(JSON.parse(before).doc.slides.flatMap(slide=>slide.elements).map(element=>[element.id,element]));
    for(const element of this.doc.slides.flatMap(slide=>slide.elements)){
      const original=previous.get(element.id);
      if(original&&contentSignature(original)!==contentSignature(element)&&!groundingAssignments.has(element.id))element.grounding=continueGrounding(element);
    }
    this.pending=null;const after=this.snapshot();if(before===after)return false;this.past.push({label,before,after});this.future=[];let size=this.past.reduce((n,x)=>n+x.before.length+x.after.length,0);while(this.past.length>1&&(this.past.length>this.maxHistory||size>this.maxHistoryBytes)){const x=this.past.shift();size-=x.before.length+x.after.length;}this.revision++;this.emit('commit');return true;}
  cancel(){if(!this.pending)return;const snap=this.pending.before;this.pending=null;this.restore(snap);}
  transaction(label,fn){this.begin(label);try{fn(this.doc,this.slide);this.commit();}catch(e){this.cancel();throw e;}}
  restore(snapshot){const state=JSON.parse(snapshot);this.doc=state.doc;this.active=state.active;this.selection=new Set([...this.selection].filter(id=>this.slide.elements.some(e=>e.id===id)));this.revision++;this.emit('restore');}
  undo(){if(this.pending)this.commit();const cmd=this.past.pop();if(!cmd)return;this.future.push(cmd);this.restore(cmd.before);}
  redo(){const cmd=this.future.pop();if(!cmd)return;this.past.push(cmd);this.restore(cmd.after);}
  replace(doc){this.doc=validateDocument(doc);this.active=this.doc.slides[0].id;this.selection.clear();this.past=[];this.future=[];this.pending=null;this.clipboard=null;this.revision++;this.emit('restore');}
  setElementContent(element,props){const before=contentSignature(element);Object.assign(element,props);if(contentSignature(element)!==before)element.grounding=continueGrounding(element);}
  normalizeGrounding(document){for(const element of document.slides.flatMap(slide=>slide.elements))element.grounding=continueGrounding(element);return document;}
  inspectGrounding(objectIds=null){
    if(objectIds!==null&&(!Array.isArray(objectIds)||objectIds.some(id=>!validIdentity(id))))throw new Error('Invalid grounding target IDs.');
    const targets=objectIds===null?null:new Set(objectIds),units=[];
    this.doc.slides.forEach((slide,slideIndex)=>slide.elements.forEach((element,elementIndex)=>{
      if(['text','table'].includes(element.type)&&(!targets||targets.has(element.id)))units.push({object_id:element.id,text:elementText(element),grounding:clone(element.grounding),locations:[{slide_id:slide.id,slide_index:slideIndex,element_index:elementIndex,start:0,end:elementText(element).length}]});
    }));return units;
  }
  assignGrounding(assignments){
    if(!Array.isArray(assignments))throw new Error('Invalid grounding assignments.');
    const assigned=new Set(),elements=new Map(this.doc.slides.flatMap(slide=>slide.elements).map(element=>[element.id,element]));
    const seen=new Set(this.doc.slides.flatMap(slide=>slide.elements).filter(element=>!assignments.some(item=>item.object_id===element.id)).flatMap(element=>element.grounding.map(annotation=>annotation.id)));
    const validated=assignments.map(item=>{
      const element=elements.get(item.object_id);if(!element||assigned.has(item.object_id))throw new Error('Unknown or duplicate grounding target.');
      assigned.add(item.object_id);return {element,annotations:validateGrounding(element,item.annotations,seen)};
    });
    const apply=()=>{for(const {element,annotations}of validated){element.grounding=annotations;this.pending.groundingAssignments.add(element.id);}};
    if(this.pending)apply();else this.transaction('Assign grounding',apply);
    return {assigned:validated.length};
  }
  copySelected(){
    this.clipboard={handle:uid('clip'),artifact_id:this.doc.id,elements:clone(this.selected)};
    // The public record contains content only. The opaque handle can recover the
    // native record exclusively in this editor and artifact.
    return JSON.stringify({handle:this.clipboard.handle,elements:this.clipboard.elements.map(element=>{const out=clone(element);delete out.grounding;return out;})});
  }
  pasteObjects(payload=null){
    let record=this.clipboard,retainGrounding=record?.artifact_id===this.doc.id;
    if(payload!==null){
      const raw=JSON.parse(payload),handle=Array.isArray(raw)?null:raw.handle;
      if(!record||handle!==record.handle||!retainGrounding){
        const temp=makeDocument();temp.slides[0].elements=(Array.isArray(raw)?raw:raw.elements).map(element=>({...element,grounding:[]}));
        record={elements:importExternalDocument(temp).slides[0].elements};retainGrounding=false;
      }
    }
    if(!record?.elements.length)return [];
    const elements=copyElements(record.elements,{retainGrounding,offset:28,unlock:true});
    this.transaction('Paste objects',()=>this.slide.elements.push(...elements));this.select(elements.map(element=>element.id));return elements;
  }
  ackGrounding({receipts=[],invalidations=[],submitted_snapshot=null}={}){
    const normalized=[...receipts.map(receipt=>({...receipt,origin:validateGroundingOrigin(receipt.origin)})),...invalidations.map(invalidation=>({...invalidation,invalidated:true}))].map(item=>{
      if(!validIdentity(item.object_id)||!validIdentity(item.annotation_id)||!item.invalidated&&item.origin.kind!=='saved')throw new Error('Invalid grounding acknowledgement.');
      return {...item,submitted_origin:validateGroundingOrigin(item.submitted_origin)};
    });
    const sameOrigin=(a,b)=>JSON.stringify(validateGroundingOrigin(a))===JSON.stringify(b);
    const annotationSignature=annotation=>JSON.stringify({anchor:annotation.anchor,claim_ids:annotation.claim_ids,relation:annotation.relation});
    const historicalDocs=[...(this.pending?[JSON.parse(this.pending.before).doc]:[]),...this.past.flatMap(entry=>[JSON.parse(entry.before).doc,JSON.parse(entry.after).doc]),...this.future.flatMap(entry=>[JSON.parse(entry.before).doc,JSON.parse(entry.after).doc]),this.doc];
    const submittedDoc=submitted_snapshot?(typeof submitted_snapshot==='string'?JSON.parse(submitted_snapshot):submitted_snapshot):null;
    const sourceElements=submittedDoc?(submittedDoc.doc||submittedDoc).slides.flatMap(slide=>slide.elements):[...historicalDocs.flatMap(doc=>doc.slides.flatMap(slide=>slide.elements)),...(this.clipboard?.elements||[])];
    const submittedIds=submittedDoc?new Set(sourceElements.map(element=>element.id)):null;
    const sources=new Map(normalized.map(item=>{
      const element=sourceElements.find(element=>element.id===item.object_id&&element.grounding.some(annotation=>annotation.id===item.annotation_id&&sameOrigin(annotation.origin,item.submitted_origin)));
      const annotation=element?.grounding.find(annotation=>annotation.id===item.annotation_id&&sameOrigin(annotation.origin,item.submitted_origin));
      if(item.anchor)validateCitationAnchor(item.anchor,element?elementText(element):'');
      return [item,annotation?{text:contentSignature(element),annotation:annotationSignature(annotation)}:null];
    }));
    let updated=0;
    const updateElements=elements=>{let changed=false;for(const element of elements){
      element.grounding=element.grounding.filter(annotation=>{
        // Copies have fresh IDs but retain the exact source association origin.
        const matches=normalized.filter(item=>{const source=sources.get(item);return source&&sameOrigin(annotation.origin,item.submitted_origin)&&source.text===contentSignature(element)&&source.annotation===annotationSignature(annotation);});
        const exact=matches.find(item=>item.object_id===element.id&&item.annotation_id===annotation.id);
        // Only objects created while the save was in flight may inherit a
        // source receipt. Submitted objects require their own exact selector.
        const freshCopy=submittedIds&&!submittedIds.has(element.id);
        const match=exact||(freshCopy&&(matches.find(item=>!item.invalidated)||matches[0]));if(!match)return true;
        changed=true;updated++;if(match.invalidated)return false;if(match.anchor)annotation.anchor=validateCitationAnchor(match.anchor,elementText(element));annotation.origin=clone(match.origin);return true;
      });
    }return changed;};
    const updateSnapshot=snapshot=>{const value=JSON.parse(snapshot);return updateElements(value.doc.slides.flatMap(slide=>slide.elements))?JSON.stringify(value):snapshot;};
    updateElements(this.doc.slides.flatMap(slide=>slide.elements));
    for(const entry of [...this.past,...this.future]){entry.before=updateSnapshot(entry.before);entry.after=updateSnapshot(entry.after);}
    if(this.pending)this.pending.before=updateSnapshot(this.pending.before);
    if(this.clipboard?.artifact_id===this.doc.id)updateElements(this.clipboard.elements);
    if(updated)this.emit('grounding');return {updated};
  }
  add(element){this.transaction(`Insert ${element.type}`,()=>this.slide.elements.push(element));this.select([element.id]);return element;}
  updateSelected(props,label='Format objects'){this.transaction(label,()=>{for(const e of this.selected)if(!e.locked)Object.assign(e,props);});}
  deleteSelected(){this.transaction('Delete objects',()=>{this.slide.elements=this.slide.elements.filter(e=>!this.selection.has(e.id)||e.locked);});this.select([]);}
  duplicateSelected(){const els=copyElements(this.selected.filter(e=>!e.locked),{offset:24});this.transaction('Duplicate objects',()=>this.slide.elements.push(...els));this.select(els.map(e=>e.id));}
  addSlide(layout='blank'){const s=makeSlide(layout,this.doc.theme);this.transaction('New slide',()=>{const i=this.doc.slides.findIndex(s=>s.id===this.active);this.doc.slides.splice(i+1,0,s);this.active=s.id;});this.select([]);return s;}
  duplicateSlide(){const s=clone(this.slide);s.id=uid('s');s.name+=' copy';s.elements=copyElements(s.elements);this.transaction('Duplicate slide',()=>{const i=this.doc.slides.findIndex(x=>x.id===this.active);this.doc.slides.splice(i+1,0,s);this.active=s.id;});this.select([]);}
  deleteSlide(){if(this.doc.slides.length===1)return false;this.transaction('Delete slide',()=>{const i=this.doc.slides.findIndex(s=>s.id===this.active);this.doc.slides.splice(i,1);this.active=this.doc.slides[Math.min(i,this.doc.slides.length-1)].id;});this.select([]);return true;}
  reorderSlide(from,to){this.transaction('Reorder slides',()=>{const [slide]=this.doc.slides.splice(from,1);this.doc.slides.splice(to,0,slide);});}
  align(mode){const els=this.selected.filter(e=>!e.locked);if(!els.length)return;const b=els.length===1?{x:0,y:0,w:this.doc.width,h:this.doc.height}:unionBounds(els);this.transaction('Align objects',()=>{for(const e of els){const r=elementBounds(e);if(mode==='left')e.x+=b.x-r.x;if(mode==='center')e.x+=b.x+b.w/2-r.x-r.w/2;if(mode==='right')e.x+=b.x+b.w-r.x-r.w;if(mode==='top')e.y+=b.y-r.y;if(mode==='middle')e.y+=b.y+b.h/2-r.y-r.h/2;if(mode==='bottom')e.y+=b.y+b.h-r.y-r.h;}});}
  distribute(axis){const es=this.selected.filter(e=>!e.locked).sort((a,b)=>elementBounds(a)[axis]-elementBounds(b)[axis]);if(es.length<3)return;const k=axis==='x'?'w':'h',bs=es.map(elementBounds),total=bs.reduce((n,b)=>n+b[k],0),gap=(bs.at(-1)[axis]+bs.at(-1)[k]-bs[0][axis]-total)/(es.length-1);this.transaction('Distribute objects',()=>{let p=bs[0][axis];es.forEach((e,i)=>{e[axis]+=p-bs[i][axis];p+=bs[i][k]+gap;});});}
  arrange(mode){this.transaction('Arrange objects',()=>{const list=this.slide.elements,chosen=list.filter(e=>this.selection.has(e.id));if(mode==='front')this.slide.elements=[...list.filter(e=>!this.selection.has(e.id)),...chosen];else if(mode==='back')this.slide.elements=[...chosen,...list.filter(e=>!this.selection.has(e.id))];else if(mode==='forward'){for(let i=list.length-2;i>=0;i--)if(this.selection.has(list[i].id)&&!this.selection.has(list[i+1].id))[list[i],list[i+1]]=[list[i+1],list[i]];}else{for(let i=1;i<list.length;i++)if(this.selection.has(list[i].id)&&!this.selection.has(list[i-1].id))[list[i],list[i-1]]=[list[i-1],list[i]];}});}
  group(){if(this.selected.length<2)return;this.updateSelected({groupId:uid('g')},'Group objects');}
  ungroup(){this.updateSelected({groupId:null},'Ungroup objects');}
}
