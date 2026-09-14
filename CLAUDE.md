# CLAUDE.md - RugRadar (GenLayer Agent Tank Hackathon)

Đây là file điều phối cho dự án. Đọc file này ĐẦU TIÊN mỗi phiên. Khi làm việc, nghía lại các file trong `references/` được trỏ ở dưới.

## 1. Dự án là gì (1 câu)

RugRadar: một Intelligent Contract trên GenLayer nhận địa chỉ 1 token trên Robinhood Chain, đọc dữ liệu on-chain sống (holder, thanh khoản, mua/bán, source code), rồi CODE CONTRACT tự chấm điểm rủi ro 0-100 và ra verdict SAFE / SUSPICIOUS / SCAM kèm lý do, lưu on-chain. Nhiều validator chạy AI rồi đồng thuận.

## 1b. Khung dự thi: ONCHAIN JUSTICE

Đóng khung RugRadar là "toà án token phi tập trung": đưa bằng chứng on-chain + bộ luật an toàn công khai vào, mạng validator AI tuyên SAFE/SCAM, bản án ghi on-chain ai cũng kiểm chứng được. Đây là theme "Onchain Justice" của hackathon (kiểm duyệt theo luật công khai, phán từ bằng chứng). Mọi mô tả, README, UI, content phải bám ngôn ngữ toà án/phân xử/bằng chứng/luật công khai, KHÔNG dùng ngôn ngữ "snipe kiếm lời" (dễ bị coi là shill degen, sai tông giám khảo). "Bị cáo" là con token, không phải 1 vụ tranh chấp giữa người.

## 2. Quyết định thiết kế đã CHỐT (không tự đổi, muốn đổi phải hỏi)

- CODE quyết định điểm số và verdict. AI (LLM) CHỈ trả quan sát đóng (closed observation) dạng có/không cho từng dấu hiệu, không tự tính điểm. Lý do: LLM tính toán không đáng tin, và giám khảo GenLayer thưởng đúng kiểu "AI quan sát, code phán".
- 2 nguồn dữ liệu (đã verify sống, xem `references/data-sources.md`): Blockscout (holder, verified, source code) + GeckoTerminal network "robinhood" (thanh khoản, volume, mua/bán, tuổi pool).
- Fail-closed: thiếu data hoặc không đọc được thì trả UNRESOLVED, KHÔNG đoán bừa.
- Chain: contract chạy trên GenLayer **Studionet** (user chốt 14/9 sau khi cả Asimov lẫn Bradbury nghẽn xử lý giao dịch, xem `error-log.md` mục 20-22). Bản trên Bradbury `0xe297716bA5Aab8672539D97d646e8010EcCCc6Da` chỉ để làm bằng chứng đã deploy lên testnet công khai. Token cần chấm nằm trên Robinhood Chain (Chain ID 4663), chỉ ĐỌC, không giao dịch.
- Frontend: làm 1 trang đơn giản (nhập địa chỉ token, ra điểm + lý do). Không bắt buộc theo luật hackathon nhưng là điểm khác biệt vì đa số đối thủ chỉ nộp contract thuần. Xem `references/competitor-notes.md`.

## 3. Nguyên tắc chống over-engineering (BẮT BUỘC)

- Ưu tiên giải pháp ĐƠN GIẢN NHẤT chạy được. Không thêm abstraction, tính năng, hay tham số ngoài yêu cầu.
- Contract viết vừa đủ. KHÔNG proxy nâng cấp, KHÔNG tham số hoá quá mức, KHÔNG admin key nếu chưa cần.
- Muốn làm phức tạp thêm (thêm nguồn data, thêm tầng, thêm tính năng) thì HỎI trước, không tự ý.
- Chỉ làm đúng những gì đã thống nhất trong file này.

## 4. Quy tắc LUÔN áp dụng (BẮT BUỘC)

- KHÔNG dùng dấu gạch dài (em dash) trong mọi code, comment, content, README. Chỉ dùng "-" hoặc bỏ.
- Xử lý điều kiện tiên quyết TRƯỚC: build 1 chức năng cần bước tiên quyết thì kiểm tra và xử lý bước đó trước, không nhảy thẳng vào chức năng chính.
- Báo lỗi thì CHẨN ĐOÁN nguyên nhân gốc và giải thích TRƯỚC, chờ duyệt rồi mới sửa code.
- Gặp thứ không làm được (tool/mạng/asset bị chặn, thiếu quyền, thiếu file, API die) thì BÁO NGAY lúc phát hiện, dừng lại hỏi, không tự lách.
- Đặt tên biến và hàm trong code PHẢI tiếng Anh toàn bộ.
- Khi in code ra cho user đọc: mỗi dòng code kèm 1 comment giải thích dòng đó làm gì. Phần nào tự đặt tên (biến, hàm tự viết) đánh dấu bằng comment # để phân biệt với từ khoá/tên do thư viện quy định.
- API/thư viện ngoài: xác minh còn sống thật trước khi dùng.

