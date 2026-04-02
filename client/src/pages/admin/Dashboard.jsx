import React, { useState } from 'react';
import { 
  FiGrid, 
  FiBox, 
  FiBarChart2, 
  FiTag, 
  FiDollarSign, 
  FiTrendingUp, 
  FiLogOut,
  FiUser,
  FiMenu,
  FiX
} from 'react-icons/fi';
import { FaGlassCheers } from 'react-icons/fa';

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Dashboard');

  const menuItems = [
    { name: 'Dashboard', icon: FiGrid },
    { name: 'Inventory Management', icon: FiBox },
    { name: 'Stock Reports', icon: FiBarChart2 },
    { name: 'Offers', icon: FiTag },
    { name: 'Item Price', icon: FiDollarSign },
    { name: 'Stock In/Out Report', icon: FiTrendingUp },
    { name: 'Profit Management', icon: FiTrendingUp },
    { name: 'Cocktails/Mocktails', icon: FaGlassCheers },
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('userEmail');
    window.location.href = '/login';
  };

  const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || 'vignesh@gmail.com';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {sidebarOpen ? <FiX className="text-gray-600" /> : <FiMenu className="text-gray-600" />}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800">AFMC MESS</h1>
          </div>

          {/* User Email */}
          <div className="px-6 pb-6">
            <p className="text-gray-600 text-sm">{userEmail}</p>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveMenu(item.name)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-left
                    ${isActive 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="text-lg" />
                  <span className="text-sm">{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200 mt-auto">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <FiLogOut className="text-lg" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:ml-64 min-h-screen">
        {/* Simple header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">{activeMenu}</h2>
          </div>
        </header>

        {/* Content Area - Shows different content based on selected menu */}
        <div className="p-6">
          {activeMenu === 'Dashboard' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Dashboard Content</p>
            </div>
          )}
          
          {activeMenu === 'Inventory Management' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Inventory Management Content</p>
            </div>
          )}
          
          {activeMenu === 'Stock Reports' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Stock Reports Content</p>
            </div>
          )}
          
          {activeMenu === 'Offers' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Offers Content</p>
            </div>
          )}
          
          {activeMenu === 'Item Price' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Item Price Content</p>
            </div>
          )}
          
          {activeMenu === 'Stock In/Out Report' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Stock In/Out Report Content</p>
            </div>
          )}
          
          {activeMenu === 'Profit Management' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Profit Management Content</p>
            </div>
          )}
          
          {activeMenu === 'Cocktails/Mocktails' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Cocktails/Mocktails Content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;