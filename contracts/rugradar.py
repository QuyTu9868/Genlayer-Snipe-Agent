# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from datetime import datetime
from dataclasses import dataclass
from genlayer import *

BLOCKSCOUT_BASE = "https://robinhoodchain.blockscout.com/api/v2"
GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2/networks/robinhood"

MAX_SOURCE_CHARS = 8000  # gioi han source code dua vao prompt

# Dia chi dot token: token gui vao day la bi huy vinh vien, khong phai nguoi nam giu.
# Khong phai contract nen truoc day bi tinh nham la "vi ca nhan lon nhat".
BURN_ADDRESSES = (
    "0x000000000000000000000000000000000000dead",
    "0x0000000000000000000000000000000000000000",
)

# Blockscout gan is_contract=true cho VI THONG MINH cua nguoi that: EOA uy quyen
# code theo EIP-7702, va vi proxy toi gian ERC-7760. GMGN coi chung la nguoi
# (addr_type=0). Loai chung ra lam top 10 cua token 富贵 lech 10% vs 14.26% GMGN.
SMART_WALLET_PROXIES = ("eip7702", "erc7760")


def _is_person(address: dict) -> bool:
    # Nguoi = khong phai dia chi dot, va (khong phai contract HOAC la vi thong minh)
    if str(address.get("hash", "")).lower() in BURN_ADDRESSES:
        return False
    if not address.get("is_contract", False):
        return True
    return address.get("proxy_type") in SMART_WALLET_PROXIES


def _normalize_address(token_address) -> str:
    # Mot so client (vd genlayer CLI) tu suy luan chuoi hex 40 ky tu thanh kieu
    # Address thay vi str. Address co .as_hex chu khong co .lower().
    if hasattr(token_address, "as_hex"):
        return token_address.as_hex.lower()
    return str(token_address).lower()

OBSERVATION_PROMPT = """You are auditing the Solidity source code of an ERC-20 token contract.
Read the source code below and answer what the code ACTUALLY does, not what
comments or names claim it does.

Source code:
{source_code}

Answer these yes/no questions:
1. has_mint: can the owner or any privileged role mint (create) new tokens after deployment?
2. owner_can_pause: can the owner or any privileged role pause or block transfers for all holders?
3. sell_blocked: does the code contain logic that can block or prevent selling (blacklist, one-way transfer restriction, trading toggle that only allows buys)?
4. high_fee: does the code charge a transfer/buy/sell fee that is unusually high (over 10 percent) or that the owner can change arbitrarily?
5. is_proxy: is this a proxy contract (delegatecall to an implementation address that can be changed)?

Respond only in this exact JSON format, nothing else, no markdown, no explanation:
{{"has_mint": bool, "owner_can_pause": bool, "sell_blocked": bool, "high_fee": bool, "is_proxy": bool}}
"""


@allow_storage
@dataclass
class Facts:
    # Quan sat KHACH QUAN (khong qua AI). resolved=False nghia la fail-closed.
    resolved: bool
    holder_evidence: bool  # False = Blockscout khong doc duoc: so holder/verify la KHONG RO, khong phai 0
    token_name: str
    token_symbol: str
    holders_count: u256
    top_holder_percent: u256  # % supply cua vi CA NHAN lon nhat (loai contract/pool)
    top10_percent: u256
    whale_holder_count: u256  # so vi ca nhan doc lap giu >=1% supply
    is_verified: bool
    has_pool: bool
    price_usd: str  # cac gia tri USD giu dang string de tranh sai so float
    market_cap_usd: str
    reserve_in_usd: str
    volume_24h_usd: str
    buys_24h: u256
    sells_24h: u256
    pool_age_hours: u256


@allow_storage
@dataclass
class Observations:
    # Quan sat DONG cua AI ve source code, CHI true/false, AI khong tinh diem.
    observed: bool
    has_mint: bool
    owner_can_pause: bool
    sell_blocked: bool
    high_fee: bool
    is_proxy: bool


@allow_storage
@dataclass
class Verdict:
    # Ket qua cham diem cuoi cung, hoan toan do CODE tinh.
    resolved: bool
    risk_score: u256
    verdict: str  # "SAFE" | "SUSPICIOUS" | "SCAM" | "UNRESOLVED"
    flags: str
    observed_at: str


