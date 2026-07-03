import { DEFAULT_PROVIDER_URLS } from '@/lib/config-defaults';
import { NextRequest } from 'next/server';
import { getApiKeyByProvider, getModelConfig } from './db';

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getProviderConfig(modelId: string): Promise<ProviderConfig | null> {
  // 获取模型配置
  const modelConfig = await getModelConfig(modelId);
  if (!modelConfig) {
    throw new Error(`模型 ${modelId} 未找到`);
  }

  const provider = modelConfig.provider;
  
  // 获取 API Key
  const apiKeyData = await getApiKeyByProvider(provider);
  if (!apiKeyData || !apiKeyData.is_active) {
    throw new Error(`请先在后台配置 ${provider} 的 API Key`);
  }

  // 解密 API Key（Base64 解码）
  const apiKey = Buffer.from(apiKeyData.api_key_encrypted, 'base64').toString('utf-8');
  
  // 根据 provider 返回配置
  // Provider URLs from config-defaults (single source of truth)
  const providerConfigs: Record<string, { baseUrl: string }> = Object.fromEntries(
    Object.entries(DEFAULT_PROVIDER_URLS).map(([k, v]) => [k, { baseUrl: v }])
  );

  const config = providerConfigs[provider];
  if (!config) {
    throw new Error(`不支持的提供商: ${provider}`);
  }

  // 使用自定义 base_url 或默认值
  const baseUrl = apiKeyData.base_url || config.baseUrl;

  return {
    baseUrl,
    apiKey,
    model: modelId,
  };
}

// OpenAI 兼容格式调用
async function callOpenAICompatible(
  config: ProviderConfig,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${error}`);
  }

  return response.body!;
}

// Anthropic 格式调用
async function callAnthropic(
  config: ProviderConfig,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  // 分离 system 消息
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemMsg?.content,
      messages: chatMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${error}`);
  }

  // 转换 Anthropic 流格式为统一格式
  const reader = response.body!.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const output = JSON.stringify({ type: 'content', content: parsed.delta.text });
                  controller.enqueue(encoder.encode(`data: ${output}\n\n`));
                }
              } catch {}
            }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`));
        controller.close();
      }
    },
  });
}

export async function streamChat(
  request: NextRequest,
  messages: { role: string; content: string }[],
  modelId: string
): Promise<ReadableStream> {
  const config = await getProviderConfig(modelId);
  
  if (!config) {
    throw new Error('无法获取模型配置');
  }

  // Anthropic 使用不同的格式
  if (config.baseUrl.includes('anthropic')) {
    return callAnthropic(config, messages);
  }

  // 其他提供商使用 OpenAI 兼容格式
  const responseStream = await callOpenAICompatible(config, messages);
  
  // 转换 OpenAI 流格式为统一格式
  const reader = responseStream.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  const output = JSON.stringify({ type: 'content', content });
                  controller.enqueue(encoder.encode(`data: ${output}\n\n`));
                }
              } catch {}
            }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`));
        controller.close();
      }
    },
  });
}
