# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json  # parse JSON tra ve tu Blockscout/GeckoTerminal
from datetime import datetime  # tinh tuoi pool tu pool_created_at
from dataclasses import dataclass  # dinh nghia kieu du lieu luu on-chain
from genlayer import *  # nap SDK GenLayer (gl.Contract, gl.public, gl.nondet, gl.eq_principle, gl.vm...)

# BLOCKSCOUT_BASE, GECKOTERMINAL_BASE: hang so tu dat, endpoint 2 nguon du lieu da verify song
BLOCKSCOUT_BASE = "https://robinhoodchain.blockscout.com/api/v2"
GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2/networks/robinhood"

MAX_SOURCE_CHARS = 8000  # MAX_SOURCE_CHARS: gioi han do dai source code dua vao prompt, tranh prompt qua to


def _normalize_address(token_address) -> str:  # _normalize_address: ham tu dat, chuan hoa token_address ve chuoi hex thuong
    # mot so client (vd genlayer CLI) tu suy luan chuoi hex 40 ky tu thanh kieu
    # Address thay vi str, du contract khai bao tham so la str. Address co
    # thuoc tinh as_hex (checksummed) chu khong co .lower() nhu str thuong.
    if hasattr(token_address, "as_hex"):
        return token_address.as_hex.lower()
    return str(token_address).lower()

# OBSERVATION_PROMPT: cau hoi dong cho AI, CHI tra ve true/false cho tung dau hieu, khong tu tinh diem
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


@allow_storage  # cho phep luu kieu du lieu tu dat nay vao state on-chain
@dataclass
class Facts:  # Facts: tap hop cac quan sat KHACH QUAN (khong qua AI) ve 1 token
    resolved: bool  # resolved: co doc duoc du lieu loi tu ca 2 nguon hay khong (fail-closed)
    holders_count: u256  # holders_count: tong so vi dang giu token
    top_holder_percent: u256  # top_holder_percent: % supply cua vi CA NHAN (khong tinh contract/pool) giu nhieu nhat
    whale_holder_count: u256  # whale_holder_count: so vi ca nhan doc lap giu >=1% supply
    is_verified: bool  # is_verified: source code token co duoc verify tren Blockscout khong
    has_pool: bool  # has_pool: token co pool thanh khoan tren GeckoTerminal khong
    reserve_in_usd: str  # reserve_in_usd: do sau thanh khoan pool dau tien (USD, dang string tranh sai so float)
    volume_24h_usd: str  # volume_24h_usd: volume giao dich 24h (USD, dang string)
    buys_24h: u256  # buys_24h: so lenh mua trong 24h
    sells_24h: u256  # sells_24h: so lenh ban trong 24h
    pool_age_hours: u256  # pool_age_hours: tuoi pool tinh theo gio, tu luc tao den luc scan


@allow_storage  # cho phep luu kieu du lieu tu dat nay vao state on-chain
@dataclass
class Observations:  # Observations: quan sat DONG cua AI ve source code, CHI true/false, AI khong tinh diem
    observed: bool  # observed: AI co thuc su phan tich duoc source code hay khong (fail-closed)
    has_mint: bool  # has_mint: owner/role dac quyen co the mint them token
    owner_can_pause: bool  # owner_can_pause: owner/role dac quyen co the tam dung giao dich
    sell_blocked: bool  # sell_blocked: co logic chan/gioi han chieu ban
    high_fee: bool  # high_fee: phi giao dich cao bat thuong hoac owner chinh tuy y
    is_proxy: bool  # is_proxy: contract proxy, code thuc thi co the bi trao doi sau nay


@allow_storage  # cho phep luu kieu du lieu tu dat nay vao state on-chain
@dataclass
class Verdict:  # Verdict: ket qua CHAM DIEM cuoi cung, hoan toan do CODE tinh, khong qua AI
    resolved: bool  # resolved: co du du lieu de cham diem hay UNRESOLVED (fail-closed)
    risk_score: u256  # risk_score: diem rui ro 0-100, cang cao cang nguy hiem
    verdict: str  # verdict: "SAFE" | "SUSPICIOUS" | "SCAM" | "UNRESOLVED"
    flags: str  # flags: cac ly do da bat, noi nhau boi "; ", moi ly do 1 cau ngan
    observed_at: str  # observed_at: thoi diem cham diem (gl.message_raw["datetime"], deterministic)


