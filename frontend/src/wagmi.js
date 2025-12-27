import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, polygonAmoy } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Cross-Chain Bridge',
  projectId: 'YOUR_PROJECT_ID', // Отримаємо пізніше від WalletConnect
  chains: [baseSepolia, polygonAmoy],
  ssr: false,
});