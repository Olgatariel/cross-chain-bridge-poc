import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getContract } from '../config/contracts';
import { CHAINS, getExplorerUrl } from '../config/chains';

function RecentTransfers({ account }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      loadTransfers();
    }
  }, [account]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const baseTransfers = await loadBaseTransfers();
      const polygonTransfers = await loadPolygonTransfers();
      
      const allTransfers = [...baseTransfers, ...polygonTransfers]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
      
      setTransfers(allTransfers);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBaseTransfers = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(CHAINS.BASE_SEPOLIA.rpcUrls.default.http[0]);
      const tokenConsumerConfig = getContract(CHAINS.BASE_SEPOLIA.id, 'TokenConsumer');
      
      if (!tokenConsumerConfig) return [];
      
      const contract = new ethers.Contract(
        tokenConsumerConfig.address,
        tokenConsumerConfig.abi,
        provider
      );

      const filter = contract.filters.DepositIntent(account);
      const events = await contract.queryFilter(filter, -10000);
      
      return await Promise.all(events.map(async (event) => {
        const block = await event.getBlock();
        return {
          type: 'deposit',
          direction: 'Base → Polygon',
          amount: ethers.formatEther(event.args.amount),
          nonce: event.args.nonce.toString(),
          txHash: event.transactionHash,
          chainId: CHAINS.BASE_SEPOLIA.id,
          timestamp: block.timestamp,
          status: 'completed'
        };
      }));
    } catch (error) {
      console.error('Error loading Base transfers:', error);
      return [];
    }
  };

  const loadPolygonTransfers = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(CHAINS.POLYGON_AMOY.rpcUrls.default.http[0]);
      const bridgeConfig = getContract(CHAINS.POLYGON_AMOY.id, 'BridgeMintBurn');
      
      if (!bridgeConfig) return [];
      
      const contract = new ethers.Contract(
        bridgeConfig.address,
        bridgeConfig.abi,
        provider
      );

      const filter = contract.filters.WithdrawIntent(account);
      const events = await contract.queryFilter(filter, -10000);
      
      return await Promise.all(events.map(async (event) => {
        const block = await event.getBlock();
        return {
          type: 'withdrawal',
          direction: 'Polygon → Base',
          amount: ethers.formatEther(event.args.amount),
          nonce: event.args.withdrawNonce.toString(),
          txHash: event.transactionHash,
          chainId: CHAINS.POLYGON_AMOY.id,
          timestamp: block.timestamp,
          status: 'completed'
        };
      }));
    } catch (error) {
      console.error('Error loading Polygon transfers:', error);
      return [];
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading && transfers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Recent Transfers</h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading transfers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">Recent Transfers</h3>
        <button
          onClick={loadTransfers}
          disabled={loading}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {transfers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No transfers found</p>
          <p className="text-sm text-gray-400 mt-2">
            Your bridge transactions will appear here
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Direction</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Amount</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Time</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer, index) => (
                <tr key={`${transfer.txHash}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      transfer.type === 'deposit' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {transfer.direction}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium text-gray-800">
                    {parseFloat(transfer.amount).toFixed(4)} {transfer.type === 'deposit' ? 'TKN1' : 'wTKN1'}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    {formatDate(transfer.timestamp)}
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {transfer.status}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <a
                      href={getExplorerUrl(transfer.chainId, transfer.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RecentTransfers;