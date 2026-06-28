import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - fetch active design config for frontend
export async function GET() {
  try {
    const categories = await query(
      'SELECT id, name, icon, sort_order FROM design_categories WHERE is_active = true ORDER BY sort_order'
    );
    const templates = await query(
      'SELECT id, name, category_id, prompt, thumbnail, sort_order FROM design_templates WHERE is_active = true ORDER BY sort_order'
    );
    const tools = await query(
      'SELECT id, name, icon, sort_order FROM design_tools WHERE is_active = true ORDER BY sort_order'
    );
    const suggestions = await query(
      'SELECT id, text, sort_order FROM design_suggestions WHERE is_active = true ORDER BY sort_order'
    );
    return NextResponse.json({ categories, templates, tools, suggestions });
  } catch (e: any) {
    // Fallback defaults
    return NextResponse.json({
      categories: [
        { id: 'all', name: '全部', icon: 'Sparkles', sort_order: 0 },
        { id: 'poster', name: '海报', icon: 'Image', sort_order: 1 },
        { id: 'social', name: '社媒', icon: 'Type', sort_order: 2 },
        { id: 'presentation', name: '演示', icon: 'Presentation', sort_order: 3 },
        { id: 'logo', name: 'Logo', icon: 'Layout', sort_order: 4 },
        { id: 'video', name: '视频', icon: 'Video', sort_order: 5 },
      ],
      templates: [
        { id: 't1', name: '科技海报', category_id: 'poster', prompt: '生成一张科技感深色海报，主题为AI创新', thumbnail: '', sort_order: 1 },
        { id: 't2', name: '产品宣传页', category_id: 'poster', prompt: '产品宣传落地页，现代简约风格', thumbnail: '', sort_order: 2 },
        { id: 't3', name: '社交媒体封面', category_id: 'social', prompt: '社交媒体封面图，品牌配色', thumbnail: '', sort_order: 3 },
        { id: 't4', name: 'PPT封面', category_id: 'presentation', prompt: '演示文稿封面页，专业商务风格', thumbnail: '', sort_order: 4 },
        { id: 't5', name: 'Logo设计', category_id: 'logo', prompt: '设计一个简约现代的Logo', thumbnail: '', sort_order: 5 },
        { id: 't6', name: '短视频封面', category_id: 'video', prompt: '短视频封面图，吸引眼球', thumbnail: '', sort_order: 6 },
      ],
      tools: [
        { id: 'templates', name: '模板', icon: 'Image', sort_order: 1 },
        { id: 'elements', name: '元素', icon: 'Shapes', sort_order: 2 },
        { id: 'text', name: '文字', icon: 'Type', sort_order: 3 },
        { id: 'images', name: '图片', icon: 'Image', sort_order: 4 },
        { id: 'upload', name: '上传', icon: 'Upload', sort_order: 5 },
        { id: 'layers', name: '图层', icon: 'Layers', sort_order: 6 },
      ],
      suggestions: [
        { id: 's1', text: '设计一张科技感海报', sort_order: 1 },
        { id: 's2', text: '生成一个产品落地页', sort_order: 2 },
        { id: 's3', text: '制作社交媒体封面图', sort_order: 3 },
      ],
    });
  }
}
