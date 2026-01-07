import { getChainById } from '../config/chains';

function WalletConnect({ account, chainId, onConnect, onDisconnect, loading }) {
  const chain = getChainById(chainId);
  
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {account ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">
                  {formatAddress(account)}
                </span>
              </div>
              {chain && (
                <div className="px-3 py-1 rounded-full text-sm font-medium"
                     style={{ backgroundColor: `${chain.color}20`, color: chain.color }}>
                  {chain.name}
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-500">Not connected</span>
          )}
        </div>
        
        <button
          onClick={account ? onDisconnect : onConnect}
          disabled={loading}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            account
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Connecting...' : account ? 'Disconnect' : 'Connect Wallet'}
        </button>
      </div>
    </div>
  );
}

export default WalletConnect;
