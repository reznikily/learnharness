// The learner's control sits BELOW content that grows per step (the shape of real stepper demos).
export const followSource = `
function Demo() {
 const [step, setStep] = useState(0);
 const rows = [];
 for (let i = 0; i <= step * 2; i++) rows.push(h(Text, {key: 'r' + i}, 'Строка ' + (i + 1) + ': применение modus ponens к посылкам.'));
 return h(Stack, null,
  h(Text, null, 'Цель: вывести H→Q'),
  h(Stack, null, rows),
  h(Row, null,
   h(Button, {id: 'next', disabled: step === 6, onClick: () => setStep(s => Math.min(6, s + 1))}, 'Следующий шаг'),
   h(Button, {id: 'reset', onClick: () => setStep(0)}, 'Сначала')),
  h(Text, null, h('span', {id: 'step'}, 'Шаг ' + step)));
}
return Demo;
`;
