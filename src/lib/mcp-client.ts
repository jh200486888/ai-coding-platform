import { getSetting } from '@/lib/db';
import { spawn, ChildProcess } from 'child_process';

// ============ Stdio MCP Transport ============
class StdioTransport {
  private proc: ChildProcess | null = null;
  private buffer = '';
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any) => void;
  protocolVersion?: string;

  constructor(
    private command: string,
    private args: string[],
    private env: Record<string, string>,
    private cwd?: string,
  ) {}

  async start(): Promise<void> {
    this.proc = spawn(process.execPath, [this.command, ...this.args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
      cwd: this.cwd,
    });

    if (!this.proc.pid) {
      throw new Error('Failed to spawn: ' + this.command);
    }

    this.proc.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const msg = JSON.parse(t);
          if (msg.result?.protocolVersion) {
            this.protocolVersion = msg.result.protocolVersion;
          }
          this.onmessage?.(msg);
        } catch { /* non-JSON output, ignore */ }
      }
    });

    this.proc.stderr!.on('data', (data: Buffer) => {
      const m = data.toString().trim();
      if (m) console.error('[Stdio:' + this.command.split('/').pop() + '] ' + m);
    });

    this.proc.on('error', (err) => { this.onerror?.(err); });
    this.proc.on('exit', (code) => { this.onclose?.(); });
  }

  async send(message: any): Promise<void> {
    if (!this.proc?.stdin) throw new Error('Not started');
    return new Promise((resolve, reject) => {
      this.proc!.stdin!.write(JSON.stringify(message) + '\n', (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.proc) {
      try { this.proc.stdin?.end(); } catch {}
      const p = this.proc;
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 2000);
      this.proc = null;
    }
  }
}

// ============ MCP Server Config ============
interface MCPServerConfig {
  id: string;
  name: string;
  url?: string;
  type: 'http' | 'sse' | 'stdio';
  enabled: boolean;
  apiKey?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ============ MCP Client Manager ============
class MCPClientManager {
  private clients = new Map<string, any>();
  private configs: MCPServerConfig[] = [];
  private initialized = false;
  private failedServers = new Set<string>();

  async initialize() {
    if (this.initialized) return;
    try {
      const s = await getSetting('mcp_servers');
      if (s) this.configs = JSON.parse(s);
    } catch { this.configs = []; }
    this.initialized = true;
  }

  async getClient(name: string): Promise<any | null> {
    if (this.clients.has(name)) return this.clients.get(name);
    if (this.failedServers.has(name)) return null;
    const cfg = this.configs.find(c => c.name === name && c.enabled);
    if (!cfg) return null;

    try {
      const { createMCPClient } = await import('@ai-sdk/mcp');

      if (cfg.type === 'stdio' && cfg.command) {
        const projectDir = process.env.PROJECT_DIR || '/www/wwwroot/agent.piyiguo.com';
        const transport = new StdioTransport(cfg.command, cfg.args || [], cfg.env || {}, projectDir);
        const client = await createMCPClient({ transport });
        if (client) {
          this.clients.set(name, client);
          const info = client.serverInfo || {};
          console.log('[MCP] ' + name + ': stdio connected (' + (info.name || 'unknown') + ' v' + (info.version || '?') + ')');
        }
        return client;
      } else {
        const headers: Record<string, string> = { ...(cfg.headers || {}) };
        if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;
        const client = await createMCPClient({
          transport: {
            type: cfg.type as 'http' | 'sse',
            url: cfg.url!,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          },
        });
        if (client) {
          this.clients.set(name, client);
          const info = client.serverInfo || {};
          console.log('[MCP] ' + name + ': ' + cfg.type + ' connected (' + (info.name || 'unknown') + ' v' + (info.version || '?') + ')');
        }
        return client;
      }
    } catch (e: any) {
      this.failedServers.add(name);
      console.error('[MCP] ' + name + ': ' + (e.message || String(e)).slice(0, 200));
      return null;
    }
  }

  async getAllTools(): Promise<Record<string, any>> {
    await this.initialize();
    const all: Record<string, any> = {};
    const enabledConfigs = this.configs.filter(c => c.enabled);
    for (const cfg of enabledConfigs) {
      try {
        const client = await this.getClient(cfg.name);
        if (!client) continue;
        const tools = await client.tools();
        for (const [n, t] of Object.entries(tools)) {
          all['mcp_' + cfg.name + '_' + n] = t;
        }
        console.log('[MCP] ' + cfg.name + ': ' + Object.keys(tools).length + ' tools loaded');
      } catch (e: any) {
        console.error('[MCP] ' + cfg.name + ' tools: ' + (e.message || String(e)).slice(0, 200));
      }
    }
    return all;
  }

  getConfigs() { return [...this.configs]; }

  async closeAll() {
    for (const [n, c] of this.clients) {
      try { await c.close(); } catch {}
    }
    this.clients.clear();
    this.failedServers.clear();
    this.initialized = false;
  }
}

export const mcpManager = new MCPClientManager();
