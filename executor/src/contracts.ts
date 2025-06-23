import { Wallet, JsonRpcProvider, Contract } from 'ethers';
import PerpZK_ABI from './abis/PerpEngineZK.json' assert { type: 'json' };
export const provider = new JsonRpcProvider(process.env.RPC_URL);
export const signer   = new Wallet(process.env.EXECUTOR_PK!, provider);
export const perpZK = new Contract(
  process.env.PERP_ADDR!,   // address of deployed PerpEngineZK
  PerpZK_ABI,
  signer
);