class RugRadar(gl.Contract):  # RugRadar: ten contract tu dat, ke thua gl.Contract
    facts: TreeMap[str, Facts]  # facts: state tu dat, luu Facts theo dia chi token (chu thuong)
    observations: TreeMap[str, Observations]  # observations: state tu dat, luu quan sat AI theo dia chi token
    verdicts: TreeMap[str, Verdict]  # verdicts: state tu dat, luu ket qua cham diem theo dia chi token

    def __init__(self):  # constructor, chay 1 lan luc deploy
        pass  # TreeMap tu khoi tao rong, khong can gan gi them

    def _fetch_token_info(self, token_address: str) -> dict:  # _fetch_token_info: ham tu dat, lay holders_count + total_supply
        url = f"{BLOCKSCOUT_BASE}/tokens/{token_address}"  # url: endpoint chi tiet 1 token tren Blockscout

        def fetch() -> str:  # fetch: closure non-deterministic, moi validator tu chay doc lap
            try:  # bat loi mang/parse de tra ve JSON on dinh thay vi crash
                web_data = gl.nondet.web.render(url, mode="text")  # goi web, lay body dang text (JSON)
                data = json.loads(web_data)  # parse JSON
                if not isinstance(data, dict) or data.get("holders_count") is None:  # dia chi khong ton tai -> Blockscout tra {"message":"Not found"}, KHONG co field nay
                    return json.dumps({"ok": False, "error": "token not found"}, sort_keys=True)
                return json.dumps(  # tra ve JSON da chuan hoa, sort_keys de moi validator ra chuoi y het nhau
                    {
                        "ok": True,
                        "holders_count": data.get("holders_count"),
                        "total_supply": data.get("total_supply"),
                    },
                    sort_keys=True,
                )
            except Exception as e:  # loi mang, timeout, JSON hong...
                return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, sort_keys=True)  # danh dau that bai, fail-closed o tang goi

        return json.loads(gl.eq_principle.strict_eq(fetch))  # dong thuan strict: tat ca validator phai ra dung 1 ket qua

    def _fetch_holders(self, token_address: str, total_supply_raw: int) -> dict:  # _fetch_holders: ham tu dat, tinh top holder % va whale count
        url = f"{BLOCKSCOUT_BASE}/tokens/{token_address}/holders"  # url: danh sach holder tren Blockscout

        def fetch() -> str:  # fetch: closure non-deterministic
            try:
                web_data = gl.nondet.web.render(url, mode="text")  # goi web
                data = json.loads(web_data)  # parse JSON
                items = data.get("items", [])  # danh sach holder
                eoa_values = [  # eoa_values: bien tu dat, so du cua CAC VI CA NHAN (bo contract/pool AMM ra)
                    int(item["value"])
                    for item in items
                    if not item.get("address", {}).get("is_contract", False)
                ]
                eoa_values.sort(reverse=True)  # sap xep giam dan, vi lon nhat len dau
                top_percent = 0  # mac dinh 0 neu khong co vi ca nhan nao
                whale_count = 0  # mac dinh 0
                if total_supply_raw > 0 and eoa_values:  # chi tinh khi co du lieu hop le
                    top_percent = eoa_values[0] * 100 // total_supply_raw  # % supply vi lon nhat, chia nguyen tranh float
                    whale_count = sum(  # dem so vi ca nhan doc lap giu >=1% supply
                        1 for v in eoa_values if v * 100 >= total_supply_raw
                    )
                return json.dumps(
                    {"ok": True, "top_holder_percent": top_percent, "whale_holder_count": whale_count},
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, sort_keys=True)

        return json.loads(gl.eq_principle.strict_eq(fetch))

    def _fetch_verification(self, token_address: str) -> dict:  # _fetch_verification: ham tu dat, lay is_verified
        url = f"{BLOCKSCOUT_BASE}/smart-contracts/{token_address}"  # url: endpoint smart-contract tren Blockscout

        def fetch() -> str:  # fetch: closure non-deterministic
            try:
                web_data = gl.nondet.web.render(url, mode="text")  # goi web (tra 422 neu chua verify, van co body)
                data = json.loads(web_data)  # parse JSON
                is_verified = bool(data.get("is_verified", False)) if isinstance(data, dict) else False  # is_verified: co truong nay khi verify, khong thi mac dinh False
                return json.dumps({"ok": True, "is_verified": is_verified}, sort_keys=True)
            except Exception:
                return json.dumps({"ok": True, "is_verified": False}, sort_keys=True)  # loi/khong verify -> coi nhu chua verify, khong phai fail-closed toan bo

        return json.loads(gl.eq_principle.strict_eq(fetch))

    def _fetch_pool(self, token_address: str) -> dict:  # _fetch_pool: ham tu dat, lay thanh khoan + volume + mua/ban
        url = f"{GECKOTERMINAL_BASE}/tokens/{token_address}/pools"  # url: danh sach pool tren GeckoTerminal

        def fetch() -> str:  # fetch: closure non-deterministic
            try:
                web_data = gl.nondet.web.render(url, mode="text")  # goi web
                data = json.loads(web_data)  # parse JSON
                pools = data.get("data", [])  # danh sach pool
                if not pools:  # token khong co pool nao
                    return json.dumps({"ok": True, "has_pool": False}, sort_keys=True)
                attrs = pools[0]["attributes"]  # attrs: thong tin pool dau tien (thanh khoan sau nhat)
                transactions_h24 = attrs.get("transactions", {}).get("h24", {})  # transactions_h24: so lenh mua/ban 24h
                return json.dumps(
                    {
                        "ok": True,
                        "has_pool": True,
                        "reserve_in_usd": str(attrs.get("reserve_in_usd")),
                        "volume_24h_usd": str(attrs.get("volume_usd", {}).get("h24")),
                        "buys_24h": transactions_h24.get("buys", 0),
                        "sells_24h": transactions_h24.get("sells", 0),
                        "pool_created_at": attrs.get("pool_created_at", ""),
                    },
                    sort_keys=True,
                )
            except Exception as e:
                return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, sort_keys=True)

        return json.loads(gl.eq_principle.strict_eq(fetch))

    @gl.public.write  # method ghi state, doi qua consensus cua validator
    def scan_token(self, token_address: str) -> None:  # scan_token: ham tu dat, doc toan bo facts khach quan cho 1 token
        key = _normalize_address(token_address)  # key: dia chi da chuan hoa, dung lam key luu tru VA truyen tiep xuong duoi
        token_address = key  # tu day tro di dung ban da chuan hoa (chac chan la str)

        token_info = self._fetch_token_info(token_address)  # goi Blockscout: token info
        pool_info = self._fetch_pool(token_address)  # goi GeckoTerminal: pool

        core_ok = token_info.get("ok", False) and pool_info.get("ok", False)  # core_ok: 2 nguon chinh co doc duoc khong (fail-closed)

        if not core_ok:  # thieu du lieu loi, khong doan bua
            self.facts[key] = Facts(  # luu Facts danh dau UNRESOLVED, cac field con lai de mac dinh an toan
                resolved=False,
                holders_count=0,
                top_holder_percent=0,
                whale_holder_count=0,
                is_verified=False,
                has_pool=False,
                reserve_in_usd="0",
                volume_24h_usd="0",
                buys_24h=0,
                sells_24h=0,
                pool_age_hours=0,
            )
            return

        total_supply_raw = int(token_info.get("total_supply") or 0)  # total_supply_raw: tong cung dang raw (theo decimals)
        holders_info = self._fetch_holders(token_address, total_supply_raw)  # goi Blockscout: danh sach holder
        verification_info = self._fetch_verification(token_address)  # goi Blockscout: trang thai verify

        has_pool = pool_info.get("has_pool", False)  # has_pool: token co pool khong
        pool_age_hours = 0  # pool_age_hours: mac dinh 0 neu khong co pool
        if has_pool and pool_info.get("pool_created_at"):  # chi tinh tuoi pool khi co du lieu
            created_at = datetime.fromisoformat(  # created_at: thoi diem tao pool, parse tu chuoi ISO 8601
                pool_info["pool_created_at"].replace("Z", "+00:00")
            )
            now = datetime.fromisoformat(  # now: thoi gian giao dich DETERMINISTIC (gl.message_raw['datetime'], moi validator giong nhau)
                gl.message_raw["datetime"].replace("Z", "+00:00")
            )
            pool_age_hours = max(0, int((now - created_at).total_seconds() // 3600))  # pool_age_hours: chan khong am

        self.facts[key] = Facts(
            resolved=True,
            holders_count=int(token_info.get("holders_count") or 0),
            top_holder_percent=holders_info.get("top_holder_percent", 0) if holders_info.get("ok") else 0,
            whale_holder_count=holders_info.get("whale_holder_count", 0) if holders_info.get("ok") else 0,
            is_verified=verification_info.get("is_verified", False),
            has_pool=has_pool,
            reserve_in_usd=pool_info.get("reserve_in_usd", "0") if has_pool else "0",
            volume_24h_usd=pool_info.get("volume_24h_usd", "0") if has_pool else "0",
            buys_24h=pool_info.get("buys_24h", 0) if has_pool else 0,
            sells_24h=pool_info.get("sells_24h", 0) if has_pool else 0,
            pool_age_hours=pool_age_hours,
        )

    @gl.public.view  # method chi doc, khong doi state
    def get_facts(self, token_address: str) -> Facts:  # get_facts: ham tu dat, tra ve Facts da scan cua 1 token
        return self.facts[_normalize_address(token_address)]

    def _observe_source(self, token_address: str) -> dict:  # _observe_source: ham tu dat, doc source code roi hoi AI quan sat dong
        url = f"{BLOCKSCOUT_BASE}/smart-contracts/{token_address}"  # url: endpoint smart-contract tren Blockscout

        def fetch_and_analyze() -> str:  # fetch_and_analyze: closure non-deterministic, fetch + hoi AI trong CUNG 1 khoi
            try:
                web_data = gl.nondet.web.render(url, mode="text")  # goi web lay source code
                data = json.loads(web_data)  # parse JSON
                if not isinstance(data, dict) or not data.get("is_verified"):  # khong verify -> khong co source de doc
                    return json.dumps({"ok": True, "has_source": False}, sort_keys=True)
                source_code = (data.get("source_code") or "")[:MAX_SOURCE_CHARS]  # source_code: cat bot tranh prompt qua to
                if not source_code:  # verify nhung khong co source_code (hiem, phong thu)
                    return json.dumps({"ok": True, "has_source": False}, sort_keys=True)
                prompt = OBSERVATION_PROMPT.format(source_code=source_code)  # prompt: dien source code vao mau cau hoi
                result = gl.nondet.exec_prompt(prompt, response_format="json")  # goi LLM, tra ve dict da parse JSON san
                return json.dumps(  # chuan hoa lai CHI 5 field bool, khong lay gi khac AI co the them vao
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
            except Exception as e:  # loi mang, loi parse JSON cua AI...
                return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, sort_keys=True)

        # prompt_comparative: LLM giam khao so sanh ket qua leader/validator theo principle,
        # KHONG dung strict_eq vi moi validator chay 1 model LLM khac nhau (Gemini/GPT-oss/Kimi/...),
        # output se khong bao gio byte-giong-het-nhau (da kiem chung that: strict_eq luon NO_MAJORITY).
        raw = gl.eq_principle.prompt_comparative(
            fetch_and_analyze,
            principle=(
                "Both outputs must have the same boolean value for each of the five keys "
                "has_mint, owner_can_pause, sell_blocked, high_fee, is_proxy, and the same "
                "value for ok and has_source. JSON key order and unrelated formatting do not matter."
            ),
        )
        return json.loads(raw)

    @gl.public.write  # method ghi state, doi qua consensus cua validator
    def observe_token(self, token_address: str) -> None:  # observe_token: ham tu dat, chay tang quan sat AI cho 1 token
        key = _normalize_address(token_address)  # key: dia chi da chuan hoa, dung lam key luu tru VA truyen tiep xuong duoi
        result = self._observe_source(key)  # goi Blockscout + AI

        if not result.get("ok") or not result.get("has_source"):  # loi mang HOAC khong co source de doc -> khong quan sat duoc
            self.observations[key] = Observations(  # luu quan sat danh dau CHUA QUAN SAT, cac co mac dinh False
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

    @gl.public.view  # method chi doc, khong doi state
    def get_observations(self, token_address: str) -> Observations:  # get_observations: ham tu dat, tra ve quan sat AI da luu cua 1 token
        return self.observations[_normalize_address(token_address)]

    @gl.public.write  # method ghi state, KHONG co khoi non-deterministic nao - CODE THUAN tinh diem
    def compute_verdict(self, token_address: str) -> None:  # compute_verdict: ham tu dat, cong tru diem theo scoring-spec.md, KHONG nho AI
        key = _normalize_address(token_address)  # key: dia chi da chuan hoa, dung lam key luu tru
        default_facts = Facts(  # default_facts: dung khi chua scan_token, coi nhu chua co du lieu
            resolved=False, holders_count=0, top_holder_percent=0, whale_holder_count=0,
            is_verified=False, has_pool=False, reserve_in_usd="0", volume_24h_usd="0",
            buys_24h=0, sells_24h=0, pool_age_hours=0,
        )
        default_obs = Observations(  # default_obs: dung khi chua observe_token, coi nhu AI chua quan sat
            observed=False, has_mint=False, owner_can_pause=False,
            sell_blocked=False, high_fee=False, is_proxy=False,
        )
        facts = self.facts.get(key, default_facts)  # facts: doc lai Facts da luu tu CP1, hoac mac dinh neu chua scan
        obs = self.observations.get(key, default_obs)  # obs: doc lai Observations da luu tu CP2, hoac mac dinh neu chua observe

        if not facts.resolved:  # thieu du lieu loi tu Blockscout/GeckoTerminal -> UNRESOLVED, khong doan bua
            self.verdicts[key] = Verdict(
                resolved=False,
                risk_score=0,
                verdict="UNRESOLVED",
                flags="Khong doc duoc du lieu tu Blockscout/GeckoTerminal",
                observed_at=gl.message_raw["datetime"],
            )
            return

        risk = 0  # risk: bien tu dat, diem rui ro dang cong don, bat dau tu 0
        flags = []  # flags: bien tu dat, danh sach ly do da bat co

        if not facts.is_verified:  # co do 1: source code chua verify
            risk += 20
            flags.append("Source code chua duoc verify")
        if obs.has_mint:  # co do 2: owner mint them token duoc
            risk += 15
            flags.append("Owner co the mint them token")
        if obs.owner_can_pause:  # co do 3: owner tam dung giao dich duoc
            risk += 10
            flags.append("Owner co the tam dung giao dich")
        if obs.sell_blocked:  # co do 4 (nang): co logic chan ban, honeypot ro
            risk += 25
            flags.append("Co logic chan ban (honeypot)")
        if obs.high_fee:  # co do 5: phi giao dich cao bat thuong
            risk += 10
            flags.append("Phi giao dich cao bat thuong hoac owner chinh tuy y")
        if obs.is_proxy:  # co do 6: contract proxy, code co the bi doi sau
            risk += 10
            flags.append("Contract la proxy, code thuc thi co the bi doi")

        if facts.top_holder_percent > 50:  # co do 7a: vi ca nhan lon nhat giu qua nhieu
            risk += 20
            flags.append("Vi ca nhan lon nhat giu qua 50% supply")
        elif facts.top_holder_percent > 30:  # co do 7b: muc nhe hon
            risk += 10
            flags.append("Vi ca nhan lon nhat giu qua 30% supply")

        if facts.holders_count < 50:  # co do 8: qua it nguoi giu token
            risk += 10
            flags.append("It hon 50 vi dang giu token")

        if not facts.has_pool:  # co do 9a (nang): khong co pool thanh khoan nao
            risk += 25
            flags.append("Khong co pool thanh khoan tren GeckoTerminal")
        else:  # co pool - cac co do 9b/11 CHI xet khi thuc su co pool, tranh dem 2 lan voi 9a
            if float(facts.reserve_in_usd) < 5000:  # co do 9b: co pool nhung thanh khoan qua mong
                risk += 15
                flags.append("Thanh khoan pool duoi 5000 USD")
            if facts.pool_age_hours < 24:  # co do 11: pool qua moi
                risk += 10
                flags.append("Pool moi tao duoi 24 gio")

        if facts.buys_24h >= 20 and facts.sells_24h == 0:  # co do 10: hanh vi honeypot - mua duoc, ban khong duoc
            risk += 20
            flags.append("24h co nhieu lenh mua nhung khong co lenh ban nao (nghi honeypot)")

        if facts.whale_holder_count >= 3:  # co xanh a: nhieu vi lon doc lap, phan tan tot
            risk -= 15
            flags.append("Co tu 3 vi lon doc lap tro len (phan tan tot)")
        elif facts.whale_holder_count >= 1:  # co xanh b: it nhat 1 vi lon doc lap
            risk -= 8
            flags.append("Co it nhat 1 vi lon doc lap")

        risk = max(0, min(100, risk))  # chan bien 0-100

        if risk <= 25:  # map risk -> verdict theo scoring-spec.md
            verdict_str = "SAFE"
        elif risk <= 60:
            verdict_str = "SUSPICIOUS"
        else:
            verdict_str = "SCAM"

        self.verdicts[key] = Verdict(
            resolved=True,
            risk_score=risk,
            verdict=verdict_str,
            flags="; ".join(flags) if flags else "Khong co dau hieu nao duoc ghi nhan",
            observed_at=gl.message_raw["datetime"],
        )

    @gl.public.view  # method chi doc, khong doi state
    def get_verdict(self, token_address: str) -> Verdict:  # get_verdict: ham tu dat, tra ve ket qua cham diem da luu cua 1 token
        return self.verdicts[_normalize_address(token_address)]