## 5. DANH SÁCH CHECKPOINT (làm tuần tự, xong cái nào tick cái đó)

- [x] CP0 - Setup: đã verify API thật (`gl.nondet.web.render`, `gl.nondet.exec_prompt`, `gl.eq_principle.strict_eq/prompt_comparative/prompt_non_comparative`), dựng khung `contracts/`, `tests/direct/`, `tests/integration/`. Test local dùng **studionet** (Studio hosted, không cần Docker - glsim không có bản Windows). Contract mini `contracts/rugradar.py` đã deploy thật lên studionet và đọc được `reserve_in_usd` sống từ GeckoTerminal (validator đồng thuận qua strict_eq). Chi tiết + cạm bẫy đã gặp: `references/genlayer-contract-api.md`.
- [x] CP1 - Tầng dữ liệu: `contracts/rugradar.py` có `scan_token(token_address)` đọc thật Blockscout (token info, holders, verified) + GeckoTerminal (pool), lưu `Facts` (holders_count, top_holder_percent, whale_holder_count, is_verified, has_pool, reserve_in_usd, volume_24h_usd, buys_24h, sells_24h, pool_age_hours, resolved) qua `gl.eq_principle.strict_eq`. Đã test thật trên studionet với token POPE (verified, có pool) - ra facts hợp lý. Quyết định riêng: `top_holder_percent`/`whale_holder_count` loại trừ địa chỉ contract (pool AMM) khỏi tính toán - xem lý do trong `references/genlayer-contract-api.md`. Cạm bẫy đã gặp: `gl.vm.get_timestamp()` không tồn tại, phải dùng `gl.message_raw["datetime"]`.
- [x] CP2 - Tầng quan sát AI: `observe_token(token_address)` đọc source code từ Blockscout + hỏi LLM qua `gl.eq_principle.prompt_comparative` (KHÔNG dùng strict_eq - đã verify strict_eq luôn NO_MAJORITY với exec_prompt vì mỗi validator chạy model khác nhau), trả về `Observations` (has_mint, owner_can_pause, sell_blocked, high_fee, is_proxy, observed). AI chỉ trả bool, code không nhờ AI tính điểm. Test thật trên studionet với token POPE - ra đủ 5 cờ, đúng closed-schema. Chi tiết: `references/genlayer-contract-api.md`.
- [x] CP3 - Tầng chấm điểm (CODE): `compute_verdict(token_address)` - hàm thuần code (không nondet), đọc `Facts` + `Observations` đã lưu, cộng/trừ điểm đúng `references/scoring-spec.md`, chặn 0-100, ra `Verdict` (resolved, risk_score, verdict, flags, observed_at). UNRESOLVED khi `Facts.resolved == False` (đơn giản hoá 1 chỗ so với spec gốc - xem ghi chú trong `genlayer-contract-api.md`). Test thật trên studionet: pipeline đầy đủ scan→observe→verdict ra SAFE hợp lý; gọi compute_verdict khi chưa scan ra đúng UNRESOLVED.
- [x] CP4 - Test: `tests/integration/test_cp4_scenarios.py` test 3 nhánh (token sạch vs rủi ro hơn, thiếu data → UNRESOLVED, rescan không hỏng state/không lẫn giữa 2 token) trên studionet thật (direct mode local không dùng được - xem lỗi #9b trong `error-log.md`). Tìm được 2 bug thật lúc thiết kế test và đã sửa: (1) pool_age tính nhầm cả khi không có pool, (2) địa chỉ không tồn tại (404 "Not found") không bị coi là fetch lỗi. Mỗi nhánh đã pass ít nhất 1 lần chạy thật; còn flaky do GeckoTerminal/GenVM web-fetch thỉnh thoảng timeout 408 (đặc tính hạ tầng, có retry, không phải bug contract).
- [x] CP5 - Deploy testnet + đọc lại verdict từ chain: `genlayer-py`/`gltest` không dùng được để deploy/gọi lên testnet_asimov thật (lỗi decode ABI, xem `error-log.md` #10a) - chuyển sang **`genlayer` CLI chính thức (npm, genlayer-js)** thì deploy + gọi thành công. Contract hiện dùng (studionet): `0x391231076da23971aF9cF90eD8816B1E44c4A755` (bản Asimov cũ `0xE26f7DFeA81AC9E5b130608B4C074A4E3F57A0AD`). Đã chạy đủ `scan_token` → `observe_token` → `compute_verdict`, đọc lại bằng `genlayer call get_verdict` (lệnh riêng biệt, không phải receipt của tx ghi) ra `{resolved: true, verdict: SAFE, risk_score: 0}` - chứng minh chạy thật trên chain. Bug thật phát hiện qua CLI: tham số địa chỉ bị suy luận thành kiểu `Address` thay vì `str`, đã sửa bằng `_normalize_address()` áp dụng ở mọi method public. Ví deploy riêng (không phải ví chính user) đã tạo, private key chỉ nằm trong `.env` cục bộ, không lộ ra chat.
- [x] CP6 - Frontend đơn giản: `frontend/` (Vite + React + TS + Tailwind v4 + genlayer-js, UI tiếng Anh). Nhập địa chỉ token -> đọc `get_verdict` (view, không cần ví) -> nếu chưa có thì app TỰ KÝ tuần tự `scan_token → observe_token → compute_verdict` trên testnet Asimov thật bằng 1 ví demo riêng của app (KHÔNG cần người xem có ví/GEN) -> hiện risk score/verdict/flags/facts. Quyết định có chủ định, đã cảnh báo rủi ro và được user xác nhận: private key ví demo (không giữ tài sản thật, chỉ GEN testnet) nhúng vào bundle JS qua `VITE_DEPLOYER_PRIVATE_KEY` - xem lý do + cảnh báo an toàn đầy đủ ở `frontend/README.md` mục "Quyết định: ví demo ở phía frontend". Đã test qua browser thật (pixelbrowse + Playwright), sửa 3 lỗi thật phát hiện qua đó: (1) `genlayer-js` bản browser treo vĩnh viễn khi contract trả lỗi thay vì reject như Node - vá bằng timeout 15s; (2) `flags` trong contract viết tiếng Việt (từ CP3) lộ ra giữa UI tiếng Anh - dịch ở tầng frontend thay vì deploy lại contract; (3) pixelshot/CDP screenshot tự động báo sai "treo trang" do timing bắt màn hình, không phải bug thật - xác minh lại bằng Playwright chờ đủ 20s. Chi tiết: `frontend/README.md`, `references/error-log.md` mục 12-14.
- [ ] CP7 - Nộp bài: README rõ ràng, public GitHub repo, quay demo, submit trên Agent Tank TRƯỚC deadline 17/9 15:30 UTC.

## 6. File tham chiếu (đọc khi cần)

- `references/genlayer-contract-api.md` - API viết Intelligent Contract (web, LLM, equivalence principle). Đọc trước CP1, CP2.
- `references/data-sources.md` - endpoint Blockscout + GeckoTerminal đã verify, field trả về. Đọc trước CP1.
- `references/scoring-spec.md` - danh sách cờ đỏ/xanh, cách code tính điểm và verdict. Đọc trước CP2, CP3.
- `references/competitor-notes.md` - đối thủ làm gì, house style giám khảo thích, cách né đụng hàng. Đọc khi phân vân hướng đi.
- `references/error-log.md` - log lỗi thật đã gặp + cách sửa theo từng checkpoint (tránh debug lại lần 2). Đọc khi gặp lỗi lạ, hoặc trước khi bắt đầu 1 checkpoint mới để biết cạm bẫy đã biết.

## 7. Skill Claude nên dùng theo giai đoạn

- Bắt đầu ý tưởng mới: dapp-discovery (ĐÃ XONG cho dự án này).
- Viết/sửa contract: vibe-code-dapp (lưu ý: skill này gốc Solidity/Hardhat, GenLayer dùng Python nên chỉ lấy nguyên tắc, không lấy cú pháp Solidity).
- Test + quét bảo mật contract: contract-test-audit (chỉ nguyên tắc test/coverage; GenLayer không dùng Foundry/Slither được, test bằng công cụ GenLayer).
- Sửa lỗi / thêm bớt chức năng: code-change-workflow (chẩn đoán trước, chờ duyệt).
- Frontend: design-taste-frontend hoặc minimalist-ui cho gu, dùng genlayer-js thay wagmi.
- Viết content giới thiệu dự án (nếu cần đăng X): blockchain-content-writer + humanize-writing.
