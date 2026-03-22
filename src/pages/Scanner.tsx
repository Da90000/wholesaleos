import React, { useState, useRef } from 'react';
import { Upload, FileText, Package, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

export function Scanner() {
  const [mode, setMode] = useState<'purchase' | 'inventory' | 'sale' | 'daily_summary'>('purchase');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Fetch settings to get AI config
      const settingsRes = await fetch('/api/settings');
      const settings = await settingsRes.json();

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Content = base64data.replace(/^data:image\/\w+;base64,/, '');
        
        const provider = settings.aiProvider || 'google';
        const apiKey = settings.aiApiKey || (provider === 'google' ? process.env.GEMINI_API_KEY : '');
        const modelName = settings.aiModel || (provider === 'google' ? 'gemini-3-flash-preview' : 'gpt-4o-mini');

        if (!apiKey) {
          throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key not configured. Please add it in Settings.`);
        }

        let prompt = '';
        if (mode === 'purchase') {
          prompt = `You are a data extraction assistant for a Bangladeshi wholesale business.
Extract all line items from this invoice/receipt image.
Respond ONLY with valid JSON — no markdown, no explanation:
{
 "supplier": "string",
 "date": "YYYY-MM-DD",
 "invoice_number": "string",
 "items": [{ "name": "str", "qty": N, "unit": "Carton|Packet|Piece|Kg|Dozen", "unit_cost": N }]
}`;
        } else if (mode === 'inventory') {
          prompt = `Extract product info from this packet/carton photo.
Respond ONLY with valid JSON:
{
 "name": "str", "brand": "str", "weight": "str",
 "category": "Chips & Snacks|Biscuits|Juice & Drinks|Candy & Confectionery|Noodles|Other",
 "unit": "Piece|Carton|Packet|Kg", "mrp": N, "notes": "str"
}`;
        } else if (mode === 'sale') {
          prompt = `Extract order items from this handwritten/printed order image.
Respond ONLY with valid JSON:
{
 "customer": "str",
 "items": [{ "name": "str", "qty": N, "unit": "Carton|Packet|Piece|Dozen|Kg", "unit_price": N }]
}`;
        } else if (mode === 'daily_summary') {
          prompt = `Extract the daily transaction summary from this image. It typically contains Sales, Expenses, and Credit/Dues.
Respond ONLY with valid JSON:
{
  "date": "YYYY-MM-DD",
  "day": "string",
  "sales": {
    "items": [{ "name": "string", "quantity": "string or number", "amount": number }],
    "total": number
  },
  "expenses": {
    "items": [{ "category": "string", "notes": "string", "amount": number }],
    "total": number
  },
  "credit_dues": {
    "customer": "string",
    "items": [{ "name": "string", "quantity": "string or number", "amount": number }],
    "total": number
  },
  "financial_highlights": {
    "total_revenue": number,
    "total_dues": number,
    "major_cash_outflow": number
  }
}`;
        }

        let jsonStr = '';

        try {
          if (provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: apiKey.trim().replace(/^["']|["']$/g, '') });
            const response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: file.type,
                      data: base64Content,
                    },
                  },
                  { text: prompt },
                ],
              },
            });
            jsonStr = response.text?.trim() || '{}';
          } else if (provider === 'openai') {
            const openai = new OpenAI({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
            const response = await openai.chat.completions.create({
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${file.type};base64,${base64Content}`,
                      },
                    },
                  ],
                },
              ],
            });
            jsonStr = response.choices[0].message.content?.trim() || '{}';
          } else if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': apiKey.trim(),
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'dangerously-allow-browser': 'true'
              },
              body: JSON.stringify({
                model: modelName,
                max_tokens: 1024,
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image',
                        source: {
                          type: 'base64',
                          media_type: file.type,
                          data: base64Content,
                        },
                      },
                      { type: 'text', text: prompt }
                    ],
                  }
                ],
              }),
            });
            const data = await response.json();
            if (data.error) {
              throw new Error(data.error.message || 'Anthropic API Error');
            }
            jsonStr = data.content?.[0]?.text?.trim() || '{}';
          }
        } catch (apiErr: any) {
          if (apiErr.message?.includes('NOT_FOUND') || apiErr.message?.includes('Requested entity was not found')) {
            throw new Error(`The AI model "${modelName}" was not found. Please go to Settings and select a different model.`);
          }
          throw apiErr;
        }

        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        
        const data = JSON.parse(jsonStr);
        setResult(data);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to scan image');
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // Navigate to the respective form with the extracted data
    if (mode === 'purchase') {
      navigate('/purchases', { state: { scannedData: result } });
    } else if (mode === 'inventory') {
      navigate('/inventory', { state: { scannedData: result } });
    } else if (mode === 'sale') {
      navigate('/sales', { state: { scannedData: result } });
    } else if (mode === 'daily_summary') {
      navigate('/reports', { state: { scannedData: result } });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">AI Scanner</h2>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        <button
          onClick={() => setMode('purchase')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
            mode === 'purchase' ? 'bg-white text-[#0F6E56] shadow-sm' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ShoppingCart size={18} />
          Purchase Invoice
        </button>
        <button
          onClick={() => setMode('inventory')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
            mode === 'inventory' ? 'bg-white text-[#0F6E56] shadow-sm' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Package size={18} />
          Product Packet
        </button>
        <button
          onClick={() => setMode('sale')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
            mode === 'sale' ? 'bg-white text-[#0F6E56] shadow-sm' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileText size={18} />
          Sales Order
        </button>
        <button
          onClick={() => setMode('daily_summary')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
            mode === 'daily_summary' ? 'bg-white text-[#0F6E56] shadow-sm' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileText size={18} />
          Daily Summary
        </button>
      </div>

      {!result && !loading && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:bg-gray-50 hover:border-[#0F6E56] transition-colors"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="w-16 h-16 bg-[#E1F5EE] text-[#0F6E56] rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Tap to upload or take a photo</h3>
          <p className="text-sm text-gray-500">Supports JPG, PNG from camera or gallery</p>
        </div>
      )}

      {loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center bg-gray-50">
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-4 h-4 bg-[#0F6E56] rounded-full animate-bounce"></div>
            <div className="w-4 h-4 bg-[#0F6E56] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-4 h-4 bg-[#0F6E56] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <p className="text-gray-600 font-medium">Scanning document with AI...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-[#0F6E56] mb-6">
            <CheckCircle2 size={24} />
            <h3 className="text-lg font-bold">Scan Successful</h3>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm mb-6 overflow-x-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setResult(null)}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Scan Another
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition-colors"
            >
              Add to Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
