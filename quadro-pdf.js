// PDF do quadro de tarefas (o mesmo da página /quadro-de-tarefas-infantil), feito no servidor para mandar pelo WhatsApp.
// A4 deitado, uma folha por criança.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, 'public');
const mm = (n) => n * 72 / 25.4;
const NAVY = '#0d1b4c', MUTED = '#6a76a3', LINE = '#c9d2ee', DOT = '#aab6dc', ALT = '#fffbea', WE = '#f6f8ff';
const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const font = (f) => fs.readFileSync(path.join(PUB, 'fonts', f));
const FONTS = { display: font('lilita-one.woff'), body: font('nunito-800.woff') };
const icon = (i) => { const p = path.join(PUB, 'img/3d', `${String(i).replace(/[^a-z0-9-]/gi, '')}.png`); return fs.existsSync(p) ? p : path.join(PUB, 'img/3d/star.png'); };

function sheet(doc, name, tasks, host) {
  const W = doc.page.width, H = doc.page.height, L = mm(12), R = W - mm(12), T = mm(11);
  // topo: nome da criança, semana e marca
  doc.font('body').fontSize(mm(4.2)).fillColor(MUTED).text('MISSÕES DA SEMANA DE', L, T, { characterSpacing: 1.6, lineBreak: false });
  doc.font('display').fontSize(mm(15)).fillColor(NAVY).text(name, L, T + mm(5), { width: mm(170), height: mm(16), ellipsis: true, lineBreak: false });
  doc.image(icon('game'), R - mm(38), T + mm(6), { width: mm(11) });
  doc.font('display').fontSize(mm(6)).fillColor(NAVY).text('GameTask', R - mm(26), T + mm(8.4), { lineBreak: false });
  doc.font('body').fontSize(mm(4)).fillColor(MUTED).text('Semana de ____/____ a ____/____', R - mm(110), T + mm(10.5), { width: mm(68), align: 'right', lineBreak: false });

  // grade
  const gx = L, gy = T + mm(24), gw = R - L, gh = H - gy - mm(27), first = mm(78), col = (gw - first) / 7, head = mm(11);
  const rh = (gh - head) / Math.max(1, tasks.length);
  doc.save().roundedRect(gx, gy, gw, gh, mm(4)).clip();
  doc.rect(gx, gy, gw, head).fill(NAVY);
  doc.rect(gx + first + col * 5, gy + head, col * 2, gh - head).fill(WE);
  tasks.forEach((_, r) => { if (r % 2) doc.rect(gx, gy + head + r * rh, gw, rh).fill(ALT); });
  doc.lineWidth(mm(.35)).strokeColor(LINE);
  for (let c = 0; c <= 7; c++) { const x = gx + first + c * col; doc.moveTo(x, gy + head).lineTo(x, gy + gh).stroke(); }
  for (let r = 1; r < tasks.length; r++) { const y = gy + head + r * rh; doc.moveTo(gx, y).lineTo(gx + gw, y).stroke(); }
  doc.restore();
  doc.lineWidth(mm(.7)).strokeColor(NAVY).roundedRect(gx, gy, gw, gh, mm(4)).stroke();
  doc.font('display').fontSize(mm(5.4)).fillColor('#fff').text('Tarefa', gx + mm(4), gy + mm(3), { lineBreak: false });
  DAYS.forEach((d, c) => doc.text(d, gx + first + c * col, gy + mm(3), { width: col, align: 'center', lineBreak: false }));
  const ic = Math.min(mm(9), rh * .7), dot = Math.min(mm(9), rh * .66) / 2;
  tasks.forEach((t, r) => {
    const cy = gy + head + r * rh + rh / 2;
    doc.image(icon(t.i), gx + mm(3), cy - ic / 2, { width: ic });
    doc.font('body').fontSize(Math.min(mm(4.6), rh * .32)).fillColor(NAVY)
      .text(t.t, gx + mm(3) + ic + mm(3), cy - mm(2.6), { width: first - ic - mm(9), height: rh, lineBreak: false, ellipsis: true });
    doc.lineWidth(mm(.6)).strokeColor(DOT).dash(mm(1.2), { space: mm(1) });
    for (let c = 0; c < 7; c++) doc.circle(gx + first + c * col + col / 2, cy, dot).stroke();
    doc.undash();
  });

  // rodapé
  const fy = gy + gh + mm(7);
  doc.font('body').fontSize(mm(4.4)).fillColor(NAVY).text('Bolinhas da semana:', L, fy, { lineBreak: false });
  doc.lineWidth(mm(.5)).strokeColor(NAVY).moveTo(L + mm(46), fy + mm(4.5)).lineTo(L + mm(90), fy + mm(4.5)).stroke();
  doc.text('Prêmio combinado:', L + mm(100), fy, { lineBreak: false });
  doc.moveTo(L + mm(142), fy + mm(4.5)).lineTo(R, fy + mm(4.5)).stroke();
  doc.fontSize(mm(3.1)).fillColor(MUTED).text(`Quadro grátis em ${host}/quadro-de-tarefas-infantil · No app GameTask a criança marca no celular e você só aprova.`,
    L, fy + mm(9), { width: R - L, align: 'center', lineBreak: false });
}

// kids: ['Eva', ...]; tasks: [{ t: 'Arrumar a cama', i: 'bed' }, ...] → Buffer do PDF
function quadroPdf({ kids, tasks, host }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false, info: { Title: 'Quadro de tarefas', Author: 'GameTask' } });
    doc.registerFont('display', FONTS.display);
    doc.registerFont('body', FONTS.body);
    const out = []; doc.on('data', d => out.push(d)); doc.on('end', () => resolve(Buffer.concat(out))); doc.on('error', reject);
    (kids.length ? kids : ['']).forEach(k => { doc.addPage(); sheet(doc, k, tasks.slice(0, 12), host); });
    doc.end();
  });
}

module.exports = { quadroPdf };
