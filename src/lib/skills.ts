// @ts-nocheck
/**
 * 技能系统 - SKILL.md 标准格式的技能发现与加载
 * 参考 Agent Skills 开放标准（Anthropic原创，Claude Code/OpenCode/Cursor/GitHub通用）
 * 
 * 渐进式加载：
 * 1. 启动时只加载 name + description（几乎0 token）
 * 2. 任务匹配时加载完整 SKILL.md 指令
 * 3. 按需加载 references/ 和 scripts/
 */
import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface SkillMeta {
  name: string;
  description: string;
  globs?: string[];
  alwaysApply?: boolean;
  priority?: number;
}

interface Skill extends SkillMeta {
  id: string;
  directory: string;
  instructions: string; // SKILL.md 的 markdown 内容（frontmatter之后的部分）
  hasReferences: boolean;
  hasScripts: boolean;
}

// 技能目录路径（项目根目录下的 skills/）
const SKILLS_DIR = path.join(process.cwd(), 'skills');

// 已加载的技能缓存
let skillsCache: Skill[] | null = null;

/**
 * 发现所有可用技能（只加载元数据）
 */
export function discoverSkills(): Skill[] {
  if (skillsCache) return skillsCache;

  const skills: Skill[] = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    skillsCache = skills;
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

      const skill: Skill = {
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
      };

      skills.push(skill);
    } catch (error) {
      console.error(`[Skills] 加载技能 ${entry.name} 失败:`, error);
    }
  }

  // 按优先级排序
  skills.sort((a, b) => (b.priority || 100) - (a.priority || 100));

  skillsCache = skills;
  return skills;
}

/**
 * 生成技能目录（注入系统提示词）
 */
export function generateSkillsCatalog(): string {
  const skills = discoverSkills();
  if (skills.length === 0) return '';

  const lines = skills.map(s => {
    let line = `- **${s.name}** (ID: ${s.id}): ${s.description}`;
    if (s.hasReferences) line += ' [有参考文档]';
    if (s.hasScripts) line += ' [有执行脚本]';
    return line;
  });

  return `## 可用技能\n使用 use_skill 加载技能指令，使用 read_skill_file 读取参考文档或脚本。\n\n${lines.join('\n')}`;
}

/**
 * 清除技能缓存（开发时用）
 */
export function clearSkillsCache(): void {
  skillsCache = null;
}

// ==================== AI SDK 工具定义 ====================

export const getAvailableSkillsTool = tool({
  description: `获取当前可用的技能列表。每个技能包含名称、描述和ID。

当用户提到部署、修bug、代码审查、数据库操作等任务时，先调用此工具查看是否有相关技能可以加载。`,
  parameters: z.object({}),
  execute: async () => {
    const skills = discoverSkills();
    if (skills.length === 0) {
      return '当前没有可用技能。在 skills/ 目录下添加 SKILL.md 文件来创建技能。';
    }

    const lines = skills.map(s => {
      let line = `📌 ${s.name} (ID: ${s.id})\n   ${s.description}`;
      if (s.hasReferences) line += '\n   📚 有参考文档可用';
      if (s.hasScripts) line += '\n   🔧 有执行脚本可用';
      return line;
    });

    return `可用技能 (${skills.length}个):\n\n${lines.join('\n\n')}\n\n使用 use_skill 加载技能指令，使用 read_skill_file 读取参考文档。`;
  },
});

export const useSkillTool = tool({
  description: `加载指定技能的完整指令。加载后请严格按照技能指令执行任务。

技能指令包含了完成特定任务的标准流程、验证步骤和安全规则。`,
  parameters: z.object({
    skillId: z.string().describe('技能ID，从 get_available_skills 获取'),
  }),
  execute: async ({ skillId }) => {
    const skills = discoverSkills();
    const skill = skills.find(s => s.id === skillId);

    if (!skill) {
      return `❌ 未找到技能: ${skillId}。可用技能: ${skills.map(s => s.id).join(', ')}`;
    }

    let output = `# 技能: ${skill.name}\n\n${skill.instructions}`;

    if (skill.hasReferences) {
      output += `\n\n📎 此技能有参考文档，使用 read_skill_file 读取具体文件。`;
    }
    if (skill.hasScripts) {
      output += `\n\n🔧 此技能有执行脚本，使用 read_skill_file 读取脚本内容。`;
    }

    return output;
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
    const skills = discoverSkills();
    const skill = skills.find(s => s.id === skillId);

    if (!skill) {
      return `❌ 未找到技能: ${skillId}`;
    }

    const fullPath = path.join(skill.directory, filePath);

    // 安全检查：防止路径遍历
    if (!fullPath.startsWith(skill.directory)) {
      return `❌ 非法路径: ${filePath}`;
    }

    if (!fs.existsSync(fullPath)) {
      // 列出可用文件
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

    const content = fs.readFileSync(fullPath, 'utf-8');
    return content;
  },
});

export const skillTools = {
  get_available_skills: getAvailableSkillsTool,
  use_skill: useSkillTool,
  read_skill_file: readSkillFileTool,
};
