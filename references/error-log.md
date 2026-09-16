# Log lỗi thật đã gặp khi build RugRadar (cập nhật theo checkpoint)

Ghi lại để không tốn công debug lại lần 2. Mỗi mục: triệu chứng - nguyên nhân gốc - cách sửa.

## CP0

### 1. `glsim` deploy fail `HTTP Error 404: Not Found` với MỌI contract
- **Triệu chứng:** deploy contract mẫu chính thức (LlmHelloWorld) cũng fail y hệt, không phải do code.
- **Nguyên nhân gốc:** `glsim` (genlayer-test[sim]) tải binary GenVM từ GitHub release `genlayerlabs/genvm`. Release đang dùng (`v0.3.0-rc7`) chỉ có asset cho Linux (amd64/arm64) và macOS (arm64), KHÔNG có bản Windows.
- **Cách sửa:** bỏ `glsim`, dùng **studionet** (Studio hosted, `https://studio.genlayer.com/api`) làm mạng test/deploy chính - không cần Docker/WSL. Xem `genlayer-contract-api.md`.

### 2. Deploy that bao `invalid_contract` (khong stdout/stderr, khong traceback)
- **Triệu chứng:** contract giống hệt contract mẫu chính thức nhưng deploy lên studionet bị từ chối. Local `genvm-linter validate` vẫn báo pass bình thường.
- **Nguyên nhân gốc:** có 2 dòng comment thuần (`# ...`) đặt GIỮA dòng `{ "Depends": ... }` và dòng `import` đầu tiên. GenVM host-level từ chối parse, không phải lỗi Python.
- **Cách sửa:** không đặt comment thuần trước dòng `import` đầu tiên. Comment cuối dòng code (inline) thì không sao.

### 3. `contract.method(args=[...])` chỉ trả object, không thực thi
- **Triệu chứng:** gọi trực tiếp `contract.scan_liquidity(args=[...], wait_interval=...)` báo lỗi `unexpected keyword argument`.
- **Nguyên nhân gốc:** `genlayer-test` 0.29.2 đổi API - `contract.method(args=[...])` chỉ trả về `ContractFunction`, chưa thực thi.
- **Cách sửa:** gọi `.transact()` cho method ghi, `.call()` cho method đọc.

## CP1

### 4. `validate` báo lỗi "use bigint or one of sized integers"
- **Triệu chứng:** dataclass `@allow_storage` khai báo field kiểu `int` bị từ chối lúc load contract.
- **Nguyên nhân gốc:** GenVM storage không cho phép Python `int` trần (không giới hạn kích thước).
- **Cách sửa:** dùng kiểu có kích thước: `u256`, `i32`, `bigint`...

### 5. `AttributeError: module 'genlayer.gl.vm' has no attribute 'get_timestamp'`
- **Triệu chứng:** crash lúc chạy that tren studionet. Local `genvm-linter check` (chi lint+validate) van bao PASS, khong bat duoc.
- **Nguyên nhân gốc:** ham nay khong ton tai trong SDK that (co the do tai lieu AI-summary sai, hoac ten ham da doi).
- **Cách sửa:** dùng `gl.message_raw["datetime"]` (string ISO, deterministic - la thoi diem giao dich). Luôn chạy thêm `genvm-linter typecheck` (pyright that) truoc khi deploy, khong chi `check`.

### 6. Top holder theo raw balance gan nhu luon la pool AMM, khong phai vi ca nhan
- **Triệu chứng:** neu tinh top_holder_percent tren TOAN BO holder, token thanh khoan tot nao cung bi bao "top holder giu >50%" (vi do la pool Uniswap/Pons giu thanh khoan, khong phai 1 vi rug).
- **Cách sửa (quyet dinh rieng cua CP1, khong co trong scoring-spec.md goc):** loc bo dia chi co `is_contract == true` truoc khi tinh `top_holder_percent`/`whale_holder_count`.

### 7. Doi khi `scan_token` tra ve `resolved=False` du du lieu that ton tai
- **Triệu chứng:** goi lai voi cung token, cung code, co luc pass co luc fail.
- **Nguyên nhân gốc (xac nhan chi tiet o CP4, xem `eq_outputs` trong tx that):** khong phai chi la "gia doi lien tuc" nhu doan ban dau - da thay ro rang `NondetException: {'causes': ['WEBPAGE_LOAD_FAILED'], 'ctx': {'status': 408, 'body': 'Navigation timeout', 'url': '.../pools'}}`. Mot so validator fetch GeckoTerminal THANH CONG (co data that), mot so bi TIMEOUT (408) - 2 ket qua JSON khac han nhau nen `strict_eq` bao `DISAGREE`. Day la do ha tang web-fetch cua GenVM/GeckoTerminal doi luc cham, khong phai loi code.
- **Cách sửa:** khong phai bug, day la dac tinh binh thuong khi doc du lieu song qua eq_principle. Retry (goi lai scan_token) la qua duoc. CP4 dung ham `_scan_until_resolved` retry toi da vai lan cho on dinh, giong cach 1 frontend that se cho nguoi dung bam "quet lai".

## CP2

### 8. `gl.eq_principle.strict_eq()` boc `exec_prompt()` LUON `NO_MAJORITY`
- **Triệu chứng:** moi lan goi `observe_token` deu fail voi status `CANCELED NO_MAJORITY`.
- **Nguyên nhân gốc:** moi validator tren studionet chay 1 MODEL LLM KHAC NHAU theo policy rieng (Gemini, GPT-oss, Kimi, Grok, Minimax, Mistral, Gemma...). Output text khong bao gio byte-giong-het-nhau du cung 1 prompt.
- **Cách sửa:** dung `gl.eq_principle.prompt_comparative(fn, principle="...")` cho MOI khoi co goi `exec_prompt`, viet ro principle noi tung field bool nao phai khop.

