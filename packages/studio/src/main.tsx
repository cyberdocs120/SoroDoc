import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { UploadPanel } from './components/UploadPanel.tsx';
import { PreviewPane } from './components/PreviewPane.tsx';
import { type ContractData } from './api.ts';

function App() {
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleUpload = useCallback((data: ContractData) => {
    setContractData(data);
    setError(null);
    setGenerating(false);
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setGenerating(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">SoroDoc Studio</h1>
          {generating && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Generating...
            </span>
          )}
        </div>
        <div className="flex gap-4 items-center">
          {contractData && (
            <button
              onClick={() => { setContractData(null); setError(null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              New Contract
            </button>
          )}
          <a
            href="https://sorodoc.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Docs
          </a>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r bg-white overflow-y-auto">
          <UploadPanel
            onUpload={handleUpload}
            onStartGeneration={() => setGenerating(true)}
            onError={handleError}
          />
        </div>
        <div className="flex-1 bg-gray-100 overflow-y-auto">
          <PreviewPane data={contractData} error={error} />
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
