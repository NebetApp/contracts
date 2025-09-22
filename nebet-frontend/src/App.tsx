import React, { useState } from 'react';
import { ToastProvider } from './components/ui/Toast';
import { Navigation } from './components/layout/Navigation';
import { Dashboard } from './components/sections/Dashboard';
import { Passports } from './components/sections/Passports';
import { Verification } from './components/sections/Verification';
// import { Funding } from './components/sections/Funding';

// Import Nunito and Inter fonts
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

function App() {
  const [currentSection, setCurrentSection] = useState('dashboard');

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'passports':
        return <Passports />;
      case 'verification':
        return <Verification />;
      case 'funding':
        // return <Funding />;
        return <div className="p-8 text-center text-[#8F969C]">Funding section coming soon...</div>;
      case 'analytics':
        return <div className="p-8 text-center text-[#8F969C]">Analytics section coming soon...</div>;
      case 'relayer':
        return <div className="p-8 text-center text-[#8F969C]">Relayer section coming soon...</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-white to-[#F2F5F7]">
        <Navigation 
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
        />
        
        <main className="lg:pl-64">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
