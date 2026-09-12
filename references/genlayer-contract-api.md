# API viết Intelligent Contract GenLayer (verify that ngay 8/9/2026, chay pass tren studionet that)

GenLayer contract viet bang PYTHON. Docs: https://docs.genlayer.com/developers/intelligent-contracts
SDK reference: https://sdk.genlayer.com. Studio hosted: https://studio.genlayer.com

## Khung contract co ban (verify voi contracts/rugradar.py, deploy that thanh cong)

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *

class RugRadar(gl.Contract):
    reserve_in_usd: str

    def __init__(self):
        self.reserve_in_usd = ""

    @gl.public.write
    def scan_liquidity(self, token_address: str) -> None:
        ...

    @gl.public.view
    def get_reserve_in_usd(self) -> str:
        return self.reserve_in_usd
```

**CANH BAY (da an that, mat ~1 gio debug):** khong duoc dat dong comment thuan
(`# ...`) giua dong `{ "Depends": ... }` va dong `import` dau tien. Local
`genvm-linter validate` van pass binh thuong nhung deploy that len studionet
se bi consensus tu choi voi loi `invalid_contract` (khong co traceback, stdout/
stderr rong). Comment cuoi dong code (inline, sau code) thi khong sao. Muon
ghi chu dai thi dat SAU dong import, truoc class.

## Web + LLM + Equivalence Principle (verify tu contracts/football_bets.py chinh thuc + rugradar.py)

```python
def scan_liquidity(self, token_address: str) -> None:
    pool_url = "https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/" + token_address + "/pools"

    def fetch_reserve() -> str:
        web_data = gl.nondet.web.render(pool_url, mode="text")  # goi web, mode="text" cho JSON API
        data = json.loads(web_data)
        pools = data.get("data", [])
        if not pools:
            return "NO_POOL"
        return str(pools[0]["attributes"]["reserve_in_usd"])

    # strict_eq: moi validator tu chay fetch_reserve doc lap, dong thuan khi khop y het
    self.reserve_in_usd = gl.eq_principle.strict_eq(fetch_reserve)
```

- `gl.nondet.web.render(url, mode="text"|"html")`: doc web trong khoi non-deterministic.
- `gl.nondet.exec_prompt(prompt, response_format="json")`: goi LLM, tra JSON da parse san.
- `gl.eq_principle.strict_eq(fn)`: dung cho du lieu khach quan (API JSON) - tat ca validator phai ra ket qua GIONG HET NHAU.
- `gl.eq_principle.prompt_comparative(fn, principle="...")`: LLM giam khao so sanh 2 ket qua leader/validator theo principle mo ta.
- `gl.eq_principle.prompt_non_comparative(fn, task="...", criteria="...")`: validator khong chay lai fn, chi cham output cua leader theo criteria (dung cho output mo nhu tom tat/loi chao).
- `gl.message.sender_address`: dia chi nguoi goi.
- Tang du lieu AI-observation cua RugRadar (CP2) nen dung `prompt_comparative` voi principle rang buoc dung format JSON dong (has_mint/owner_can_pause/...), khong dung `prompt_non_comparative` (danh cho output mo, khong phu hop voi observation dong).

## Cach test local - KHONG dung glsim tren Windows

`glsim` (genlayer-test[sim]) tai binary GenVM tu GitHub release
(`genlayerlabs/genvm`), release nay CHI co asset cho Linux (amd64/arm64) va
macOS (arm64) - KHONG co ban Windows. Deploy bang glsim tren Windows native
se luon bao `HTTP Error 404: Not Found` bat ke code gi (da kiem chung: ca
contract mau chinh thuc LlmHelloWorld cung fail y het).

=> Project nay dung **studionet** (Studio hosted, `https://studio.genlayer.com/api`)
lam mang test/deploy chinh, khong can Docker/WSL. `gltest.config.yaml`:

```yaml
networks:
  default: studionet
  localnet:
    url: "http://127.0.0.1:4001/api"   # du phong, chi dung neu sau nay co Docker
  studionet: {}
paths:
  contracts: "contracts"
environment: .env
```

