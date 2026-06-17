import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { UploadPanel } from './components/UploadPanel.tsx';
import { PreviewPane } from './components/PreviewPane.tsx';

function App() {
  const [contractData, setContractData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">SoroDoc Studio</h1>
        <div className="flex gap-4">
          <button className="text-sm font-medium text-gray-600 hover:text-gray-900">Docs</button>
          <button className="text-sm font-medium text-gray-600 hover:text-gray-900">Settings</button>
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r bg-white overflow-y-auto">
          <UploadPanel onUpload={setContractData} />
        </div>
        <div className="flex-1 bg-gray-100 overflow-y-auto">
          <PreviewPane data={contractData} />
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
