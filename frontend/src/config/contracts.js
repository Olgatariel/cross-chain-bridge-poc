// TODO: Update these addresses with your deployed contract addresses
// You can find them in ../deployments/base.json and ../deployments/polygon.json

export const CONTRACTS = {
  BASE_SEPOLIA: {
    Token1: {
      address: '0x6e7406e945B6a41b0B9e15F5F139a521d4bbae41',
      abi: [
        'function balanceOf(address owner) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function claimFaucet() external',
        'function lastClaim(address) view returns (uint256)',
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)'
      ]
    },
    TokenConsumer: {
      address: '0x66A58371c29DcDca9991C2f27df6aAeF4EbAe0F0',
      abi: [
        'function deposit(uint256 amount) external',
        'function currentNonce() view returns (uint256)',
        'event DepositIntent(address indexed user, uint256 amount, uint256 nonce)',
        'event ReleaseExecuted(address indexed user, uint256 amount, uint256 nonce)'
      ]
    }
  },
  POLYGON_AMOY: {
    WrappedToken1: {
      address: '0x9a801c2fF18234ce990c98d253Ebe6c49EB8eBEa',
      abi: [
        'function balanceOf(address owner) view returns (uint256)',
        'event TokensMinted(address indexed to, uint256 amount)',
        'event TokensBurned(address indexed from, uint256 amount)'
      ]
    },
    BridgeMintBurn: {
      address: '0xFc454442344EcF8502ddC7Fb8Ea90eb1D3178e1C',
      abi: [
        'function withdraw(uint256 amount) external',
        'function withdrawNonce() view returns (uint256)',
        'event WrappedMinted(address indexed to, uint256 amount, uint256 indexed depositNonce)',
        'event WithdrawIntent(address indexed user, uint256 amount, uint256 indexed withdrawNonce)'
      ]
    }
  }
};

export const getContract = (chainId, contractName) => {
  if (chainId === 84532) {
    return CONTRACTS.BASE_SEPOLIA[contractName];
  } else if (chainId === 80002) {
    return CONTRACTS.POLYGON_AMOY[contractName];
  }
  return null;
};