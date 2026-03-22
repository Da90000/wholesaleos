import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { AlertCircle, TrendingUp, ShoppingBag, DollarSign, Users } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    netProfit: 0,
    totalBaki: 0,
    lowStockCount: 0,
    bakiCustomers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = await getSupabase();
      if (!supabase) return;

      try {
        const [
          { data: invoices },
          { data: purchases },
          { data: products },
          { data: customers }
        ] = await Promise.all([
          supabase.from('invoices').select('total, paid, customer_id'),
          supabase.from('purchases').select('total'),
          supabase.from('products').select('stock, alert_qty'),
          supabase.from('customers').select('id')
        ]);

        let sales = 0;
        let baki = 0;
        invoices?.forEach(inv => {
          sales += Number(inv.total);
          baki += (Number(inv.total) - Number(inv.paid));
        });

        let buys = 0;
        purchases?.forEach(pur => {
          buys += Number(pur.total);
        });

        let lowStock = 0;
        products?.forEach(p => {
          if (p.stock <= p.alert_qty) lowStock++;
        });

        // For baki customers, we'd ideally query invoices grouped by customer, but for now we'll just count invoices with baki
        const bakiCusts = new Set(invoices?.filter(i => i.total > i.paid).map(i => i.customer_id)).size;

        setStats({
          totalSales: sales,
          totalPurchases: buys,
          netProfit: sales - buys, // simplified
          totalBaki: baki,
          lowStockCount: lowStock,
          bakiCustomers: bakiCusts
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8"><div className="flex gap-2"><div className="w-3 h-3 bg-[#0F6E56] rounded-full animate-bounce"></div><div className="w-3 h-3 bg-[#0F6E56] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div><div className="w-3 h-3 bg-[#0F6E56] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div></div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {stats.lowStockCount > 0 && (
        <div className="bg-[#FAEEDA] border border-[#854F0B] text-[#854F0B] px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">{stats.lowStockCount} products are at or below their alert threshold (low stock)</p>
        </div>
      )}

      {stats.bakiCustomers > 0 && (
        <div className="bg-[#FCEBEB] border border-[#A32D2D] text-[#A32D2D] px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">{stats.bakiCustomers} customers have outstanding baki</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <TrendingUp size={20} className="text-[#0F6E56]" />
            <h3 className="font-medium">Total Bikri (Sales)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.totalSales).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <ShoppingBag size={20} className="text-blue-600" />
            <h3 className="font-medium">Total Kena (Purchases)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.totalPurchases).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <DollarSign size={20} className="text-green-600" />
            <h3 className="font-medium">Lav (Profit)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.netProfit).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <Users size={20} className="text-red-600" />
            <h3 className="font-medium">Total Baki (Dues)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">৳ {Math.round(stats.totalBaki).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
