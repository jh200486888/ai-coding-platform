'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import type { ModelConfig } from '@/types';
import { MODELS, PROVIDERS } from '@/lib/models';

export function ModelManager() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newModel, setNewModel] = useState<Partial<ModelConfig>>({
    name: '',
    provider: 'openai',
    modelId: '',
    baseUrl: '',
    apiKeyId: '',
    isDefault: false,
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    const response = await fetch('/api/models');
    if (response.ok) {
      const data = await response.json();
      setModels(data);
    }
  };

  const handleAdd = async () => {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newModel),
    });
    if (response.ok) {
      setShowForm(false);
      setNewModel({
        name: '',
        provider: 'openai',
        modelId: '',
        baseUrl: '',
        apiKeyId: '',
        isDefault: false,
      });
      fetchModels();
    }
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/models?id=${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchModels();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">模型管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {showForm && (
        <div className="bg-muted p-4 rounded-lg space-y-3">
          <div>
            <label className="text-sm font-medium">模型名称</label>
            <input
              type="text"
              value={newModel.name}
              onChange={e => setNewModel({ ...newModel, name: e.target.value })}
              placeholder="例如：GPT-4o"
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">厂商</label>
            <select
              value={newModel.provider}
              onChange={e => setNewModel({ ...newModel, provider: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            >
              {Object.entries(PROVIDERS).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">模型 ID</label>
            <select
              value={newModel.modelId}
              onChange={e => setNewModel({ ...newModel, modelId: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            >
              <option value="">选择模型</option>
              {MODELS.filter(m => m.provider === newModel.provider).map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Base URL（可选）</label>
            <input
              type="text"
              value={newModel.baseUrl}
              onChange={e => setNewModel({ ...newModel, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={newModel.isDefault}
              onChange={e => setNewModel({ ...newModel, isDefault: e.target.checked })}
            />
            <label htmlFor="isDefault" className="text-sm">
              设为默认模型
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
            >
              保存
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-muted text-foreground rounded text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>暂无模型配置</p>
          </div>
        ) : (
          models.map(model => (
            <div
              key={model.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div>
                <div className="font-medium flex items-center gap-2">
                  {model.name}
                  {model.isDefault && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {PROVIDERS[model.provider]} • {model.modelId}
                </div>
              </div>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
