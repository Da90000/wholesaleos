import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function getSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  }
  return {};
}

function saveSettings(settings: any) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Settings API
  app.get('/api/settings', (req, res) => {
    const settings = getSettings();
    res.json({
      supabaseUrl: settings.supabaseUrl || '',
      supabaseAnonKey: settings.supabaseAnonKey || '',
      supabaseSchema: settings.supabaseSchema || 'wholesaleos',
      aiProvider: settings.aiProvider || 'google',
      aiModel: settings.aiModel || 'gemini-2.0-flash',
      aiApiKey: settings.aiApiKey || '',
      appName: settings.appName || 'WholesaleOS',
      isConfigured: !!(settings.supabaseUrl && settings.supabaseAnonKey)
    });
  });

  app.post('/api/settings', (req, res) => {
    const { supabaseUrl, supabaseAnonKey, supabaseSchema, aiProvider, aiModel, aiApiKey, appName } = req.body;
    const settings = getSettings();
    settings.supabaseUrl = supabaseUrl;
    settings.supabaseAnonKey = supabaseAnonKey;
    settings.supabaseSchema = supabaseSchema || 'wholesaleos';
    settings.aiProvider = aiProvider || 'google';
    settings.aiModel = aiModel || 'gemini-2.0-flash';
    settings.aiApiKey = aiApiKey;
    settings.appName = appName || 'WholesaleOS';
    saveSettings(settings);
    res.json({ success: true });
  });

  // Helper to get Supabase client
  const getSupabase = () => {
    const settings = getSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
      throw new Error('Database not configured');
    }
    return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
      db: {
        schema: settings.supabaseSchema || 'public'
      }
    });
  };

  // API Routes
  // Invoices API
  app.post('/api/invoices', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { customer_id, date, total, paid, pay_type, items } = req.body;
      
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert([{ customer_id, date, total, paid, pay_type }])
        .select()
        .single();
        
      if (invError) throw invError;

      const invoiceItems = items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
        
      if (itemsError) throw itemsError;

      // Update stock
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
          
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product_id);
        }
      }

      res.json({ success: true, invoice });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Purchases API
  app.post('/api/purchases', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { supplier, date, invoice_no, total, items } = req.body;
      
      const { data: purchase, error: purError } = await supabase
        .from('purchases')
        .insert([{ supplier, date, invoice_no, total }])
        .select()
        .single();
        
      if (purError) throw purError;

      const purchaseItems = items.map((item: any) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);
        
      if (itemsError) throw itemsError;

      // Update stock
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
          
        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock + item.quantity })
            .eq('id', item.product_id);
        }
      }

      res.json({ success: true, purchase });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Customer Balance API
  app.get('/api/customers/:id/balance', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('total, paid')
        .eq('customer_id', req.params.id);
        
      if (error) throw error;
      
      let totalBaki = 0;
      invoices?.forEach(inv => {
        totalBaki += (inv.total - inv.paid);
      });
      
      res.json({ baki: totalBaki });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Backup APIs
  app.get('/api/backup/export', async (req, res) => {
    try {
      const supabase = getSupabase();
      const tables = ['products', 'customers', 'invoices', 'invoice_items', 'purchases', 'purchase_items'];
      const backup: any = {};
      
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backup[table] = data;
      }
      
      res.json(backup);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/backup/import', async (req, res) => {
    // Simplified import for now
    res.json({ success: true, message: 'Import not fully implemented in this demo' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
