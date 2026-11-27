// Publica o APK compilado no site: copia para public/android/GameTask.apk e escreve public/android/version.json
// (o número da versão que o link "Atualizar app" compara). Uso: node app-android/publish.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const apk = path.join(__dirname, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!fs.existsSync(apk)) { console.error('APK não encontrado. Compile antes: gradlew assembleDebug'); process.exit(1); }

const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk');
const bt = path.join(sdk, 'build-tools');
const ver = fs.readdirSync(bt).sort().reverse().find(v => fs.existsSync(path.join(bt, v, 'aapt2.exe')) || fs.existsSync(path.join(bt, v, 'aapt2')));
if (!ver) { console.error('aapt2 não encontrado em', bt); process.exit(1); }
const aapt2 = path.join(bt, ver, fs.existsSync(path.join(bt, ver, 'aapt2.exe')) ? 'aapt2.exe' : 'aapt2');
const out = execFileSync(aapt2, ['dump', 'badging', apk], { encoding: 'utf8' });
const m = out.match(/versionCode='(\d+)' versionName='([^']*)'/);
if (!m) { console.error('Não consegui ler a versão do APK'); process.exit(1); }

fs.mkdirSync(path.join(root, 'public/android'), { recursive: true });
fs.copyFileSync(apk, path.join(root, 'public/android/GameTask.apk'));
fs.copyFileSync(apk, path.join(root, 'GameTask-teste.apk'));
fs.writeFileSync(path.join(root, 'public/android/version.json'), JSON.stringify({ versionCode: +m[1], versionName: m[2], built: new Date().toISOString() }) + '\n');
console.log(`Publicado: versão ${m[2]} (código ${m[1]}), ${(fs.statSync(apk).size / 1048576).toFixed(1)} MB`);
