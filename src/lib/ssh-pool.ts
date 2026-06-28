/**
 * SSH 连接池 - 管理到远程服务器的SSH连接
 * 使用 node-ssh 库实现连接复用、超时管理和错误恢复
 */
import { NodeSSH, SSHExecCommandOptions } from 'node-ssh';

interface ServerConfig {
  host: string;
  username: string;
  privateKey?: string;
  password?: string;
  port: number;
  projectDir: string;
  pm2Service: string;
  appPort: number;
}

// 危险命令黑名单 - 直接拒绝执行
const DANGEROUS_COMMANDS = [
  /rm\s+(-rf?\s+)?\/\s*$/,
  /rm\s+(-rf?\s+)?\/etc/,
  /rm\s+(-rf?\s+)?\/www(?!\/wwwroot\/agent)/,
  /shutdown/,
  /reboot/,
  /init\s+[06]/,
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\{\s*:\|:\s*&\s*\}/,
  /DROP\s+DATABASE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/i,
  /wget.*\|\s*(ba)?sh/,
  /curl.*\|\s*(ba)?sh/,
  /chmod\s+777\s+\//,
  /chown\s+.*\s+\//,
];

// 需要审批的命令模式 - 执行前需要用户确认
const APPROVAL_COMMANDS = [
  /rm\s+/,
  /DROP\s+/i,
  /DELETE\s+/i,
  /TRUNCATE/i,
  /ALTER\s+/i,
  /pm2\s+(stop|delete|restart)/,
  /systemctl\s+(stop|restart|disable)/,
  /apt(\s+get)?\s+(remove|purge)/,
  /npm\s+uninstall/,
  /pnpm\s+remove/,
  /git\s+(reset|checkout)\s+--hard/,
  /docker\s+(rm|rmi|stop)/,
];

class SSHConnectionPool {
  private connections: Map<string, NodeSSH> = new Map();
  private lastUsed: Map<string, number> = new Map();
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5分钟空闲断开

  constructor() {
    // 每2分钟检查一次空闲连接
    setInterval(() => this.cleanupIdle(), 2 * 60 * 1000);
  }

  private getServerConfig(serverId: string): ServerConfig {
    const envPrefix = serverId.toUpperCase();

    const config: ServerConfig = {
      host: process.env[`${envPrefix}_SERVER_HOST`] || '',
      username: process.env[`${envPrefix}_SERVER_USER`] || 'root',
      port: parseInt(process.env[`${envPrefix}_SERVER_PORT`] || '22'),
      projectDir: process.env[`${envPrefix}_SERVER_DIR`] || '',
      pm2Service: process.env[`${envPrefix}_PM2_SERVICE`] || '',
      appPort: parseInt(process.env[`${envPrefix}_APP_PORT`] || '3000'),
    };

    // 私钥优先
    const keyPath = process.env[`${envPrefix}_SSH_KEY`];
    const password = process.env[`${envPrefix}_SSH_PASSWORD`];
    if (keyPath) {
      config.privateKey = keyPath;
    } else if (password) {
      config.password = password;
    }

    return config;
  }

