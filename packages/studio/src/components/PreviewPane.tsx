import React, { useState, useCallback } from 'react';
import { type ContractData } from '../api.ts';

interface PreviewPaneProps {
  data: ContractData | null;
  error?: string | null;
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
        if (line.startsWith('```')) return null;
        if (line.startsWith('| ')) {
          const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
          return (
            <div key={i} className="grid grid-cols-3 gap-2 text-sm py-1 border-b border-gray-100">
              {cells.map((cell, j) => (
                <span key={j} className={j === 0 ? 'font-mono font-medium' : 'text-gray-600'}>{cell}</span>
              ))}
            </div>
          );
        }
        if (line.startsWith('- ')) return <li key={i} className="text-sm ml-4">{line.slice(2)}</li>;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-gray-700 mb-2">{line}</p>;
      })}
    </div>
  );
}

function FunctionDocCard({ fn }: { fn: NonNullable<ContractData['docs']>['functions'][number] }) {
  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <h3 className="font-mono font-bold text-blue-700">{fn.name}()</h3>
      <p className="text-sm text-gray-600 mt-1 mb-3">{fn.description}</p>
      {fn.params.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Parameters</h4>
          {fn.params.map((p: { name: string; type: { kind: string }; description: string }) => (
            <div key={p.name} className="flex items-start gap-2 text-sm py-1">
              <code className="text-xs bg-gray-100 px-1 rounded font-mono">{p.name}</code>
              <span className="text-gray-500 text-xs">{p.type.kind}</span>
              <span className="text-gray-700">{p.description}</span>
            </div>
          ))}
        </div>
      )}
      {fn.returns.description && (
        <div className="text-sm">
          <span className="font-medium">Returns:</span>{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">{fn.returns.type.kind}</code>{' '}
          <span className="text-gray-600">{fn.returns.description}</span>
        </div>
      )}
      {fn.examples?.filter((e: { language: string; code: string }) => e.language === 'typescript').map((ex: { language: string; code: string }, i: number) => (
        <details key={i} className="mt-3">
          <summary className="text-xs font-medium text-blue-600 cursor-pointer">Example</summary>
          <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto">{ex.code}</pre>
        </details>
      ))}
    </div>
  );
}

export function PreviewPane({ data, error }: PreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'abi'>('docs');

  const handleExportMarkdown = useCallback(() => {
    if (!data?.outputs?.markdown) return;
    const blob = new Blob([data.outputs.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.contractName || 'docs'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const handleExportAll = useCallback(() => {
    if (!data?.outputs) return;
    Object.entries(data.outputs).forEach(([format, content]) => {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.contractName || 'docs'}.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [data]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-500 text-3xl mb-3">Error</div>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-5xl mb-4">&#128196;</div>
          <p>Upload a contract to preview documentation</p>
          <p className="text-sm mt-2 text-gray-300">Supports .wasm files and deployed contract IDs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{data.contractName}</h2>
          <p className="text-sm text-gray-500">{data.network} network</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportMarkdown}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            Export .md
          </button>
          <button
            onClick={handleExportAll}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Export All
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'docs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Documentation
        </button>
        <button
          onClick={() => setActiveTab('abi')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'abi'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ABI
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'docs' && data.docs ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <MarkdownPreview content={data.docs?.overview || 'No overview generated.'} />
            </div>

            {data.docs?.functions && data.docs.functions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Functions ({data.docs.functions.length})
                </h3>
                {data.docs.functions.map((fn: NonNullable<ContractData['docs']>['functions'][number]) => (
                  <FunctionDocCard key={fn.name} fn={fn} />
                ))}
              </div>
            )}

            {data.docs?.errors && data.docs.errors.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Errors ({data.docs.errors.length})
                </h3>
                {data.docs.errors.map((err: NonNullable<ContractData['docs']>['errors'][number]) => (
                  <div key={err.code} className="bg-white rounded-lg border p-3 mb-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">
                        {err.code}
                      </code>
                      <span className="font-mono font-bold text-sm">{err.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{err.description}</p>
                    {err.remediation && (
                      <p className="text-xs text-gray-500 mt-1">Fix: {err.remediation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'abi' ? (
          <div className="bg-white rounded-lg border overflow-hidden">
            <pre className="p-4 text-xs font-mono overflow-auto max-h-full">
              {JSON.stringify(data.abi || { note: 'ABI data not available. Generate docs from WASM or a deployed contract to see the ABI.' }, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
