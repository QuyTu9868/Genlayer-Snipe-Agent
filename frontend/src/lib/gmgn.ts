// gmgn.ts: doc du lieu THI TRUONG tu GMGN OpenAPI, CHI de hien thi.
//
// Ranh gioi quan trong: khong mot con so nao o day duoc tham gia cham diem.
// Ban an (risk score, verdict, flags) sinh ra tu contract on-chain, noi moi
// validator tu doc bang chung va tu dong thuan. GMGN chi la boi canh thi
// truong de nguoi xem doi chieu, va co the vang mat ma trang van chay binh thuong.
//
// GMGN cho goi thang tu trinh duyet: header Access-Control-Allow-Origin la "*"
// va ho liet ke dich danh X-APIKEY trong Access-Control-Allow-Headers.
// Nhom endpoint doc chi can X-APIKEY; cac lenh giao dich doi them X-Signature
// ky bang private key PEM - thu KHONG bao gio duoc dua vao bundle nay.
const GMGN_BASE = "https://openapi.gmgn.ai";
const GMGN_CHAIN = "robinhood";
const GMGN_API_KEY = import.meta.env.VITE_GMGN_API_KEY as string | undefined;

export type MarketData = {
  name: string;
  symbol: string;
  logo: string;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  buys24h: number;
  sells24h: number;
  holderCount: number;
  totalSupply: number;
  createdAt: number; // unix giay
  // phan security, undefined neu endpoint do that bai rieng
  security?: {
    isHoneypot: boolean;
    isOpenSource: boolean;
    isBlacklist: boolean;
    isRenounced: boolean;
    buyTaxPercent: number;
    sellTaxPercent: number;
    top10Percent: number;
  };
};

export function isGmgnConfigured(): boolean {
  return Boolean(GMGN_API_KEY);
}

// callGmgn: 1 request co xac thuc. client_id chi la UUID ngau nhien sinh tai
// cho, timestamp la unix giay - khong co gi bi mat ngoai chinh API key.
async function callGmgn(path: string, address: string): Promise<Record<string, unknown>> {
  if (!GMGN_API_KEY) throw new Error("GMGN API key is not configured");
  const query = new URLSearchParams({
    address,
    chain: GMGN_CHAIN,
    client_id: crypto.randomUUID(),
    timestamp: String(Math.floor(Date.now() / 1000)),
  });
  const res = await fetch(`${GMGN_BASE}${path}?${query}`, {
    headers: { "X-APIKEY": GMGN_API_KEY },
  });
  if (!res.ok) throw new Error(`GMGN ${path} failed: HTTP ${res.status}`);
  const body = (await res.json()) as { code?: number; data?: Record<string, unknown> };
  if (body.code !== 0 || !body.data) throw new Error(`GMGN ${path} returned code ${body.code}`);
  return body.data;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// GMGN tra ty le dang 0-1 ("0.0004" = 0.04%), doi sang phan tram de hien thi
function ratioToPercent(value: unknown): number {
  return num(value) * 100;
}

// getMarketData: gop token/info + token/security. Han muc cua GMGN la 1
// request/giay va DUNG CHUNG cho moi nguoi dang xem trang, nen 2 loi goi phai
// noi tiep chu khong song song. Neu security hong thi van tra ve phan info.
export async function getMarketData(tokenAddress: string): Promise<MarketData> {
  const info = await callGmgn("/v1/token/info", tokenAddress);
  const price = (info.price ?? {}) as Record<string, unknown>;

  const totalSupply = num(info.total_supply);
  const priceUsd = num(price.price);

  let security: MarketData["security"];
  try {
    await new Promise((r) => setTimeout(r, 1100)); // ton trong han muc 1 req/s
    const sec = await callGmgn("/v1/token/security", tokenAddress);
    security = {
      isHoneypot: Boolean(sec.is_honeypot),
      isOpenSource: Boolean(sec.is_open_source),
      isBlacklist: Boolean(sec.is_blacklist),
      isRenounced: Boolean(sec.is_renounced),
      buyTaxPercent: ratioToPercent(sec.buy_tax),
      sellTaxPercent: ratioToPercent(sec.sell_tax),
      top10Percent: ratioToPercent(sec.top_10_holder_rate),
    };
  } catch {
    security = undefined; // khoi security bien mat, phan con lai van hien
  }

  return {
    name: String(info.name ?? ""),
    symbol: String(info.symbol ?? ""),
    logo: String(info.logo ?? ""),
    priceUsd,
    marketCapUsd: priceUsd * totalSupply,
    liquidityUsd: num(info.liquidity),
    volume24hUsd: num(price.volume_24h),
    buys24h: num(price.buys_24h),
    sells24h: num(price.sells_24h),
    holderCount: num(info.holder_count),
    totalSupply,
    // GMGN hien tuoi tinh tu luc MO GIAO DICH (open_timestamp, vd token tot nghiep
    // launchpad), khong phai luc tao contract. Token chua mo thi moi lui ve creation.
    createdAt: num(info.open_timestamp) || num(info.creation_timestamp),
    security,
  };
}