## CP4

### 9b. `gltest` direct mode (test nhanh, mock, khong can mang) cung fail tai `genvm-universal.tar.xz`
- **Triệu chứng:** `direct_deploy("contracts/rugradar.py")` bao `HTTP Error 404` khi tai SDK, dung het thoi gian test cho ca 3 test case.
- **Nguyên nhân gốc:** khac voi CP0 (glsim - van de rieng cua Windows), lan nay xac nhan release `v0.3.0-rc7` cua `genlayerlabs/genvm` KHONG CO asset `genvm-universal.tar.xz` tren BAT KY platform nao (chi co `genvm-linux-*`, `genvm-macos-*`, `genvm-runners-all`). Day la loi packaging that cua `genlayer-test` 0.29.2 (code cu, gia dinh sai ten asset), khong rieng gi Windows.
- **Cách sửa:** khong dung duoc direct mode luc nay voi phien ban nay. Toan bo test CP4 chuyen sang chay that tren studionet (integration test), chap nhan cham hon (~15-60s/case) va can du lieu token that thay vi mock.

## CP5

### 10a. Deploy len testnet_asimov (that, khong phai studionet) fail o buoc doc lai receipt
- **Triệu chứng:** `factory.deploy()` voi `--network testnet_asimov` luon bao
  `DeploymentError: ... Could not decode contract function call to
  getTransactionData(bytes32,uint256) ...` (loi decode ABI cua web3.py). Thu ca
  `genlayer-py` 0.16.3 (ban dang dung) lan 0.18.0 (moi nhat tren PyPI) deu fail
  Y HET, loai duoc gia thuyet "client cu qua".
- **Bang chung tx that su DA duoc mine:** nonce cua vi deploy tang tu 0 len 3
  (dung bang so lan thu deploy), va so du GEN GIAM that (~0.11 GEN mat vi gas)
  sau cac lan thu that bai. Nghia la giao dich deploy DA len chain that, chi la
  `genlayer-py` khong doc lai duoc receipt/dia chi contract qua RPC chuan.
- **Nguyên nhân gốc (nghi ngo, chua xac minh 100%):** ABI cua smart contract
  dieu phoi dong thuan (`ConsensusMain`/tuong duong) tren testnet_asimov khac
  voi ABI ma `genlayer-py` (ca 2 ban) mong doi khi goi `getTransactionData`.
  Co the testnet_asimov dang chay 1 ban contract khac (cu hon hoac dang nang
  cap) so voi ban PyPI cua genlayer-py target toi.
- **Da thu, KHONG sua duoc tu phia minh:** nang cap genlayer-py len 0.18.0 -
  fail y het. Day la van de tuong thich giua cong cu client va mang testnet
  cong khai cua GenLayer, ngoai kha nang sua cua project nay.
- **Chua thu (huong di tiep neu can):** dung `genlayer` CLI chinh thuc
  (npm, khac code path voi `genlayer-py`) de deploy thay vi `gltest` - CLI nay
  KHONG can Docker cho deploy remote (Docker chi can cho `genlayer up` chay
  Studio local). Chua kiem chung duoc trong phien lam viec nay.

### 10a2. Fix that: dung `genlayer` CLI (npm, genlayer-js) thay vi `gltest`/`genlayer-py` cho testnet
- Sau khi xac nhan `genlayer-py` (ca 0.16.3 lan 0.18.0) khong doc lai duoc receipt
  tren testnet_asimov, chuyen sang `genlayer` CLI chinh thuc (`npm install -g
  genlayer`, dung `genlayer-js` ben duoi, code path HOAN TOAN khac genlayer-py)
  - DEPLOY THANH CONG that: `genlayer deploy --contract contracts/rugradar.py`.
- **An toan private key:** KHONG bao gio go private key truc tiep vao lenh
  (se lo qua Bash tool). Dung `genlayer account import --private-key "$KEY"`
  voi `$KEY` lay tu bien shell doc tu `.env` (`KEY=$(grep ... .env | cut ...)`),
  KHONG BAO GIO xuat hien trong noi dung lenh go ra. `genlayer account unlock`
  cache key vao OS keychain de ky giao dich sau do khong can nhap lai.
- **Bug that phat hien qua genlayer CLI (khong thay o studionet/gltest):**
  `genlayer write <addr> scan_token --args "0x1c85..."` bao
  `AttributeError: 'Address' object has no attribute 'lower'`. Nguyen nhan:
  CLI TU SUY LUAN 1 chuoi hex 40 ky tu thanh kieu `Address` (khong quan tam
  contract khai bao tham so la `str`), khac voi `gltest`/Python truyen thang
  `str`. Sua bang ham `_normalize_address()` kiem tra `hasattr(x, "as_hex")`
  truoc khi `.lower()`. Ap dung dau moi public method nhan `token_address`.
  Day la bang chung that su can chuan hoa input o RANH GIOI API, khong the
  gia dinh client nao cung tuan theo dung kieu da khai bao trong schema.
- **Flaky rieng cua testnet_asimov (khac studionet):** nhieu lenh `write`
  bi `Transaction reverted` (loi EVM chung chung, khong phai loi contract)
  hoac `status_name: LEADER_TIMEOUT` (leader khong tra ket qua kip, thuong
  gap voi `observe_token` vi co goi LLM lau hon). Retry vai lan la qua. Day
  la testnet cong khai dang trong giai incentivized (nhieu builder cung dung),
  khac han studionet on dinh.

