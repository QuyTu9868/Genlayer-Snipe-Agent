# Nguồn dữ liệu (đã verify sống ngày 7/9/2026)

Agent chỉ ĐỌC 2 nguồn GET công khai. Cả hai trả JSON, hợp với web access của GenLayer.

## 1. Blockscout - Robinhood Chain explorer

Base: `https://robinhoodchain.blockscout.com`

- Danh sách token: `GET /api/v2/tokens?type=ERC-20`
  - Field mỗi token: `address_hash`, `name`, `symbol`, `decimals`, `total_supply`, `holders_count`, `circulating_market_cap`, `volume_24h`, `reputation` ("ok"/khác), `icon_url`
- Thông tin 1 token: `GET /api/v2/tokens/{address}`
- Holder của token: `GET /api/v2/tokens/{address}/holders` -> để tính TOP HOLDER giữ bao nhiêu % supply, và tìm ví lớn (whale)
- Trạng thái verified + source code contract: `GET /api/v2/smart-contracts/{address}` -> field `is_verified`, `source_code` (đọc source để AI quan sát hàm mint/owner/blacklist)
- Ghi chú: WebFetch từ server bị Cloudflare chặn 403, nhưng đọc bằng trình duyệt/agent web access thì OK. Xác nhận lại trong contract thật ở CP1.

## 2. GeckoTerminal - dữ liệu DEX (thanh khoản, volume thật)

Base: `https://api.geckoterminal.com/api/v2`, network slug = `robinhood`

- Pool của 1 token: `GET /networks/robinhood/tokens/{address}/pools`
- Pool trending: `GET /networks/robinhood/trending_pools`
- Field mỗi pool (quan trọng):
  - `reserve_in_usd` = ĐỘ SÂU THANH KHOẢN (tiền thật trong pool)
  - `volume_usd` (m5/m15/m30/h1/h6/h24) = volume thật theo khung giờ
  - `transactions` (buys/sells/buyers/sellers từng khung) = dùng bắt HONEYPOT hành vi: 24h nhiều BUY mà gần như 0 SELL -> nghi mua được không bán được
  - `pool_created_at` = tuổi pool/token
  - `dex.data.id` = sàn niêm yết (uniswap-v2/v3/v4-robinhood, pons-v2-dex, bankr-robinhood)

## Lưu ý fail-closed

- Token không có pool nào trên GeckoTerminal -> coi như thiếu thanh khoản, cờ đỏ nặng (hoặc UNRESOLVED nếu cũng không đọc được Blockscout).
- Bất kỳ nguồn nào fetch lỗi/timeout -> KHÔNG đoán, trả UNRESOLVED cho phần đó.
