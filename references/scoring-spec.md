# Spec chấm điểm (CODE quyết, AI chỉ quan sát)

Nguyên tắc: AI trả các quan sát đóng (true/false/số). CODE contract cộng trừ ra điểm rủi ro 0-100 và verdict. Điểm càng cao càng nguy hiểm.

## Đầu vào tầng CODE

Từ tầng dữ liệu (facts, đọc thẳng từ API, không cần AI):
- `holders_count` (số)
- `top_holder_percent` (số, % supply ví lớn nhất giữ)
- `is_verified` (bool)
- `reserve_in_usd` (số, thanh khoản)
- `volume_24h_usd` (số)
- `buys_24h`, `sells_24h` (số)
- `pool_age_hours` (số)
- `whale_holder_count` (số ví lớn độc lập nằm trong holder)

Từ tầng quan sát AI (đọc source code, chỉ trả bool):
- `has_mint` (owner in thêm token được)
- `owner_can_pause` (owner chặn giao dịch được)
- `sell_blocked` (có logic chặn bán)
- `high_fee` (phí mua/bán cao bất thường hoặc chỉnh được tuỳ ý)
- `is_proxy` (contract proxy, code tráo được)

## Cách tính (đề xuất, chỉnh trong code)

Bắt đầu `risk = 0`. Cộng theo cờ đỏ:
- `is_verified == false` -> +20
- `has_mint == true` -> +15
- `owner_can_pause == true` -> +10
- `sell_blocked == true` -> +25 (nặng, đây là honeypot rõ)
- `high_fee == true` -> +10
- `is_proxy == true` -> +10
- `top_holder_percent > 50` -> +20 ; `> 30` -> +10
- `holders_count < 50` -> +10
- `reserve_in_usd < 5000` -> +15 ; không có pool -> +25
- honeypot hành vi: `buys_24h >= 20` và `sells_24h == 0` -> +20
- `pool_age_hours < 24` -> +10

Trừ theo cờ xanh:
- `whale_holder_count >= 3` -> -15 ; `>= 1` -> -8

Chặn biên: `risk = max(0, min(100, risk))`.

## Verdict (CODE map từ risk)

- `risk <= 25` -> SAFE
- `26 <= risk <= 60` -> SUSPICIOUS
- `risk > 60` -> SCAM
- Thiếu data lõi (không đọc được cả verified lẫn thanh khoản) -> UNRESOLVED (fail-closed, không map điểm)

## Đầu ra lưu on-chain

`{ token_address, risk_score, verdict, flags: [danh sách cờ đã bật], observed_at }`. Kèm lý do đọc được (mỗi cờ 1 câu ngắn) để hiện lên UI.

## Ghi chú chống over-engineering

- Trọng số ở trên là điểm khởi đầu, chỉnh bằng vài token thật rồi khoá lại. KHÔNG làm hệ thống trọng số cấu hình động lúc chưa cần.
- Đừng thêm cờ mới nếu data không đọc được thật (vd LP lock chính xác để v2).