### 10b. Dia chi khong ton tai bi tinh diem bua thay vi UNRESOLVED
- **Triệu chứng:** phat hien luc thiet ke test "thieu du lieu" - dia chi khong phai token nao van ra `resolved=True` voi diem so.
- **Nguyên nhân gốc:** Blockscout tra HTTP 404 nhung VAN co body JSON hop le `{"message":"Not found"}`. `gl.nondet.web.render()` khong tu raise loi theo status code, chi tra ve body tho. Code cu chi bat exception luc parse JSON (JSON nay parse duoc binh thuong), khong kiem tra field cot loi (`holders_count`) co ton tai hay khong.
- **Cách sửa:** trong `_fetch_token_info`, kiem tra `data.get("holders_count") is None` (hoac `data` khong phai dict) thi coi la fetch that bai (`ok: False`), khong chi dua vao "JSON parse duoc hay khong".

## CP6

### 12. `genlayer-js` (ban browser) treo vinh vien khi contract method doc gap loi
- **Triệu chứng:** goi `client.readContract()` cho 1 token CHUA TUNG duoc
  `scan_token` (contract nem `KeyError`) - trong Node, promise reject binh
  thuong trong duoi 2 giay. Trong TRINH DUYET (qua Vite dev server, cung 1
  ham `readContract` cua cung goi `genlayer-js`), promise KHONG BAO GIO
  resolve lan KHONG BAO GIO reject - treo vinh vien, xac nhan bang debug log
  ghi truc tiep vao DOM (chup man hinh nhieu lan, log "calling getVerdict"
  luon xuat hien nhung "getVerdict returned" khong bao gio xuat hien).
- **Nguyên nhân gốc (nghi ngo, chua dao sau vao source cua genlayer-js):** loi
  RPC tra ve tu GenVM la 1 chuoi rat lon dang Go-struct-dump (khac han JSON
  loi thong thuong). Nghi ngo code xu ly loi cua `genlayer-js` dung API
  Node-only (vd `Buffer`, `util.inspect`) de dinh dang loi nay, khong duoc
  polyfill trong bundle browser cua Vite, gay loi PHU o giua duong xu ly loi
  ma khong bao gio propagate ve thanh 1 promise rejection dung nghia.
- **Cách sửa:** boc MOI le goi `readContract` (get_verdict/get_facts/
  get_observations) bang `withTimeout()` (15s) trong
  `frontend/src/lib/genlayer.ts` - qua 15s khong co ket qua thi coi nhu that
  bai (tra null), UI hien "not found" thay vi treo mai. Day la workaround o
  tang frontend, KHONG sua duoc tan goc vi la loi trong thu vien genlayer-js.

### 13. Contract luu `flags` bang tieng Viet, lo ra giua UI tieng Anh
- **Triệu chứng:** VerdictCard hien dung du lieu that nhung dong "Evidence
  considered" hien nguyen van tieng Viet (vd "Co it nhat 1 vi lon doc lap")
  giua 1 trang toan tieng Anh - phat hien qua chup man hinh that, khong phai
  loi kieu hay loi build.
- **Nguyên nhân gốc:** contract (`compute_verdict`, viet o CP3) ghi cac cau
  ly do bang tieng Viet, truoc khi CP6 chot ngon ngu UI la tieng Anh.
- **Cách sửa:** KHONG sua + deploy lai contract that (ton GEN that, phai chay
  lai ca 3 buoc scan/observe/compute cho moi token da test). Dich o tang
  frontend bang tu dien tinh `translateFlag()` trong
  `frontend/src/lib/flags.ts`, fallback ve nguyen van neu gap cau la chua co
  trong tu dien.

### 11. Doi khi van gap `MAJORITY_DISAGREE` du da dung `prompt_comparative`
- **Triệu chứng:** tx roi vao `UNDETERMINED`, khong ghi state.
- **Nguyên nhân gốc:** cac model that su doc khac nhau ve 1 doan code mo ho (khong phai loi code contract).
- **Cách sửa:** khong phai bug. Frontend/logic goi lai nen cho phep retry, dung tinh la loi.

### 14. Chup man hinh tu dong (pixelshot/CDP) bao SAI la trang bi treo
- **Triệu chứng:** sau khi doi kien truc frontend sang dung 1 vi demo rieng
  (xem quyet dinh o `frontend/README.md`), test lai bang chup man hinh tu
  dong lien tuc 6 lan lien, lan nao cung dung o "Checking the record..." -
  nghi la bug that (khac han hanh vi da thay o CP6, luc do cuoi cung van
  resolve duoc).
- **Nguyên nhân gốc:** KHONG phai bug. Dung Playwright viet script rieng, cho
  du 20 giay that su roi moi chup, thi trang chi mat ~2.6 giay de doc xong va
  hien dung ket qua. Cong cu chup man hinh nhanh (`pixelshot --wait-network-idle`,
  cap ~2-12s tuy lan) bat man hinh dung LUC promise chua kip resolve, roi bao
  cao sai la "treo". Day la gioi han cua chinh cong cu do (khong tin cay cho
  cac lan doc RPC co do tre bien thien), khong phai dac diem cua app.
