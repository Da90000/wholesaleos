import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ScanLine, FileText, ShoppingCart, Package, Users, BarChart3, Settings, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SettingsModal } from './SettingsModal';

export function Layout() {
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/scanner', icon: ScanLine, label: 'AI Scanner', badge: true },
    { to: '/sales', icon: FileText, label: 'Sales / Invoices' },
    { to: '/purchases', icon: ShoppingCart, label: 'Purchases' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#0F6E56] text-white p-4 flex justify-between items-center shadow-md z-30 relative">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="md:hidden p-1 hover:bg-[#085041] rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-xl font-bold">WholesaleOS</h1>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-[#085041] rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav className={`
          absolute md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 overflow-y-auto py-4">
            <ul className="flex flex-col px-3 gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="w-2 h-2 rounded-full bg-green-500 ml-auto"></span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          <Outlet />
        </main>
      </div>

      {showSettings && <SettingsModal onSave={() => setShowSettings(false)} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
