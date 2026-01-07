import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getContract } from '../config/contracts';

function FaucetButton({ signer, chainId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [canClaim, setCanClaim] = useState(true);
  const [timeUntilClaim, setTimeUntilClaim] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkFaucetStatus();
    const interval = setInterval(checkFaucetStatus, 10000);
    return () => clearInterval(interval);
  }, [signer, chainId]);

  useEffect(() => {
    if (timeUntilClaim > 0) {
      const timer = setInterval(() => {
        setTimeUntilClaim(prev => {
          if (prev <= 1) {
            setCanClaim(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeUntilClaim]);

  const checkFaucetStatus = async () => {
    if (!signer || chainId !== 84532) return;
    
    try {
      const token1Config = getContract(chainId, 'Token1');
      if (!token1Config) return;

      const tokenContract = new ethers.Contract(
        token1Config.address,
        token1Config.abi,
        signer
      );

      const address = await signer.getAddress();
      const lastClaim = await tokenContract.lastClaim(address);
      
      if (lastClaim > 0) {
        const now = Math.floor(Date.now() / 1000);
        const nextClaim = Number(lastClaim) + (24 * 60 * 60);
        const timeLeft = nextClaim - now;
        
        if (timeLeft > 0) {
          setCanClaim(false);
          setTimeUntilClaim(timeLeft);
        } else {
          setCanClaim(true);
          setTimeUntilClaim(0);
        }
      }
    } catch (error) {
      console.error('Error checking faucet status:', error);
    }
  };

  const handleClaimFaucet = async () => {
    if (!signer || !canClaim) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const token1Config = getContract(chainId, 'Token1');
      const tokenContract = new ethers.Contract(
        token1Config.address,
        token1Config.abi,
        signer
      );

      const tx = await tokenContract.claimFaucet();
      setMessage('Claiming 100 TKN1...');
      
      await tx.wait();
      
      setMessage('✅ Successfully claimed 100 TKN1!');
      setCanClaim(false);
      setTimeUntilClaim(24 * 60 * 60);
      
      if (onSuccess) {
        onSuccess();
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Faucet error:', error);
      if (error.message.includes('Wait 24h')) {
        setMessage('❌ Please wait 24 hours between claims');
      } else {
        setMessage('❌ Failed to claim tokens');
      }
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (chainId !== 84532) return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-gray-800">Token Faucet</p>
          <p className="text-sm text-gray-600">Claim 100 TKN1 tokens</p>
        </div>
        <button
          onClick={handleClaimFaucet}
          disabled={loading || !canClaim}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Claiming...' : canClaim ? 'Claim Tokens' : 'Claimed'}
        </button>
      </div>
      
      {!canClaim && timeUntilClaim > 0 && (
        <p className="text-sm text-gray-600">
          Next claim available in: {formatTime(timeUntilClaim)}
        </p>
      )}
      
      {message && (
        <p className={`text-sm mt-2 ${message.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default FaucetButton;