studionet tu tao 10 tai khoan test ngau nhien moi lan chay (nhu localnet), khong can cau hinh private key thu cong.

## Cach goi contract qua gltest (verify voi genlayer-test 0.29.2)

```python
from gltest import get_contract_factory

factory = get_contract_factory("RugRadar")   # ten phai khop class trong contracts/
contract = factory.deploy()                   # deploy, tra ve Contract co san

result = contract.scan_liquidity(args=[token_address]).transact()   # method GHI: goi .transact()
value = contract.get_reserve_in_usd(args=[]).call()                  # method DOC: goi .call()
```

Luu y: `contract.method(args=[...])` MOT MINH chi tra ve object `ContractFunction`,
PHAI noi them `.transact()` (method ghi) hoac `.call()` (method doc) moi thuc su
chay. Day la API cua genlayer-test 0.29.2, khac ban cu hon trong 1 so vi du
online (co ban goi thang khong can `.transact()/.call()`).

## Cong cu da cai va verify tren may nay (Windows, khong Docker)

- `pip install "genlayer-test[sim]"` (ban 0.29.2) - dung cho `gltest` (test runner, khong dung `glsim` vi ly do tren).
- `pip install "genvm-linter @ git+https://github.com/genlayerlabs/genvm-linter.git@main"` -
  lint nhanh (`python -m genvm_linter.cli lint <file>`) va validate day du bang GenVM that
  (`python -m genvm_linter.cli check <file>`, lan dau tai ~310MB SDK). Tren Windows PHAI set
  `PYTHONIOENCODING=utf-8` truoc khi chay, neu khong se crash o buoc in ky tu unicode (✓).
- Plugin Claude Code chinh thuc: `claude /plugin marketplace add genlayerlabs/skills` roi
  `claude /plugin install genlayer-dev@genlayerlabs` (nguoi dung tu chay lenh nay trong chat).

## Thoi gian deterministic (verify that o CP1, sua 1 lan bao loi that)

`gl.vm.get_timestamp()` KHONG TON TAI (AttributeError khi chay that, du local
`genvm-linter check` van bao pass - phai dung them `typecheck` moi bat duoc).
Thoi gian giao dich DUNG la:

```python
from datetime import datetime
now = datetime.fromisoformat(gl.message_raw["datetime"].replace("Z", "+00:00"))
```

`gl.message_raw` la dict (`MessageRawType`), co them field ngoai `gl.message`
(vd `datetime`, `is_init`, `entry_kind`...) ma `gl.message` (NamedTuple tien loi)
khong co.

## Kieu du lieu luu on-chain (@allow_storage dataclass)

`int` KHONG duoc phep, phai dung kieu co kich thuoc: `u256`, `i32`, `bigint`...
(loi luc `validate`: "use bigint or one of sized integers").

## Cong cu kiem tra truoc khi deploy - LUON chay ca 2, khong chi 1

- `python -m genvm_linter.cli check <file>` - lint + load/schema, KHONG bat duoc
  loi goi sai ham SDK (vd `gl.vm.get_timestamp()` khong ton tai van "pass").
- `python -m genvm_linter.cli typecheck <file>` - pyright that voi type stub SDK,
  BAT DUOC loi goi sai ham/attribute. Luon chay them cai nay truoc khi deploy that,
  do ~15-60s deploy that len studionet dat hon nhieu.

## Blockscout - shape du lieu da verify that (CP1, token POPE tren Robinhood Chain)

- `GET /tokens/{addr}`: `holders_count`, `total_supply` la STRING (dang raw theo decimals).
- `GET /tokens/{addr}/holders`: `items[].value` (STRING, raw units), `items[].address.is_contract` (bool),
  `items[].address.hash`. Vi LON NHAT theo raw balance THUONG LA CONTRACT POOL AMM (vd Uniswap v4
  PoolManager), khong phai 1 vi ca nhan rug - phai LOC `is_contract == False` truoc khi tinh
  `top_holder_percent`/`whale_holder_count`, neu khong hau het token thanh khoan tot se bi bao nham
  la "top holder giu >50%". Day la quyet dinh thiet ke rieng cua CP1, KHONG co trong scoring-spec.md
  goc (spec chi noi "vi lon nhat", khong noi ro loai tru contract) - can luu y neu tune lai diem sau.
