import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { Plus, ScanLine, Trash2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Sales() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const location = useLocation();
  const navigate = useNavigate();
  const scannedData = location.state?.scannedData;

  const [form, setForm] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    pay_type: 'paid',
    paid: 0,
    items: [{ product_id: '', quantity: 1, unit_price: 0 }]
  });

  useEffect(() => {
    async function loadData() {
      const supabase = await getSupabase();
      if (!supabase) return;

      const [
        { data: custs },
        { data: prods },
        { data: invs }
      ] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('invoices').select('*, customers(name)').order('created_at', { ascending: false })
      ]);

      setCustomers(custs || []);
      setProducts(prods || []);
      setInvoices(invs || []);
      setLoading(false);

      if (scannedData && scannedData.customer) {
        let currentCusts = [...(custs || [])];
        let cust = currentCusts.find(c => c.name.toLowerCase().includes(scannedData.customer.toLowerCase()));
        
        if (!cust && scannedData.customer) {
           const { data: newCust } = await supabase.from('customers').insert([{
             name: scannedData.customer,
             phone: '',
             area: ''
           }]).select().single();
           if (newCust) {
             cust = newCust;
             currentCusts.push(cust);
             setCustomers(currentCusts);
           }
        }

        let currentProds = [...(prods || [])];
        const newItems = [];

        for (const item of scannedData.items || []) {
          let prod = currentProds.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()));
          
          if (!prod && item.name) {
            const { data: newProd } = await supabase.from('products').insert([{
              name: item.name,
              category: 'Other',
              unit: item.unit || 'Piece',
              buy_price: 0,
              sell_price: item.unit_price || 0,
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
            unit_price: item.unit_price || prod?.sell_price || 0
          });
        }
        
        setProducts(currentProds);

        setForm(prev => ({
          ...prev,
          customer_id: cust?.id || '',
          items: newItems.length > 0 ? newItems : [{ product_id: '', quantity: 1, unit_price: 0 }]
        }));
      }
    }
    loadData();
  }, [scannedData]);

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: 1, unit_price: 0 }]
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
        newItems[index].unit_price = prod.sell_price;
      }
    }
    
    setForm({ ...form, items: newItems });
  };

  const subtotal = form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const baki = subtotal - form.paid;

  useEffect(() => {
    if (form.pay_type === 'paid') {
      setForm(prev => ({ ...prev, paid: subtotal }));
    } else if (form.pay_type === 'due') {
      setForm(prev => ({ ...prev, paid: 0 }));
    }
  }, [form.pay_type, subtotal]);

  const handleSubmit = async () => {
    if (!form.customer_id || form.items.some(i => !i.product_id)) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          total: subtotal
        })
      });

      if (!res.ok) throw new Error('Failed to save invoice');
      
      // Reload
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    const supabase = await getSupabase();
    if (!supabase) return;
    
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(invoices.filter(i => i.id !== id));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sales / Invoices</h2>
        <button
          onClick={() => navigate('/scanner')}
          className="bg-[#0F6E56] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#085041] transition-colors"
        >
          <ScanLine size={18} />
          <span className="hidden sm:inline">Scan Order</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Create Invoice</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={form.customer_id}
                onChange={e => setForm({ ...form, customer_id: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
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
                      value={item.unit_price}
                      onChange={e => handleItemChange(index, 'unit_price', Number(e.target.value))}
                      className="w-24 h-11 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                      placeholder="Price"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-right font-medium text-gray-900 hidden sm:block">
                      ৳ {Math.round(item.quantity * item.unit_price).toLocaleString()}
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
                  Total: ৳ {Math.round(item.quantity * item.unit_price).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.pay_type === 'paid'}
                    onChange={() => setForm({ ...form, pay_type: 'paid' })}
                    className="text-[#0F6E56] focus:ring-[#0F6E56]"
                  />
                  <span className="text-sm">Paid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.pay_type === 'due'}
                    onChange={() => setForm({ ...form, pay_type: 'due' })}
                    className="text-[#0F6E56] focus:ring-[#0F6E56]"
                  />
                  <span className="text-sm">Baki (Due)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.pay_type === 'partial'}
                    onChange={() => setForm({ ...form, pay_type: 'partial' })}
                    className="text-[#0F6E56] focus:ring-[#0F6E56]"
                  />
                  <span className="text-sm">Partial</span>
                </label>
              </div>
            </div>

            {form.pay_type === 'partial' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={form.paid}
                  onChange={e => setForm({ ...form, paid: Number(e.target.value) })}
                  className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                />
              </div>
            )}

            <div className="md:col-start-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between mb-1 text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>৳ {Math.round(subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm text-gray-600">
                <span>Paid:</span>
                <span className="text-green-600">৳ {Math.round(form.paid).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span>Baki:</span>
                <span className={baki > 0 ? 'text-red-600' : 'text-gray-900'}>
                  ৳ {Math.round(baki).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              className="bg-[#0F6E56] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#085041] transition-colors"
            >
              Save Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Invoice History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Baki</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const invBaki = inv.total - inv.paid;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.customers?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-right">৳ {Math.round(inv.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600">৳ {Math.round(inv.paid).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">৳ {Math.round(invBaki).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {inv.pay_type === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF3DE] text-[#3B6D11]">
                          <CheckCircle2 size={12} /> Paid
                        </span>
                      ) : inv.pay_type === 'partial' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FAEEDA] text-[#854F0B]">
                          <AlertCircle size={12} /> Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FCEBEB] text-[#A32D2D]">
                          <XCircle size={12} /> Due
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No invoices found. Create one above.
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
