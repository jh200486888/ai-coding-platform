import { tool } from 'ai';
import { z } from 'zod';
import { query, getApiKeyByProvider } from '@/lib/db';

// ============ PostgreSQL 数据库工具 ============
export const dbTools = {
  db_list_tables: tool({
    description: '列出数据库中所有表及其行数估算。用于了解数据库结构。',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const tables = await query(
          `SELECT tablename, 
                  pg_catalog.obj_description(c.oid) as description
           FROM pg_tables t
           LEFT JOIN pg_class c ON c.relname = t.tablename
           WHERE schemaname = 'public'
           ORDER BY tablename`
        );
        if (!tables || tables.length === 0) return '数据库中暂无表';
        const lines = tables.map((t: any) => `  ${t.tablename}${t.description ? ' - ' + t.description : ''}`);
        return `数据库共 ${tables.length} 张表:\n${lines.join('\n')}`;
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),

  db_describe_table: tool({
    description: '查看指定表的列信息（列名、类型、是否可空、默认值）。',
    inputSchema: z.object({
      table: z.string().describe('表名'),
    }),
    execute: async ({ table }) => {
      try {
        // Sanitize table name
        const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
        const cols = await query(
          `SELECT column_name, data_type, is_nullable, column_default,
                  col_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, ordinal_position) as description
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [safeTable]
        );
        if (!cols || cols.length === 0) return `表 "${safeTable}" 不存在或无列`;
        const lines = cols.map((c: any) =>
          `  ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ' DEFAULT ' + c.column_default : ''}${c.description ? ' -- ' + c.description : ''}`
        );
        return `表 "${safeTable}" 共 ${cols.length} 列:\n${lines.join('\n')}`;
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),

  db_query: tool({
    description: '执行只读 SQL 查询（仅支持 SELECT）。用于查看数据、统计、搜索等。禁止执行 INSERT/UPDATE/DELETE/DROP 等修改操作。',
    inputSchema: z.object({
      sql: z.string().describe('SELECT SQL 语句'),
      limit: z.number().optional().describe('最大返回行数，默认 50'),
    }),
    execute: async ({ sql: sqlInput, limit }) => {
      try {
        const trimmed = sqlInput.trim().replace(/;$/, '');
        // Security: only allow SELECT
        const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
        if (firstWord !== 'SELECT' && firstWord !== 'WITH') {
          return '⛔ 安全限制: 仅允许 SELECT / WITH 查询，禁止修改操作';
        }
        const maxRows = Math.min(limit || 50, 200);
        const result = await query(trimmed + ` LIMIT ${maxRows}`);
        if (!result || result.length === 0) return '查询结果为空';
        const total = result.length;
        const preview = result.slice(0, 20);
        const formatted = preview.map((row: any) => JSON.stringify(row)).join('\n');
        return `查询返回 ${total} 行${total > 20 ? '（显示前 20 行）' : ''}:\n${formatted}`;
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),

  db_table_data: tool({
    description: '获取指定表的最近数据（按创建时间或ID倒序）。',
    inputSchema: z.object({
      table: z.string().describe('表名'),
      rows: z.number().optional().describe('返回行数，默认 10'),
      where: z.string().optional().describe('WHERE 条件（不含 WHERE 关键字），如 "status = \'active\'"'),
    }),
    execute: async ({ table, rows, where }) => {
      try {
        const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
        const maxRows = Math.min(rows || 10, 100);
        let sql = `SELECT * FROM "${safeTable}"`;
        if (where) {
          const safeWhere = where.replace(/['";\\]/g, '');
          sql += ` WHERE ${safeWhere}`;
        }
        sql += ` ORDER BY 1 DESC LIMIT ${maxRows}`;
        const result = await query(sql);
        if (!result || result.length === 0) return `表 "${safeTable}" 无数据`;
        return `表 "${safeTable}" 最近 ${result.length} 条数据:\n${result.map((r: any) => JSON.stringify(r)).join('\n')}`;
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),
};

// ============ GitHub 工具 ============
async function getGitHubToken(): Promise<string | null> {
  try {
    const keyData = await getApiKeyByProvider('github');
    if (keyData && keyData.is_active && keyData.api_key_encrypted) {
      return Buffer.from(keyData.api_key_encrypted, 'base64').toString('utf-8');
    }
  } catch {}
  return null;
}

async function githubAPI(path: string, token: string, method = 'GET', body?: any): Promise<any> {
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res.json();
}

export const githubTools = {
  github_search_code: tool({
    description: '在 GitHub 上搜索代码。需要先在设置中配置 github_token。',
    inputSchema: z.object({
      query: z.string().describe('搜索查询，如 "repo:owner/rename filename:config language:typescript"'),
      per_page: z.number().optional().describe('每页结果数，默认 10'),
    }),
    execute: async ({ query: q, per_page }) => {
      const token = await getGitHubToken();
      if (!token) return '⚠️ 未配置 GitHub Token。请在后台管理 → API密钥 → 添加 GitHub 密钥';
      try {
        const data = await githubAPI(`/search/code?q=${encodeURIComponent(q)}&per_page=${per_page || 10}`, token);
        if (!data.items || data.items.length === 0) return '未找到匹配的代码';
        return `找到 ${data.total_count} 个结果（显示 ${data.items.length} 个）:\n` +
          data.items.map((item: any) => `  ${item.repository.full_name}: ${item.path}`).join('\n');
      } catch (e: any) {
        return '搜索失败: ' + (e.message || String(e));
      }
    },
  }),

  github_list_issues: tool({
    description: '列出 GitHub 仓库的 Issues。',
    inputSchema: z.object({
      owner: z.string().describe('仓库所有者'),
      repo: z.string().describe('仓库名'),
      state: z.enum(['open', 'closed', 'all']).optional().describe('状态过滤，默认 open'),
      per_page: z.number().optional().describe('每页数，默认 10'),
    }),
    execute: async ({ owner, repo, state, per_page }) => {
      const token = await getGitHubToken();
      if (!token) return '⚠️ 未配置 GitHub Token。请在后台管理 → API密钥 → 添加 GitHub 密钥';
      try {
        const data = await githubAPI(`/repos/${owner}/${repo}/issues?state=${state || 'open'}&per_page=${per_page || 10}&sort=created&direction=desc`, token);
        if (!data || data.length === 0) return '暂无 Issues';
        return `仓库 ${owner}/${repo} 的 Issues (${state || 'open'}):\n` +
          data.map((i: any) => `  #${i.number} [${i.state}] ${i.title} (${i.user?.login}) ${i.labels?.map((l: any) => l.name).join(',') || ''}`).join('\n');
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),

  github_create_issue: tool({
    description: '在 GitHub 仓库创建新 Issue。',
    inputSchema: z.object({
      owner: z.string().describe('仓库所有者'),
      repo: z.string().describe('仓库名'),
      title: z.string().describe('Issue 标题'),
      body: z.string().optional().describe('Issue 内容'),
      labels: z.array(z.string()).optional().describe('标签列表'),
    }),
    execute: async ({ owner, repo, title, body, labels }) => {
      const token = await getGitHubToken();
      if (!token) return '⚠️ 未配置 GitHub Token。请在后台管理 → API密钥 → 添加 GitHub 密钥';
      try {
        const data = await githubAPI(`/repos/${owner}/${repo}/issues`, token, 'POST', {
          title, body, labels: labels || [],
        });
        return `Issue 已创建: #${data.number} ${data.title}\n${data.html_url}`;
      } catch (e: any) {
        return '创建失败: ' + (e.message || String(e));
      }
    },
  }),

  github_list_prs: tool({
    description: '列出 GitHub 仓库的 Pull Requests。',
    inputSchema: z.object({
      owner: z.string().describe('仓库所有者'),
      repo: z.string().describe('仓库名'),
      state: z.enum(['open', 'closed', 'all']).optional().describe('状态过滤，默认 open'),
    }),
    execute: async ({ owner, repo, state }) => {
      const token = await getGitHubToken();
      if (!token) return '⚠️ 未配置 GitHub Token。请在后台管理 → API密钥 → 添加 GitHub 密钥';
      try {
        const data = await githubAPI(`/repos/${owner}/${repo}/pulls?state=${state || 'open'}&sort=created&direction=desc&per_page=15`, token);
        if (!data || data.length === 0) return '暂无 Pull Requests';
        return `仓库 ${owner}/${repo} 的 PRs (${state || 'open'}):\n` +
          data.map((pr: any) => `  #${pr.number} [${pr.state}] ${pr.title} (+${pr.additions}/-${pr.deletions}) by ${pr.user?.login}`).join('\n');
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),

  github_get_repo: tool({
    description: '获取 GitHub 仓库信息（描述、星数、语言等）。',
    inputSchema: z.object({
      owner: z.string().describe('仓库所有者'),
      repo: z.string().describe('仓库名'),
    }),
    execute: async ({ owner, repo }) => {
      const token = await getGitHubToken();
      if (!token) return '⚠️ 未配置 GitHub Token。请在后台管理 → API密钥 → 添加 GitHub 密钥';
      try {
        const data = await githubAPI(`/repos/${owner}/${repo}`, token);
        return [
          `仓库: ${data.full_name}`,
          `描述: ${data.description || '无'}`,
          `语言: ${data.language || '未知'}`,
          `Stars: ${data.stargazers_count} | Forks: ${data.forks_count} | Issues: ${data.open_issues_count}`,
          `默认分支: ${data.default_branch}`,
          `创建: ${data.created_at?.split('T')[0]} | 更新: ${data.updated_at?.split('T')[0]}`,
          `URL: ${data.html_url}`,
        ].join('\n');
      } catch (e: any) {
        return '查询失败: ' + (e.message || String(e));
      }
    },
  }),
};
