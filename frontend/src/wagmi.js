import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, polygonAmoy } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Cross-Chain Bridge',
  projectId: 'c0592a358c9b4c2a99ad058ff5f8c9a2', 
  chains: [baseSepolia, polygonAmoy],
  ssr: false,
});