- **Bai hoc:** gap ket qua "treo" tu chup man hinh tu dong nhieu lan lien
  tiep NHUNG code logic khong co gi bat thuong (khong loi ném ra, khong async
  chain thieu catch) - nen nghi ngo cong cu do truoc, xac minh lai bang cach
  doc that lau (20s+) qua Playwright/console log truc tiep, TRUOC KHI ket
  luan la bug that va di sua code.

### 15. `wasm_trap DeterministicMode` khi scan token HOP (khong bat duoc bang try/except)
- **Triệu chứng:** token HOP luon bao `wasm_trap DeterministicMode` o `scan_token`,
  trong khi POPE chay binh thuong. `try/except` Python bao quanh moi fetch khong
  bat duoc gi ca, vi day la loi cap VM chu khong phai exception Python.
- **Nguyên nhân gốc:** `scan_token` goi 4 endpoint trong CUNG 1 giao dich, tong
  ~626 KB. Rieng `/smart-contracts/{addr}` cua HOP nang 575 KB (kem ca source
  code lan bytecode). GenVM vuot gioi han bo nho roi trap.
- **Cách sửa:** thay `/tokens/{addr}` + `/smart-contracts/{addr}` bang MOT
  endpoint `/addresses/{addr}` (~1 KB, nho hon 540 lan) - no tra ve ca
  `is_verified` lan khoi `token` long ben trong, du cho toan bo Facts.
  `/smart-contracts/` van dung nhung chi o `observe_token`, la giao dich rieng.

### 16. Contract khong deploy duoc len testnet Asimov khi source vuot ~24 KB
- **Triệu chứng:** sau khi them field va comment, moi lan deploy deu treo o
  `NOT_VOTED` roi timeout. Kiem tra tren chain: `status: 0`, `activator: 0x0`,
  `createdTimestamp: 0` - tuc la tx chua bao gio len chain.
- **Nguyên nhân gốc:** kich thuoc source. Ban deploy duoc o CP5 nang 24.390
  byte; ban moi 27.411 byte thi tach; contract phu FetchDebug (2.458 byte)
  deploy binh thuong cung ngay -> khong phai loi vi hay mang.
- **Cách sửa:** rut gon comment (giu lai cac comment giai thich "tai sao",
  bo cac comment mo ta "cai gi" lap lai ten bien) xuong 19.561 byte. Deploy
  thanh cong ngay lan dau, tx ket thuc `FINISHED_WITH_RETURN` trong ~25 giay.

### 17. Dia chi contract moi deploy nam o `recipient`, khong phai `data.contract_address`
- **Triệu chứng:** script deploy tu viet doc `tx.data.contract_address` nen luon
  thay `undefined`, tuong la deploy that bai du tx da `FINISHED_WITH_RETURN`.
- **Nguyên nhân gốc:** voi giao dich deploy, GenLayer dat dia chi contract moi
  vao truong `recipient` cua transaction.
- **Cách sửa:** doc `recipient`. Hau qua cua nham lan nay: script thu lai 12 lan
  nen da deploy 12 ban contract giong het nhau, chi dung ban cuoi.

### 18. Market cap sai 1000 lan: tron don vi cua 2 nguon
- **Triệu chứng:** KOX ra market cap ~32.8 TRIEU USD trong khi GMGN va bot
  Telegram deu bao ~4-27 NGHIN USD. Meme coin moi tao khong the co von hoa do.
- **Nguyên nhân gốc:** `_market_cap()` lay GIA tu GeckoTerminal nhan voi
  `total_supply` cua Blockscout. Blockscout tra `1e30` raw con GeckoTerminal tra
  `1e27` cho cung token do - lech dung 1000 lan. Cac ty le holder KHONG bi anh
  huong vi ca tu lan mau deu lay tu Blockscout, chi rieng market cap tron 2 nguon.
- **Cách sửa:** doc thang `fdv_usd` co san trong response `/pools` ma contract
  DA goi roi (khong ton them request), xoa han `_market_cap()` va toan bo phep
  toan so nguyen ne softfloat. Gia va cung gio ve chung 1 nguon.
- **Bài học:** khong bao gio nhan/chia 2 con so den tu 2 API khac nhau. Neu mot
  nguon da tinh san ket qua thi lay ket qua do.

### 19. "Transaction reverted to consensus contract" la do TU MINH ghi de gas price
- **Triệu chứng:** goi `scan_token`/`observe_token` bi revert ngay luc gui, khong
  theo quy luat nao. Vi du 49.8 GEN, nonce sach, contract mo phong chay tot.
- **Chẩn đoán sai da di qua (ghi lai de khong lap lai):** (1) "gui 2 tx qua sat
  nhau" - sai; (2) "phai cho tx truoc FINALIZED chu khong phai ACCEPTED" - sai,
  tx deploy da FINALIZED ma van revert.
- **Nguyên nhân gốc:** mieng va `eth_gasPrice = 30 gwei` them o muc 16 de chua
  ket mempool. Consensus contract tinh phi tu gas price, bom len 30 gwei thi no
  tu choi. Thu A/B cung 1 lenh cach nhau 15 giay: khong ghi de -> gui duoc;
  ghi de -> revert.
- **Cách sửa:** bo ghi de. Frontend (`genlayer.ts`) chua bao gio dung mieng va
  nay nen khong bi anh huong.
- **Bài học:** mot ban va cho loi A co the la nguyen nhan cua loi B. Khi gap loi
  la, thu bo cac mieng va cua chinh minh TRUOC khi di dung gia thuyet ve mang.

