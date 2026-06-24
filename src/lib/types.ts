// Conversation types
export interface Conversation {
  id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

// Message types
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id: string | null;
  token_count: number | null;
  created_at: string;
}

// Model config types
export interface ModelConfig {
  id: string;
  model_id: string;
  display_name: string;
  provider: string;
  description: string | null;
  is_enabled: number;
  default_temperature: string | null;
  default_max_tokens: number | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

// API Key types
export interface ApiKey {
  id: string;
  provider: string;
  provider_name: string;
  api_key_encrypted: string;
  base_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// API Key input (for create/update, without encrypted key)
export interface ApiKeyInput {
  provider: string;
  provider_name: string;
  api_key: string;
  base_url?: string;
  is_active?: boolean;
}

// Chat request
export interface ChatRequest {
  conversation_id?: string;
  model_id: string;
  messages: { role: string; content: string }[];
}

// Chat response chunk (SSE)
export interface ChatChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  conversation_id?: string;
  message_id?: string;
  error?: string;
}

// Theme
export type Theme = 'light' | 'dark' | 'system';
