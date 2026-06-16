import React from 'react';

export function PreviewPane({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <p>Upload a contract to preview documentation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {data.name || `Contract: ${data.id?.substring(0, 8)}...`}
        </h2>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">
            Export Markdown
          </button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
            Generate SDK
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        <div className="bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wider">
            Parsed ABI
          </div>
          <div className="p-4 overflow-y-auto font-mono text-sm">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wider">
            Live Preview
          </div>
          <div className="p-8 prose prose-slate max-w-none overflow-y-auto">
            <h1>{data.name || 'Contract Documentation'}</h1>
            <p className="text-gray-500 italic">This is a placeholder for the AI-generated documentation preview.</p>
            <div className="mt-8 space-y-4">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              <div className="h-32 bg-gray-50 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