- `GET /smart-contracts/{addr}`: tra `is_verified` (bool) + `source_code` khi verify; dia chi khong
  hop le/chua verify tra HTTP 422 (khong phai 404) nhung van co the co body - fail-closed ve
  `is_verified=False`, KHONG coi day la loi lam UNRESOLVED ca token (rat nhieu memecoin that hop le
  se roi vao truong hop nay).
- `gl.nondet.web.render()` doc Blockscout/GeckoTerminal BINH THUONG (khong bi Cloudflare chan nhu
  WebFetch cua Claude Code tool). Thinh thoang 1-2 validator fetch data SONG (dang doi, gia thay
  doi lien tuc) lech nhau vai giay se lam `strict_eq` khong dong thuan 1 vong - day la dac tinh
  binh thuong khi doc du lieu song qua eq_principle, KHONG phai bug, thu lai la qua (da gap va
  xac nhan trong luc build CP1).

## LLM + equivalence principle - strict_eq KHONG dung duoc voi exec_prompt (verify that CP2)

Da thu that: `gl.eq_principle.strict_eq()` boc quanh `gl.nondet.exec_prompt()` LUON
`NO_MAJORITY` tren studionet, vi moi validator chay 1 MODEL LLM KHAC NHAU (Gemini,
GPT-oss, Kimi, Grok, Minimax, Mistral, Gemma...) theo policy rieng - output khong bao
gio byte-giong-het-nhau du cung 1 prompt. **Phai dung `gl.eq_principle.prompt_comparative`**
cho moi khoi co goi `exec_prompt`, VIET RO principle noi ro tung field bool nao phai
khop:

```python
raw = gl.eq_principle.prompt_comparative(
    fetch_and_analyze,  # closure fetch web + goi exec_prompt, tra ve 1 chuoi JSON
    principle=(
        "Both outputs must have the same boolean value for each of the five keys "
        "has_mint, owner_can_pause, sell_blocked, high_fee, is_proxy, and the same "
        "value for ok and has_source. JSON key order and unrelated formatting do not matter."
    ),
)
```

Ngay ca voi `prompt_comparative`, thinh thoang van gap `MAJORITY_DISAGREE` (cac model
that su doc khac nhau ve 1 doan code mo ho) - tx roi vao `UNDETERMINED`, KHONG ghi
state (dung voi tinh than fail-closed cua platform). Day la dac tinh binh thuong cua
dong thuan da-model cho task phan doan (khac voi CP1 - facts tu API khach quan it
gap tinh trang nay hon). Frontend/logic goi lai nen cho phep retry, KHONG coi day la
loi contract.

## CP3 - 1 cho don gian hoa so voi scoring-spec.md goc (tu quyet, khong hoi lai vi khong doi ket qua nhieu)

`scoring-spec.md` viet UNRESOLVED khi "khong doc duoc CA verified LAN thanh khoan"
(ca 2 cung fail). CP1 da luu `Facts.resolved` la 1 co DUY NHAT (fail-closed ngay
khi 1 trong 2 nguon fail, khong phan biet nguon nao). CP3 dung thang
`not facts.resolved` de quyet UNRESOLVED - tuc la CHAT hon spec chu (chi can 1
nguon fail la UNRESOLVED, khong doi ca 2). Khong sua lai CP1 vi da test that va
on dinh, sua se ton cong test lai ma loi ich khong nhieu (van dung tinh than
fail-closed cua ca du an).

## Nguyen tac bam house style giam khao (khong doi)

- Fetch nguon xong thi cac validator DOC LAP fetch lai va chi chap nhan khi khop.
- AI bi gioi han o "closed-schema observation": tra dung bo field bool da dinh.
- Verdict do CODE suy ra, KHONG de model quyet.
- Fail-closed: thieu/loi data -> UNRESOLVED, khong doan.
- Deploy xong DOC LAI verdict tu chain de chung minh, khong chi khoe leader receipt.
