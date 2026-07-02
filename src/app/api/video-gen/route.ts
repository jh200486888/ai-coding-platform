import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { decodeApiKey, PROVIDER_ALIASES } from '@/lib/ai-providers';

// Agnes AI Video Generation API
// 文生视频/图生视频 - 异步任务+轮询模式
// 文档: https://agnes-ai.com/doc/agnes-video-v20
// 创建: POST /v1/videos
// 查询(推荐): GET /agnesapi?video_id=<ID>
// 查询(兼容): GET /v1/videos/<task_id>

async function getAgnesApiKey(): Promise<{ key: string; baseUrl: string } | null> {
  // agnes-image provider stores video model keys too
  let apiKey = await queryOne(
    'SELECT "apiKey", "baseUrl", "isActive" FROM api_keys WHERE provider = $1 AND "isActive" = true',
    ['agnes-image']
  );
  if (!apiKey?.apiKey) {
    // fallback to agnes provider
    apiKey = await queryOne(
      'SELECT "apiKey", "baseUrl", "isActive" FROM api_keys WHERE provider = $1 AND "isActive" = true',
      ['agnes']
    );
  }
  if (!apiKey?.apiKey) return null;
  return { key: decodeApiKey(apiKey.apiKey), baseUrl: apiKey.baseUrl || 'https://apihub.agnes-ai.com/v1' };
}

// 创建视频任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'agnes-video-v2.0',
      image,           // 图生视频的参考图URL
      width = 1152,    // 必须是64的倍数
      height = 768,    // 必须是64的倍数
      num_frames = 121, // 81(3s), 121(5s), 161(7s), 241(10s), 441(15s)
      frame_rate = 24,
      mode,            // 'text2video' or 'image2video'
      negative_prompt,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: '请输入视频提示词' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyData = await getAgnesApiKey();
    if (!keyData) {
      return new Response(JSON.stringify({ error: '未配置 Agnes AI API Key，请先在后台添加' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      width: Math.round(width / 64) * 64,   // 确保是64的倍数
      height: Math.round(height / 64) * 64,  // 确保是64的倍数
      num_frames,
      frame_rate,
    };

    if (negative_prompt) requestBody.negative_prompt = negative_prompt;
    if (mode) requestBody.mode = mode;

    // 图生视频: image放在extra_body中
    if (image) {
      const extraBody: Record<string, unknown> = {};
      extraBody.image = image;
      if (mode) extraBody.mode = mode;
      requestBody.extra_body = extraBody;
    }

    console.log(`[VideoGen] Creating video: model=${model}, frames=${num_frames}, fps=${frame_rate}, size=${width}x${height}, hasImage=${!!image}`);

    const response = await fetch(`${keyData.baseUrl}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyData.key}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as Record<string, unknown>)?.error
        ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
        : `HTTP ${response.status}`;
      return new Response(JSON.stringify({ error: `视频创建失败: ${errorMsg}` }), {
        status: response.status, headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log(`[VideoGen] Task created:`, JSON.stringify(data).substring(0, 500));

    // 返回video_id和task_id供前端轮询
    return new Response(JSON.stringify({
      success: true,
      video_id: data.video_id || data.id || data.task_id,
      task_id: data.task_id || data.id,
      status: data.status || 'processing',
      model,
      estimated_time: num_frames > 241 ? 180 : 120, // 预估等待秒数
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Video generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 查询视频状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('video_id');
    const taskId = searchParams.get('task_id');

    if (!videoId && !taskId) {
      return new Response(JSON.stringify({ error: '请提供 video_id 或 task_id' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyData = await getAgnesApiKey();
    if (!keyData) {
      return new Response(JSON.stringify({ error: '未配置 Agnes AI API Key' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let queryUrl: string;
    if (videoId) {
      // 推荐方式: 用video_id查询（不会导致排队延长）
      queryUrl = `${keyData.baseUrl.replace('/v1', '')}/agnesapi?video_id=${encodeURIComponent(videoId)}`;
    } else {
      // 兼容方式: 用task_id查询（可能导致排队延长，不推荐）
      queryUrl = `${keyData.baseUrl}/videos/${encodeURIComponent(taskId!)}`;
    }

    const response = await fetch(queryUrl, {
      headers: { 'Authorization': `Bearer ${keyData.key}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as Record<string, unknown>)?.error
        ? ((errorData as Record<string, Record<string, string>>).error.message || 'Unknown error')
        : `HTTP ${response.status}`;
      return new Response(JSON.stringify({ error: `查询失败: ${errorMsg}` }), {
        status: response.status, headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // 解析状态
    const status = data.status || data.output?.status || 'unknown';
    const isComplete = status === 'succeeded' || status === 'SUCCEEDED' || status === 'complete';
    const isFailed = status === 'failed' || status === 'FAILED' || status === 'error';
    const isProcessing = !isComplete && !isFailed;

    let videoUrl = '';
    if (isComplete) {
      // 从响应中提取视频URL
      videoUrl = data.video_url || data.output?.video_url || 
                 (data.results?.videos?.[0]?.url) ||
                 (data.data?.[0]?.url) || '';
    }

    return new Response(JSON.stringify({
      success: isComplete,
      status: isComplete ? 'completed' : isFailed ? 'failed' : 'processing',
      video_url: videoUrl,
      progress: data.progress || data.output?.progress || 0,
      error: isFailed ? (data.error || data.output?.message || '视频生成失败') : undefined,
      raw: data, // 保留原始响应供调试
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Video status query error:', error);
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