  async getConnection(serverId: string): Promise<NodeSSH> {
    const existing = this.connections.get(serverId);
    if (existing && existing.isConnected()) {
      this.lastUsed.set(serverId, Date.now());
      return existing;
    }

    const config = this.getServerConfig(serverId);
    if (!config.host) {
      throw new Error(`未配置服务器: ${serverId}。请在.env中设置 ${serverId.toUpperCase()}_SERVER_HOST`);
    }

    const ssh = new NodeSSH();
    const connectOptions: Record<string, unknown> = {
      host: config.host,
      username: config.username,
      port: config.port,
    };

    if (config.privateKey) {
      connectOptions.privateKeyPath = config.privateKey;
    } else if (config.password) {
      connectOptions.password = config.password;
    } else {
      // 尝试默认SSH密钥
      connectOptions.privateKeyPath = '/root/.ssh/id_ed25519';
    }

    try {
      await ssh.connect(connectOptions);
      this.connections.set(serverId, ssh);
      this.lastUsed.set(serverId, Date.now());
      return ssh;
    } catch (error) {
      throw new Error(`SSH连接失败 (${serverId}@${config.host}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute(
    serverId: string,
    command: string,
    options?: { timeout?: number; cwd?: string }
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    // 安全检查：危险命令直接拒绝
    for (const pattern of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        throw new Error(`⛔ 危险命令被拦截: "${command}" 匹配安全黑名单规则。此操作可能导致数据丢失或系统不可用。`);
      }
    }

    const ssh = await this.getConnection(serverId);
    const config = this.getServerConfig(serverId);

    const execOptions: SSHExecCommandOptions = {
      execOptions: {
        timeout: options?.timeout || 60000,
        cwd: options?.cwd || config.projectDir,
      },
    };

    try {
      const result = await ssh.execCommand(command, execOptions);
      this.lastUsed.set(serverId, Date.now());
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        code: result.code ?? 0,
      };
    } catch (error) {
      // 连接可能已断开，移除缓存让下次重连
      this.connections.delete(serverId);
      throw new Error(`SSH命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async readFile(serverId: string, filePath: string): Promise<string> {
    const result = await this.execute(serverId, `cat "${filePath}"`);
    if (result.code !== 0) {
      throw new Error(`读取文件失败: ${result.stderr}`);
    }
    return result.stdout;
  }

  async writeFile(
    serverId: string,
    filePath: string,
    content: string,
    backup = true
  ): Promise<{ success: boolean; backupPath?: string }> {
    // 先备份
    let backupPath: string | undefined;
    if (backup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      backupPath = `${filePath}.bak.${timestamp}`;
      const backupResult = await this.execute(serverId, `cp "${filePath}" "${backupPath}"`);
      if (backupResult.code !== 0) {
        // 文件可能不存在（新建文件），不阻斷新建
        backupPath = undefined;
      }
    }

    // 用heredoc写入，base64编码避免转义问题
    const b64Content = Buffer.from(content).toString('base64');
    const writeCmd = `echo "${b64Content}" | base64 -d > "${filePath}"`;
    const result = await this.execute(serverId, writeCmd);

    if (result.code !== 0) {
      throw new Error(`写入文件失败: ${result.stderr}`);
    }

    return { success: true, backupPath };
  }

  async uploadFile(
    serverId: string,
    localContent: string,
    remotePath: string
  ): Promise<void> {
    const ssh = await this.getConnection(serverId);
    // 写入临时文件再移动
    const tmpPath = `/tmp/upload_${Date.now()}.tmp`;
    const b64Content = Buffer.from(localContent).toString('base64');
    await this.execute(serverId, `echo "${b64Content}" | base64 -d > "${tmpPath}"`);
    await this.execute(serverId, `mv "${tmpPath}" "${remotePath}"`);
  }

  /**
   * 检查命令是否需要用户审批
   */
  needsApproval(command: string): boolean {
    return APPROVAL_COMMANDS.some(pattern => pattern.test(command));
  }

  private async cleanupIdle(): Promise<void> {
    const now = Date.now();
    for (const [serverId, lastTime] of this.lastUsed.entries()) {
      if (now - lastTime > this.IDLE_TIMEOUT) {
        const conn = this.connections.get(serverId);
        if (conn) {
          try {
            conn.dispose();
          } catch { /* ignore */ }
          this.connections.delete(serverId);
          this.lastUsed.delete(serverId);
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const [serverId, conn] of this.connections.entries()) {
      try {
        conn.dispose();
      } catch { /* ignore */ }
      this.connections.delete(serverId);
      this.lastUsed.delete(serverId);
    }
  }
}

// 单例
export const sshPool = new SSHConnectionPool();
export { DANGEROUS_COMMANDS, APPROVAL_COMMANDS };
