import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { UploadPanel } from '../src/components/UploadPanel.tsx';
import { PreviewPane } from '../src/components/PreviewPane.tsx';
import type { ContractData } from '../src/api.ts';

vi.mock('../src/api.ts', () => ({
  generateFromWasm: vi.fn(),
  generateFromDeployed: vi.fn(),
}));

import { generateFromWasm, generateFromDeployed } from '../src/api.ts';

const mockGenerateFromWasm = vi.mocked(generateFromWasm);
const mockGenerateFromDeployed = vi.mocked(generateFromDeployed);

describe('UploadPanel', () => {
  const mockOnUpload = vi.fn();
  const mockOnError = vi.fn();
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the WASM upload area', () => {
    render(
      <UploadPanel onUpload={mockOnUpload} onError={mockOnError} onStartGeneration={mockOnStart} />
    );
    expect(screen.getByText('Upload WASM')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument();
  });

  it('renders the network fetch form', () => {
    render(
      <UploadPanel onUpload={mockOnUpload} onError={mockOnError} onStartGeneration={mockOnStart} />
    );
    expect(screen.getByText('Fetch from Network')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CC...')).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
  });

  it('calls generateFromDeployed when fetch button is clicked', async () => {
    mockGenerateFromDeployed.mockResolvedValue({
      contractName: 'TestContract',
      network: 'testnet',
      outputs: { markdown: '# Test' },
    });

    render(
      <UploadPanel onUpload={mockOnUpload} onError={mockOnError} onStartGeneration={mockOnStart} />
    );

    fireEvent.change(screen.getByPlaceholderText('CC...'), {
      target: { value: 'CABC123' },
    });
    fireEvent.click(screen.getByText('Fetch & Generate'));

    await waitFor(() => {
      expect(mockGenerateFromDeployed).toHaveBeenCalledWith('CABC123', 'testnet');
    });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith({
        contractName: 'TestContract',
        network: 'testnet',
        outputs: { markdown: '# Test' },
      });
    });
  });

  it('calls onError when generation fails', async () => {
    mockGenerateFromDeployed.mockRejectedValue(new Error('Network error'));

    render(
      <UploadPanel onUpload={mockOnUpload} onError={mockOnError} onStartGeneration={mockOnStart} />
    );

    fireEvent.change(screen.getByPlaceholderText('CC...'), {
      target: { value: 'CABC123' },
    });
    fireEvent.click(screen.getByText('Fetch & Generate'));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Network error');
    });
  });

  it('disables inputs while loading', async () => {
    mockGenerateFromDeployed.mockImplementation(() => new Promise(() => {}));

    render(
      <UploadPanel onUpload={mockOnUpload} onError={mockOnError} onStartGeneration={mockOnStart} />
    );

    fireEvent.change(screen.getByPlaceholderText('CC...'), {
      target: { value: 'CABC123' },
    });
    fireEvent.click(screen.getByText('Fetch & Generate'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('CC...')).toBeDisabled();
    });
  });
});

describe('PreviewPane', () => {
  it('shows empty state when no data', () => {
    render(<PreviewPane data={null} />);
    expect(screen.getByText(/Upload a contract/)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<PreviewPane data={null} error="Something went wrong" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders contract name and network', () => {
    const data: ContractData = {
      contractName: 'Token',
      network: 'testnet',
    };
    render(<PreviewPane data={data} />);
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('testnet network')).toBeInTheDocument();
  });

  it('renders documentation when docs are provided', () => {
    const data: ContractData = {
      contractName: 'Token',
      network: 'testnet',
      docs: {
        contractName: 'Token',
        overview: 'A fungible token contract',
        functions: [
          {
            name: 'transfer',
            description: 'Transfers tokens',
            params: [
              { name: 'to', type: { kind: 'address' }, description: 'Recipient address' },
            ],
            returns: { type: { kind: 'void' }, description: '' },
          },
        ],
        events: [],
        errors: [
          {
            code: 1,
            name: 'InsufficientBalance',
            description: 'Not enough tokens',
            commonCauses: ['Low balance'],
            remediation: 'Check balance',
          },
        ],
      },
    };
    render(<PreviewPane data={data} />);
    expect(screen.getByText('transfer()')).toBeInTheDocument();
    expect(screen.getByText('Transfers tokens')).toBeInTheDocument();
    expect(screen.getByText('InsufficientBalance')).toBeInTheDocument();
  });

  it('shows ABI tab content', () => {
    const data: ContractData = {
      contractName: 'Token',
      network: 'testnet',
      abi: {
        name: 'Token',
        functions: [
          { name: 'transfer', params: [], returns: { kind: 'void' } },
        ],
        events: [],
        errors: [],
      },
    };
    render(<PreviewPane data={data} />);
    fireEvent.click(screen.getByText('ABI'));
    expect(screen.getByText(/"name": "Token"/)).toBeInTheDocument();
  });
});
