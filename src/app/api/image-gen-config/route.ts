import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

const DEFAULT_CONFIG = {
  models: [
    { id: 'qwen-image-2.0', name: '通义万相 2.0', provider: '阿里百炼', desc: '快速生图', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'qwen-image-2.0-pro', name: '通义万相 2.0 Pro', provider: '阿里百炼', desc: '高清生图', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'wan2.6-t2i', name: '万相 2.6', provider: '阿里百炼', desc: '推荐版', maxN: 4, supportsEdit: false, enabled: true },
    { id: 'wanx-v1-edit', name: '万相图生图', provider: '阿里百炼', desc: '参考图改图', maxN: 4, supportsEdit: true, enabled: true },
    { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI', desc: '需API Key', maxN: 10, supportsEdit: true, enabled: true },
    { id: 'SeedDream-3.0', name: '即梦 3.0', provider: '火山引擎', desc: '中文理解极强', maxN: 4, supportsEdit: false, enabled: true },
  ],
  ratios: [
    { id: '1:1', label: '1:1', w: 32, h: 32, enabled: true },
    { id: '3:4', label: '3:4', w: 27, h: 36, enabled: true },
    { id: '4:3', label: '4:3', w: 36, h: 27, enabled: true },
    { id: '16:9', label: '16:9', w: 40, h: 22, enabled: true },
    { id: '9:16', label: '9:16', w: 22, h: 40, enabled: true },
    { id: '3:1', label: '3:1', w: 44, h: 16, enabled: true },
  ],
  resolutions: [
    { id: '1k', label: '1K', desc: '标准', enabled: true },
    { id: '2k', label: '2K', desc: '高清', enabled: true },
    { id: '4k', label: '4K', desc: 'Beta', enabled: true },
  ],
  qualities: [
    { id: 'low', label: 'Low', enabled: true },
    { id: 'medium', label: 'Medium', enabled: true },
    { id: 'high', label: 'High', enabled: true },
  ],
  styles: [
    { id: 'none', label: '无预设', prefix: '', enabled: true },
    { id: 'photo', label: '写实摄影', prefix: 'Professional photography, ultra realistic, 8k, high detail: ', enabled: true },
    { id: 'illustration', label: '商业插画', prefix: 'Commercial illustration, clean vector style, vibrant colors: ', enabled: true },
    { id: 'anime', label: '动漫风格', prefix: 'Anime style, detailed illustration, vibrant: ', enabled: true },
    { id: 'oil', label: '油画质感', prefix: 'Oil painting texture, rich brushstrokes, classical art: ', enabled: true },
    { id: 'watercolor', label: '水彩画', prefix: 'Watercolor painting, soft edges, translucent layers: ', enabled: true },
    { id: 'minimal', label: '极简设计', prefix: 'Minimalist design, clean lines, simple composition: ', enabled: true },
    { id: 'cyberpunk', label: '赛博朋克', prefix: 'Cyberpunk style, neon lights, futuristic, dark atmosphere: ', enabled: true },
    { id: 'chinese', label: '中国风', prefix: 'Chinese traditional art style, ink painting elements, elegant: ', enabled: true },
  ],
  counts: [
    { id: 1, label: '1', enabled: true },
    { id: 2, label: '2', enabled: true },
    { id: 4, label: '4', enabled: true },
    { id: 8, label: '8', enabled: true },
  ],
  formats: [
    { id: 'png', label: 'PNG', enabled: true },
    { id: 'webp', label: 'WebP', enabled: true },
    { id: 'jpeg', label: 'JPEG', enabled: true },
  ],
  maxUploadSizeMB: 10,
  defaultModel: 'qwen-image-2.0',
  defaultRatio: '1:1',
  defaultResolution: '1k',
  defaultQuality: 'low',
  defaultStyle: 'none',
  defaultCount: 1,
  defaultFormat: 'png',
};

export async function GET() {
  try {
    const stored = await getSetting('image_gen_config');
    const config = stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to get image gen config:', error);
    return NextResponse.json({ success: true, data: DEFAULT_CONFIG });
  }
}
