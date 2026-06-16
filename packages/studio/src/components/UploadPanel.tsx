import React, { useState } from 'react';

export function UploadPanel({ onUpload }: { onUpload: (data: any) => void }) {
  const [contractId, setContractId] = useState('');
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Placeholder: In a real app, we'd read the WASM or upload it
      onUpload({ name: file.name, type: 'wasm' });
    }
  };

  const handleFetchContract = () => {
    if (contractId) {
      onUpload({ id: contractId, type: 'remote' });
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-2">Upload WASM</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <input 
            type="file" 
            accept=".wasm" 
            className="hidden" 
            id="wasm-upload" 
            onChange={handleFileUpload}
          />
          <label htmlFor="wasm-upload" className="cursor-pointer">
            <div className="text-gray-500">Drag and drop your contract .wasm here</div>
            <div className="text-sm text-gray-400 mt-1">or click to browse files</div>
          </label>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">OR</span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Fetch from Network</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract ID</label>
            <input 
              type="text"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              placeholder="CC..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button 
            onClick={handleFetchContract}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Fetch ABI
          </button>
        </div>
      </div>
    </div>
  );
}
