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

  if (type === 'chart') {
    return NextResponse.json({ id, type, title, config: JSON.parse(content) });
  }

  if (type === 'pptx') {
    const buffer = Buffer.from(content, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(title)}.pptx"`,
      },
    });
  }

  if (type === 'docx') {
    // Re-use export API for docx conversion
    const exportUrl = new URL('/api/export', request.url);
    exportUrl.searchParams.set('format', 'docx');
    exportUrl.searchParams.set('title', title);
    // Return the markdown content with a redirect to export API
    return NextResponse.json({ id, type, title, markdown: content, download_url: `/api/export?format=docx&title=${encodeURIComponent(title)}` });
  }

  if (type === 'markdown' || type === 'html') {
    return NextResponse.json({ id, type, title, content });
  }

  return NextResponse.json({ id, type, title, content });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await import('@/lib/db');
  await run('DELETE FROM generated_artifacts WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
