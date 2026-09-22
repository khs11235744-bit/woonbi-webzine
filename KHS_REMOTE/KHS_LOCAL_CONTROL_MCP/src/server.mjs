import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import 'dotenv/config';

const execFileAsync = promisify(execFile);
const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const HOST = process.env.HOST ?? '127.0.0.1';
const MCP_PATH = process.env.MCP_PATH ?? '/mcp';
const PROFILE = (process.env.PERMISSION_PROFILE ?? 'read').toLowerCase();
const CONTROL_TOKEN = process.env.LOCAL_CONTROL_TOKEN ?? '';
const MAX_READ_BYTES = Number.parseInt(process.env.MAX_READ_BYTES ?? '262144', 10);
const MAX_DIRECTORY_ENTRIES = Number.parseInt(process.env.MAX_DIRECTORY_ENTRIES ?? '300', 10);
const COMMAND_TIMEOUT_MS = Number.parseInt(process.env.COMMAND_TIMEOUT_MS ?? '15000', 10);
const SAFE_EXECUTABLES = new Set(
  (process.env.SAFE_EXECUTABLES ?? 'git,git.exe,node,node.exe,npm,npm.cmd,npx,npx.cmd,python,python.exe,python3,python3.exe,rg,rg.exe,where,where.exe,ipconfig,tasklist,whoami,hostname')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
);

if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
  throw new Error('KHS Local Control MCP refuses non-loopback bind addresses.');
}
if (!['read', 'write', 'control'].includes(PROFILE)) {
  throw new Error(`Invalid PERMISSION_PROFILE: ${PROFILE}`);
}

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(os.homedir(), value.slice(2));
  return value;
}

const workspaceInput = expandHome(process.env.WORKSPACE_ROOT ?? process.cwd());
if (!existsSync(workspaceInput)) throw new Error(`WORKSPACE_ROOT does not exist: ${workspaceInput}`);
const WORKSPACE_ROOT = await realpath(path.resolve(workspaceInput));

function isWithin(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function resolveReadable(input = '.') {
  const abs = path.resolve(WORKSPACE_ROOT, expandHome(input));
  const real = await realpath(abs);
  if (!isWithin(WORKSPACE_ROOT, real)) throw new Error('Path is outside WORKSPACE_ROOT.');
  return real;
}

async function resolveWritable(input) {
  const abs = path.resolve(WORKSPACE_ROOT, expandHome(input));
  let ancestor = path.dirname(abs);
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error('Could not resolve writable ancestor.');
    ancestor = parent;
  }
  const realAncestor = await realpath(ancestor);
  if (!isWithin(WORKSPACE_ROOT, realAncestor)) throw new Error('Path is outside WORKSPACE_ROOT.');
  return abs;
}

function requireProfile(minimum) {
  const rank = { read: 0, write: 1, control: 2 };
  if (rank[PROFILE] < rank[minimum]) throw new Error(`Tool requires '${minimum}' profile; current profile is '${PROFILE}'.`);
}

function requireControlToken(value) {
  if (!CONTROL_TOKEN || CONTROL_TOKEN.length < 24) throw new Error('Set a strong LOCAL_CONTROL_TOKEN before privileged tools can run.');
  if (value !== CONTROL_TOKEN) throw new Error('Invalid control token.');
}

function textResult(value) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
    structuredContent: typeof value === 'object' && value !== null ? value : { value }
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }]
  };
}

async function audit(event) {
  const auditDir = path.join(WORKSPACE_ROOT, '.khs-mcp');
  await mkdir(auditDir, { recursive: true });
  const file = path.join(auditDir, 'audit.jsonl');
  const safe = { time: new Date().toISOString(), ...event };
  const { appendFile } = await import('node:fs/promises');
  await appendFile(file, `${JSON.stringify(safe)}\n`, 'utf8');
}

