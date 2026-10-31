export const motionSource = `
function Demo() {
 const [count, setCount] = useState(1);
 const [n, setN] = useState(2);
 const displayed = useAnimatedNumber(n);
 return h(Stack, null,
  h(Row, null,
   h(Button, {id:'add', onClick:()=>setCount(c=>Math.min(7,c+1))}, 'Добавить шаг'),
   h(Button, {id:'remove', onClick:()=>setCount(c=>Math.max(0,c-1)), disabled:count===0}, 'Убрать шаг'),
   h(Button, {id:'bulk', onClick:()=>setCount(c=>c===1?6:1)}, 'Один / шесть'),
   h(Button, {id:'number', onClick:()=>setN(v=>v===2?8:2)}, 'Изменить сторону')),
  h(Label, null, 'Сторона квадрата', h(Slider, {id:'side', min:0,max:10,value:n,onChange:e=>setN(Number(e.target.value))})),
  h(Text, null, h('span', {id:'value'}, 'Площадь: '+n*n)),
  h(Figure, {label:'Квадрат',viewBox:'0 0 600 100'},h('rect',{id:'square',x:10,y:10,width:displayed*8,height:displayed*8})),
  h(Canvas, {label:'Площадь на холсте',width:600,height:100,draw:(ctx,c)=>{ctx.fillStyle=c.primary;ctx.fillRect(10,10,displayed*8,displayed*8)}}),
  h(Stack, null, Array.from({length:count}, (_,i)=>h(Stack, {key:i},
   h(Text, null, 'Шаг '+(i+1)+'. Сравни стороны и площадь: увеличение стороны вдвое увеличивает площадь в четыре раза.'),
   h(Formula, {tex:'S=a^2'}),
   h(Figure, {label:'Шаг '+(i+1),viewBox:'0 0 600 110'},h('rect',{x:10,y:10,width:80,height:80}))))),
  h(Text, null, h('span',{id:'count'}, 'Шагов: '+count)));
}
return Demo;
`;