### 20. Tx dung yen o PENDING: tang consensus cua Asimov ngung xu ly (khong phai loi minh)
- **Triệu chứng:** moi `scan_token` deu khong ghi duoc Facts, ke ca nhanh
  fail-closed. Doc tx bang `getTransaction` thi bao contract `getTransactionData`
  revert voi chu ky `0x1f90236d`.
- **Cac chan doan SAI da di qua (ghi lai de khong lap lai):**
  1. "Token moi tao, du lieu bien dong nen strict_eq khong dong thuan duoc" -
     SAI. Thu doi chung voi HOP (token cu, tung chay ngon) thi cung trugt y het.
  2. "Tx chua tung len chain" - SAI. Tim dung tx EVM theo nonce roi doc receipt:
     `status: success`, gasUsed 920k, 4 log. Giao dich GenLayer CO duoc tao.
  3. "Ma tx client tra ve bi sai" - SAI. Giai ma log cua receipt ra dung ma do.
- **Cách tìm ra nguyên nhân thật:** dem su kien phat ra tu consensus contract
  `0x6CAFF6769d70824745AD895663409DC70aB5B28E` trong 2 cua so 900 block:
  luc 14:10 (chay duoc) co **1318** su kien, luc 02:00 (trugt) chi con **7**.
  Chain van de block binh thuong (62 block/30 giay), vi du tien, nonce sach.
- **Nguyên nhân gốc:** validator cua testnet Asimov ngung nhan viec. Tx nam o
  `PENDING/NOT_VOTED`, da co `activator` nhung `lastLeader = 0x0` va
  `lastVoteTimestamp = 0`.
- **Cách xử lý:** khong co cach nao tu phia minh. DUNG thu lai lien tuc (moi lan
  thu day them 1 tx vao hang doi cua vi, `txSlot` da len toi 18), doi mang hoi
  lai roi chay lai.
- **Bài học:** truoc khi nghi ngo code, do xem HA TANG co dang chay khong.
  Dem su kien on-chain giua 2 khung gio la phep do re va dut khoat.
  Va: `writeContract` tra ve hash KHONG co nghia la tx da chay - phai doc
  receipt EVM va trang thai GenLayer moi biet.

### 21. Nghiem thu ban sua market cap (muc 18) tren studionet
- Asimov van ngung xu ly (muc 20), nen deploy ban contract hien tai len
  studionet bang vi dung 1 lan va chay du scan -> observe -> verdict cho UNFUCK
  (`0x00B75840e990fcA55284E7cFBA608F18f64D841B`). Ca 3 buoc ACCEPTED.
- Ket qua: `market_cap_usd = 6989.36`, GeckoTerminal `fdv_usd = 6989` (khop
  tuyet doi), GMGN = $7,140 (lech 2% do gia nhich giua 2 lan goi). Holders 23
  khop dung GMGN. Truoc khi sua, cung cong thuc cho ra con so gap 1000 lan.
- Verdict: SAFE, risk 5, flags day du. Pipeline dung ve logic; chan duy nhat
  con lai la ha tang Asimov.

### 22. Bradbury (testnet ke nhiem Asimov) nhan deploy nhung ghi van nghen
- **Boi canh:** Bradbury va Asimov la CUNG 1 chain (chain id 4221, so block trung,
  so du vi y het), chi khac consensus contract (Bradbury `0x0112Bf6e...`,
  Asimov `0x6CAFF676...`). GenLayer cong bo Bradbury la testnet ke nhiem.
- **Ket qua thu that (14/9 ~08:15-08:35 UTC):** deploy RugRadar len Bradbury
  ACCEPTED sau ~4.5 phut (`0xe297716bA5Aab8672539D97d646e8010EcCCc6Da`). Nhung
  `scan_token` qua 10 phut khong ACCEPTED, Facts khong ghi duoc, va lenh
  `observe_token` gui sau do bi consensus contract revert ngay luc gui.
- **Doi chung:** cung ban contract, cung token, tren studionet chay tron
  scan -> observe -> verdict trong ~2 phut, va contract van doc lai duoc sau do.
- **Ket luan:** ca 2 testnet cong khai deu nghen o tang xu ly giao dich trong
  khung gio nay; studionet la moi truong duy nhat chay on dinh de demo.
- **Mau lap lai tren ca 2 testnet:** khi 1 tx toi contract con treo, tx tiep
  theo tu cung vi bi revert luc gui. Frontend gui 3 tx noi tiep nen se dinh.

### 23. Phan tren bang chung mot phan khi Blockscout bi chan (user duyet 14/9)
- **Van de goc:** Blockscout bi Cloudflare chan theo dot (HTTP 403, trang
  "Just a moment..."), contract fail-closed ve UNRESOLVED ca khi GeckoTerminal
  van doc duoc pool that. Ban an phu thuoc viec Blockscout co mo cua hay khong.
- **Phat hien them:** Cloudflare chan THEO IP. Cung luc may dev nhan 403 thi
  validator studionet van doc duoc Blockscout (UNFUCK ra SAFE voi du bang
  chung). Canh Blockscout tu IP cua minh KHONG dai dien cho validator.
- **Cach sua:** `Facts.holder_evidence`. Blockscout khong doc duoc NHUNG
  GeckoTerminal co pool -> van ra verdict, +20 co "Holder and
  source-verification evidence unavailable", bo qua moi co dua tren holder
  (ke ca co xanh). Khong co pool lan Blockscout -> van UNRESOLVED. Loi fetch
  chuan hoa ve chuoi co dinh "unavailable" de validator gap loi khac chu van
  dong thuan. Chi tiet: `scoring-spec.md` muc "Phan tren bang chung mot phan".
