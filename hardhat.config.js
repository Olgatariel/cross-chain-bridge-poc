require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: false // Set to true if contracts are too large
    }
  },
  
  networks: {
    // Local hardhat network for testing
    hardhat: {
      chainId: 31337,
      // Uncomment to fork a network for testing
      // forking: {
      //   url: process.env.BASE_SEPOLIA_RPC,
      //   blockNumber: 14390000
      // }
    },
    
    // Base Sepolia Testnet
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gasPrice: "auto",
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.basescan.org",
          apiKey: process.env.BASESCAN_API_KEY
        }
      }
    },
    
    // Polygon Amoy Testnet  
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
      gasPrice: "auto",
      verify: {
        etherscan: {
          apiUrl: "https://api-amoy.polygonscan.com",
          apiKey: process.env.POLYGONSCAN_API_KEY
        }
      }
    }
  },
  
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  
  // Paths configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  // Mocha test configuration
  mocha: {
    timeout: 40000
  }
};