// @ts-nocheck
/**
 * Document Converter - Markdown to PDF/DOCX conversion tool
 * Uses pandoc if available, falls back to basic HTML→PDF via wkhtmltopdf
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const TMP_DIR = '/tmp/doc-convert';

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

export function convertMarkdown(content: string, format: 'pdf' | 'docx', title?: string): { filePath: string; fileName: string } {
  ensureTmpDir();
  const ts = Date.now();
  const mdPath = join(TMP_DIR, `input-${ts}.md`);
  const safeName = (title || 'document').replace(/[^a-zA-Z0-9\u4e00-\u9fff-_]/g, '_').slice(0, 50);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const outPath = join(TMP_DIR, `${safeName}-${ts}.${ext}`);

  writeFileSync(mdPath, content, 'utf-8');

  try {
    if (format === 'pdf') {
      // Try pandoc first, then wkhtmltopdf
      try {
        execSync(`pandoc "${mdPath}" -o "${outPath}" --pdf-engine=xelatex -V mainfont="Noto Sans CJK SC" -V geometry:margin=1in 2>/dev/null`, { timeout: 30000 });
      } catch {
        // Fallback: md -> html -> pdf
        const htmlPath = join(TMP_DIR, `intermediate-${ts}.html`);
        execSync(`pandoc "${mdPath}" -o "${htmlPath}" --standalone --self-contained 2>/dev/null || echo "<html><body><pre>" > "${htmlPath}" && cat "${mdPath}" >> "${htmlPath}" && echo "</pre></body></html>" >> "${htmlPath}"`, { timeout: 15000 });
        try {
          execSync(`wkhtmltopdf --quiet "${htmlPath}" "${outPath}" 2>/dev/null`, { timeout: 30000 });
        } catch {
          // Last fallback: just output the HTML
          const htmlOutPath = outPath.replace('.pdf', '.html');
          execSync(`cp "${htmlPath}" "${htmlOutPath}"`);
          return { filePath: htmlOutPath, fileName: `${safeName}.html` };
        }
        if (existsSync(htmlPath)) unlinkSync(htmlPath);
      }
    } else {
      // docx via pandoc
      try {
        execSync(`pandoc "${mdPath}" -o "${outPath}" 2>/dev/null`, { timeout: 30000 });
      } catch {
        throw new Error('pandoc not installed. Install with: apt-get install -y pandoc');
      }
    }

    return { filePath: outPath, fileName: `${safeName}.${ext}` };
  } finally {
    // Cleanup input
    if (existsSync(mdPath)) unlinkSync(mdPath);
  }
}

export function readConvertedFile(filePath: string): Buffer {
  return readFileSync(filePath);
}

export function cleanupConvertedFile(filePath: string): void {
  try { if (existsSync(filePath)) unlinkSync(filePath); } catch {}
}
