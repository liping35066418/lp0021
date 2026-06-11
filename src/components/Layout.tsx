import { useState, ReactNode, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSidebarToggle = () => {
    setCollapsed(!collapsed);
  };

  const handleMobileMenuClick = () => {
    setMobileOpen(true);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  const containerClass = 'flex h-screen bg-gray-50 overflow-hidden';
  const contentClass = 'flex flex-col flex-1 min-w-0';
  const mainClass = cn(
    'flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300',
    'bg-gradient-to-br from-gray-50 to-gray-100'
  );
  const wrapperClass = 'max-w-7xl mx-auto';
  const content = children || <Outlet />;

  return (
    <div className={containerClass}>
      <Sidebar
        collapsed={collapsed}
        onToggle={handleSidebarToggle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />

      <div className={contentClass}>
        <Navbar onMenuClick={handleMobileMenuClick} />

        <main className={mainClass}>
          <div className={wrapperClass}>
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}
