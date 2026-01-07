import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnect from './components/WalletConnect';
import NetworkSelector from './components/NetworkSelector';
import BridgeForm from './components/BridgeForm';
import RecentTransfers from './components/RecentTransfers';
import { CHAINS } from './config/chains';

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState(0); // 0: Base→Polygon, 1: Polygon→Base

  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      checkConnection();
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (!window.ethereum) return;
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer = await web3Provider.getSigner();
        const network = await web3Provider.getNetwork();
        
        setAccount(accounts[0]);
        setSigner(web3Signer);
        setChainId(Number(network.chainId));
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      setSigner(null);
    } else if (accounts[0] !== account) {
      setAccount(accounts[0]);
      checkConnection();
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use this application');
      return;
    }

    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();
      
      setAccount(accounts[0]);
      setSigner(web3Signer);
      setChainId(Number(network.chainId));
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setChainId(null);
  };

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error) {
      if (error.code === 4902) {
        const chain = Object.values(CHAINS).find(c => c.id === targetChainId);
        if (chain) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.default.http[0]],
                blockExplorerUrls: [chain.blockExplorers.default.url]
              }],
            });
          } catch (addError) {
            console.error('Error adding chain:', addError);
          }
        }
      } else {
        console.error('Error switching chain:', error);
      }
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Cross-Chain Bridge
          </h1>
          <p className="text-gray-600">
            Bridge tokens between Base Sepolia and Polygon Amoy
          </p>
        </div>

        <div className="mb-6">
          <WalletConnect
            account={account}
            chainId={chainId}
            onConnect={connectWallet}
            onDisconnect={disconnectWallet}
            loading={loading}
          />
        </div>

        {account ? (
          <div className="space-y-6">
            <NetworkSelector
              currentChainId={chainId}
              selectedDirection={selectedDirection}
              onDirectionChange={setSelectedDirection}
              onSwitchNetwork={switchNetwork}
            />

            <BridgeForm
              account={account}
              chainId={chainId}
              signer={signer}
              provider={provider}
              selectedDirection={selectedDirection}
              onSwitchNetwork={switchNetwork}
            />

            <RecentTransfers account={account} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 text-lg">
              Please connect your wallet to start bridging tokens
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;