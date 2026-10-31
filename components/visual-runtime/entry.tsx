import React, {useState, useEffect, useLayoutEffect, useCallback, useRef, createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {Button as AppButton} from '../ui/button';
import {Input} from '../ui/input';
import {Textarea} from '../ui/textarea';
import {Separator} from '../ui/separator';
import katex from 'katex';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { Diagram } from './diagram';
import { Flow, useAnimatedNumber } from './motion';

const Stack = ({children}: React.PropsWithChildren) => <Flow className="flex flex-col gap-4">{children}</Flow>;
const Row = ({children}: React.PropsWithChildren) => <Flow className="flex flex-wrap items-center gap-3">{children}</Flow>;
const Grid = ({children}: React.PropsWithChildren) => <Flow className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</Flow>;
const Button = (props: React.ComponentProps<typeof AppButton>) => <AppButton {...props} className="max-w-full whitespace-normal transition-[color,background-color,border-color,box-shadow] motion-reduce:transition-none" />;
const Text = ({children}: React.PropsWithChildren) => <p className="font-sans text-base leading-relaxed">{children}</p>;
const Label = ({children}: React.PropsWithChildren) => <label className="flex flex-col gap-2 text-sm">{children}</label>;
const Slider = (props: React.ComponentProps<'input'>) => <Input {...props} type="range" className="accent-primary" />;
const Formula = React.memo(({tex}: {tex:string}) => <span className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{__html:katex.renderToString(tex,{throwOnError:false,trust:false})}} />);
const palette = () => Object.fromEntries(['foreground','muted-foreground','primary','border','background','destructive'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()]));
const Figure = ({children,viewBox='0 0 600 300',label}: React.PropsWithChildren<{viewBox?:string;label:string}>) => <svg role="img" aria-label={label} viewBox={viewBox} className="w-full" fill="none" stroke="currentColor">{children}</svg>;
const Canvas = ({draw,width=600,height=300,label}: {draw:(ctx:CanvasRenderingContext2D,colors:Record<string,string>)=>void;width?:number;height?:number;label:string}) => {
 const ref=useRef<HTMLCanvasElement>(null);
 const drawRef=useRef(draw);
 drawRef.current=draw;
 const paint=useCallback(()=>{
  const c=ref.current;const ctx=c?.getContext('2d');
  if(!ctx||!c||width<=0||height<=0)return;
  const scale=c.getBoundingClientRect().width/width*devicePixelRatio;
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
  const colors=palette();
  ctx.clearRect(0,0,c.width,c.height);ctx.save();
  try{
   ctx.setTransform(c.width/width,0,0,c.height/height,0,0);
   ctx.fillStyle=colors.foreground ?? "currentColor";ctx.strokeStyle=colors.foreground ?? "currentColor";
   ctx.font=getComputedStyle(document.body).font;
   drawRef.current(ctx,colors);
  }finally{ctx.restore();}
 },[width,height]);
 useLayoutEffect(()=>{paint();},[draw,paint]);
 useEffect(()=>{
  const observer=new ResizeObserver(paint);if(ref.current)observer.observe(ref.current);
  window.addEventListener('visual-theme',paint);window.addEventListener('resize',paint);
  document.fonts.addEventListener('loadingdone',paint);
  return()=>{observer.disconnect();window.removeEventListener('visual-theme',paint);window.removeEventListener('resize',paint);document.fonts.removeEventListener('loadingdone',paint);};
 },[paint]);
 return <canvas ref={ref} width={width} height={height} aria-label={label} role="img" className="block w-full" style={{aspectRatio:`${width} / ${height}`}}/>;
};
window.addEventListener('message',e=>{
 if(e.source!==parent)return;
 if(e.data?.type==='visual-fonts' && typeof e.data.css==='string'){let style=document.getElementById('app-fonts');if(!style){style=document.createElement('style');style.id='app-fonts';document.head.append(style);}style.textContent=e.data.css;return;}
 if(e.data?.type!=='visual-theme'||typeof e.data?.tokens!=='object'||!e.data.tokens)return;
 for(const [key,value] of Object.entries(e.data.tokens))if(/^--[a-zA-Z0-9-]+$/.test(key)&&typeof value==='string')document.documentElement.style.setProperty(key,value);
 document.documentElement.classList.toggle('dark',e.data.dark===true);
 document.documentElement.style.colorScheme=e.data.dark===true?'dark':'light';
 window.dispatchEvent(new Event('visual-theme'));
});
const api={h,useState,useEffect,useRef,useAnimatedNumber,Button,Input,Textarea,Separator,Stack,Row,Grid,Text,Label,Slider,Formula,Figure,Canvas,Diagram,palette};
try {
 const source = JSON.parse(document.getElementById('visual-source')!.textContent!);
 const Component = new Function(...Object.keys(api),source)(...Object.values(api));
 function App(){const [,refresh]=useState(0);useEffect(()=>{const update=()=>refresh(n=>n+1);window.addEventListener('visual-theme',update);return()=>window.removeEventListener('visual-theme',update);},[]);return <MotionConfig reducedMotion="user"><LayoutGroup>{h(Component)}</LayoutGroup></MotionConfig>;}
 createRoot(document.getElementById('root')!).render(h(App));
} catch(error){setTimeout(()=>{throw error;});}
