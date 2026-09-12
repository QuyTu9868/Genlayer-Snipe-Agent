# Ghi chú đối thủ + house style (khảo sát 7/9/2026)

## Quy mô

- ~375 builder join Agent Tank hackathon. Tổng contributions bên Builder ~5.394 bài.
- Build window 3-17/9/2026, deadline 17/9 15:30 UTC, winners 25/9. Giải: 5% toàn bộ GenLayer Points.
- Nộp bài cần: public GitHub repo + full project application, deploy testnet. Panel chấm + cộng đồng rate.

## Đối thủ đang làm gì

Gu chung: "xác minh 1 tài liệu/policy/claim so với nguồn gốc rồi consensus". Ví dụ đã nộp:
- Smart Contract Audit Oracle (audit source code + consensus) <- GẦN nhất với ý AI đọc code
- UpgradeDiff Sentinel (audit upgrade GitHub, AI trả 5 quan sát đóng, code phán COMPATIBLE/INCOMPATIBLE)
- RecallGuard / FDA Recall Registry (đọc CPSC/FDA phán sản phẩm bị recall)
- BugBountyScopeOracle, ArtifactConformanceAttestor, Handshake, CipherNova...

Kết luận:
- KHÔNG ai làm meme coin / rug / token safety / đọc DEX sống -> niche này trống, đây là điểm khác biệt của RugRadar.
- Cơ chế "AI + consensus" thì ĐỤNG HÀNG nặng -> đừng khoe cơ chế, khoe DATA SỐNG + domain nóng (meme coin Robinhood Chain).
- Đa số là contract THUẦN, nhiều bài ghi rõ "no frontend, no backend, no database". -> Làm 1 frontend đơn giản là điểm cộng khác biệt vì đa số không có.

## House style ăn điểm (bắt chước)

- AI chỉ trả quan sát đóng, CODE phán verdict.
- Validator độc lập fetch lại nguồn, chỉ nhận khi khớp; verify hash/nguồn.
- Fail-closed khi thiếu data.
- Chống replay, không admin override.
- Có test nhiều ca (họ hay ghi "30/30, 77 tests passed"), deploy xong đọc lại verdict từ chain.
- Mô tả bài viết chắc tay, nhấn "contract, not the model, derives the verdict".

## Điểm khác biệt của RugRadar (bám chặt)

1. Data on-chain SỐNG trên Robinhood Chain (chain đang top volume DEX), không phải tài liệu tĩnh.
2. Đóng khung Onchain Justice: toà án token, luật công khai, phán từ bằng chứng.
3. Có frontend bấm-là-ra-verdict trong khi đa số không có.
