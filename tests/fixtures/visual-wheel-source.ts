// Synthetic stepper shaped like a real delivered components-v1 demo:
// header + step indicator on top, a two-column Grid that grows per step,
// and the step controls at the BOTTOM (the control the learner keeps clicking).
export const stepperSource = `
function Demo(){
 var st=useState(0), step=st[0], setStep=st[1];
 var rows=[];
 for(var i=0;i<=step*2;i++) rows.push(h(Row,{key:'r'+i},h('span',null,(i+1)+'.'),h(Formula,{tex:'A_'+i+'\\\\to(B_'+i+'\\\\to C_'+i+')'}),h('span',null,'обоснование '+(i+1))));
 var right=[h('div',{key:'t'},'Схема')];
 for(var j=0;j<step*3;j++) right.push(h(Text,{key:'p'+j},'Пояснение '+(j+1)+': подстановка X и Y в схему modus ponens сохраняет всю левую часть.'));
 return h(Stack,null,
  h('div',{id:'goal'},'Цель: вывести H→Q'),
  h(Row,null,h(Text,null,'Шаг '+step+' из 3'),[0,1,2,3].map(function(k){return h(Button,{key:k,id:'dot'+k,variant:k===step?'default':'outline',onClick:function(){setStep(k);}},String(k));})),
  h(Grid,null,h(Stack,null,rows),h(Stack,null,right)),
  h(Separator,null),
  h(Row,null,
   h(Button,{id:'back',variant:'outline',disabled:step===0,onClick:function(){setStep(Math.max(0,step-1));}},'Назад'),
   h(Button,{id:'next',disabled:step===3,onClick:function(){setStep(Math.min(3,step+1));}},'Следующий шаг'),
   h(Button,{id:'reset',variant:'outline',onClick:function(){setStep(0);}},'Сначала'))
 );
}
return Demo;
`;
