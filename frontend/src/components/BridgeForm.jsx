import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CHAINS } from '../config/chains';
import { getContract } from '../config/contracts';
import TransactionStatus from './TransactionStatus';
import FaucetButton from './FaucetButton';

function BridgeForm({ account, chainId, signer, provider, onSwitchNetwork }) {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  
  const isOnBase = chainId === CHAINS.BASE_SEPOLIA.id;
  const isOnPolygon = chainId === CHAINS.POLYGON_AMOY.id;
  const sourceChain = isOnBase ? CHAINS.BASE_SEPOLIA : CHAINS.POLYGON_AMOY;
  const destinationChain = isOnBase ? CHAINS.POLYGON_AMOY : CHAINS.BASE_SEPOLIA;

  useEffect(() => {
    if (account && chainId && provider) {
      loadBalanceAndAllowance();
    }
  }, [account, chainId, amount]);

  const loadBalanceAndAllowance = async () => {
    try {
      if (isOnBase) {
        const token1Config = getContract(chainId, 'Token1');
        const tokenConsumerConfig = getContract(chainId, 'TokenConsumer');
        
        if (token1Config && tokenConsumerConfig) {
          const tokenContract = new ethers.Contract(
            token1Config.address,
            token1Config.abi,
            provider
          );
          
          const bal = await tokenContract.balanceOf(account);
          const allow = await tokenContract.allowance(account, tokenConsumerConfig.address);
          
          setBalance(ethers.formatEther(bal));
          setAllowance(ethers.formatEther(allow));
          
          if (amount && parseFloat(amount) > 0) {
            setNeedsApproval(parseFloat(ethers.formatEther(allow)) < parseFloat(amount));
          } else {
            setNeedsApproval(false);
          }
        }
      } else if (isOnPolygon) {
        const wrappedTokenConfig = getContract(chainId, 'WrappedToken1');
        
        if (wrappedTokenConfig) {
          const tokenContract = new ethers.Contract(
            wrappedTokenConfig.address,
            wrappedTokenConfig.abi,
            provider
          );
          
          const bal = await tokenContract.balanceOf(account);
          setBalance(ethers.formatEther(bal));
          setNeedsApproval(false);
        }
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const handleApprove = async () => {
    if (!signer || !amount) return;
    
    setLoading(true);
    setTxStatus({ status: 'pending', message: 'Approving tokens...' });
    
    try {
      const token1Config = getContract(chainId, 'Token1');
      const tokenConsumerConfig = getContract(chainId, 'TokenConsumer');
      
      const tokenContract = new ethers.Contract(
        token1Config.address,
        token1Config.abi,
        signer
      );
      
      const amountWei = ethers.parseEther(amount);
      const tx = await tokenContract.approve(tokenConsumerConfig.address, amountWei);
      
      setTxStatus({ 
        status: 'pending', 
        message: 'Waiting for approval confirmation...',
        txHash: tx.hash,
        chainId
      });
      
      await tx.wait();
      
      setTxStatus({ 
        status: 'success', 
        message: 'Approval successful!',
        txHash: tx.hash,
        chainId
      });
      
      await loadBalanceAndAllowance();
    } catch (error) {
      console.error('Approval error:', error);
      setTxStatus({ 
        status: 'error', 
        message: error.message || 'Approval failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBridge = async () => {
    if (!signer || !amount) return;
    
    setLoading(true);
    
    try {
      if (isOnBase) {
        await handleDeposit();
      } else if (isOnPolygon) {
        await handleWithdraw();
      }
    } catch (error) {
      console.error('Bridge error:', error);
      setTxStatus({ 
        status: 'error', 
        message: error.message || 'Bridge transaction failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    setTxStatus({ 
      status: 'pending', 
      message: 'Initiating deposit on Base...' 
    });
    
    const tokenConsumerConfig = getContract(chainId, 'TokenConsumer');
    const consumerContract = new ethers.Contract(
      tokenConsumerConfig.address,
      tokenConsumerConfig.abi,
      signer
    );
    
    const amountWei = ethers.parseEther(amount);
    const tx = await consumerContract.deposit(amountWei);
    
    setTxStatus({ 
      status: 'pending', 
      message: 'Locking tokens on Base...',
      txHash: tx.hash,
      chainId
    });
    
    await tx.wait();
    
    setTxStatus({ 
      status: 'processing', 
      message: 'Tokens locked! Relayer will mint wrapped tokens on Polygon (~10-30s)...',
      txHash: tx.hash,
      chainId
    });
    
    setAmount('');
    await loadBalanceAndAllowance();
    
    setTimeout(() => {
      setTxStatus({
        status: 'success',
        message: 'Bridge complete! Check your Polygon wallet for wTKN1 tokens.',
        txHash: tx.hash,
        chainId
      });
    }, 2000);
  };

  const handleWithdraw = async () => {
    setTxStatus({ 
      status: 'pending', 
      message: 'Initiating withdrawal on Polygon...' 
    });
    
    const bridgeConfig = getContract(chainId, 'BridgeMintBurn');
    const bridgeContract = new ethers.Contract(
      bridgeConfig.address,
      bridgeConfig.abi,
      signer
    );
    
    const amountWei = ethers.parseEther(amount);
    const tx = await bridgeContract.withdraw(amountWei);
    
    setTxStatus({ 
      status: 'pending', 
      message: 'Burning wrapped tokens...',
      txHash: tx.hash,
      chainId
    });
    
    await tx.wait();
    
    setTxStatus({ 
      status: 'processing', 
      message: 'Tokens burned! Relayer will release original tokens on Base (~10-30s)...',
      txHash: tx.hash,
      chainId
    });
    
    setAmount('');
    await loadBalanceAndAllowance();
    
    setTimeout(() => {
      setTxStatus({
        status: 'success',
        message: 'Bridge complete! Check your Base wallet for TKN1 tokens.',
        txHash: tx.hash,
        chainId
      });
    }, 2000);
  };

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balance);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Bridge Tokens</h2>
      
      {!isOnBase && !isOnPolygon && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            Please switch to Base Sepolia or Polygon Amoy network
          </p>
        </div>
      )}

      {(isOnBase || isOnPolygon) && (
        <div className="mb-4 p-2 rounded-lg" style={{ backgroundColor: `${sourceChain.color}10` }}>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-600">From</p>
            <p className="font-semibold text-sm" style={{ color: sourceChain.color }}>
              {sourceChain.name}
            </p>
            <p className="text-xs text-gray-500">
              {isOnBase ? 'TKN1' : 'wTKN1'}
            </p>
          </div>
          
          <div className="text-xl text-gray-400">→</div>
          
          <div className="text-center flex-1">
            <p className="text-xs text-gray-600">To</p>
            <p className="font-semibold text-sm" style={{ color: destinationChain.color }}>
              {destinationChain.name}
            </p>
            <p className="text-xs text-gray-500">
              {isOnBase ? 'wTKN1' : 'TKN1'}
            </p>
          </div>
        </div>
      </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <span className="text-gray-600">Balance:</span>
        <span className="font-semibold text-gray-800">
          {parseFloat(balance).toFixed(4)} {isOnBase ? 'TKN1' : 'wTKN1'}
        </span>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '') {
              setAmount('');
              return;
            }
          
            const numericValue = Number(value);
            if (isNaN(numericValue) || numericValue <= 0) {
              return;
            }
          
            setAmount(value);
          }}
          placeholder="Enter amount"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {isValidAmount && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            ⏱️ Estimated time: 10-30 seconds
          </p>
        </div>
      )}

      <div className="space-y-3">
        {isOnBase && needsApproval && (
          <button
            onClick={handleApprove}
            disabled={loading || !isValidAmount}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Approving...' : 'Approve Tokens'}
          </button>
        )}
        
        <button
          onClick={handleBridge}
          disabled={loading || !isValidAmount || (isOnBase && needsApproval)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
          {loading 
            ? 'Processing...' 
            : isOnBase 
              ? 'Bridge to Polygon' 
              : 'Bridge to Base'
          }
        </button>

        {isOnBase && (
          <FaucetButton 
            signer={signer} 
            chainId={chainId}
            onSuccess={loadBalanceAndAllowance}
          />
        )}
      </div>

      {txStatus && (
        <div className="mt-6">
          <TransactionStatus status={txStatus} onClose={() => setTxStatus(null)} />
        </div>
      )}
    </div>
  );
}

export default BridgeForm;
