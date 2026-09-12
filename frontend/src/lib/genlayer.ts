import { createClient } from "genlayer-js";
import { testnetAsimov } from "genlayer-js/chains";
import type { TransactionStatus } from "genlayer-js/types";

// CONTRACT_ADDRESS: dia chi RugRadar that da deploy o CP5, tren GenLayer Asimov Testnet
export const CONTRACT_ADDRESS = "0x8835d2E5a58AD6A73501CA18860Ab89cC3c85308" as const;

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function isWalletInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.ethereum;
}

export function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

// connectWallet: xin quyen truy cap tai khoan va dam bao dang o dung mang GenLayer Asimov Testnet
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) {
    throw new Error("No account selected.");
  }

  const targetChainIdHex = `0x${testnetAsimov.id.toString(16)}`;
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (currentChainId !== targetChainIdHex) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
    } catch (switchError: unknown) {
      const code = (switchError as { code?: number })?.code;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetChainIdHex,
              chainName: testnetAsimov.name,
              nativeCurrency: testnetAsimov.nativeCurrency,
              rpcUrls: testnetAsimov.rpcUrls.default.http,
              blockExplorerUrls: [testnetAsimov.blockExplorers?.default.url],
            },
          ],
        });
      } else {
        throw new Error("Please switch to GenLayer Asimov Testnet in your wallet.");
      }
    }
  }

  return accounts[0];
}

export async function getConnectedAccount(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ?? null;
}

// getClient: client doc (khong can vi) hoac client ky duoc (can dia chi vi dang ket noi)
export function getClient(account?: string) {
  const config: Record<string, unknown> = { chain: testnetAsimov };
  if (account) config.account = account;
  return createClient(config);
}

export type Facts = {
  resolved: boolean;
  holders_count: number;
  top_holder_percent: number;
  whale_holder_count: number;
  is_verified: boolean;
  has_pool: boolean;
  reserve_in_usd: string;
  volume_24h_usd: string;
  buys_24h: number;
  sells_24h: number;
  pool_age_hours: number;
};

export type Observations = {
  observed: boolean;
  has_mint: boolean;
  owner_can_pause: boolean;
  sell_blocked: boolean;
  high_fee: boolean;
  is_proxy: boolean;
};

export type Verdict = {
  resolved: boolean;
  risk_score: number;
  verdict: "SAFE" | "SUSPICIOUS" | "SCAM" | "UNRESOLVED";
  flags: string;
  observed_at: string;
};

// withTimeout: genlayer-js (ban browser) da xac nhan bi TREO VINH VIEN thay vi
// reject khi contract bao loi (vd KeyError cho token chua tung duoc scan_token) -
// khac han Node, noi loi nay reject binh thuong trong duoi 2s. Day la loi that
// cua thu vien o browser, khong sua duoc tu code minh, nen bat buoc phai chan
// bang timeout de UI khong treo vinh vien.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function toNumber(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function normalizeFacts(raw: Record<string, unknown>): Facts {
  return {
    resolved: Boolean(raw.resolved),
    holders_count: toNumber(raw.holders_count),
    top_holder_percent: toNumber(raw.top_holder_percent),
    whale_holder_count: toNumber(raw.whale_holder_count),
    is_verified: Boolean(raw.is_verified),
    has_pool: Boolean(raw.has_pool),
    reserve_in_usd: String(raw.reserve_in_usd ?? "0"),
    volume_24h_usd: String(raw.volume_24h_usd ?? "0"),
    buys_24h: toNumber(raw.buys_24h),
    sells_24h: toNumber(raw.sells_24h),
    pool_age_hours: toNumber(raw.pool_age_hours),
  };
}

function normalizeObservations(raw: Record<string, unknown>): Observations {
  return {
    observed: Boolean(raw.observed),
    has_mint: Boolean(raw.has_mint),
    owner_can_pause: Boolean(raw.owner_can_pause),
    sell_blocked: Boolean(raw.sell_blocked),
    high_fee: Boolean(raw.high_fee),
    is_proxy: Boolean(raw.is_proxy),
  };
}

function normalizeVerdict(raw: Record<string, unknown>): Verdict {
  return {
    resolved: Boolean(raw.resolved),
    risk_score: toNumber(raw.risk_score),
    verdict: String(raw.verdict ?? "UNRESOLVED") as Verdict["verdict"],
    flags: String(raw.flags ?? ""),
    observed_at: String(raw.observed_at ?? ""),
  };
}

// getVerdict: doc verdict da luu, tra ve null neu token nay CHUA TUNG duoc scan_token lan nao
const READ_TIMEOUT_MS = 15000; // du cho lan doc thanh cong cham nhat da thay (~12s), chan lan bi treo vinh vien

export async function getVerdict(tokenAddress: string): Promise<Verdict | null> {
  const client = getClient();
  try {
    const raw = await withTimeout(
      client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_verdict",
        args: [tokenAddress],
      }),
      READ_TIMEOUT_MS,
    );
    return normalizeVerdict(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getFacts(tokenAddress: string): Promise<Facts | null> {
  const client = getClient();
  try {
    const raw = await withTimeout(
      client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_facts",
        args: [tokenAddress],
      }),
      READ_TIMEOUT_MS,
    );
    return normalizeFacts(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getObservations(tokenAddress: string): Promise<Observations | null> {
  const client = getClient();
  try {
    const raw = await withTimeout(
      client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_observations",
        args: [tokenAddress],
      }),
      READ_TIMEOUT_MS,
    );
    return normalizeObservations(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

// runWrite: goi 1 method ghi (scan_token/observe_token/compute_verdict) va cho consensus xac nhan
async function runWrite(account: string, functionName: string, tokenAddress: string): Promise<void> {
  const client = getClient(account);
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: [tokenAddress],
    value: BigInt(0),
  });
  await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as TransactionStatus,
    retries: 40,
    interval: 5000,
  });
}

export type ScanStep = "scan_token" | "observe_token" | "compute_verdict";

// runFullScan: chay tuan tu 3 buoc, goi onStep truoc moi buoc de UI hien tien do
export async function runFullScan(
  account: string,
  tokenAddress: string,
  onStep: (step: ScanStep) => void,
): Promise<Verdict> {
  onStep("scan_token");
  await runWrite(account, "scan_token", tokenAddress);

  onStep("observe_token");
  await runWrite(account, "observe_token", tokenAddress);

  onStep("compute_verdict");
  await runWrite(account, "compute_verdict", tokenAddress);

  const verdict = await getVerdict(tokenAddress);
  if (!verdict) {
    throw new Error("Scan finished but the verdict could not be read back from chain.");
  }
  return verdict;
}

export function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}
