import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type Manejador = (request: Request) => Promise<Response>;

/** Pasa una petición de Node a la función `POST` de api/chat.ts (la misma que usa Vercel en producción). */
async function atender(req: IncomingMessage, res: ServerResponse, cargar: () => Promise<{ POST: Manejador }>) {
  try {
    const cuerpo = await new Promise<string>((ok) => {
      let texto = '';
      req.on('data', (parte) => (texto += parte));
      req.on('end', () => ok(texto));
    });
    const { POST } = await cargar();
    const respuesta = await POST(
      new Request('http://localhost/api/chat', {
        method: req.method,
        headers: { 'content-type': 'application/json' },
        body: req.method === 'POST' ? cuerpo : undefined,
      }),
    );
    res.statusCode = respuesta.status;
    res.setHeader('content-type', respuesta.headers.get('content-type') ?? 'application/json');
    res.end(await respuesta.text());
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(error) }));
  }
}

/** En desarrollo, /api/chat se atiende localmente (en Vercel lo atiende la función de api/). */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) =>
        atender(req, res, () => server.ssrLoadModule('/api/chat.ts') as Promise<{ POST: Manejador }>),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/chat', (req, res) =>
        atender(req, res, () => import(pathToFileURL(resolve('api/chat.ts')).href)),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  // Las variables sin prefijo VITE_ (como GEMINI_API_KEY) solo las usa el servidor; nunca llegan al navegador.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), apiLocal()] };
});
