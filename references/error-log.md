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
