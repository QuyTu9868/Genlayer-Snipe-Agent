# RugRadar frontend

Trang don gian: nhap dia chi token -> doc verdict tu contract that tren GenLayer Studionet.
Stack: Vite + React + TypeScript + Tailwind v4 + genlayer-js. UI tieng Anh (quyet dinh CP6).

## Chay local

```bash
npm install
```

Tao file `.env` (KHONG commit, da co trong .gitignore):

```
VITE_DEPLOYER_PRIVATE_KEY=0x...
```

Day la private key cua 1 vi RIENG chi dung cho demo (khong phai vi chinh, khong
chua tai san that - chi GEN testnet xin tu faucet). Xem canh bao an toan o
muc "Quyet dinh: vi demo o phia frontend" ben duoi TRUOC KHI dung pattern nay
cho bat ky du an nao khac.

```bash
npm run dev
```

Mo `http://localhost:5173`. Co the mo thang toi 1 token da scan qua query param, vd:
`http://localhost:5173/?token=0x1c85e5fb478e91d8b769a509278f10e5e432754a`

## Cau hinh

Dia chi contract va mang muc tieu dang HARDCODE trong `src/lib/genlayer.ts`
(`CONTRACT_ADDRESS`, chain `studionet` tu `genlayer-js/chains`) - khong dung
env var, vi contract nay chi deploy 1 lan cho ban nop hackathon, khong can doi
qua nhieu moi truong.

## Luong hoat dong

1. Doc `get_verdict` (view, khong can vi) - neu token da tung duoc `scan_token`,
   hien ket qua ngay.
2. Neu chua co, nguoi xem bam "Open a case" - app TU KY 3 giao dich ghi
   (`scan_token` -> `observe_token` -> `compute_verdict`) bang 1 vi demo rieng
   cua app (xem muc duoi), khong can nguoi xem co vi hay GEN gi ca.
3. Doc lai `get_verdict` sau khi ca 3 buoc xong, hien VerdictCard.

## Quyet dinh: vi demo o phia frontend (KHONG phai pattern production)

App nay tu tra phi "mo ho so" cho nguoi xem bang cach nhung private key cua
1 vi demo thang vao bundle JS gui cho trinh duyet (`VITE_DEPLOYER_PRIVATE_KEY`,
doc qua `import.meta.env`). Bat ky ai mo DevTools cung doc duoc key nay va
dung no de ky giao dich (ton GEN cua vi demo).

Day la lua chon co chu dinh cho 1 ban demo hackathon, chap nhan duoc vi:
- Vi demo la vi RIENG, tao chi de deploy + demo, khong bao gio dung lai cho
  bat ky viec gi khac.
- Vi chi giu GEN testnet (khong co gia tri that), xin lai duoc tu faucet.
- Doi lai la UX tot han han cho nguoi xem/giam khao: khong can cai vi, khong
  can xin faucet, bam 1 nut la thay ket qua.

**KHONG lam theo pattern nay voi bat ky vi nao giu tai san that.** Muon nguoi
dung khong phai tra gas ma van an toan thi phai co backend/serverless giu key
(vd 1 Cloudflare Worker hoac Vercel Function nhan {tokenAddress} roi tu ky va
tra ve ket qua), khong bao gio nhung key vao code chay tren trinh duyet.

## Cam bay da gap (xem chi tiet o `../references/error-log.md`)

- `genlayer-js` (ban browser) bi TREO VINH VIEN thay vi bao loi khi contract
  method doc (`readContract`) gap loi thuc thi (vd `KeyError` cho token chua
  scan) - khac Node, noi loi nay bao ve binh thuong trong <2s. Da vá bang
  `withTimeout()` trong `src/lib/genlayer.ts` (15s) de UI khong treo mai.
- Contract luu `flags` bang tieng Viet (viet tu CP3, truoc khi chot UI tieng
  Anh o CP6). Dich o `src/lib/flags.ts` thay vi doi + deploy lai contract.
- Chup man hinh tu dong (pixelshot/CDP) doi luc bao sai la trang dang "treo"
  o trang thai doc du lieu, dung do timing bat man hinh cua cong cu do, khong
  phai loi that (xac minh lai bang Playwright cho doi du 20s: trang thuc te
  chi mat ~2-3s de doc xong). Muon test lai trang thai nay cho chac thi cho
  du 15-20s that su truoc khi ket luan, dung tin 1 lan chup man hinh nhanh.
