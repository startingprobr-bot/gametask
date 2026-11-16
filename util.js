const TZ = process.env.TZ || 'America/Sao_Paulo';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
const r2 = (n) => Math.round(n * 100) / 100;

// A tarefa aparece em `day`?
function taskOnDay(t, day) {
  if (!t.active) return false;
  if (t.type === 'daily') return t.weekdays.includes(String(dow(day)));
  if (t.repeat_weekly) return day >= t.date && dow(day) === dow(t.date);
  if (t.carry) return day >= t.date; // passa para o dia seguinte até ser feita (quem já fez sai em lib.dayTasks)
  return t.date === day;
}
// Dias de teste em palavras: 30 = "1 mês", 90 = "3 meses", 45 = "45 dias"
const trialText = (d) => { d = Math.round(+d) || 0; return d >= 30 && d % 30 === 0 ? (d === 30 ? '1 mês' : `${d / 30} meses`) : `${d} ${d === 1 ? 'dia' : 'dias'}`; };
module.exports = { today, dow, r2, taskOnDay, trialText };
