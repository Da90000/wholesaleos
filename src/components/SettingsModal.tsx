import { useState, useEffect } from 'react';

interface SettingsModalProps {
  onSave: () => void;
  onClose?: () => void;
}

export function SettingsModal({ onSave, onClose }: SettingsModalProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseSchema, setSupabaseSchema] = useState('public');
  const [aiProvider, setAiProvider] = useState('google');
  const [aiModel, setAiModel] = useState('gemini-3-flash-preview');
  const [aiApiKey, setAiApiKey] = useState('');
  const [appName, setAppName] = useState('WholesaleOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const providerModels: Record<string, { id: string; name: string }[]> = {
    google: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fastest)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Most Accurate)' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o (Most Accurate)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fastest)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSupabaseUrl(data.supabaseUrl || '');
        setSupabaseAnonKey(data.supabaseAnonKey || '');
        setSupabaseSchema(data.supabaseSchema || 'public');
        setAiProvider(data.aiProvider || 'google');
        setAiModel(data.aiModel || 'gemini-3-flash-preview');
        setAiApiKey(data.aiApiKey || '');
        setAppName(data.appName || 'WholesaleOS');
      });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Basic validation
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL and Anon Key are required');
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, supabaseAnonKey, supabaseSchema, aiProvider, aiModel, aiApiKey, appName })
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">App Settings</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supabase URL
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supabase Anon Key
            </label>
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Database Schema
            </label>
            <input
              type="text"
              value={supabaseSchema}
              onChange={(e) => setSupabaseSchema(e.target.value)}
              placeholder="public"
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
            <p className="text-xs text-gray-500 mt-1">
              {supabaseSchema !== 'public' 
                ? `Note: Ensure "${supabaseSchema}" is added to "Exposed schemas" in Supabase API Settings.` 
                : 'Leave as "public" unless you created a custom schema in Supabase.'}
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">AI Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setAiProvider(newProvider);
                    setAiModel(providerModels[newProvider][0].id);
                  }}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                >
                  <option value="google">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Model
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                >
                  {providerModels[aiProvider].map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={`Enter your ${aiProvider === 'google' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                />
                {aiProvider === 'google' && (
                  <p className="text-xs text-gray-500 mt-1">If left blank, the app will use the system's default key.</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#0F6E56] text-white h-10 rounded-lg font-medium hover:bg-[#085041] transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save & Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
