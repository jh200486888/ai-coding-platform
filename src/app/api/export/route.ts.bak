import { NextRequest, NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';

// ============ Markdown 解析 ============
interface ExportSection {
  title?: string;
  content: string;
  level?: number;
}

function parseMarkdown(md: string): ExportSection[] {
  const lines = md.split('\n');
  const sections: ExportSection[] = [];
  let currentContent: string[] = [];
  let currentTitle = '';
  let currentLevel = 0;

  const flushSection = () => {
    if (currentContent.length > 0 || currentTitle) {
      sections.push({
        title: currentTitle || undefined,
        content: currentContent.join('\n').trim(),
        level: currentLevel || undefined,
      });
      currentContent = [];
      currentTitle = '';
      currentLevel = 0;
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flushSection();
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].trim();
    } else {
      currentContent.push(line);
    }
  }
  flushSection();
  return sections;
}

// ============ HTML 生成（用于 PDF） ============
function markdownToHtml(md: string, title?: string): string {
  const sections = parseMarkdown(md);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || '报告'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; padding: 40px 60px; color: #1a1a2e; line-height: 1.8; background: #fff; }
  h1 { font-size: 28px; color: #7c3aed; margin: 40px 0 20px; padding-bottom: 12px; border-bottom: 3px solid #7c3aed; }
  h2 { font-size: 22px; color: #7c3aed; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
  h3 { font-size: 18px; color: #6d28d9; margin: 24px 0 12px; }
  h4 { font-size: 16px; color: #5b21b6; margin: 20px 0 10px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: Consolas, 'Courier New', monospace; font-size: 14px; }
  pre { background: #1e1e2a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
  pre code { background: none; padding: 0; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #7c3aed; color: #fff; }
  tr:nth-child(even) { background: #f9fafb; }
  blockquote { border-left: 4px solid #7c3aed; padding: 8px 16px; margin: 12px 0; background: #f5f3ff; }
  strong { color: #7c3aed; }
  .cover { text-align: center; padding: 80px 0 40px; }
  .cover h1 { font-size: 36px; border: none; margin-bottom: 16px; }
  .cover .meta { color: #64748b; font-size: 14px; }
  .divider { border: none; border-top: 2px solid #7c3aed; margin: 24px 0; }
</style></head><body>`;

  if (title) {
    html += `<div class="cover"><h1>${title}</h1><div class="meta">AI 编程平台 · ${new Date().toLocaleDateString('zh-CN')}</div></div><hr class="divider">`;
  }

  for (const section of sections) {
    if (section.title) {
      const tag = `h${Math.min(section.level || 1, 6)}`;
      html += `<${tag}>${section.title}</${tag}>`;
    }
    if (section.content) {
      html += renderContent(section.content);
    }
  }

  html += '</body></html>';
  return html;
}

function renderContent(content: string): string {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<br>';
    if (trimmed.startsWith('```')) return '';
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return `<li>${inlineFormat(trimmed.slice(2))}</li>`;
    if (/^\d+\.\s/.test(trimmed)) return `<li>${inlineFormat(trimmed.replace(/^\d+\.\s/, ''))}</li>`;
    if (trimmed.startsWith('|')) return renderTableRow(trimmed);
    if (trimmed.startsWith('>')) return `<blockquote>${inlineFormat(trimmed.slice(1).trim())}</blockquote>`;
    return `<p>${inlineFormat(trimmed)}</p>`;
  }).join('\n');
}

function renderTableRow(line: string): string {
  const cells = line.split('|').filter(c => c.trim() && !c.trim().match(/^[-:]+$/));
  if (cells.length === 0) return '';
  return '<tr>' + cells.map(c => `<td>${inlineFormat(c.trim())}</td>`).join('') + '</tr>';
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#7c3aed">$1</a>');
}

// ============ Markdown 直接导出 ============
function exportMarkdown(content: string, title: string): NextResponse {
  const filename = encodeURIComponent(`${title}.md`);
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ============ HTML 导出 ============
function exportHtml(content: string, title: string): NextResponse {
  const html = markdownToHtml(content, title);
  const filename = encodeURIComponent(`${title}.html`);
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ============ TXT 导出 ============
function exportTxt(content: string, title: string): NextResponse {
  // Strip markdown formatting for plain text
  const plain = content
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, ''));
  const filename = encodeURIComponent(`${title}.txt`);
  return new NextResponse(plain, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ============ POST Handler ============
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, format, title } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: '缺少内容' }, { status: 400 });
    }

    const safeTitle = title || '报告';
    const safeFormat = format || 'md';

    switch (safeFormat) {
      case 'md':
        return exportMarkdown(content, safeTitle);
      case 'html':
        return exportHtml(content, safeTitle);
      case 'txt':
        return exportTxt(content, safeTitle);
      case 'docx':
        // docx 需要额外包，后续支持
        return NextResponse.json({ error: 'DOCX 格式即将支持，当前请使用 MD/HTML/TXT' }, { status: 400 });
      case 'pdf':
        return NextResponse.json({ error: 'PDF 格式即将支持，当前请使用 MD/HTML/TXT' }, { status: 400 });
      default:
        return NextResponse.json({ error: `不支持的格式: ${safeFormat}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Export API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