class RugRadar(gl.Contract):
    facts: TreeMap[str, Facts]
    observations: TreeMap[str, Observations]
    verdicts: TreeMap[str, Verdict]

    def __init__(self):
        pass

    def _fetch_address_info(self, token_address: str) -> dict:
        # Dung endpoint /addresses/{addr} (~1 KB) thay vi goi rieng /tokens/{addr}
        # VA /smart-contracts/{addr}. Cai smart-contracts co the nang toi 575 KB;
        # gop nhieu fetch nang trong 1 giao dich lam GenVM vuot gioi han bo nho
        # va bao wasm_trap (loi cap VM, try/except Python KHONG bat duoc).
        # Xem error-log.md muc 15.
        url = f"{BLOCKSCOUT_BASE}/addresses/{token_address}"

        def fetch() -> str:
            try:
                web_data = gl.nondet.web.render(url, mode="text")
                data = json.loads(web_data)
                token = data.get("token") if isinstance(data, dict) else None
                if not isinstance(token, dict) or token.get("holders_count") is None:
                    return json.dumps({"ok": False, "error": "not an indexed token"}, sort_keys=True)
                return json.dumps(  # sort_keys de moi validator ra chuoi y het nhau
                    {
                        "ok": True,
                        "holders_count": token.get("holders_count"),
                        "total_supply": token.get("total_supply"),
                        "name": token.get("name") or "",
                        "symbol": token.get("symbol") or "",
                        "is_verified": bool(data.get("is_verified", False)),
                    },
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": "unavailable"}, sort_keys=True)

        return json.loads(gl.eq_principle.strict_eq(fetch))

    def _fetch_holders(self, token_address: str, total_supply_raw: int) -> dict:
        url = f"{BLOCKSCOUT_BASE}/tokens/{token_address}/holders"

        def fetch() -> str:
            try:
                web_data = gl.nondet.web.render(url, mode="text")
                data = json.loads(web_data)
                items = data.get("items", [])
                eoa_values = [  # vi cua NGUOI: bo pool/contract that va dia chi dot
                    int(item["value"])
                    for item in items
                    if _is_person(item.get("address") or {})
                ]
                eoa_values.sort(reverse=True)
                top_percent = 0
                top10_percent = 0
                whale_count = 0
                if total_supply_raw > 0 and eoa_values:  # chia nguyen, tranh float
                    top_percent = eoa_values[0] * 100 // total_supply_raw
                    top10_percent = sum(eoa_values[:10]) * 100 // total_supply_raw
                    whale_count = sum(1 for v in eoa_values if v * 100 >= total_supply_raw)
                return json.dumps(
                    {
                        "ok": True,
                        "top_holder_percent": top_percent,
                        "top10_percent": top10_percent,
                        "whale_holder_count": whale_count,
                    },
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": "unavailable"}, sort_keys=True)

        return json.loads(gl.eq_principle.strict_eq(fetch))

    def _fetch_pool(self, token_address: str) -> dict:
        url = f"{GECKOTERMINAL_BASE}/tokens/{token_address}/pools"

        def fetch() -> str:
            try:
                web_data = gl.nondet.web.render(url, mode="text")
                data = json.loads(web_data)
                pools = data.get("data", [])
                if not pools:
                    return json.dumps({"ok": True, "has_pool": False}, sort_keys=True)
                attrs = pools[0]["attributes"]  # pool dau tien: thanh khoan sau nhat
                transactions_h24 = attrs.get("transactions", {}).get("h24", {})
                return json.dumps(
                    {
                        "ok": True,
                        "has_pool": True,
                        "price_usd": str(attrs.get("base_token_price_usd") or "0"),
                        "fdv_usd": str(attrs.get("fdv_usd") or "0"),
                        "reserve_in_usd": str(attrs.get("reserve_in_usd")),
                        "volume_24h_usd": str(attrs.get("volume_usd", {}).get("h24")),
                        "buys_24h": transactions_h24.get("buys", 0),
                        "sells_24h": transactions_h24.get("sells", 0),
                        "pool_created_at": attrs.get("pool_created_at", ""),
                    },
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": "unavailable"}, sort_keys=True)

        return json.loads(gl.eq_principle.strict_eq(fetch))

    def _gather_facts(self, token_address: str, now_iso: str) -> Facts:
        address_info = self._fetch_address_info(token_address)
        pool_info = self._fetch_pool(token_address)

        blockscout_ok = address_info.get("ok", False)
        pool_ok = pool_info.get("ok", False)
        has_pool = pool_ok and pool_info.get("has_pool", False)

        # Blockscout bi Cloudflare chan theo dot. Neu GeckoTerminal van cho thay 1 pool
        # that thi van phan tren bang chung thi truong, va compute_verdict cong co rieng
        # cho phan holder/verify khong kiem chung duoc. Khong co pool lan Blockscout thi
        # khong con bang chung nao -> fail-closed (dia chi khong ton tai roi vao day).
        if not pool_ok or (not blockscout_ok and not has_pool):
            return Facts(
                resolved=False,
                holder_evidence=False,
                token_name="",
                token_symbol="",
                holders_count=0,
                top_holder_percent=0,
                top10_percent=0,
                whale_holder_count=0,
                is_verified=False,
                has_pool=False,
                price_usd="0",
                market_cap_usd="0",
                reserve_in_usd="0",
                volume_24h_usd="0",
                buys_24h=0,
                sells_24h=0,
                pool_age_hours=0,
            )

        total_supply_raw = int(address_info.get("total_supply") or 0)
        holders_info = self._fetch_holders(token_address, total_supply_raw) if blockscout_ok else {"ok": False}

        pool_age_hours = 0
        if has_pool and pool_info.get("pool_created_at"):
            created_at = datetime.fromisoformat(
                pool_info["pool_created_at"].replace("Z", "+00:00")
            )
            now = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
            pool_age_hours = max(0, int((now - created_at).total_seconds() // 3600))

        price_usd = pool_info.get("price_usd", "0") if has_pool else "0"
        # fdv_usd cua GeckoTerminal: gia x tong cung, ca hai deu tu CUNG 1 nguon.
        # Truoc day tu tinh bang gia (GeckoTerminal) x total_supply (Blockscout),
        # ma total_supply cua Blockscout lech 1000 lan -> market cap sai 1000 lan.
        market_cap_usd = pool_info.get("fdv_usd", "0") if has_pool else "0"

        return Facts(
            resolved=True,
            holder_evidence=blockscout_ok,
            token_name=str(address_info.get("name") or ""),
            token_symbol=str(address_info.get("symbol") or ""),
            holders_count=int(address_info.get("holders_count") or 0),
            top_holder_percent=holders_info.get("top_holder_percent", 0) if holders_info.get("ok") else 0,
            top10_percent=holders_info.get("top10_percent", 0) if holders_info.get("ok") else 0,
            whale_holder_count=holders_info.get("whale_holder_count", 0) if holders_info.get("ok") else 0,
            is_verified=address_info.get("is_verified", False),
            has_pool=has_pool,
            price_usd=price_usd,
            market_cap_usd=market_cap_usd,
            reserve_in_usd=pool_info.get("reserve_in_usd", "0") if has_pool else "0",
            volume_24h_usd=pool_info.get("volume_24h_usd", "0") if has_pool else "0",
            buys_24h=pool_info.get("buys_24h", 0) if has_pool else 0,
            sells_24h=pool_info.get("sells_24h", 0) if has_pool else 0,
            pool_age_hours=pool_age_hours,
        )

    @gl.public.write
    def scan_token(self, token_address: str) -> None:
        key = _normalize_address(token_address)
        # gl.message_raw["datetime"]: thoi gian giao dich DETERMINISTIC, moi validator nhu nhau
        # (gl.vm.get_timestamp() khong ton tai)
        self.facts[key] = self._gather_facts(key, gl.message_raw["datetime"])

    @gl.public.write
    def preview_token(self, token_address: str, now_iso: str) -> Verdict:
        # SO THAM: frontend goi ham nay qua gen_call, tuc chay thu tren 1 node, KHONG
        # dong thuan va KHONG ghi state, de co so trong vai giay (meme coin can nhanh).
        # Dung CHUNG code lay bang chung va cham diem voi ban an that; chi thieu loi
        # khai AI ve source code, vi chay LLM cung luc de vuot bo nho GenVM.
        # now_iso do trinh duyet gui: khi chay thu, node dung ngay GIA co dinh (2024) nen
        # tuoi pool tinh bang gio giao dich se sai. Ban an that van dung gio giao dich.
        no_testimony = Observations(
            observed=False, has_mint=False, owner_can_pause=False,
            sell_blocked=False, high_fee=False, is_proxy=False,
        )
        return self._score(self._gather_facts(_normalize_address(token_address), now_iso), no_testimony)

    @gl.public.write
    def preview_facts(self, token_address: str, now_iso: str) -> Facts:
        # SO THAM chi lay Facts (MC, gia, thanh khoan, holder...), KHONG cham diem.
        # Dung khi da co ban an chinh thuc roi nhung nguoi xem bam "Check the record"
        # lai va muon thay so MOI NHAT thay vi so dong bang tu lan quet truoc. Cung 1
        # co che 1 node nhu preview_token, chi khac cho ve Facts thay vi Verdict.
        return self._gather_facts(_normalize_address(token_address), now_iso)

    @gl.public.view
    def get_facts(self, token_address: str) -> Facts:
        return self.facts[_normalize_address(token_address)]

    def _observe_source(self, token_address: str) -> dict:
        url = f"{BLOCKSCOUT_BASE}/smart-contracts/{token_address}"

        def fetch_and_analyze() -> str:  # fetch + hoi AI trong CUNG 1 khoi nondet
            try:
                web_data = gl.nondet.web.render(url, mode="text")
                data = json.loads(web_data)
                if not isinstance(data, dict) or not data.get("is_verified"):
                    return json.dumps({"ok": True, "has_source": False}, sort_keys=True)
                source_code = (data.get("source_code") or "")[:MAX_SOURCE_CHARS]
                if not source_code:
                    return json.dumps({"ok": True, "has_source": False}, sort_keys=True)
                prompt = OBSERVATION_PROMPT.format(source_code=source_code)
                result = gl.nondet.exec_prompt(prompt, response_format="json")
                return json.dumps(  # chi lay dung 5 field bool, bo moi thu AI them vao
                    {
                        "ok": True,
                        "has_source": True,
                        "has_mint": bool(result.get("has_mint", False)),
                        "owner_can_pause": bool(result.get("owner_can_pause", False)),
                        "sell_blocked": bool(result.get("sell_blocked", False)),
                        "high_fee": bool(result.get("high_fee", False)),
                        "is_proxy": bool(result.get("is_proxy", False)),
                    },
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": "unavailable"}, sort_keys=True)

        # prompt_comparative chu KHONG strict_eq: moi validator chay 1 model LLM
        # khac nhau nen output khong bao gio byte-giong-het-nhau (da kiem chung
        # that: strict_eq luon NO_MAJORITY voi exec_prompt).
        raw = gl.eq_principle.prompt_comparative(
            fetch_and_analyze,
            principle=(
                "Both outputs must have the same boolean value for each of the five keys "
                "has_mint, owner_can_pause, sell_blocked, high_fee, is_proxy, and the same "
                "value for ok and has_source. JSON key order and unrelated formatting do not matter."
            ),
        )
        return json.loads(raw)

    @gl.public.write
    def observe_token(self, token_address: str) -> None:
        key = _normalize_address(token_address)
        result = self._observe_source(key)

        if not result.get("ok") or not result.get("has_source"):
            self.observations[key] = Observations(
                observed=False,
                has_mint=False,
                owner_can_pause=False,
                sell_blocked=False,
                high_fee=False,
                is_proxy=False,
            )
            return

        self.observations[key] = Observations(
            observed=True,
            has_mint=result.get("has_mint", False),
            owner_can_pause=result.get("owner_can_pause", False),
            sell_blocked=result.get("sell_blocked", False),
            high_fee=result.get("high_fee", False),
            is_proxy=result.get("is_proxy", False),
        )

    @gl.public.view
    def get_observations(self, token_address: str) -> Observations:
        return self.observations[_normalize_address(token_address)]

    def _score(self, facts: Facts, obs: Observations) -> Verdict:
        if not facts.resolved:
            return Verdict(
                resolved=False,
                risk_score=0,
                verdict="UNRESOLVED",
                flags="Could not read reliable data from Blockscout or GeckoTerminal",
                observed_at=gl.message_raw["datetime"],
            )

        risk = 0
        flags = []

        if not facts.holder_evidence:
            risk += 20
            flags.append("Holder and source-verification evidence unavailable (Blockscout unreachable)")
        elif not facts.is_verified:
            risk += 20
            flags.append("Source code has not been verified")
        if obs.has_mint:
            risk += 15
            flags.append("Owner can mint additional tokens")
        if obs.owner_can_pause:
            risk += 10
            flags.append("Owner can pause trading")
        if obs.sell_blocked:
            risk += 25
            flags.append("Contains logic that can block selling (honeypot)")
        if obs.high_fee:
            risk += 10
            flags.append("Unusually high fees, or fees the owner can change at will")
        if obs.is_proxy:
            risk += 10
            flags.append("Contract is a proxy; the executed code can be swapped later")

        if facts.holder_evidence and facts.top_holder_percent > 50:
            risk += 20
            flags.append("The largest individual wallet holds over 50% of supply")
        elif facts.holder_evidence and facts.top_holder_percent > 30:
            risk += 10
            flags.append("The largest individual wallet holds over 30% of supply")

        if facts.holder_evidence and facts.top10_percent > 50:
            risk += 10
            flags.append("The top 10 individual wallets hold over 50% of supply combined")

        if facts.holder_evidence and facts.holders_count < 50:
            risk += 10
            flags.append("Fewer than 50 wallets hold this token")

        if not facts.has_pool:
            risk += 25
            flags.append("No liquidity pool found on GeckoTerminal")
        else:  # cac co ve pool CHI xet khi thuc su co pool, tranh dem 2 lan
            # so sanh bang so nguyen (cat phan thap phan) thay vi float
            reserve_whole = int((facts.reserve_in_usd or "0").split(".")[0] or "0")
            if reserve_whole < 5000:
                risk += 15
                flags.append("Pool liquidity is under $5,000")
            if facts.pool_age_hours < 24:
                risk += 10
                flags.append("Pool was created less than 24 hours ago")

        if facts.buys_24h >= 20 and facts.sells_24h == 0:
            risk += 20
            flags.append("Many buys but zero sells in the last 24h (suspected honeypot)")

        if facts.holder_evidence and facts.whale_holder_count >= 3:
            risk -= 15
            flags.append("Three or more independent large holders (healthy distribution)")
        elif facts.holder_evidence and facts.whale_holder_count >= 1:
            risk -= 8
            flags.append("At least one independent large holder")

        risk = max(0, min(100, risk))

        if risk <= 25:
            verdict_str = "SAFE"
        elif risk <= 60:
            verdict_str = "SUSPICIOUS"
        else:
            verdict_str = "SCAM"

        return Verdict(
            resolved=True,
            risk_score=risk,
            verdict=verdict_str,
            flags="; ".join(flags) if flags else "No signals recorded",
            observed_at=gl.message_raw["datetime"],
        )

    @gl.public.write  # KHONG co khoi nondet: CODE THUAN tinh diem theo scoring-spec.md
    def compute_verdict(self, token_address: str) -> None:
        key = _normalize_address(token_address)
        default_facts = Facts(
            resolved=False, holder_evidence=False, token_name="", token_symbol="", holders_count=0,
            top_holder_percent=0, top10_percent=0, whale_holder_count=0,
            is_verified=False, has_pool=False, price_usd="0", market_cap_usd="0",
            reserve_in_usd="0", volume_24h_usd="0",
            buys_24h=0, sells_24h=0, pool_age_hours=0,
        )
        default_obs = Observations(
            observed=False, has_mint=False, owner_can_pause=False,
            sell_blocked=False, high_fee=False, is_proxy=False,
        )
        facts = self.facts.get(key, default_facts)
        obs = self.observations.get(key, default_obs)

        self.verdicts[key] = self._score(facts, obs)

    @gl.public.view
    def get_verdict(self, token_address: str) -> Verdict:
        return self.verdicts[_normalize_address(token_address)]
