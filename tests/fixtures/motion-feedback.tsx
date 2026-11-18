// @ts-nocheck — real Chat with a scripted in-page server; never shipped.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Chat} from '../../components/chat';
import {AppShell, SidebarProvider} from '../../components/sidebar';
import {ServerEventsProvider} from '../../components/server-events';
import {AppearanceProvider} from '../../components/settings/appearance';
import {ActivityProvider} from '../../components/activity-dock';
import '../../components/chat-width-rails.css';
const quizArgs=(question)=>({question,options:[{label:'Venus'},{label:'Mercury'},{label:'Mars'}],correctAnswer:'Mercury',explanation:'Innermost.',type:'check'});
const call=(id,name,args,timestamp)=>({id:`a-${id}`,role:'assistant',content:[{type:'toolCall',id,name,arguments:args}],timestamp,stopReason:'toolUse'});
const srv=window.__srv=JSON.parse(sessionStorage.getItem('srv')||'null')??{messages:[],postStatus:200,stream:[],jobs:[],posts:0};
const save=()=>sessionStorage.setItem('srv',JSON.stringify(srv));
window.__fixture={call,quizArgs,save};
const listeners={};
window.__emit=(name,data)=>listeners[name]?.(JSON.stringify(data));
window.fetch=async(input,init)=>{
 const path=String(input);
 if(init?.method==='POST'&&path==='/api/chat'){
  srv.posts++;
  if(srv.postStatus!==200)return new Response('refused',{status:srv.postStatus});
  await new Promise(r=>setTimeout(r,srv.postDelay??60));
  const {input:event}=JSON.parse(init.body);
  if(event?.type==='answer')srv.messages.push({id:`r-${event.toolCallId}`,role:'toolResult',toolCallId:event.toolCallId,toolName:'quiz',content:[{type:'text',text:'answered'}],details:event.answer,isError:false,timestamp:Date.now()},{id:`next-${event.toolCallId}`,role:'assistant',content:[{type:'text',text:'Продолжим.'}],stopReason:'stop',timestamp:Date.now()});
  save();
  return Response.json({ok:true});
 }
 if(init?.method&&init.method!=='GET')return Response.json({ok:true});
 let body={};
 if(path.endsWith('/stream')){
  const events=srv.stream.splice(0);
  return new Response(new ReadableStream({async start(c){const e=new TextEncoder();for(const ev of events){c.enqueue(e.encode(`data: ${JSON.stringify(ev)}\n\n`));await new Promise(r=>setTimeout(r,20));}srv.messages.push(...(srv.afterStream??[]).splice(0));c.enqueue(e.encode('data: {"type":"turn-settled"}\n\n'));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 }
 if(path==='/api/chats')body={chats:[{id:'synthetic',title:'Synthetic',updatedAt:'2026-10-27T00:00:00Z',createdAt:'2026-10-27T00:00:00Z',kind:'teach'}]};
 else if(path.startsWith('/api/chats/'))body={messages:srv.messages,turnInFlight:false};
 else if(path.startsWith('/api/jobs'))body={jobs:srv.jobs,turnInFlight:false};
 else if(path==='/api/activity')body={jobs:[],extractions:[]};
 else if(path==='/api/settings')body={settings:{}};
 else if(path==='/api/models')return new Response('{}',{status:503});
 else if(path==='/api/graph/status')body={enabled:false};
 return Response.json(body);
};
window.__mount=()=>createRoot(document.getElementById('root')).render(<ServerEventsProvider connect={()=>({close(){},onOpen(){},onEvent(n,cb){listeners[n]=cb;}})}><AppearanceProvider><SidebarProvider><ActivityProvider><AppShell><Chat chatId="synthetic" title="Motion" initialMessages={srv.messages} initialConfigured/></AppShell></ActivityProvider></SidebarProvider></AppearanceProvider></ServerEventsProvider>);
