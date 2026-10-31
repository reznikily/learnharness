import React, {useId,useLayoutEffect,useMemo,useRef} from 'react';

const resources=JSON.parse(document.getElementById('visual-diagrams')?.textContent||'{}');

export const Diagram = React.memo(function Diagram({id,label}:{id:string;label:string}) {
 const ref=useRef<HTMLDivElement>(null);
 const instance=useId().replace(/[^a-z0-9]/gi,'');
 const svg=useMemo(()=>{
  if(!resources[id]?.svg) throw new Error(`Diagram ${id} is missing. Call render_diagram, then write_demo again.`);
  // Each instance needs its own marker/clip IDs, including repeated copies of one diagram.
  return resources[id].svg.replace(/\bid="([^"]+)"/g,(_:string,value:string)=>`id="${instance}-${value}"`).replace(/url\(#([\w-]+)\)/g,(_:string,value:string)=>`url(#${instance}-${value})`);
 },[id,instance]);
 const markup=useMemo(()=>({__html:svg}),[svg]);
 useLayoutEffect(()=>{
  const root=ref.current!;
  // Keep renderer-measured label widths when adopting the user's font.
  const texts=Array.from(root.querySelectorAll('text'));
  // Batch reads between writes: one layout for the whole SVG, not one per label.
  for(const text of texts)text.style.fontFamily='sans-serif';
  const widths=texts.map(text=>text.hasAttribute('textLength')?0:text.getComputedTextLength());
  texts.forEach((text,index)=>{
   const width=widths[index]!;
   if(width>0){text.setAttribute('textLength',String(width));text.setAttribute('lengthAdjust','spacingAndGlyphs');}
   text.style.fontFamily='var(--font-sans)';
  });
 },[svg]);
 return <div data-diagram ref={ref} role="img" aria-label={label} tabIndex={0} className="max-w-full min-w-0 overflow-x-auto font-sans focus-visible:outline-2 focus-visible:outline-ring" dangerouslySetInnerHTML={markup}/>;
});
