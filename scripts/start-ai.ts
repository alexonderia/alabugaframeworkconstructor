import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

async function responds(url: string, accept: (data: unknown) => boolean) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500), redirect: 'error' });
    return response.ok && accept(await response.json());
  } catch {
    return false;
  }
}

const servicePort = Number(process.env.AF_AI_PORT || 4176);
const entry = process.argv.includes('--demo') ? '/demo/' : '/builder/';
const service = `http://127.0.0.1:${servicePort}`;
const running = await responds(service + '/api/ai/health', data =>
  (data as { status?: string } | null)?.status === 'ok');

if (running) {
  console.log('Сервис Constructor уже работает. Готовность модели: npm run diagnose -- --require-ai --url ' + service);
} else {
  const configured = process.env.AF_OLLAMA_URL || process.env.AF_OLLAMA_PORT;
  const upstream = (process.env.AF_OLLAMA_URL || `http://127.0.0.1:${process.env.AF_OLLAMA_PORT || 11434}`).replace(/\/+$/, '');
  const available = () => responds(upstream + '/api/version', data =>
    typeof (data as { version?: string } | null)?.version === 'string');
  if (!await available()) {
    if (configured) throw new Error('Указанная Ollama недоступна. Проверьте настройки и запустите выбранный сервис.');
    const exe = resolve('.local/ollama/ollama.exe');
    if (!existsSync(exe)) throw new Error('Ollama не найдена. Сначала выполните npm run ai:setup.');
    const child = spawn(exe, ['serve'], {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_MODELS: resolve('.local/models'),
        OLLAMA_NUM_PARALLEL: '1',
        OLLAMA_MAX_LOADED_MODELS: '1',
        OLLAMA_NO_CLOUD: '1',
        OLLAMA_VULKAN: '1',
        OLLAMA_CONTEXT_LENGTH: process.env.AF_AI_CONTEXT || '4096',
      },
    });
    process.on('exit', () => child.kill());
    process.on('SIGINT', () => process.exit());
    let exited = false;
    child.once('error', () => { exited = true; });
    child.once('exit', () => { exited = true; });
    for (let attempt = 0; attempt < 20 && !exited; attempt++) {
      if (await available()) break;
      await delay(500);
    }
    if (!await available()) throw new Error('Ollama не запустилась. Проверьте установку и порт 11434.');
  }
  process.env.AF_OLLAMA_URL = upstream;
  await import('../apps/ai-server/src/ai-server');
}
console.log(`Откройте ${service}${entry}`);
