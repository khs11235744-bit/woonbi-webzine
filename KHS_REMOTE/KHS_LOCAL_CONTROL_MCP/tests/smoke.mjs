import { spawn } from 'node:child_process';
import process from 'node:process';

const port = 8799;
const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    MCP_PATH: '/mcp',
    WORKSPACE_ROOT: process.cwd(),
    PERMISSION_PROFILE: 'read',
    LOCAL_CONTROL_TOKEN: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); });

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Health endpoint did not become ready. ' + stderr);
}

try {
  const health = await waitForHealth();
  if (!health.ok) throw new Error('Health returned ok=false');
  if (health.profile !== 'read') throw new Error('Expected read profile');
  console.log('Smoke test passed:', health);
} finally {
  child.kill();
}
