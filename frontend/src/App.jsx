import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, createPublicClient, http } from 'viem';
import { polygonAmoy } from 'wagmi/chains';

const TOKEN_ADDRESS = '0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af';
const CONSUMER_ADDRESS = '0x787f3F838a126491F651207Bb575E07D9a95Da5b';
const VAULT_ADDRESS = '0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af';

const TOKEN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const CONSUMER_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const VAULT_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];


const polygonClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});

function App() {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(0);
  const [polygonBalance, setPolygonBalance] = useState(0n);
  
  const { address, isConnected } = useAccount();

  // Base Sepolia Balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address },
  });

  
  useEffect(() => {
    if (!address) return;
    
    const fetchPolygonBalance = async () => {
      try {
        const data = await polygonClient.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'getBalance',
          args: [address],
        });
        setPolygonBalance(data);
      } catch (error) {
        console.error('Error fetching Polygon balance:', error);
      }
    };

    fetchPolygonBalance();
    const interval = setInterval(fetchPolygonBalance, 10000); 
    
    return () => clearInterval(interval);
  }, [address, step]);

  const { data: approveHash, writeContract: approve } = useWriteContract();
  const { isLoading: isApproving } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { data: depositHash, writeContract: deposit } = useWriteContract();
  const { isLoading: isDepositing, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const amountWei = parseEther(amount);
      setStep(1);
      approve({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [CONSUMER_ADDRESS, amountWei],
      });
    } catch (error) {
      console.error(error);
      setStep(0);
      alert('Transaction failed: ' + error.message);
    }
  };

  if (approveHash && !isApproving && step === 1) {
    setStep(2);
    const amountWei = parseEther(amount);
    deposit({
      address: CONSUMER_ADDRESS,
      abi: CONSUMER_ABI,
      functionName: 'deposit',
      args: [amountWei, 80002n],
    });
  }

  if (isDepositSuccess && step === 2) {
    setTimeout(() => {
      setStep(0);
      setAmount('');
      refetchBalance();
    }, 3000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-1">🌉 Bridge</h1>
          <p className="text-sm text-purple-100">Base → Polygon</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-2xl p-4 mb-3">
          
          {/* Connect Button */}
          <div className="flex justify-center mb-4">
            <ConnectButton />
          </div>

          {isConnected && (
            <>
              {/* Base Sepolia Balance */}
              <div className="bg-purple-50 rounded-lg p-3 mb-3 text-center">
                <p className="text-xs text-gray-600 mb-1">Base Sepolia</p>
                <p className="text-xl font-bold text-purple-600">
                  {balance ? formatEther(balance) : '0.0'} TKN1
                </p>
              </div>

              {/* Polygon Amoy Virtual Balance */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 text-center">
                <p className="text-xs text-gray-600 mb-1">Polygon Amoy (Virtual)</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatEther(polygonBalance)} TKN1
                </p>
              </div>

              {/* Amount Input */}
              <div className="mb-4 flex justify-center">
                <div className="w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1 text-center">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      step="0.1"
                      min="0"
                      disabled={step > 0}
                      className="w-full px-3 py-2 pr-14 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-center disabled:bg-gray-100"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-500 font-medium">
                      TKN1
                    </span>
                  </div>
                </div>
              </div>

              {/* Bridge Button */}
              <div className="flex justify-center mb-3">
                <button
                  onClick={handleBridge}
                  disabled={step > 0 || !amount}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-2 px-8 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {step === 0 && '🌉 Bridge'}
                  {step === 1 && '⏳ Approving...'}
                  {step === 2 && '⏳ Depositing...'}
                </button>
              </div>

              {/* Status */}
              {step > 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 text-center">
                    {step === 1 && 'Step 1/2: Approving...'}
                    {step === 2 && !isDepositSuccess && 'Step 2/2: Depositing...'}
                    {isDepositSuccess && '✅ Success! Balances updating...'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info */}
        <div className="bg-white/90 backdrop-blur rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600">
            <strong>POC Demo</strong> - Automated relayer processes bridge transactions
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Contract: {CONSUMER_ADDRESS.slice(0, 6)}...{CONSUMER_ADDRESS.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;