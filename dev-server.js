/**
 * Servidor de Desarrollo con Live Reload y Compilación Automática para AVFenix Types
 * Ejecutar con: node dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const WATCH_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
let clients = [];

// Mime types para servir archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

// Compilar proyecto usando la CLI de AFXC
function triggerRebuild() {
  console.log('\n\x1b[36m[AFXC WATCH]\x1b[0m Cambios detectados en .avf. Recompilando proyecto...');
  exec('node afxc.js build', (err, stdout, stderr) => {
    if (err) {
      console.error('\x1b[31m[AFXC ERROR]\x1b[0m Error durante la compilación:\n', stderr || err.message);
      notifyClients('error', stderr || err.message);
    } else {
      console.log(stdout.trim());
      console.log('\x1b[32m[LIVE RELOAD]\x1b[0m Notificando al navegador para recargar...');
      notifyClients('reload');
    }
  });
}

// Enviar evento SSE a los navegadores conectados
function notifyClients(event, data = '') {
  clients.forEach(res => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// Servidor HTTP estático con canal SSE para Live Reload
const server = http.createServer((req, res) => {
  // Suscripción al canal SSE para recarga en vivo
  if (req.url === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    clients.push(res);
    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });
    return;
  }

  // Determinar ruta de archivo
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();

  // Inyectar script de Live Reload en index.html
  if (req.url === '/' || req.url === '/index.html') {
    if (fs.existsSync(filePath)) {
      let html = fs.readFileSync(filePath, 'utf8');
      const liveReloadSnippet = `
        <!-- Script de Live Reload inyectado por dev-server -->
        <script>
          (function() {
            const evtSource = new EventSource('/__livereload');
            evtSource.addEventListener('reload', () => {
              console.log('[AVFenix DevServer] Recompilado detectado. Recargando...');
              window.location.reload();
            });
            evtSource.addEventListener('error', (e) => {
              if (e.data) console.error('[AVFenix DevServer Error]:', JSON.parse(e.data));
            });
          })();
        </script>
      `;
      html = html.replace('</body>', `${liveReloadSnippet}</body>`);
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
      res.end(html);
      return;
    }
  }

  // Servir otros archivos estáticos
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// Observar cambios en archivos .avf
if (fs.existsSync(WATCH_DIR)) {
  fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.avf')) {
      triggerRebuild();
    }
  });
  console.log(`\x1b[35m[AFXC WATCH]\x1b[0m Observando directorio: \x1b[33m${WATCH_DIR}\x1b[0m`);
}

server.listen(PORT, () => {
  console.log(`\n\x1b[32m🚀 [AVFenix DevServer]\x1b[0m Servidor escuchando en: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
});
