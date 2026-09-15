import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { TransactionStatus } from "genlayer-js/types";

// CONTRACT_ADDRESS: dia chi RugRadar tren GenLayer Studionet. Chuyen tu Asimov sang
// vi ca Asimov lan Bradbury nghen tang xu ly giao dich (error-log muc 20, 22).
export const CONTRACT_ADDRESS = "0x36A0a2469473cEc4f2573DA07F386092F58FE8c7" as const;

// DEMO NOTE (quyet dinh co chu dinh, KHONG phai pattern production):
// App nay tu tra phi quet ho nguoi xem bang 1 vi rieng CHI dung cho demo,
// khong chua tai san that (chi la GEN testnet, xin tu faucet). Vi vay day la
// muc rui ro chap nhan duoc cho ban nop hackathon - KHONG lam vay voi bat ky
// vi nao co tai san that, vi key nay se lo cho bat ky ai xem duoc source cua
// trang web (nguoi dung khong ky gi ca, khong can vi rieng).
const DEMO_PRIVATE_KEY = import.meta.env.VITE_DEPLOYER_PRIVATE_KEY as string | undefined;

// getDemoAccount: tao signer tu private key demo, ky giao dich thay cho nguoi xem
function getDemoAccount() {
  if (!DEMO_PRIVATE_KEY) {
    throw new Error(
      "Demo wallet is not configured. Set VITE_DEPLOYER_PRIVATE_KEY in frontend/.env.",
    );
  }
  return createAccount(DEMO_PRIVATE_KEY as `0x${string}`);
}

// getClient: client doc (khong can vi) hoac client ky duoc voi vi demo cua app
export function getClient(withSigner = false) {
  const config: Record<string, unknown> = { chain: studionet };
  if (withSigner) config.account = getDemoAccount();
  return createClient(config);
}

export type Facts = {
  resolved: boolean;
  holder_evidence: boolean; // false = Blockscout khong doc duoc luc scan
  token_name: string;
  token_symbol: string;
  holders_count: number;
  top_holder_percent: number;
  top10_percent: number;
  whale_holder_count: number;
  is_verified: boolean;
  has_pool: boolean;
  price_usd: string;
  market_cap_usd: string;
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
    // contract cu khong co truong nay: coi nhu co du bang chung holder
    holder_evidence: raw.holder_evidence === undefined ? true : Boolean(raw.holder_evidence),
    token_name: String(raw.token_name ?? ""),
    token_symbol: String(raw.token_symbol ?? ""),
    holders_count: toNumber(raw.holders_count),
    top_holder_percent: toNumber(raw.top_holder_percent),
    top10_percent: toNumber(raw.top10_percent),
    whale_holder_count: toNumber(raw.whale_holder_count),
    is_verified: Boolean(raw.is_verified),
    has_pool: Boolean(raw.has_pool),
    price_usd: String(raw.price_usd ?? "0"),
    market_cap_usd: String(raw.market_cap_usd ?? "0"),
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

// previewVerdict: SO THAM. simulateWriteContract chay thu preview_token tren node leader
// (leaderOnly), khong dong thuan, khong ghi chain, khong can vi: co ket qua trong vai
// giay. Khong co loi khai AI. readContract KHONG dung duoc: studionet chan goi ham ghi
// theo kieu "read". Tra null neu loi/qua han, UI chi viec cho ban an that.
const PREVIEW_TIMEOUT_MS = 60000;

export async function previewVerdict(tokenAddress: string): Promise<Verdict | null> {
  const client = getClient();
  const now = new Date().toISOString();
  try {
    const raw = await withTimeout(
      client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName: "preview_token",
        // gio that tu trinh duyet: node chay thu dung ngay gia nen tuoi pool se sai
        args: [tokenAddress, now],
        leaderOnly: true,
      }),
      PREVIEW_TIMEOUT_MS,
    );
    // ket qua ve dang Map, doi sang object thuong cho normalizeVerdict
    const record = raw instanceof Map ? Object.fromEntries(raw) : (raw as Record<string, unknown>);
    return { ...normalizeVerdict(record), observed_at: now };
  } catch {
    return null;
  }
}

// previewFacts: giong previewVerdict nhung tra Facts (MC, gia, holder...) thay vi Verdict.
// Dung khi DA CO ban an chinh thuc roi ma nguoi xem van muon so MOI NHAT: diem/flags giu
// nguyen tu ban an da dong thuan, chi rieng cac con so nay duoc lam tuoi moi lan check.
export async function previewFacts(tokenAddress: string): Promise<Facts | null> {
  const client = getClient();
  try {
    const raw = await withTimeout(
      client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName: "preview_facts",
        args: [tokenAddress, new Date().toISOString()],
        leaderOnly: true,
      }),
      PREVIEW_TIMEOUT_MS,
    );
    const record = raw instanceof Map ? Object.fromEntries(raw) : (raw as Record<string, unknown>);
    return normalizeFacts(record);
  } catch {
    return null;
  }
}

// runWrite: goi 1 method ghi (scan_token/observe_token/compute_verdict) bang vi demo cua app, cho consensus xac nhan
async function runWrite(functionName: string, tokenAddress: string): Promise<void> {
  const client = getClient(true);
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

// runFullScan: chay tuan tu 3 buoc bang vi demo cua app, goi onStep truoc moi buoc de UI hien tien do
export async function runFullScan(
  tokenAddress: string,
  onStep: (step: ScanStep) => void,
): Promise<Verdict> {
  // scan_token (bang chung) va observe_token (loi khai AI) khong phu thuoc nhau nen gui
  // CUNG LUC. Da do that tren studionet: 2 tx tu cung 1 vi van tach biet, tong thoi gian
  // ~70s -> ~56s.
  onStep("scan_token");
  await Promise.all([runWrite("scan_token", tokenAddress), runWrite("observe_token", tokenAddress)]);

  onStep("compute_verdict");
  await runWrite("compute_verdict", tokenAddress);

  const verdict = await getVerdict(tokenAddress);
  if (!verdict) {
    throw new Error("Scan finished but the verdict could not be read back from chain.");
  }
  return verdict;
}

export function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}
