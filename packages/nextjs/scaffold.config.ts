import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "IZYEU2cWBgnFmgiTAgpWD";

const scaffoldConfig = {
  // The networks on which your DApp is live.
  // foundry (local Anvil) first for iteration speed; baseSepolia is the hackathon's
  // primary testnet target; sepolia kept alongside for L1-only integrations.
  // Add/remove chains here — the frontend (network selector, RPC, burner wallet
  // visibility) derives entirely from this array, nothing is hardcoded elsewhere.
  targetNetworks: [chains.foundry, chains.baseSepolia, chains.sepolia],
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: 3000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    // Example:
    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when ALL target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  //
  // "allNetworks" rather than the stock "localNetworksOnly" because
  // targetNetworks above intentionally includes testnets — under
  // "localNetworksOnly" the burner disappears entirely (the check is *every*
  // target being local), which costs you the fastest way to click through a
  // local demo without MetaMask. The burner is clearly labelled in the connect
  // modal; just don't send anything you care about to one.
  burnerWalletMode: "allNetworks",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
