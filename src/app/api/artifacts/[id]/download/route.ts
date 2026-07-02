import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artifact = await queryOne('SELECT * FROM generated_artifacts WHERE id = $1', [id]);
  
  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const type = artifact.type;
  const title = artifact.title || 'document';
  const content = artifact.content;

  // PPTX - serve as binary download
  if (type === 'pptx') {
    const buffer = Buffer.from(content, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '.pptx"',
      },
    });
  }

  // DOCX - serve as binary download (content is base64-encoded docx)
  if (type === 'docx') {
    try {
      const buffer = Buffer.from(content, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '.docx"',
        },
      });
    } catch {
      // If not valid base64, treat as markdown and return as text
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '.md"',
        },
      });
    }
  }

  // HTML - serve as downloadable html
  if (type === 'html') {
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '.html"',
      },
    });
  }

  // Markdown - serve as downloadable markdown
  if (type === 'markdown') {
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '.md"',
      },
    });
  }

  // Chart - return JSON config
  if (type === 'chart') {
    return NextResponse.json({ id, type, title, config: JSON.parse(content) });
  }

  // Fallback - return as text download
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="' + encodeURIComponent(title) + '"',
    },
  });
}
