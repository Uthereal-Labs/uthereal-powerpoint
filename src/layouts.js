/** Adaptive layouts own geometry; ordinary native elements remain the only content source. */
const LAYOUT_DEFINITIONS={
  process:{collection:'steps',min:2,max:6,slots:{panel_id:'roundRect',number_id:'text',title_id:'text',body_id:'text',connector_id:'arrow'},content:{title:'title_id',body:'body_id'},required:['title']},
  comparison:{collection:'items',min:2,max:2,slots:{panel_id:'roundRect',title_id:'text',body_id:'text'},content:{title:'title_id',body:'body_id'},required:['title']},
  key_figures:{collection:'figures',min:1,max:4,slots:{panel_id:'roundRect',value_id:'text',label_id:'text',context_id:'text'},content:{value:'value_id',label:'label_id',context:'context_id'},required:['value','label']},
  takeaway_evidence:{collection:'points',min:1,max:4,slots:{text_id:'text',dot_id:'ellipse'},content:{text:'text_id'},required:['text']},
};
const layoutIdentity=value=>typeof value==='string'&&value.length>0&&value.length<=200;
function definitionFor(type){const definition=Object.hasOwn(LAYOUT_DEFINITIONS,type)?LAYOUT_DEFINITIONS[type]:null;if(!definition)throw new Error('Unsupported adaptive layout type.');return definition;}
function layoutRows(component){return component[definitionFor(component.type).collection]||[];}
export function componentElementIds(component){
  const definition=definitionFor(component.type);
  return [...['title_id','takeaway_id','chart_id'].flatMap(key=>component[key]?[component[key]]:[]),...layoutRows(component).flatMap(row=>Object.keys(definition.slots).map(key=>row[key]))];
}
function validateLayoutFrame(frame){
  if(!frame||!['x','y','w','h'].every(key=>Number.isFinite(frame[key]))||frame.w<=0||frame.h<=0||Object.values(frame).some(value=>Math.abs(value)>100000))throw new Error('Layout frame must have finite positive dimensions.');
  return {x:frame.x,y:frame.y,w:frame.w,h:frame.h};
}
function validateLayoutText(value){if(typeof value!=='string'||value.length>100000)throw new Error('Layout content must be text of at most 100,000 characters.');return value;}
function validateRowCount(definition,rows,chart=false){
  if(!Array.isArray(rows)||chart&&rows.length||!chart&&(rows.length<definition.min||rows.length>definition.max))throw new Error(`This layout needs ${definition.min}–${definition.max} ordered items${chart?' or one existing chart':''}.`);
}
export function validateComponents(raw,elements,seen){
  if(raw===undefined)return undefined;
  if(!Array.isArray(raw)||raw.length>100)throw new Error('Invalid adaptive layouts.');
  const available=new Map(elements.map(element=>[element.id,element])),members=new Set();
  return raw.map(component=>{
    if(!component||component.version!==1||!layoutIdentity(component.id)||seen.has(component.id))throw new Error('Invalid adaptive layout identity or version.');
    const definition=definitionFor(component.type);seen.add(component.id);
    const frame=validateLayoutFrame(component.frame),chart=component.type==='takeaway_evidence'&&component.chart_id!==undefined;
    const sourceRows=component[definition.collection];validateRowCount(definition,sourceRows,chart);
    const claim=(id,type)=>{if(!layoutIdentity(id)||available.get(id)?.type!==type||members.has(id))throw new Error('Invalid or shared layout content slot.');members.add(id);return id;};
    const rows=sourceRows.map(row=>{
      if(!row||!layoutIdentity(row.id)||seen.has(row.id))throw new Error('Layout item IDs must be unique.');
      seen.add(row.id);return {id:row.id,...Object.fromEntries(Object.entries(definition.slots).map(([key,type])=>[key,claim(row[key],type)]))};
    });
    const out={id:component.id,type:component.type,version:1,frame,[definition.collection]:rows};
    if(component.title_id!==undefined)out.title_id=claim(component.title_id,'text');
    if(component.type==='process'){
      out.emphasis_step_id=component.emphasis_step_id??null;
      if(out.emphasis_step_id!==null&&!rows.some(row=>row.id===out.emphasis_step_id))throw new Error('Unknown emphasized process step.');
    }
    if(component.type==='takeaway_evidence'){
      out.takeaway_id=claim(component.takeaway_id,'text');
      if(chart)out.chart_id=claim(component.chart_id,'chart');
    }
    return out;
  });
}
/** Partial copies become ordinary objects; complete copies remap every native slot. */
export function remapComponents(components,idMap,createId,offset=0){
  return (components||[]).filter(component=>componentElementIds(component).every(id=>idMap.has(id))).map(component=>{
    const definition=definitionFor(component.type),rows=layoutRows(component),rowMap=new Map(rows.map(row=>[row.id,createId('item')]));
    const out={...structuredClone(component),id:createId('layout'),frame:{...component.frame,x:component.frame.x+offset,y:component.frame.y+offset},[definition.collection]:rows.map(row=>({id:rowMap.get(row.id),...Object.fromEntries(Object.keys(definition.slots).map(key=>[key,idMap.get(row[key])]))}))};
    for(const key of ['title_id','takeaway_id','chart_id'])if(component[key])out[key]=idMap.get(component[key]);
    if(component.type==='process')out.emphasis_step_id=rowMap.get(component.emphasis_step_id)||null;
    return out;
  });
}
export function createLayouts({makeElement,uid,fontFamilyFor,setContent,measureText}){
  const find=(document,id)=>{for(const slide of document.slides){const component=slide.components?.find(item=>item.id===id);if(component)return {slide,component};}throw new Error(`Unknown layout: ${id}`);};
  const member=(slide,id)=>slide.components?.find(component=>componentElementIds(component).includes(id))||null;
  const assertUnlocked=(slide,component)=>{const ids=new Set(componentElementIds(component));if(slide.elements.some(element=>ids.has(element.id)&&element.locked))throw new Error('Unlock layout objects before editing or detaching this layout.');};
  const assertProperties=(slide,ids,props)=>{
    const geometryKeys=['x','y','w','h','rotation','groupId'];
    for(const id of ids){
      const component=member(slide,id);if(!component)continue;
      if(Object.keys(props).some(key=>key!=='locked'))assertUnlocked(slide,component);
      const slot=component.chart_id===id?'chart':layoutRows(component).flatMap(row=>Object.entries(row)).find(([key,value])=>key!=='id'&&value===id)?.[0];
      const owned=new Set([...geometryKeys,...(component.chart_id!==id?['fill']:[]),...(slide.elements.find(element=>element.id===id)?.type==='text'?['padding']:[]),...(slot==='panel_id'?['radius']:[]),...(['title_id','body_id','value_id','label_id','context_id','connector_id'].includes(slot)?['hidden']:[]),...(slot==='number_id'?['text']:[])]);
      if(Object.keys(props).some(key=>owned.has(key)))throw new Error('Detach layout before changing its managed geometry or style.');
    }
  };
  const textDefaults=key=>({fontRole:['title_id','value_id','takeaway_id'].includes(key)?'heading':'body',fontSize:({title_id:24,value_id:56,label_id:22,takeaway_id:32,text_id:22})[key]||18,bold:['title_id','value_id','label_id','takeaway_id'].includes(key),text:'',padding:0,fill:'@ink'});
  const geometry=(document,slide,component)=>{
    const elements=new Map(slide.elements.map(element=>[element.id,element])),placements=[],{frame}=component,rows=layoutRows(component),sx=document.width/1280,sy=document.height/720;
    const get=id=>{const element=elements.get(id);if(!element)throw new Error('Adaptive layout has a missing content slot.');return element;};
    const place=(id,props)=>{get(id);placements.push({id,props:{rotation:0,groupId:component.id,...props}});};
    const textHeight=(id,width)=>{
      const element=get(id),fontSize=Math.max(18,element.fontSize||18),fontFamily=fontFamilyFor(element,document.theme),lines=measureText({...element,fontSize,fontFamily},Math.max(1,width),document.theme);
      if(!Number.isInteger(lines)||lines<1)throw new Error('Layout text measurement is unavailable.');
      return lines*fontSize*(element.lineHeight||1.2)+4;
    };
    const textBox=(id,x,y,w,h,extra={})=>place(id,{x,y,w:Math.max(1,w),h:Math.max(1,h),fontSize:Math.max(18,get(id).fontSize||18),padding:0,...extra});
    let overflow=frame.x<0||frame.y<0||frame.x+frame.w>document.width||frame.y+frame.h>document.height-48*sy;
    if(component.title_id){
      const y=frame.y-126*sy,height=textHeight(component.title_id,frame.w);
      textBox(component.title_id,frame.x,y,frame.w,height,{fill:'@ink'});
      overflow||=y<0||y+height+24>frame.y;
    }
    if(component.type==='takeaway_evidence'){
      const takeawayHeight=textHeight(component.takeaway_id,frame.w),contentY=frame.y+takeawayHeight+24;
      textBox(component.takeaway_id,frame.x,frame.y,frame.w,takeawayHeight,{fill:'@ink'});
      if(component.chart_id){
        const height=frame.h-takeawayHeight-24;
        place(component.chart_id,{x:frame.x,y:contentY,w:frame.w,h:Math.max(1,height)});
        overflow||=frame.w<520*sx||height<300*sy;
      }else{
        let y=contentY;
        for(const row of rows){const height=textHeight(row.text_id,frame.w-28);textBox(row.text_id,frame.x+28,y,frame.w-28,height,{fill:'@muted'});place(row.dot_id,{x:frame.x+2,y:y+9,w:8,h:8,fill:'@accent'});y+=height+20;}
        overflow||=y-20>frame.y+frame.h;
      }
    }else{
      const gap=component.type==='process'?32:24,padding=20,width=(frame.w-gap*(rows.length-1))/rows.length,inner=Math.max(1,width-2*padding);
      const slots=component.type==='key_figures'?['value_id','label_id','context_id']:component.type==='process'?['title_id','body_id']:['title_id','body_id'];
      const metrics=rows.map(row=>slots.map(key=>get(row[key]).text?textHeight(row[key],inner):0));
      const headingOffset=component.type==='process'?34:0;
      const height=Math.max(component.type==='comparison'?220:160,...metrics.map(heights=>2*padding+headingOffset+heights.reduce((total,value)=>total+value,0)+Math.max(0,heights.filter(Boolean).length-1)*10));
      rows.forEach((row,index)=>{
        const x=frame.x+index*(width+gap),y=frame.y,emphasized=row.id===component.emphasis_step_id;
        place(row.panel_id,{x,y,w:Math.max(1,width),h:height,fill:emphasized?'@dark':'@surface',radius:12});
        if(component.type==='process')textBox(row.number_id,x+padding,y+padding,inner,22,{text:String(index+1),fontSize:18,fill:emphasized?'@light':'@accent'});
        let textY=y+padding+headingOffset;
        slots.forEach((key,slotIndex)=>{const value=get(row[key]).text,height=metrics[index][slotIndex];textBox(row[key],x+padding,textY,inner,height,{fill:emphasized?'@light':key==='value_id'?'@accent':slotIndex===0||key==='label_id'?'@ink':'@muted',hidden:!value});if(value)textY+=height+10;});
        if(component.type==='process')place(row.connector_id,{x:x+width+6,y:y+height/2-8,w:gap-12,h:16,fill:'@accent',hidden:index===rows.length-1});
      });
      overflow||=width<2*padding+18||height>frame.h;
    }
    return {placements,overflow};
  };
  const normalize=document=>{
    const diagnostics=[];
    for(const slide of document.slides)for(const component of slide.components||[]){
      const {placements,overflow}=geometry(document,slide,component),elements=new Map(slide.elements.map(element=>[element.id,element]));
      for(const placement of placements)Object.assign(elements.get(placement.id),placement.props);
      if(overflow)diagnostics.push({component_id:component.id,slide_id:slide.id,kind:'layout_overflow',message:'Layout content does not fit its reserved area. Shorten text, reduce items, or enlarge the layout; all text is retained.'});
    }
    return diagnostics;
  };
  const update=(document,id,input={})=>{
    const {slide,component}=find(document,id),definition=definitionFor(component.type),previousRows=layoutRows(component),previous=new Map(previousRows.map(row=>[row.id,row]));
    assertUnlocked(slide,component);
    const allowed=new Set(['type','title','frame',definition.collection,...(component.type==='process'?['emphasis_step_id']:[]),...(component.type==='takeaway_evidence'?['takeaway','chart_id']:[])]);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.has(key))||input.type!==undefined&&input.type!==component.type)throw new Error('Use only content fields for this layout type.');
    if(component.type==='takeaway_evidence'&&!component.takeaway_id&&(typeof input.takeaway!=='string'||!input.takeaway.trim()))throw new Error('A new takeaway layout requires a nonempty takeaway.');
    const chart=component.type==='takeaway_evidence'&&(input.chart_id!==undefined||component.chart_id!==undefined);
    if(component.type==='takeaway_evidence'&&(input.points!==undefined&&chart||input.chart_id!==undefined&&previousRows.length))throw new Error('Detach layout before switching between points and chart evidence.');
    if(component.chart_id&&input.chart_id!==undefined&&input.chart_id!==component.chart_id)throw new Error('Detach layout before replacing its evidence chart.');
    const specs=input[definition.collection]??previousRows.map(row=>({id:row.id}));validateRowCount(definition,specs,chart);
    if(specs.some(spec=>!spec||typeof spec!=='object'||Array.isArray(spec)))throw new Error('Layout items must be content objects.');
    const occupiedIds=new Set([document.id,...document.slides.flatMap(item=>[item.id,...item.elements.map(element=>element.id),...(item.components||[]).flatMap(value=>[value.id,...layoutRows(value).map(row=>row.id)])])]);
    const requestedIds=specs.filter(spec=>spec.id!==undefined).map(spec=>spec.id);
    if(new Set(requestedIds).size!==requestedIds.length||requestedIds.some(itemId=>!layoutIdentity(itemId)||!previous.has(itemId)&&occupiedIds.has(itemId)))throw new Error('Invalid or duplicate layout item ID.');
    for(const spec of specs){
      if(Object.keys(spec).some(key=>key!=='id'&&!Object.hasOwn(definition.content,key)))throw new Error('Unknown layout item content field.');
      for(const field of Object.keys(definition.content))if(spec[field]!==undefined)validateLayoutText(spec[field]);
      if(!previous.has(spec.id))for(const field of definition.required)if(typeof spec[field]!=='string'||!spec[field].trim())throw new Error(`New layout items require nonempty ${field}.`);
    }
    if(input.title!==undefined)validateLayoutText(input.title);
    if(input.takeaway!==undefined)validateLayoutText(input.takeaway);
    if(input.frame!==undefined)validateLayoutFrame(input.frame);
    if(chart){const chartId=input.chart_id??component.chart_id,existing=slide.elements.find(element=>element.id===chartId),owner=member(slide,chartId);if(existing?.locked)throw new Error('Unlock the chart before using it in an adaptive layout.');if(existing?.type!=='chart'||owner&&owner!==component)throw new Error('Evidence must reference an available chart on this slide.');component.chart_id=chartId;}
    const elements=new Map(slide.elements.map(element=>[element.id,element]));
    const createText=(name,key,text)=>{const element=makeElement('text',{name,...textDefaults(key),text});slide.elements.push(element);elements.set(element.id,element);return element.id;};
    if(input.title!==undefined){if(!component.title_id){component.title_id=createText('Layout title','title_id',input.title);elements.get(component.title_id).fontSize=38;}else setContent(elements.get(component.title_id),{text:input.title});}
    if(component.type==='takeaway_evidence'){if(!component.takeaway_id)component.takeaway_id=createText('Takeaway','takeaway_id',input.takeaway??'');else if(input.takeaway!==undefined)setContent(elements.get(component.takeaway_id),{text:input.takeaway});}
    const next=specs.map(spec=>{
      let row=previous.get(spec.id);
      if(!row){row={id:spec.id||uid('item')};for(const [key,type]of Object.entries(definition.slots)){const element=makeElement(type,{name:`${component.type} ${key.replace('_id','')}`,...(type==='text'?textDefaults(key):{})});row[key]=element.id;slide.elements.push(element);elements.set(element.id,element);}}
      for(const [field,key]of Object.entries(definition.content))if(spec[field]!==undefined)setContent(elements.get(row[key]),{text:spec[field]});
      return row;
    });
    const retained=new Set(next.map(row=>row.id)),removed=new Set(previousRows.filter(row=>!retained.has(row.id)).flatMap(row=>Object.keys(definition.slots).map(key=>row[key])));
    slide.elements=slide.elements.filter(element=>!removed.has(element.id));component[definition.collection]=next;
    if(input.frame!==undefined)component.frame=validateLayoutFrame(input.frame);
    if(component.type==='process'){
      if(input.emphasis_step_id!==undefined){if(input.emphasis_step_id!==null&&!next.some(row=>row.id===input.emphasis_step_id))throw new Error('Unknown emphasized process step.');component.emphasis_step_id=input.emphasis_step_id;}
      if(!next.some(row=>row.id===component.emphasis_step_id))component.emphasis_step_id=null;
    }
    normalize(document);return component;
  };
  return {
    create(document,slideId,input){
      const definition=definitionFor(input?.type),slide=document.slides.find(item=>item.id===slideId);if(!slide)throw new Error('Unknown layout slide.');
      const sx=document.width/1280,sy=document.height/720,component={id:uid('layout'),type:input.type,version:1,frame:validateLayoutFrame(input.frame||{x:72*sx,y:190*sy,w:1136*sx,h:440*sy}),[definition.collection]:[],...(input.type==='process'?{emphasis_step_id:null}:{})};
      (slide.components??=[]).push(component);return update(document,component.id,input);
    },
    update,
    detach(document,id){const {slide,component}=find(document,id);assertUnlocked(slide,component);slide.components=slide.components.filter(item=>item!==component);for(const element of slide.elements)if(element.groupId===id)element.groupId=null;if(!slide.components.length)delete slide.components;return component;},
    normalize,
    inspect(document){return document.slides.flatMap(slide=>(slide.components||[]).map(component=>({...structuredClone(component),slide_id:slide.id,overflow:geometry(document,slide,component).overflow})));},
    member,
    assertProperties,
    elementIds:componentElementIds,
    assertFreeform(slide,ids){if(ids.some(id=>member(slide,id)))throw new Error('Detach layout before changing its objects or geometry.');},
  };
}