function createMcpServer() {
  const server = new McpServer({ name: 'khs-local-control-mcp', version: '0.1.0' });

  server.registerTool(
    'computer_status',
    {
      title: 'Computer status',
      description: 'Show the local bridge status and active safety policy.',
      inputSchema: {},
      outputSchema: {
        ok: z.boolean(),
        platform: z.string(),
        hostname: z.string(),
        workspaceRoot: z.string(),
        permissionProfile: z.string(),
        privilegedToolsConfigured: z.boolean()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }
    },
    async () => textResult({
      ok: true,
      platform: process.platform,
      hostname: os.hostname(),
      workspaceRoot: WORKSPACE_ROOT,
      permissionProfile: PROFILE,
      privilegedToolsConfigured: CONTROL_TOKEN.length >= 24
    })
  );

  server.registerTool(
    'list_directory',
    {
      title: 'List directory',
      description: 'List files inside WORKSPACE_ROOT.',
      inputSchema: { path: z.string().default('.'), includeHidden: z.boolean().optional() },
      outputSchema: { path: z.string(), entries: z.array(z.object({ name: z.string(), type: z.string(), size: z.number() })) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }
    },
    async ({ path: input, includeHidden = false }) => {
      try {
        const dir = await resolveReadable(input);
        const entries = [];
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (!includeHidden && entry.name.startsWith('.')) continue;
          const full = path.join(dir, entry.name);
          const meta = await stat(full);
          entries.push({ name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other', size: meta.size });
          if (entries.length >= MAX_DIRECTORY_ENTRIES) break;
        }
        return textResult({ path: dir, entries });
      } catch (error) { return errorResult(error); }
    }
  );

  server.registerTool(
    'read_file',
    {
      title: 'Read file',
      description: 'Read a UTF-8 text file inside WORKSPACE_ROOT.',
      inputSchema: { path: z.string().min(1) },
      outputSchema: { path: z.string(), text: z.string(), bytes: z.number(), truncated: z.boolean() },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }
    },
    async ({ path: input }) => {
      try {
        const file = await resolveReadable(input);
        const data = await readFile(file);
        const truncated = data.byteLength > MAX_READ_BYTES;
        const body = truncated ? data.subarray(0, MAX_READ_BYTES) : data;
        return textResult({ path: file, text: body.toString('utf8'), bytes: data.byteLength, truncated });
      } catch (error) { return errorResult(error); }
    }
  );

  server.registerTool(
    'write_file',
    {
      title: 'Write file',
      description: 'Write a UTF-8 file inside WORKSPACE_ROOT. Requires write profile and local control token.',
      inputSchema: { path: z.string().min(1), text: z.string(), control_token: z.string().optional() },
      outputSchema: { path: z.string(), bytesWritten: z.number() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false }
    },
    async ({ path: input, text, control_token }) => {
      try {
        requireProfile('write');
        requireControlToken(control_token);
        const file = await resolveWritable(input);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, text, 'utf8');
        await audit({ tool: 'write_file', path: file, bytes: Buffer.byteLength(text, 'utf8') });
        return textResult({ path: file, bytesWritten: Buffer.byteLength(text, 'utf8') });
      } catch (error) { return errorResult(error); }
    }
  );

  server.registerTool(
    'run_command',
    {
      title: 'Run command',
      description: 'Run an allowlisted executable inside WORKSPACE_ROOT. Requires control profile and local control token.',
      inputSchema: {
        command: z.array(z.string()).min(1),
        cwd: z.string().optional(),
        timeoutMs: z.number().int().min(1000).max(120000).optional(),
        control_token: z.string().optional()
      },
      outputSchema: { exitCode: z.number(), stdout: z.string(), stderr: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true, idempotentHint: false }
    },
    async ({ command, cwd, timeoutMs, control_token }) => {
      try {
        requireProfile('control');
        requireControlToken(control_token);
        const executable = command[0];
        const base = path.basename(executable).toLowerCase();
        if (!SAFE_EXECUTABLES.has(base)) throw new Error(`Executable is not allowlisted: ${base}`);
        const workingDirectory = cwd ? await resolveReadable(cwd) : WORKSPACE_ROOT;
        const result = await execFileAsync(executable, command.slice(1), {
          cwd: workingDirectory,
          timeout: timeoutMs ?? COMMAND_TIMEOUT_MS,
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, LOCAL_CONTROL_TOKEN: '' }
        });
        await audit({ tool: 'run_command', executable: base, cwd: workingDirectory });
        return textResult({ exitCode: 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
      } catch (error) {
        if (error && typeof error === 'object' && ('stdout' in error || 'stderr' in error)) {
          return textResult({ exitCode: typeof error.code === 'number' ? error.code : 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? error.message ?? '') });
        }
        return errorResult(error);
      }
    }
  );

  return server;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization,mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

const httpServer = createServer(async (req, res) => {
  if (!req.url || !req.method) return res.writeHead(400).end('Bad Request');
  const url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  cors(res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, name: 'khs-local-control-mcp', workspaceRoot: WORKSPACE_ROOT, profile: PROFILE }));
  }
  if (url.pathname !== MCP_PATH || !['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.writeHead(404).end('Not Found');
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('[khs-mcp] request failed:', error);
    if (!res.headersSent) res.writeHead(500).end('Internal Server Error');
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[khs-mcp] listening on http://${HOST}:${PORT}${MCP_PATH}`);
  console.log(`[khs-mcp] workspace: ${WORKSPACE_ROOT}`);
  console.log(`[khs-mcp] profile: ${PROFILE}`);
});
