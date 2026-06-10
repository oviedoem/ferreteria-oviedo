// update-sw-version.js
// Actualiza BUILD_DATE en sw.js antes de cada deploy
// Ejecutado automáticamente por firebase.json predeploy
var fs   = require('fs');
var path = require('path');

var swPath  = path.join(__dirname, 'sw.js');
var content = fs.readFileSync(swPath, 'utf8');

var now = new Date();
var pad = function(n){ return n < 10 ? '0'+n : n; };
var ts  = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+
          ' '+pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());

var updated = content.replace(
  /(?:const|var) BUILD_DATE = '[^']*';/,
  "const BUILD_DATE = '" + ts + "';"
);

if (updated === content) {
  console.log('[predeploy] ADVERTENCIA: no se encontró BUILD_DATE en sw.js');
} else {
  fs.writeFileSync(swPath, updated, 'utf8');
  console.log('[predeploy] sw.js BUILD_DATE actualizado → ' + ts);
}
