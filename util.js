const TZ = process.env.TZ || 'America/Sao_Paulo';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
const r2 = (n) => Math.round(n * 100) / 100;

// A tarefa aparece em `day`?
function taskOnDay(t, day) {
  if (!t.active) return false;
  if (t.type === 'daily') return t.weekdays.includes(String(dow(day)));
  if (t.repeat_weekly) return day >= t.date && dow(day) === dow(t.date);
  return t.date === day;
}
module.exports = { today, dow, r2, taskOnDay };
