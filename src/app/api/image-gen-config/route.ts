import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';

// Hardcoded fallback models (used when DB is unavailable)
const FALLBACK_MODELS = [
  { id: 'qwen-image-2.0', name: '通义万相 2.0', provider: '阿里百炼', desc: '快速生图', maxN: 4, supportsEdit: false, enabled: true },
  { id: 'qwen-image-2.0-pro', name: '通义万相 2.0 Pro', provider: '阿里百炼', desc: '高清生图', maxN: 4, supportsEdit: false, enabled: true },
  { id: 'wan2.6-t2i', name: '万相 2.6', provider: '阿里百炼', desc: '推荐版', maxN: 4, supportsEdit: false, enabled: true },
  { id: 'wanx-v1-edit', name: '万相图生图', provider: '阿里百炼', desc: '参考图改图', maxN: 4, supportsEdit: true, enabled: true },
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI', desc: '需API Key', maxN: 10, supportsEdit: true, enabled: true },
  { id: 'SeedDream-3.0', name: '即梦 3.0', provider: '火山引擎', desc: '中文理解极强', maxN: 4, supportsEdit: false, enabled: true },
];

const FALLBACK_OTHER = {
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

// Build models list from DB model_configs + fallback
async function buildModelsList(): Promise<typeof FALLBACK_MODELS> {
  try {
    const rows = await query(
      'SELECT "modelId", name, provider, "isActive", description, "image_config" FROM model_configs WHERE "image_config" IS NOT NULL ORDER BY "sortOrder"'
    );
    if (rows && rows.length > 0) {
      const providerNames: Record<string, string> = {
        'qwen-image': '阿里百炼',
        'openai-image': 'OpenAI',
        'volcengine': '火山引擎',
      };
      return rows
        .filter((r: any) => r.isActive)
        .map((r: any) => {
          const config = typeof r.image_config === 'string' ? JSON.parse(r.image_config) : r.image_config;
          return {
            id: r.modelId,
            name: r.name,
            provider: providerNames[r.provider] || r.provider,
            desc: r.description || '',
            maxN: config?.maxN || 4,
            supportsEdit: config?.supportsEdit || false,
            enabled: true,
          };
        });
    }
  } catch (error) {
    console.error('Failed to load image models from DB, using fallback:', error);
  }
  return FALLBACK_MODELS;
}

export async function GET() {
  try {
    const stored = await getSetting('image_gen_config');
    const baseConfig = stored ? JSON.parse(stored) : FALLBACK_OTHER;
    
    // Always build models from DB for latest data
    const models = await buildModelsList();
    
    // Merge: stored/fallback config + DB models (always fresh from DB)
    const config = {
      ...FALLBACK_OTHER,
      ...baseConfig,
      models, // DB models always override stored/fallback
    };
    
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to get image gen config:', error);
    const models = await buildModelsList();
    return NextResponse.json({ success: true, data: { ...FALLBACK_OTHER, models } });
  }
}