- **Kiem chung that tren studionet:** (1) dia chi bia -> UNRESOLVED, fail-closed
  giu nguyen; (2) ban sao contract chi doi `BLOCKSCOUT_BASE` sang URL tra HTML
  -> `holder_evidence=false`, verdict SUSPICIOUS 30 = 20 + 10 (pool < 24h).
- **Hanh vi da biet:** khi Blockscout chan, `observe_token` ket thuc o trang
  thai undetermined (giam khao LLM cua prompt_comparative) nen khong ghi
  Observations. Verdict khong anh huong (coi nhu AI chua quan sat), UI an
  khoi loi khai AI.

### 24. Top 10 holder lech GMGN: vi dot bi tinh la nguoi, vi thong minh bi loai oan
- **Trieu chung:** token 富贵 `0xceebf25b318201f1f949be2fabbfcee231737139`
  contract ra top 10 = 20%, GMGN = 14.26%.
- **Dao nguoc cach GMGN tinh:** lay top holder cua GMGN, bo dia chi dot (10.76%),
  pool `0xec52` (5.37%) va "sandwich_bot" `0x8366` (3.15%) thi 10 vi con lai cong
  ra dung 14.26%. "sandwich_bot" thuc ra la PoolManager cua Uniswap V4
  (GMGN `addr_type=2` = pool).
- **Nguyen nhan goc (2 loi nguoc chieu):**
  1. `0x...dead` khong phai contract nen bi tinh la "vi ca nhan lon nhat" (10%).
  2. Bo dia chi dot xong thi ra 10%, THAP hon GMGN. Do Blockscout qua 1 contract
     do tren studionet (may dev bi Cloudflare chan): Blockscout gan
     `is_contract=true` cho vi thong minh cua nguoi that, `proxy_type` =
     `eip7702` hoac `erc7760`. 7/15 top holder bi loai oan vi vay.
- **Cach sua:** `_is_person()`: bo dia chi dot, bo contract, NHUNG giu contract co
  proxy kieu vi thong minh. Sau sua: top 10 = 14% (GMGN 14.26%), so vi lon doc
  lap 6 -> 13. Contract `0x3035D639c3d7af963E3d50d80496Ba0677d22AEa`.
- **Khong phai loi (de nguyen, chi doi nhan):** tuoi pool on-chain 61 ngay vs GMGN
  5 ngay. GMGN hien `open_timestamp` (luc token tot nghiep launchpad Pons, mo giao
  dich); pool thi duoc tao san tu 61 ngay truoc. Moc mo giao dich chi GMGN co. UI
  doi nhan on-chain thanh "Pool created", khoi Market data dung `open_timestamp`.

### 25. Rut ngan thoi gian: so tham tren 1 node + gui song song (meme coin can nhanh)
- **Muc tieu:** ban an dong thuan mat ~70s. Voi meme coin vai giay la quan trong.
- **Gui song song:** `scan_token` va `observe_token` khong phu thuoc nhau. Gui cung
  luc tu CUNG 1 vi tren studionet: 2 tx tach biet, ca 2 ghi thanh cong. Tong ban an
  ~70s -> ~56s (song song 47.5s + compute 8.7s).
- **So tham `preview_token(token, now_iso)`:** dung CHUNG `_gather_facts` va `_score`
  voi ban an that (tach ra tu scan_token/compute_verdict), tra Verdict khong ghi state.
- **Cac duong thu va ket qua that:**
  1. `readContract` (gen_call type "read") goi ham ghi: studionet tra
     "GenVM internal error" / "execution failed". Doi chung `scan_token` cung loi y
     het -> khong phai loi code moi, studionet chan goi ham ghi theo kieu read.
  2. `simulateWriteContract` (gen_call type "write"): CHAY, tra ve dang `Map`.
     `leaderOnly: true` 4.0s, `false` 5.6s. Khong can vi.
- **Bay:** khi chay thu, node dung `message_raw["datetime"]` GIA co dinh
  (`2024-11-26T06:42:42Z`) -> tuoi pool = 0 -> so tham gan nham co "pool < 24h" cho
  token 61 ngay tuoi. Sua: `preview_token` nhan `now_iso` tu trinh duyet; ban an that
  van dung gio giao dich (deterministic).
- **Sau sua:** so tham token 富贵 ra SAFE 0 voi dung co "Three or more independent large
  holders", TRUNG ban an dong thuan. Contract `0xd92B92E377244D4508ad4eff2e115035dD8AC7FC`.

### 26. UI: logo bi chan, va khoi Market context lap toan bo On-chain record
- **Trieu chung (nguoi dung bao):** thieu logo token trong khoi Market context;
  On-chain record va Market context hien gan nhu CUNG 1 noi dung (MC, Liq, Price,
  Holders, volume, buys/sells, Top10 deu co o ca 2 khoi).
- **Logo - nguyen nhan:** gmgn.ai gan header `Cross-Origin-Resource-Policy: same-origin`
  cho anh, trinh duyet tu choi tai (`NotSameOrigin`), da tat han logo o muc 25.
- **Logo - cach sua:** `images.weserv.nl`, proxy anh cong khai, tai ho o phia server
  roi tra lai voi `Cross-Origin-Resource-Policy: cross-origin` va
  `Access-Control-Allow-Origin: *` - da kiem tra song (HTTP 200, header dung) truoc
  khi dung. Luu y khi tu kiem tra: chup man hinh QUA SOM se thay "khong co logo" du
  code dung, vi <img> tai bat dong bo; phai cho `img.complete === true` moi ket luan.
