import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { Plus, ScanLine, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Purchases() {
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const location = useLocation();
  const navigate = useNavigate();
  const scannedData = location.state?.scannedData;

  const [form, setForm] = useState({
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    invoice_no: '',
    items: [{ product_id: '', quantity: 1, unit_cost: 0 }]
  });

  useEffect(() => {
    async function loadData() {
      const supabase = await getSupabase();
      if (!supabase) return;

      const [
        { data: prods },
        { data: purs }
      ] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('purchases').select('*, purchase_items(count)').order('created_at', { ascending: false })
      ]);

      setProducts(prods || []);
      setPurchases(purs || []);
      setLoading(false);

      if (scannedData && scannedData.supplier) {
        let currentProds = [...(prods || [])];
        const newItems = [];
        
        for (const item of scannedData.items || []) {
          let prod = currentProds.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()));
          
          if (!prod && item.name) {
            // Auto-create missing product
            const { data: newProd } = await supabase.from('products').insert([{
              name: item.name,
              category: 'Other',
              unit: item.unit || 'Piece',
              buy_price: item.unit_cost || 0,
              sell_price: (item.unit_cost || 0) * 1.2,
              stock: 0,
              alert_qty: 10
            }]).select().single();
            
            if (newProd) {
              prod = newProd;
              currentProds.push(prod);
            }
          }
          
          newItems.push({
            product_id: prod?.id || '',
            quantity: item.qty || 1,
            unit_cost: item.unit_cost || prod?.buy_price || 0
          });
        }
        
        setProducts(currentProds);

        setForm(prev => ({
          ...prev,
          supplier: scannedData.supplier || '',
          invoice_no: scannedData.invoice_number || '',
          date: scannedData.date || prev.date,
          items: newItems.length > 0 ? newItems : [{ product_id: '', quantity: 1, unit_cost: 0 }]
        }));
      }
    }
    loadData();
  }, [scannedData]);

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: 1, unit_cost: 0 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        newItems[index].unit_cost = prod.buy_price;
      }
    }
    
    setForm({ ...form, items: newItems });
  };

  const total = form.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const handleSubmit = async () => {
    if (!form.supplier || form.items.some(i => !i.product_id)) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          total
        })
      });

      if (!res.ok) throw new Error('Failed to save purchase');
      
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase?')) return;
    const supabase = await getSupabase();
    if (!supabase) return;
    
    await supabase.from('purchases').delete().eq('id', id);
    setPurchases(purchases.filter(p => p.id !== id));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Purchases</h2>
        <button
          onClick={() => navigate('/scanner')}
          className="bg-[#0F6E56] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#085041] transition-colors"
        >
          <ScanLine size={18} />
          <span className="hidden sm:inline">Scan Invoice</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Record Purchase</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier / Distributor</label>
              <input
                type="text"
                value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No (Optional)</label>
              <input
                type="text"
                value={form.invoice_no}
                onChange={e => setForm({ ...form, invoice_no: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-[#0F6E56] text-sm font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={16} /> Add Item
              </button>
            </div>
            
            {form.items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <select
                  value={item.product_id}
                  onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                  className="w-full sm:flex-1 h-11 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                  required
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))}
                      className="w-20 h-11 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                      placeholder="Qty"
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={e => handleItemChange(index, 'unit_cost', Number(e.target.value))}
                      className="w-24 h-11 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                      placeholder="Cost"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-right font-medium text-gray-900 hidden sm:block">
                      ৳ {Math.round(item.quantity * item.unit_cost).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={form.items.length === 1}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="w-full text-right font-medium text-gray-900 sm:hidden pt-2 border-t border-gray-200">
                  Total: ৳ {Math.round(item.quantity * item.unit_cost).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-xl font-bold text-gray-900">
              Total Kena: ৳ {Math.round(total).toLocaleString()}
            </div>
            <button
              onClick={handleSubmit}
              className="bg-[#0F6E56] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#085041] transition-colors"
            >
              Save Purchase
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Purchase History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((pur) => (
                <tr key={pur.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">{new Date(pur.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{pur.supplier}</td>
                  <td className="px-4 py-3 text-gray-500">{pur.invoice_no || '-'}</td>
                  <td className="px-4 py-3 text-center">{pur.purchase_items?.[0]?.count || 0}</td>
                  <td className="px-4 py-3 text-right font-medium">৳ {Math.round(pur.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(pur.id)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No purchases found. Record one above.
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
