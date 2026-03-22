import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    area: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = await getSupabase();
    if (!supabase) return;

    const { data: custs } = await supabase.from('customers').select('*').order('name');
    
    // Fetch balances
    if (custs) {
      const custsWithBaki = await Promise.all(custs.map(async (c) => {
        const res = await fetch(`/api/customers/${c.id}/balance`);
        const { baki } = await res.json();
        
        // Also fetch total billed and paid for the ledger
        const { data: invoices } = await supabase.from('invoices').select('total, paid').eq('customer_id', c.id);
        let totalBilled = 0;
        let totalPaid = 0;
        invoices?.forEach(inv => {
          totalBilled += inv.total;
          totalPaid += inv.paid;
        });

        return { ...c, baki, totalBilled, totalPaid };
      }));
      setCustomers(custsWithBaki);
    }
    setLoading(false);
  }

  const handleSubmit = async () => {
    if (!form.name) return;

    try {
      const supabase = await getSupabase();
      if (!supabase) return;

      const { error } = await supabase
        .from('customers')
        .insert([form]);
      if (error) throw error;
      
      setForm({ name: '', phone: '', area: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? This will also delete all their invoices.')) return;
    const supabase = await getSupabase();
    if (!supabase) return;
    
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(customers.filter(c => c.id !== id));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Customer</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name / Shop Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <input
                type="text"
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              className="bg-[#0F6E56] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#085041] transition-colors"
            >
              Add Customer
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Customer Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Name / Shop</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3 text-right">Total Billed</th>
                <th className="px-4 py-3 text-right">Total Paid</th>
                <th className="px-4 py-3 text-right">Baki (Due)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => {
                const hasBaki = c.baki > 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.area || '-'}</td>
                    <td className="px-4 py-3 text-right">৳ {Math.round(c.totalBilled).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600">৳ {Math.round(c.totalPaid).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-medium ${hasBaki ? 'text-red-600' : 'text-gray-900'}`}>
                      ৳ {Math.round(c.baki).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        hasBaki ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-[#EAF3DE] text-[#3B6D11]'
                      }`}>
                        {hasBaki ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                        {hasBaki ? 'Due' : 'Clear'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No customers found. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
