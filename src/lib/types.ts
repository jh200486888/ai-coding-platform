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

// Workspace types
export interface WorkspaceProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFile {
  id: string;
  project_id: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  content: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceConversation {
  id: string;
  project_id: string;
  title: string;
  model_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: WorkspaceAttachment[] | null;
  model_id: string | null;
  created_at: string;
}

export interface WorkspaceAttachment {
  name: string;
  type: string;
  size: number;
  content?: string;
}

export interface WorkspaceChatRequest {
  conversation_id?: string;
  project_id: string;
  model_id: string;
  messages: { role: string; content: string }[];
  attachments?: WorkspaceAttachment[];
}

export interface WorkspaceChatChunk {
  type: 'content' | 'done' | 'error' | 'file_update';
  content?: string;
  conversation_id?: string;
  message_id?: string;
  error?: string;
  file_path?: string;
  file_content?: string;
}
