// @ts-nocheck // AI SDK v7 tool() 类型推断限制，待SDK修复后移除
/**
 * 技能系统 v2 - 渐进式披露 + DB优先 + 结构化包装
 * 参考 Agent Skills 开放标准（agentskills.ac.cn）
 * 
 * 渐进式加载（三层）：
 * 1. 目录层：会话开始时仅加载 name + description（~50-100 token/技能）
 * 2. 指令层：任务匹配时加载完整 SKILL.md 正文（<skill_content>包装）
 * 3. 资源层：按需加载 references/ 和 scripts/
 * 
 * DB优先：先读DB → DB无数据读文件系统 → 都没有返回空
 */
import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { query, queryOne, run } from '@/lib/db';

// ============ 类型定义 ============

interface SkillMeta {
  name: string;
  description: string;
  globs?: string[];
  alwaysApply?: boolean;
  priority?: number;
  category?: string;
}

interface Skill extends SkillMeta {
  id: string;
  directory?: string;
  instructions: string;
  hasReferences: boolean;
  hasScripts: boolean;
  tokenEstimate?: number;
  resources?: string[];
  source: 'db' | 'filesystem';
}

// ============ 激活追踪（per-conversation） ============
// 格式: Map<conversationId, Set<skillId>>
const activationTracker = new Map<string, Set<string>>();

export function initConversationTracking(convId: string): void {
  if (!activationTracker.has(convId)) {
    activationTracker.set(convId, new Set());
  }
}

export function isSkillActivated(convId: string, skillId: string): boolean {
  return activationTracker.get(convId)?.has(skillId) || false;
}

export function markSkillActivated(convId: string, skillId: string): void {
  if (!activationTracker.has(convId)) {
    activationTracker.set(convId, new Set());
  }
  activationTracker.get(convId)!.add(skillId);
}

export function clearConversationTracking(convId: string): void {
  activationTracker.delete(convId);
}

// ============ DB技能发现 ============

async function discoverDBSkills(): Promise<Skill[]> {
  try {
    const rows = await query<{
      id: string; name: string; description: string; instructions: string;
      category: string; globs: string[]; always_apply: boolean; priority: number;
      token_estimate: number; resources: string; is_active: boolean;
    }>('SELECT id, name, description, instructions, category, globs, always_apply, priority, token_estimate, resources, is_active FROM agent_skills WHERE is_active = true ORDER BY priority DESC');
    
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      instructions: r.instructions || '',
      category: r.category || 'general',
      globs: r.globs || [],
      alwaysApply: r.always_apply || false,
      priority: r.priority || 100,
      tokenEstimate: r.token_estimate || 0,
      resources: (() => { try { return JSON.parse(r.resources || '[]'); } catch { return []; } })(),
      hasReferences: false,
      hasScripts: false,
      source: 'db' as const,
    }));
  } catch (e: any) {
    console.error('[Skills] DB技能发现失败:', e?.message);
    return [];
  }
}

// ============ 文件系统技能发现（fallback） ============

const SKILLS_DIR = path.join(process.cwd(), 'skills');
let fsSkillsCache: Skill[] | null = null;

function discoverFSSkills(): Skill[] {
  if (fsSkillsCache) return fsSkillsCache;

  const skills: Skill[] = [];
  if (!fs.existsSync(SKILLS_DIR)) {
    fsSkillsCache = skills;
    return skills;
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(SKILLS_DIR, entry.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const raw = fs.readFileSync(skillMdPath, 'utf-8');
      const { data, content } = matter(raw);
      skills.push({
        id: entry.name,
        name: data.name || entry.name,
        description: data.description || '',
        globs: data.globs || [],
        alwaysApply: data.alwaysApply || false,
        priority: data.priority || 100,
        directory: skillDir,
        instructions: content.trim(),
        hasReferences: fs.existsSync(path.join(skillDir, 'references')),
        hasScripts: fs.existsSync(path.join(skillDir, 'scripts')),
        source: 'filesystem' as const,
      });
    } catch (error) {
      console.error(`[Skills] 加载技能 ${entry.name} 失败:`, error);
    }
  }

  skills.sort((a, b) => (b.priority || 100) - (a.priority || 100));
  fsSkillsCache = skills;
  return skills;
}

// ============ 合并发现（DB优先，同名覆盖文件系统） ============