- **Trung lap - nguyen nhan:** thiet ke ban dau muon 2 khoi doc lap de doi chieu,
  nhung hien thi toan bo so lieu GMGN thay vi chi phan khac biet, nen nhin nhu lap.
  Toan bo grid (MC/Liq/Price/Holders/volume/buys-sells/Top10) trung 1-1 voi
  On-chain record; chi Honeypot/Open source/Blacklist/Renounced/tax la rieng GMGN.
- **Cach sua:** Market context CHI con hien nhung gi GMGN co ma on-chain khong co:
  Trading opened (open_timestamp, khac "Pool created" tren on-chain la luc TAO pool),
  Buy/sell tax, Honeypot, Open source, Blacklist, Renounced. Bo han cac Stat
  MC/Liq/Price/Holders/volume/buys-sells/Top10 khoi khoi nay.

### 27. Lam gon giao dien theo phan hoi nguoi dung (15/9)
- **Phan hoi:** Market context tach rieng 1 the ben duoi nhin "lac que" voi
  On-chain record; logo qua nho; UI chi chiem ~50% chieu ngang man hinh; can
  dark mode.
- **Gop the:** xoa han component `MarketPanel.tsx`. Logic doc GMGN va toan bo
  phan hien thi (logo, "Trading opened", tax, honeypot, open source, blacklist,
  renounced) chuyen vao thang trong `VerdictCard`, hien o cuoi CUNG 1 the,
  ngan cach bang 1 duong ke - khong con the roi rac.
- **Logo:** to hon (64px, 80px o man rong), hinh vuong `rounded-xl` (khong con
  tron `rounded-full`), dat dau the canh ten token.
- **Rong hon:** container App.tsx tu `max-w-3xl` (768px) len `max-w-6xl`
  (1152px). Fact list (On-chain record, Source code testimony) chuyen sang
  luoi 2 cot tu breakpoint `sm` de dung het chieu rong, van 1 cot o dien thoai.
- **Dark mode:** Tailwind v4 dung `@custom-variant dark (&:where(.dark, .dark *))`
  thay vi theo `prefers-color-scheme` mac dinh, de nut bam o goc tren-phai chu
  dong duoc chu khong bi he dieu hanh ghi de. Luu lua chon vao localStorage.
  Tach rieng token mau `--color-accent`/`--color-on-accent` cho nut CTA thay vi
  dung chung `--color-ink` (`ink` doi vai tro sang/toi giua 2 theme, dung chung
  se lam nut CTA mat tuong phan o 1 trong 2 theme).
- **Kiem chung:** chup man hinh that ca light/dark (1440px) va di dong (390px,
  khong tran ngang), xac nhan logo hien dung, khong con trung du lieu giua 2
  khu vuc, nut CTA tuong phan tot ca 2 theme.

### 28. "Check the record" khong lam moi Facts, chi doc lai ban an cu (15/9)
- **Phan hoi:** bam "Check the record" nhieu lan nhung Market cap van dung yen,
  du gmgn.ai cho thay gia da doi. Nghi la loi dong bo.
- **Chan doan lai (lan truoc do sai lop):** lan truoc toi chi kiem tra "app co
  goi lai GMGN khong" (co) nhung do KHONG PHAI so nguoi dung dang nhin. So MC
  ho dang so la o khoi "On-chain record", va so do doc tu `get_verdict` - 1 VIEW
  CALL doc thang state da luu, KHONG quet lai gi ca. No chi doi khi co ai bam
  "Request a new hearing" (quet lai that, ~1 phut). Bam "Check the record" lai
  bao nhieu lan cung ra dung 1 so do.
- **Cach sua:** them `preview_facts(token_address, now_iso)` ben canh
  `preview_token` da co - dung lai `_gather_facts`, tra Facts tuoi qua 1 node
  (simulateWriteContract, leaderOnly, ~5-7s), KHONG dong thuan, KHONG ghi chain.
  Moi lan "Check the record" (ke ca khi da co ban an), frontend goi ham nay de
  lam moi MC/gia/holder/pool hien thi, con diem so/flags/badge VAN la ban an da
  dong thuan (khong the "song" tung giay vi can nhieu validator dong y). The
  hien ro "Live reading as of HH:MM:SS" canh "On-chain record", tach biet voi
  dong "Ruled on ..." (thoi diem ban an chinh thuc) o cuoi the.
- **Kiem chung that:** SHIB-clone (top10 74%), bam check 2 lan cach nhau vai
  giay, ca 2 lan deu hien "Live reading as of ..." (khong con dong bang tu lan
  quet dau). Contract moi `0x36A0a2469473cEc4f2573DA07F386092F58FE8c7`.

### 29. Nghi risk_score = 0 qua nhieu la de hieu, nhung khong phai luon sai
- **Phan hoi:** thang diem 0-100 ma token nao cung ra gan 0, nhin nhu vo dung.
- **Tra cuu chuan nganh:** RugCheck, GoPlus, TokenSniffer, va chinh GMGN deu coi
  LP khoa/dot va % dev con giu la tin hieu nang, ngang hoac hon ca phan bo
  holder - hai thu RugRadar chua kiem. Day la lo hong that.
- **Nhung kiem thu that lai cho ket qua khac:** tra du lieu LP-lock/dev-holdings
  that cua GMGN cho dung con token dang bi nghi (SWARM) thi CUNG sach: 95% LP
  gui vao dia chi dot, dev giu 0%, `flags: []` tu chinh GMGN. Tuc voi RIENG con
  nay, nghi ngo la sai - du liem sat ca tieu chuan day du van ra thap.
