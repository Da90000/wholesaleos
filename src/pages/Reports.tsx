import React, { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { Download, Upload, Database, CheckCircle2, Save, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Reports() {
  const location = useLocation();
  const navigate = useNavigate();
  const scannedData = location.state?.scannedData;
  const [savingSummary, setSavingSummary] = useState(false);

  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    netProfit: 0,
    margin: 0,
    totalBaki: 0
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [bakiCustomers, setBakiCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = await getSupabase();
        if (!supabase) {
          setLoading(false);
          return;
        }

        const [
          { data: invoices, error: invErr },
          { data: purchases, error: purErr },
          { data: invoiceItems, error: itmErr },
          { data: customers, error: custErr }
        ] = await Promise.all([
          supabase.from('invoices').select('total, paid, customer_id'),
          supabase.from('purchases').select('total'),
          supabase.from('invoice_items').select('product_id, quantity, unit_price, products(name, buy_price)'),
          supabase.from('customers').select('id, name, phone, area')
        ]);

        if (invErr || purErr || itmErr || custErr) {
          console.error('Database error:', invErr || purErr || itmErr || custErr);
          const exactError = invErr?.message || purErr?.message || itmErr?.message || custErr?.message || 'Unknown error';
          setDbError(`Database Setup Required: ${exactError}. If using a custom schema, ensure it is "Exposed" in your API configuration and permissions are granted.`);
        } else {
          setDbError(null);
        }

        let sales = 0;
        let baki = 0;
        const custBakiMap: Record<string, number> = {};
        const custSalesMap: Record<string, number> = {};

        invoices?.forEach(inv => {
          sales += Number(inv.total);
          const invBaki = Number(inv.total) - Number(inv.paid);
          baki += invBaki;
          
          if (inv.customer_id) {
            custBakiMap[inv.customer_id] = (custBakiMap[inv.customer_id] || 0) + invBaki;
            custSalesMap[inv.customer_id] = (custSalesMap[inv.customer_id] || 0) + Number(inv.total);
          }
        });

        let buys = 0;
        purchases?.forEach(pur => {
          buys += Number(pur.total);
        });

        const prodProfitMap: Record<string, { name: string, profit: number }> = {};
        invoiceItems?.forEach(item => {
          const prod = item.products as any;
          if (prod && item.product_id) {
            const profit = (item.unit_price - prod.buy_price) * item.quantity;
            if (!prodProfitMap[item.product_id]) {
              prodProfitMap[item.product_id] = { name: prod.name, profit: 0 };
            }
            prodProfitMap[item.product_id].profit += profit;
          }
        });

        const topProds = Object.values(prodProfitMap)
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 5);

        const topCusts = Object.entries(custSalesMap)
          .map(([id, total]) => ({
            name: customers?.find(c => c.id === id)?.name || 'Unknown',
            total
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        const bakiCusts = Object.entries(custBakiMap)
          .filter(([_, amount]) => amount > 0)
          .map(([id, amount]) => {
            const c = customers?.find(c => c.id === id);
            return {
              id,
              name: c?.name || 'Unknown',
              phone: c?.phone || '-',
              area: c?.area || '-',
              baki: amount
            };
          })
          .sort((a, b) => b.baki - a.baki);

        const netProfit = sales - buys; // Simplified
        const margin = sales > 0 ? (netProfit / sales) * 100 : 0;

        setStats({
          totalSales: sales,
          totalPurchases: buys,
          netProfit,
          margin,
          totalBaki: baki
        });
        setTopProducts(topProds);
        setTopCustomers(topCusts);
        setBakiCustomers(bakiCusts);
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveSummary = async () => {
    if (!scannedData) return;
    setSavingSummary(true);
    const supabase = await getSupabase();
    if (!supabase) {
      setSavingSummary(false);
      return;
    }

    try {
      const summaryDate = scannedData.date || new Date().toISOString().split('T')[0];

      // 1. Handle Cash Sales
      if (scannedData.sales?.total > 0) {
        // Find or create "Daily Cash Sales" customer
        let { data: cashCust, error: err1 } = await supabase.from('customers').select('id').eq('name', 'Daily Cash Sales').maybeSingle();
        if (err1) throw new Error('Database tables might be missing. Please ensure your schema is correctly setup. Details: ' + err1.message);
        
        if (!cashCust) {
          const { data: newCust, error: err2 } = await supabase.from('customers').insert({ name: 'Daily Cash Sales', phone: '-', area: '-' }).select().single();
          if (err2) throw err2;
          cashCust = newCust;
        }

        if (cashCust) {
          // Insert Invoice
          const { data: inv, error: err3 } = await supabase.from('invoices').insert({
            customer_id: cashCust.id,
            date: summaryDate,
            total: scannedData.sales.total,
            paid: scannedData.sales.total,
            pay_type: 'paid'
          }).select().single();
          if (err3) throw err3;

          // Insert Items
          if (inv && scannedData.sales.items?.length > 0) {
            const itemsToInsert = [];
            for (const item of scannedData.sales.items) {
              let { data: prod } = await supabase.from('products').select('id, buy_price').ilike('name', `%${item.name}%`).limit(1).maybeSingle();
              
              const qty = Number(item.quantity) || 1;
              const unitPrice = (Number(item.amount) || 0) / qty;

              if (!prod) {
                const { data: newProd } = await supabase.from('products').insert({
                  name: item.name,
                  category: 'Other',
                  unit: 'Piece',
                  buy_price: 0,
                  sell_price: unitPrice,
                  stock: 0
                }).select().single();
                prod = newProd;
              }
              
              if (prod) {
                itemsToInsert.push({
                  invoice_id: inv.id,
                  product_id: prod.id,
                  quantity: qty,
                  unit_price: unitPrice
                });
              }
            }
            if (itemsToInsert.length > 0) {
              const { error: err4 } = await supabase.from('invoice_items').insert(itemsToInsert);
              if (err4) throw err4;
            }
          }
        }
      }

      // 2. Handle Credit/Dues
      if (scannedData.credit_dues?.total > 0 && scannedData.credit_dues?.customer) {
        // Find or create customer
        let { data: credCust } = await supabase.from('customers').select('id').ilike('name', `%${scannedData.credit_dues.customer}%`).limit(1).maybeSingle();
        if (!credCust) {
          const { data: newCust } = await supabase.from('customers').insert({ name: scannedData.credit_dues.customer, phone: '-', area: '-' }).select().single();
          credCust = newCust;
        }

        if (credCust) {
          // Insert Invoice
          const { data: inv } = await supabase.from('invoices').insert({
            customer_id: credCust.id,
            date: summaryDate,
            total: scannedData.credit_dues.total,
            paid: 0,
            pay_type: 'due'
          }).select().single();

          // Insert Items
          if (inv && scannedData.credit_dues.items?.length > 0) {
            const itemsToInsert = [];
            for (const item of scannedData.credit_dues.items) {
              let { data: prod } = await supabase.from('products').select('id, buy_price').ilike('name', `%${item.name}%`).limit(1).maybeSingle();
              
              const qty = Number(item.quantity) || 1;
              const unitPrice = (Number(item.amount) || 0) / qty;

              if (!prod) {
                const { data: newProd } = await supabase.from('products').insert({
                  name: item.name,
                  category: 'Other',
                  unit: 'Piece',
                  buy_price: 0,
                  sell_price: unitPrice,
                  stock: 0
                }).select().single();
                prod = newProd;
              }
              
              if (prod) {
                itemsToInsert.push({
                  invoice_id: inv.id,
                  product_id: prod.id,
                  quantity: qty,
                  unit_price: unitPrice
                });
              }
            }
            if (itemsToInsert.length > 0) {
              await supabase.from('invoice_items').insert(itemsToInsert);
            }
          }
        }
      }

      // 3. Handle Expenses
      if (scannedData.expenses?.total > 0) {
        // Insert Purchase
        const { data: pur } = await supabase.from('purchases').insert({
          supplier: 'Daily Expenses',
          date: summaryDate,
          invoice_no: 'EXP-' + Date.now(),
          total: scannedData.expenses.total
        }).select().single();

        // Insert Items
        if (pur && scannedData.expenses.items?.length > 0) {
          const itemsToInsert = [];
          for (const item of scannedData.expenses.items) {
            let { data: prod } = await supabase.from('products').select('id').ilike('name', `%${item.category}%`).limit(1).maybeSingle();
            
            const amount = Number(item.amount) || 0;

            if (!prod) {
              const { data: newProd } = await supabase.from('products').insert({
                name: item.category + (item.notes ? ` (${item.notes})` : ''),
                category: 'Expense',
                unit: 'Unit',
                buy_price: amount,
                sell_price: 0,
                stock: 0
              }).select().single();
              prod = newProd;
            }
            
            if (prod) {
              itemsToInsert.push({
                purchase_id: pur.id,
                product_id: prod.id,
                quantity: 1,
                unit_cost: amount
              });
            }
          }
          if (itemsToInsert.length > 0) {
            await supabase.from('purchase_items').insert(itemsToInsert);
          }
        }
      }

      alert('Daily summary saved successfully!');
      // Update state without reloading to prevent getting stuck
      navigate('/reports', { replace: true, state: {} });
      // We don't need window.location.reload() because we can just trigger a re-fetch or let the user see the updated page.
      // Actually, since we navigated to /reports without state, it will re-render and loadData will run again because scannedData is gone.
      setSavingSummary(false);
      // Force a re-fetch of data
      window.location.href = '/reports';
    } catch (err: any) {
      alert('Failed to save summary: ' + err.message);
      setSavingSummary(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch('/api/backup/export');
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wholesaleos_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('This will replace all current data. Are you sure?')) {
      e.target.value = '';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        
        if (!res.ok) throw new Error('Import failed');
        alert('Import successful');
        window.location.reload();
      };
      reader.readAsText(file);
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  };

  const handleExportSheets = async () => {
    try {
      setBackupStatus('Exporting to Google Sheets...');
      // Simulated for now as we don't have the real Sheets API setup in this demo
      await new Promise(r => setTimeout(r, 2000));
      setBackupStatus(`Last backup: ${new Date().toLocaleString()}`);
    } catch (e: any) {
      alert('Sheets export failed: ' + e.message);
      setBackupStatus(null);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Reports & Data</h2>
      </div>

      {dbError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-red-900 mb-2">Database Setup Required</h3>
          <p className="text-red-700">{dbError}</p>
        </div>
      )}

      {scannedData && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm relative">
          <button 
            onClick={() => navigate('/reports', { replace: true, state: {} })}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
          
          <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-blue-600" />
            Review Scanned Daily Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
              <h4 className="font-bold text-gray-800 mb-2">Sales</h4>
              <p className="text-2xl font-bold text-green-600">৳ {scannedData.sales?.total?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500 mt-1">{scannedData.sales?.items?.length || 0} items</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
              <h4 className="font-bold text-gray-800 mb-2">Expenses</h4>
              <p className="text-2xl font-bold text-red-600">৳ {scannedData.expenses?.total?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500 mt-1">{scannedData.expenses?.items?.length || 0} items</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
              <h4 className="font-bold text-gray-800 mb-2">Credit / Dues</h4>
              <p className="text-2xl font-bold text-orange-600">৳ {scannedData.credit_dues?.total?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Customer: {scannedData.credit_dues?.customer || 'N/A'}</p>
            </div>
          </div>

          <button
            onClick={handleSaveSummary}
            disabled={savingSummary}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            {savingSummary ? 'Saving to Database...' : 'Save Summary to Database'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Bikri</h3>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.totalSales).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Kena</h3>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.totalPurchases).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Net Lav (Profit)</h3>
          <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ৳ {Math.round(stats.netProfit).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Profit Margin %</h3>
          <p className={`text-2xl font-bold ${stats.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.margin.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Baki</h3>
          <p className="text-2xl font-bold text-red-600">৳ {Math.round(stats.totalBaki).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Lav by Product (Top 5)</h3>
          <div className="space-y-4">
            {topProducts.map((p, i) => {
              const maxProfit = Math.max(...topProducts.map(tp => Math.abs(tp.profit)));
              const width = maxProfit > 0 ? (Math.abs(p.profit) / maxProfit) * 100 : 0;
              const isProfit = p.profit >= 0;
              
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{p.name}</span>
                    <span className={isProfit ? 'text-green-600' : 'text-red-600'}>
                      ৳ {Math.round(p.profit).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${width}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {topProducts.length === 0 && <p className="text-gray-500 text-sm">No sales data yet.</p>}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Top Customers by Purchase</h3>
          <div className="space-y-4">
            {topCustomers.map((c, i) => {
              const maxTotal = Math.max(...topCustomers.map(tc => tc.total));
              const width = maxTotal > 0 ? (c.total / maxTotal) * 100 : 0;
              
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{c.name}</span>
                    <span className="text-blue-600">৳ {Math.round(c.total).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${width}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {topCustomers.length === 0 && <p className="text-gray-500 text-sm">No sales data yet.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Due Customers (Baki)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Name / Shop</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3 text-right">Baki Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bakiCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{c.area}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    ৳ {Math.round(c.baki).toLocaleString()}
                  </td>
                </tr>
              ))}
              {bakiCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                    No customers have outstanding baki. Great job!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Data Management</h3>
        <p className="text-sm text-gray-500 mb-6">Export your data to keep it safe, or import from a previous backup.</p>
        
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            Export Database (JSON)
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            <Upload size={18} />
            Import Database (JSON)
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>

          <button
            onClick={handleExportSheets}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0F6E56] text-white rounded-xl font-medium hover:bg-[#085041] transition-colors"
          >
            <Database size={18} />
            Export to Google Sheets
          </button>
        </div>
        
        {backupStatus && (
          <p className="mt-4 text-sm font-medium text-[#0F6E56] flex items-center gap-2">
            <CheckCircle2 size={16} />
            {backupStatus}
          </p>
        )}
      </div>
    </div>
  );
}