let mergedCache: Skill[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1分钟缓存

export async function discoverSkills(): Promise<Skill[]> {
  const now = Date.now();
  if (mergedCache && (now - cacheTimestamp) < CACHE_TTL) return mergedCache;

  const dbSkills = await discoverDBSkills();
  const fsSkills = discoverFSSkills();
  
  // DB优先：同名技能用DB版本覆盖
  const seen = new Set<string>();
  const merged: Skill[] = [];
  
  // 先加DB技能
  for (const s of dbSkills) {
    seen.add(String(s.id).toLowerCase());
    merged.push(s);
  }
  
  // 再加文件系统技能（跳过DB已有的同名技能）
  for (const s of fsSkills) {
    if (!seen.has(String(s.id).toLowerCase())) {
      merged.push(s);
    }
  }
  
  // 按priority排序
  merged.sort((a, b) => (b.priority || 100) - (a.priority || 100));
  
  mergedCache = merged;
  cacheTimestamp = now;
  return merged;
}

export function clearSkillsCache(): void {
  fsSkillsCache = null;
  mergedCache = null;
  cacheTimestamp = 0;
}

// ============ 技能目录生成（渐进式披露第一层） ============

export async function generateSkillsCatalog(): Promise<string> {
  const skills = await discoverSkills();
  if (skills.length === 0) return '';

  const lines = skills.map(s => {
    let line = `- **${s.name}** (ID: ${s.id}): ${s.description}`;
    if (s.tokenEstimate) line += ` [~${s.tokenEstimate}t]`;
    return line;
  });

  return `## 可用技能（渐进式加载）
使用 activate_skill 加载技能完整指令。仅当任务与技能描述匹配时才激活，避免浪费上下文。

${lines.join('\n')}`;
}

// ============ 结构化包装（P52: 上下文压缩保护） ============

function wrapSkillContent(skill: Skill): string {
  const resourcesList = (skill.resources && skill.resources.length > 0)
    ? `\n<skill_resources>\n${skill.resources.map(r => `<file>${r}</file>`).join('\n')}\n</skill_resources>`
    : '';
  
  const dirInfo = skill.directory 
    ? `\nSkill directory: ${skill.directory}\nRelative paths in this skill are relative to the skill directory.`
    : '';

  return `<skill_content name="${skill.id}">
# ${skill.name}

${skill.instructions}
${dirInfo}${resourcesList}
</skill_content>`;
}

// ============ AI SDK 工具定义 ============

export const getAvailableSkillsTool = tool({
  description: `获取当前可用的技能列表。每个技能包含名称、描述和ID。

当用户提到部署、修bug、代码审查、数据库操作等任务时，先调用此工具查看是否有相关技能可以加载。`,
  parameters: z.object({}),
  execute: async () => {
    const skills = await discoverSkills();
    if (skills.length === 0) {
      return '当前没有可用技能。在后台技能管理中添加技能，或在 skills/ 目录下创建 SKILL.md 文件。';
    }

    const lines = skills.map(s => {
      let line = `📌 ${s.name} (ID: ${s.id})\n   ${s.description}`;
      if (s.tokenEstimate) line += ` [~${s.tokenEstimate} tokens]`;
      if (s.hasReferences) line += '\n   📚 有参考文档可用';
      if (s.hasScripts) line += '\n   🔧 有执行脚本可用';
      return line;
    });

    return `可用技能 (${skills.length}个):\n\n${lines.join('\n\n')}\n\n使用 activate_skill 加载技能完整指令，使用 read_skill_file 读取参考文档。`;
  },
});

export const activateSkillTool = tool({
  description: `激活指定技能，加载其完整指令到上下文中。仅当任务与技能描述匹配时才激活。

技能指令会用 <skill_content> 标签包装，在上下文压缩时会自动保护不被裁剪。同一技能在同一对话中不会重复加载。`,
  parameters: z.object({
    skillId: z.string().describe('技能ID，从技能目录或 get_available_skills 获取'),
    conversationId: z.string().optional().describe('当前对话ID，用于追踪已激活技能避免重复'),
  }),
  execute: async ({ skillId, conversationId }) => {
    if (!skillId || typeof skillId !== 'string') return '❌ 请提供有效的技能ID（字符串类型）';
    const skills = await discoverSkills();
    const skill = skills.find(s => s.id === String(skillId) || (s.name && String(skillId) && s.name.toLowerCase() === String(skillId).toLowerCase()));

    if (!skill) {
      return `❌ 未找到技能: ${skillId}。可用技能: ${skills.map(s => s.id).join(', ')}`;
    }

    // 激活追踪：同一对话不重复加载
    if (conversationId && isSkillActivated(conversationId, skillId)) {
      return `ℹ️ 技能 "${skill.name}" 已在当前对话中激活，无需重复加载。继续按照其指令执行即可。`;
    }

    if (conversationId) {
      markSkillActivated(conversationId, skillId);
    }

    // 结构化包装
    const wrapped = wrapSkillContent(skill);

    // 记录激活到DB（可选，用于统计分析）
    try {
      await run('UPDATE agent_skills SET token_estimate = $1, updatedat = NOW() WHERE id = $2',
        [Math.ceil(skill.instructions.length / 4), skill.id]);
    } catch {}

    return wrapped;
  },
});

export const readSkillFileTool = tool({
  description: `读取技能目录下的参考文档或执行脚本。

路径格式: references/文件名 或 scripts/文件名`,
  parameters: z.object({
    skillId: z.string().describe('技能ID'),
    filePath: z.string().describe('相对于技能目录的文件路径，如 references/checklist.md 或 scripts/deploy.sh'),
  }),
  execute: async ({ skillId, filePath }) => {
    const skills = await discoverSkills();
    const skill = skills.find(s => s.id === skillId);
    if (!skill) return `❌ 未找到技能: ${skillId}`;
    if (!skill.directory) return `❌ DB技能不支持文件读取，请使用技能指令中描述的方法。`;

    const fullPath = path.join(skill.directory, filePath);
    if (!fullPath.startsWith(skill.directory)) return `❌ 非法路径: ${filePath}`;
    if (!fs.existsSync(fullPath)) {
      const listDir = (dir: string, prefix = ''): string[] => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
          if (e.isDirectory()) return listDir(path.join(dir, e.name), `${prefix}${e.name}/`);
          return [`${prefix}${e.name}`];
        });
      };
      const available = [
        ...listDir(path.join(skill.directory, 'references'), 'references/'),
        ...listDir(path.join(skill.directory, 'scripts'), 'scripts/'),
      ];
      return `❌ 文件不存在: ${filePath}\n可用文件:\n${available.map(f => `  - ${f}`).join('\n')}`;
    }

    return fs.readFileSync(fullPath, 'utf-8');
  },
});

// 兼容旧名称
export const useSkillTool = activateSkillTool;

export const skillTools = {
  get_available_skills: getAvailableSkillsTool,
  activate_skill: activateSkillTool,
  read_skill_file: readSkillFileTool,
};