- **Chung minh thang diem CO phan biet duoc:** loc 60 token moi nhat tren
  Robinhood qua GMGN rank, tim duoc SHIB-clone `top_10_holder_rate = 74%`.
  Quet qua RugRadar ra **risk_score = 22** (khac han 0), voi 3 co do that:
  vi lon nhat >50%, top 10 >50%, kem theo co xanh. Xac nhan thang diem hoat
  dong dung khi co bang chung that, khong phai luon tra ve 0.
- **Ket luan:** giu nguyen cong thuc cham diem hien tai, khong sua vi 2 ly do
  tren da du chung minh no hoat dong dung. Lo hong LP-lock/dev-holdings van
  con that su nhung khong doi ket qua cua cac token da test hom nay.

### 30. "Real-time" nghia la tu dong cap nhat, khong phai "moi lan bam moi"
- **Phan hoi:** ban sua o muc 28 (lam moi Facts khi bam "Check the record") van
  chua du. Nguoi dung muon so TU DONG doi trong luc trang dang mo, khong can
  bam lai gi ca.
- **Cach sua:** chuyen logic doc Facts song vao HAN TRONG `VerdictCard`, tu
  goi `preview_facts` ngay khi mo the va lap lai moi 15 giay (`setInterval`)
  suot luc trang con mo, tam dung khi tab bi an (`document.hidden`) de do tai.
  App.tsx chi con truyen Facts BAN DAU (tu chain) de hien ngay lap tuc trong
  luc cho lan doc song dau tien. Nhan doi thanh "Live, updates automatically -
  last read HH:MM:SS".
- **Kiem chung that:** mo the SHIB-clone, KHONG bam gi trong 33 giay, nhan
  thoi gian tu dong xuat hien va tu dong doi - dung 15s dinh ky, khong can
  tuong tac.

### 31. Phat hien qua chinh viec test muc 30: holder_evidence khong bao het loi that
- **Trieu chung phat hien khi theo doi polling lien tuc:** Top individual
  holder va Top 10 dot ngot ve 0% giua 2 lan doc, trong khi Holders van dung
  va Source verified van Yes - khong phai gia giam, ma la du lieu sai.
- **Nguyen nhan goc:** `holder_evidence` (co bao gio hien "Unavailable" hay
  khong) chi theo doi `_fetch_address_info` (`blockscout_ok`), KHONG theo doi
  rieng `_fetch_holders` (endpoint /tokens/{addr}/holders). Khi endpoint
  holders loi tam thoi (vd Blockscout chan) ma endpoint address van song, ca 3
  truong top_holder_percent/top10_percent/whale_holder_count lang le ve 0,
  con holder_evidence van bao True - hien "0%" nhu the da kiem tra that, thay
  vi "Unavailable". Loi nay ton tai tu truoc (ca trong scan_token/ban an chinh
  thuc), chi la it lo dien vi 1 lan doc consensus (5 validator) it kha nang
  cung lo hon 1 lan doc single-node lap lai lien tuc qua polling.
- **Da grep ca file:** chi dung 1 cho co kieu loi nay (`.get("ok")` dung sai);
  `observe_token` da xu ly dung tu dau (Observations(observed=False) khi loi).
- **Cach sua:** `holder_evidence = blockscout_ok and holders_info.get("ok")`.
  Ap dung cho ca `scan_token` (ban an chinh thuc) lan `preview_facts`/
  `preview_token` (dung chung `_gather_facts`). Contract moi:
  `0x51A01B0C61D05Fb53d2101b5d5c32fD85bF38422`.

### 32. Xac nhan sau khi sua: diem da phan biet duoc thay vi tap trung ve 0
- **Ket qua quet lai 5 token demo tren contract da sua mau so (muc 31 phan sau):**
  HOP risk=0 top10=38%, SWARM risk=0 top10=23%, SHIB-clone risk=10 top10=57%,
  GS risk=20 top10=94%, Wealth risk=0 top10=15%.
- So voi truoc khi sua (hau het top10 duoi 20%, nhieu token 0%), gio da co dai
  gia tri that su phan biet (15% -> 94%), va GS da gan sat nguong SUSPICIOUS
  (>25). Xac nhan `error-log.md` muc 31 sua dung goc re, khong chi la mot ca
  don le cua SHIB-clone.
- Contract cuoi cung dung cho CP7: `0xFF67ec10779B693deeb98D8D7D2F02b705841b50`.

### 33. "0/100" doc nham thanh diem xau: doi sang Safety score
- **Phan hoi (lap lai it nhat 2 lan qua nhieu token khac nhau):** thay diem 0
  cho token SAFE, nguoi dung doc nham la "0 diem" kieu thang diem so (cao =
  tot), trong khi day la `risk_score` (cao = nguy hiem, thap = an toan).
- **Khong phai loi tinh toan** - da kiem chung nhieu lan diem tinh dung theo
  scoring-spec.md. Day la van de doc hieu UI: nhieu nguoi thay so 0-100 mac
  dinh nghi cao la tot.
- **Cach sua:** contract VAN luu va tinh `risk_score` nhu cu (khong doi logic
  cham diem). Rieng FRONTEND hien `100 - risk_score` voi nhan "safety score"
  (cao = an toan, dung truc giac). Sua o `VerdictCard` va `PreliminaryCard`.
- **Kiem chung that:** BLAST co risk_score=0 tren chain, UI hien dung
  "100 / 100 safety score".
