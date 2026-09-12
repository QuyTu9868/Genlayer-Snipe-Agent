# RugRadar frontend

Trang don gian: nhap dia chi token -> doc verdict tu contract that tren GenLayer Asimov Testnet.
Stack: Vite + React + TypeScript + Tailwind v4 + genlayer-js. UI tieng Anh (quyet dinh CP6).

## Chay local

```bash
npm install
npm run dev
```

Mo `http://localhost:5173`. Co the mo thang toi 1 token da scan qua query param, vd:
`http://localhost:5173/?token=0x1c85e5fb478e91d8b769a509278f10e5e432754a`

## Cau hinh

Dia chi contract va mang muc tieu dang HARDCODE trong `src/lib/genlayer.ts`
(`CONTRACT_ADDRESS`, chain `testnetAsimov` tu `genlayer-js/chains`) - khong dung
env var, vi contract nay chi deploy 1 lan cho ban nop hackathon, khong can doi
qua nhieu moi truong.

## Luong hoat dong

1. Doc `get_verdict` (view, khong can vi) - neu token da tung duoc `scan_token`,
   hien ket qua ngay.
2. Neu chua co, nguoi dung ket noi vi (MetaMask, tu dong yeu cau chuyen sang
   GenLayer Asimov Testnet) roi bam "Open a case" - goi tuan tu 3 method ghi
   (`scan_token` -> `observe_token` -> `compute_verdict`), moi buoc can vi ky
   va cho dong thuan validator (~1-2 phut/buoc tren testnet cong khai).
3. Doc lai `get_verdict` sau khi ca 3 buoc xong, hien VerdictCard.

## Cam bay da gap (xem chi tiet o `../references/error-log.md` muc 11)

- `genlayer-js` (ban browser) bi TREO VINH VIEN thay vi bao loi khi contract
  method doc (`readContract`) gap loi thuc thi (vd `KeyError` cho token chua
  scan) - khac Node, noi loi nay bao ve binh thuong trong <2s. Da vá bang
  `withTimeout()` trong `src/lib/genlayer.ts` (15s) de UI khong treo mai.
- Contract luu `flags` bang tieng Viet (viet tu CP3, truoc khi chot UI tieng
  Anh o CP6). Dich o `src/lib/flags.ts` thay vi doi + deploy lai contract that.
