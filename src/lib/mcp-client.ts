import { getSetting } from '@/lib/db';

interface MCPConfig { name: string; transport: { type: 'http'|'sse'; url: string; headers?: Record<string,string> } }

class MCPClientManager {
  private clients = new Map<string, any>();
  private configs: MCPConfig[] = [];
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    try { const s = await getSetting('mcp_servers'); if (s) this.configs = JSON.parse(s); } catch { this.configs = []; }
    this.initialized = true;
  }

  async getClient(name: string): Promise<any|null> {
    if (this.clients.has(name)) return this.clients.get(name);
    const cfg = this.configs.find(c => c.name === name);
    if (!cfg) return null;
    try {
      const { createMCPClient } = await import('@ai-sdk/mcp');
      const client = await createMCPClient({
        transport: {
          type: cfg.transport.type,
          url: cfg.transport.url,
          headers: cfg.transport.headers,
        },
      });
      if (client) this.clients.set(name, client);
      return client;
    } catch (e: any) { console.error(`[MCP] ${name}:`, e.message); return null; }
  }

  async getAllTools(): Promise<Record<string,any>> {
    await this.initialize();
    const all: Record<string,any> = {};
    for (const cfg of this.configs) {
      try {
        const client = await this.getClient(cfg.name);
        if (!client) continue;
        const tools = await client.tools();
        for (const [n, t] of Object.entries(tools)) all[`mcp_${cfg.name}_${n}`] = t;
      } catch (e: any) { console.error(`[MCP] ${cfg.name}:`, e.message); }
    }
    return all;
  }

  getConfigs() { return [...this.configs]; }

  async closeAll() {
    for (const [n, c] of this.clients) { try { await c.close(); } catch {} }
    this.clients.clear();
  }
}

export const mcpManager = new MCPClientManager();
