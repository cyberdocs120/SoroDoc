import React, { useState, useRef, useCallback } from 'react';
import { generateFromWasm, generateFromDeployed, type ContractData } from '../api.ts';

interface UploadPanelProps {
  onUpload: (data: ContractData) => void;
  onStartGeneration?: () => void;
  onError?: (error: string) => void;
}

export function UploadPanel({ onUpload, onStartGeneration, onError }: UploadPanelProps) {
  const [contractId, setContractId] = useState('');
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWasmFile = useCallback(async (file: File) => {
    setLoading(true);
    setStatus(`Reading ${file.name}...`);
    onStartGeneration?.();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wasm = Buffer.from(arrayBuffer);
      const contractName = file.name.replace(/\.wasm$/i, '') || 'contract';

      setStatus(`Generating docs for ${contractName}...`);
      const result = await generateFromWasm(wasm, contractName, network);

      onUpload({
        contractName: result.contractName,
        network: result.network,
        outputs: result.outputs,
      });
      setStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus(null);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [network, onUpload, onStartGeneration, onError]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleWasmFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith('.wasm')) {
      handleWasmFile(file);
    } else {
      onError?.('Please drop a .wasm file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFetchContract = async () => {
    if (!contractId.trim()) return;
    setLoading(true);
    setStatus(`Fetching contract ${contractId.slice(0, 12)}...`);
    onStartGeneration?.();

    try {
      const result = await generateFromDeployed(contractId, network);
      onUpload({
        contractName: result.contractName,
        network: result.network,
        outputs: result.outputs,
      });
      setStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus(null);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-2">Upload WASM</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-500'
          } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".wasm"
            className="hidden"
            id="wasm-upload"
            ref={fileInputRef}
            onChange={handleFileInput}
          />
          <label htmlFor="wasm-upload" className="cursor-pointer">
            <div className="text-gray-500">
              {loading ? 'Processing...' : 'Drag and drop your contract .wasm here'}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {loading ? '' : 'or click to browse files'}
            </div>
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
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'testnet' | 'mainnet')}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </div>
          <button
            onClick={handleFetchContract}
            disabled={loading || !contractId.trim()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Fetch & Generate'}
          </button>
        </div>
      </div>

      {status && (
        <div className="bg-blue-50 text-blue-800 text-sm px-4 py-3 rounded-md">
          {status}
        </div>
      )}
    </div>
  );
}
