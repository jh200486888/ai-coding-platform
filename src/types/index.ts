// 类型定义文件

// API Key 类型
export interface ApiKey {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 模型配置类型
export interface ModelConfig {
  id: string;
  modelId: string;
  name: string;
  displayName?: string;
  provider: string;
  isActive: boolean;
  isDefault?: boolean;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// 对话类型
export interface Conversation {
  id: string;
  title: string;
  modelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 消息类型
export interface Message {
  id: string;
  conversationId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  createdAt: Date;
}

// 项目类型
export interface Project {
  id: string;
  name: string;
  description?: string;
  files?: WorkspaceFile[];
  messages?: WorkspaceMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// 工作区文件类型
export interface WorkspaceFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  type?: 'file' | 'folder';
  parentId?: string | null;
  children?: WorkspaceFile[];
  createdAt: Date;
  updatedAt: Date;
}

// 工作区对话类型
export interface WorkspaceConversation {
  id: string;
  projectId: string;
  title: string;
  modelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 工作区消息类型
export interface WorkspaceMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  attachments?: Attachment[];
  createdAt: Date;
}

// 附件类型
export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'code';
  mimeType: string;
  size: number;
  url: string;
  content?: string; // 文本内容
}

// 文件树节点类型
export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  content?: string;
  language?: string;
}

// AI 模型类型
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  displayName?: string;
  maxTokens?: number;
  temperature?: number;
  contextWindow?: number;
  inputPrice?: number;
  outputPrice?: number;
  status?: 'active' | 'inactive';
  description?: string;
}

// 终端日志类型
export interface TerminalLog {
  id: string;
  projectId: string;
  command: string;
  output: string;
  exitCode: number;
  createdAt: Date;
}

// Provider 类型
export interface Provider {
  id: string;
  name: string;
  models: AIModel[];
}
