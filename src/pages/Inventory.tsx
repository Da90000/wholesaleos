import { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { ScanLine, Trash2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const scannedData = location.state?.scannedData;

  const [form, setForm] = useState({
    name: '',
    category: 'Chips & Snacks',
    unit: 'Carton',
    buy_price: 0,
    sell_price: 0,
    stock: 0,
    alert_qty: 10
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (scannedData && scannedData.name) {
      setForm({
        name: scannedData.name || '',
        category: scannedData.category || 'Chips & Snacks',
        unit: scannedData.unit || 'Carton',
        buy_price: scannedData.mrp ? Math.round(scannedData.mrp * 0.8) : 0, // guess buy price
        sell_price: scannedData.mrp || 0,
        stock: 0,
        alert_qty: 10
      });
    }
  }, [scannedData]);

  async function loadData() {
    const supabase = await getSupabase();
    if (!supabase) return;

    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  }

  const handleSubmit = async () => {
    if (!form.name) return;

    try {
      const supabase = await getSupabase();
      if (!supabase) return;

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(form)
          .eq('id', isEditing);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([form]);
        if (error) throw error;
      }
      
      setForm({
        name: '', category: 'Chips & Snacks', unit: 'Carton',
        buy_price: 0, sell_price: 0, stock: 0, alert_qty: 10
      });
      setIsEditing(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (product: any) => {
    setIsEditing(product.id);
    setForm({
      name: product.name,
      category: product.category,
      unit: product.unit,
      buy_price: product.buy_price,
      sell_price: product.sell_price,
      stock: product.stock,
      alert_qty: product.alert_qty
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const supabase = await getSupabase();
    if (!supabase) return;
    
    await supabase.from('products').delete().eq('id', id);
    setProducts(products.filter(p => p.id !== id));
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <button
          onClick={() => navigate('/scanner')}
          className="bg-[#0F6E56] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#085041] transition-colors"
        >
          <ScanLine size={18} />
          <span className="hidden sm:inline">Scan Product Packet</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {isEditing ? 'Edit Product' : 'Add Product'}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
              >
                <option>Chips & Snacks</option>
                <option>Biscuits</option>
                <option>Juice & Drinks</option>
                <option>Candy & Confectionery</option>
                <option>Noodles</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
              >
                <option>Carton</option>
                <option>Packet</option>
                <option>Piece</option>
                <option>Kg</option>
                <option>Dozen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buy Price (৳)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.buy_price}
                onChange={e => setForm({ ...form, buy_price: Number(e.target.value) })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (৳)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sell_price}
                onChange={e => setForm({ ...form, sell_price: Number(e.target.value) })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Threshold</label>
              <input
                type="number"
                min="0"
                value={form.alert_qty}
                onChange={e => setForm({ ...form, alert_qty: Number(e.target.value) })}
                className="w-full h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(null);
                  setForm({
                    name: '', category: 'Chips & Snacks', unit: 'Carton',
                    buy_price: 0, sell_price: 0, stock: 0, alert_qty: 10
                  });
                }}
                className="px-4 py-2 rounded-xl font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="bg-[#0F6E56] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#085041] transition-colors"
            >
              {isEditing ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Stock List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Buy Price</th>
                <th className="px-4 py-3 text-right">Sell Price</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3 text-center">Unit</th>
                <th className="px-4 py-3 text-center">Margin %</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const margin = p.sell_price > 0 ? ((p.sell_price - p.buy_price) / p.sell_price) * 100 : 0;
                const isLowStock = p.stock <= p.alert_qty;
                
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F1FB] text-[#185FA5]">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">৳ {Math.round(p.buy_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">৳ {Math.round(p.sell_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        isLowStock ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#EAF3DE] text-[#3B6D11]'
                      }`}>
                        {isLowStock ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No products found. Add one above.
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
