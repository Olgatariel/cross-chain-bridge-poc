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
          // Create FRESH provider to avoid caching
          const freshProvider = new ethers.BrowserProvider(window.ethereum);
          
          const tokenContract = new ethers.Contract(
            token1Config.address,
            token1Config.abi,
            freshProvider
          );
          
          // Get real user balance
          const bal = await tokenContract.balanceOf(account);
          const allow = await tokenContract.allowance(account, tokenConsumerConfig.address);
          
          console.log('📊 Base Balance loaded:', ethers.formatEther(bal), 'TKN1');
          
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
          // Create FRESH provider
          const freshProvider = new ethers.BrowserProvider(window.ethereum);
          
          const tokenContract = new ethers.Contract(
            wrappedTokenConfig.address,
            wrappedTokenConfig.abi,
            freshProvider
          );
          
          const bal = await tokenContract.balanceOf(account);
          
          console.log('📊 Polygon Balance loaded:', ethers.formatEther(bal), 'wTKN1');
          
          setBalance(ethers.formatEther(bal));
          setNeedsApproval(false);
        }
      }
    } catch (error) {
      console.error('❌ Error loading balance:', error);
    }
  };

  const handleApprove = async () => {
    if (!signer || !amount) return;
    
    setLoading(true);
    setTxStatus({ status: 'pending', message: 'Approving tokens...' });
    
    try {
      const token1Config = getContract(chainId, 'Token1');
      const tokenConsumerConfig = getContract(chainId, 'TokenConsumer');
      
      // Create FRESH provider and signer
      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      const freshSigner = await freshProvider.getSigner();
      
      const tokenContract = new ethers.Contract(
        token1Config.address,
        token1Config.abi,
        freshSigner
      );
      
      const amountWei = ethers.parseEther(amount);
      
      // Estimate gas for approval
      console.log('🔍 Estimating approval gas...');
      let gasEstimate;
      try {
        gasEstimate = await tokenContract.approve.estimateGas(tokenConsumerConfig.address, amountWei);
        console.log('⛽ Estimated gas:', gasEstimate.toString());
      } catch (estimateError) {
        console.error('❌ Gas estimation failed:', estimateError);
        
        if (estimateError.message.includes('insufficient funds')) {
          throw new Error('Insufficient ETH for gas fees');
        } else {
          throw new Error('Approval will fail. Please try refreshing the page.');
        }
      }
      
      const tx = await tokenContract.approve(tokenConsumerConfig.address, amountWei, {
        gasLimit: gasEstimate * 120n / 100n // +20% buffer
      });
      
      setTxStatus({ 
        status: 'pending', 
        message: 'Waiting for approval confirmation...',
        txHash: tx.hash,
        chainId
      });
      
      const receipt = await tx.wait();
      console.log('✅ Approval confirmed:', receipt.transactionHash);
      
      setTxStatus({ 
        status: 'success', 
        message: 'Approval successful!',
        txHash: tx.hash,
        chainId
      });
      
      await loadBalanceAndAllowance();
    } catch (error) {
      console.error('❌ Approval error:', error);
      
      // HUMAN-READABLE ERROR MESSAGES
      let errorMessage = 'Approval failed';
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = '❌ You rejected the approval';
      } else if (error.message.includes('Insufficient ETH')) {
        errorMessage = error.message;
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = '❌ Insufficient ETH for gas fees';
      } else if (error.code === -32603 || error.message.includes('Internal JSON-RPC')) {
        errorMessage = '❌ Network connection error. Try:\n1. Refresh the page\n2. Reset Account in MetaMask (Settings → Advanced)';
      } else if (error.reason) {
        errorMessage = `❌ Contract error: ${error.reason}`;
      } else if (error.message) {
        const shortMessage = error.message.substring(0, 150);
        errorMessage = `❌ ${shortMessage}${error.message.length > 150 ? '...' : ''}`;
      }
      
      setTxStatus({ 
        status: 'error', 
        message: errorMessage
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
      console.error('❌ Bridge error:', error);
      
      // HUMAN-READABLE ERROR MESSAGES
      let errorMessage = 'Bridge transaction failed';
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = '❌ You rejected the transaction';
      } else if (error.message.includes('Insufficient')) {
        errorMessage = error.message; // Already human-readable
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = '❌ Insufficient funds for gas fees';
      } else if (error.code === -32603 || error.message.includes('Internal JSON-RPC')) {
        errorMessage = '❌ Network connection error. Try refreshing the page or resetting your MetaMask account.';
      } else if (error.reason) {
        errorMessage = `❌ Contract error: ${error.reason}`;
      } else if (error.message) {
        const shortMessage = error.message.substring(0, 150);
        errorMessage = `❌ ${shortMessage}${error.message.length > 150 ? '...' : ''}`;
      }
      
      setTxStatus({ 
        status: 'error', 
        message: errorMessage
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
    
    try {
      const tokenConsumerConfig = getContract(chainId, 'TokenConsumer');
      const token1Config = getContract(chainId, 'Token1');
      
      // Create FRESH provider and signer
      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      const freshSigner = await freshProvider.getSigner();
      
      const consumerContract = new ethers.Contract(
        tokenConsumerConfig.address,
        tokenConsumerConfig.abi,
        freshSigner
      );
      
      const tokenContract = new ethers.Contract(
        token1Config.address,
        token1Config.abi,
        freshProvider
      );
      
      const amountWei = ethers.parseEther(amount);
      
      // Check balance
      const currentBalance = await tokenContract.balanceOf(account);
      if (currentBalance < amountWei) {
        throw new Error(`Insufficient tokens. Your balance: ${ethers.formatEther(currentBalance)} TKN1`);
      }
      
      // Check allowance
      const currentAllowance = await tokenContract.allowance(account, tokenConsumerConfig.address);
      if (currentAllowance < amountWei) {
        throw new Error('Please click "Approve Tokens" first');
      }
      
      // Estimate gas
      console.log('🔍 Estimating gas...');
      let gasEstimate;
      try {
        gasEstimate = await consumerContract.deposit.estimateGas(amountWei);
        console.log('⛽ Estimated gas:', gasEstimate.toString());
      } catch (estimateError) {
        console.error('❌ Gas estimation failed:', estimateError);
        
        if (estimateError.message.includes('insufficient funds')) {
          throw new Error('Insufficient ETH for gas fees');
        } else if (estimateError.reason) {
          throw new Error(`Contract error: ${estimateError.reason}`);
        } else {
          throw new Error('Transaction will fail. Please try refreshing the page.');
        }
      }
      
      const tx = await consumerContract.deposit(amountWei, {
        gasLimit: gasEstimate * 120n / 100n // +20% buffer
      });
      
      setTxStatus({ 
        status: 'pending', 
        message: 'Locking tokens on Base...',
        txHash: tx.hash,
        chainId
      });
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.transactionHash);
      
      setTxStatus({ 
        status: 'processing', 
        message: 'Tokens locked! Relayer will mint wrapped tokens on Polygon (~10-30s)...',
        txHash: tx.hash,
        chainId
      });
      
      setAmount('');
      
      // Update balance IMMEDIATELY
      await loadBalanceAndAllowance();
      
      // Wait 15 seconds and show success
      setTimeout(() => {
        setTxStatus({
          status: 'success',
          message: '✅ Bridge complete! Check your Polygon wallet - wrapped tokens should appear.',
          txHash: tx.hash,
          chainId
        });
        
        // Update again after 5 seconds
        setTimeout(() => {
          loadBalanceAndAllowance();
        }, 5000);
      }, 15000);
      
    } catch (error) {
      console.error('❌ Deposit error:', error);
      
      // HUMAN-READABLE ERROR MESSAGES
      let errorMessage = 'Transaction failed';
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = '❌ You rejected the transaction';
      } else if (error.message.includes('Insufficient tokens')) {
        errorMessage = error.message;
      } else if (error.message.includes('Approve Tokens')) {
        errorMessage = error.message;
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = '❌ Insufficient ETH for gas fees';
      } else if (error.code === -32603 || error.message.includes('Internal JSON-RPC')) {
        errorMessage = '❌ Network connection error. Try:\n1. Refresh the page\n2. Reset Account in MetaMask (Settings → Advanced)';
      } else if (error.reason) {
        errorMessage = `❌ Contract error: ${error.reason}`;
      } else if (error.message) {
        const shortMessage = error.message.substring(0, 150);
        errorMessage = `❌ ${shortMessage}${error.message.length > 150 ? '...' : ''}`;
      }
      
      setTxStatus({ 
        status: 'error', 
        message: errorMessage
      });
    }
  };

  const handleWithdraw = async () => {
    setTxStatus({ 
      status: 'pending', 
      message: 'Initiating withdrawal on Polygon...' 
    });
    
    try {
      const bridgeConfig = getContract(chainId, 'BridgeMintBurn');
      
      // Create FRESH provider and signer
      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      const freshSigner = await freshProvider.getSigner();
      
      const bridgeContract = new ethers.Contract(
        bridgeConfig.address,
        bridgeConfig.abi,
        freshSigner
      );
      
      const amountWei = ethers.parseEther(amount);
      
      // Check balance before sending
      const wrappedTokenConfig = getContract(chainId, 'WrappedToken1');
      const tokenContract = new ethers.Contract(
        wrappedTokenConfig.address,
        wrappedTokenConfig.abi,
        freshProvider
      );
      
      const currentBalance = await tokenContract.balanceOf(account);
      
      if (currentBalance < amountWei) {
        throw new Error(`Insufficient tokens. Your balance: ${ethers.formatEther(currentBalance)} wTKN1`);
      }
      
      // Estimate gas
      console.log('🔍 Estimating gas...');
      let gasEstimate;
      try {
        gasEstimate = await bridgeContract.withdraw.estimateGas(amountWei);
        console.log('⛽ Estimated gas:', gasEstimate.toString());
      } catch (estimateError) {
        console.error('❌ Gas estimation failed:', estimateError);
        
        // Check different error causes
        if (estimateError.message.includes('insufficient funds')) {
          throw new Error('Insufficient MATIC for gas fees. Get MATIC from faucet.');
        } else if (estimateError.reason) {
          throw new Error(`Contract error: ${estimateError.reason}`);
        } else {
          throw new Error('Transaction will fail. Please try refreshing the page.');
        }
      }
      
      const tx = await bridgeContract.withdraw(amountWei, {
        gasLimit: gasEstimate * 120n / 100n // +20% buffer
      });
      
      setTxStatus({ 
        status: 'pending', 
        message: 'Burning wrapped tokens...',
        txHash: tx.hash,
        chainId
      });
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.transactionHash);
      
      setTxStatus({ 
        status: 'processing', 
        message: 'Tokens burned! Relayer will release original tokens on Base (~10-30s)...',
        txHash: tx.hash,
        chainId
      });
      
      setAmount('');
      
      // Update balance IMMEDIATELY after burning
      await loadBalanceAndAllowance();
      
      // Wait 15 seconds and show success
      setTimeout(() => {
        setTxStatus({
          status: 'success',
          message: '✅ Bridge complete! Check your Base wallet - tokens should appear.',
          txHash: tx.hash,
          chainId
        });
        
        // Update again after 5 seconds
        setTimeout(() => {
          loadBalanceAndAllowance();
        }, 5000);
      }, 15000);
      
    } catch (error) {
      console.error('❌ Withdrawal error:', error);
      
      // HUMAN-READABLE ERROR MESSAGES
      let errorMessage = 'Transaction failed';
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = '❌ You rejected the transaction';
      } else if (error.message.includes('Insufficient tokens')) {
        errorMessage = error.message; // Already human-readable
      } else if (error.message.includes('Insufficient MATIC')) {
        errorMessage = error.message; // Already human-readable
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = '❌ Insufficient MATIC for gas fees. Get MATIC from faucet: https://faucet.polygon.technology/';
      } else if (error.code === -32603 || error.message.includes('Internal JSON-RPC')) {
        errorMessage = '❌ Network connection error. Try:\n1. Refresh the page\n2. Reset Account in MetaMask (Settings → Advanced)\n3. Change RPC endpoint in MetaMask';
      } else if (error.reason) {
        errorMessage = `❌ Contract error: ${error.reason}`;
      } else if (error.message) {
        // Shorten technical messages
        const shortMessage = error.message.substring(0, 150);
        errorMessage = `❌ ${shortMessage}${error.message.length > 150 ? '...' : ''}`;
      }
      
      setTxStatus({ 
        status: 'error', 
        message: errorMessage
      });
    }
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
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">
            {parseFloat(balance).toFixed(4)} {isOnBase ? 'TKN1' : 'wTKN1'}
          </span>
          <button
            onClick={loadBalanceAndAllowance}
            className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
            title="Refresh balance"
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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