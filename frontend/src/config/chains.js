export const CHAINS = {
    BASE_SEPOLIA: {
      id: 84532,
      name: 'Base Sepolia',
      network: 'base-sepolia',
      nativeCurrency: {
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH',
      },
      rpcUrls: {
        default: { http: ['https://sepolia.base.org'] },
        public: { http: ['https://sepolia.base.org'] },
      },
      blockExplorers: {
        default: { 
          name: 'BaseScan', 
          url: 'https://sepolia.basescan.org' 
        },
      },
      color: '#0052FF'
    },
    POLYGON_AMOY: {
      id: 80002,
      name: 'Polygon Amoy',
      network: 'polygon-amoy',
      nativeCurrency: {
        decimals: 18,
        name: 'MATIC',
        symbol: 'MATIC',
      },
      rpcUrls: {
        default: { http: ['https://rpc-amoy.polygon.technology'] },
        public: { http: ['https://rpc-amoy.polygon.technology'] },
      },
      blockExplorers: {
        default: { 
          name: 'PolygonScan', 
          url: 'https://amoy.polygonscan.com' 
        },
      },
      color: '#8247E5'
    }
  };
  
  export const getChainById = (chainId) => {
    return Object.values(CHAINS).find(chain => chain.id === chainId);
  };
  
  export const getExplorerUrl = (chainId, txHash) => {
    const chain = getChainById(chainId);
    return chain ? `${chain.blockExplorers.default.url}/tx/${txHash}` : null;
  };