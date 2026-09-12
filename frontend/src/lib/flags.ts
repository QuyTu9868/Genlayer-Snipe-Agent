// translateFlag: contract luu flags bang tieng Viet (viet luc CP3, truoc khi chot UI tieng Anh o CP6).
// Dich sang tieng Anh o day thay vi doi + deploy lai contract that tren testnet (ton GEN that).
const FLAG_TRANSLATIONS: Record<string, string> = {
  "Source code chua duoc verify": "Source code has not been verified",
  "Owner co the mint them token": "Owner can mint additional tokens",
  "Owner co the tam dung giao dich": "Owner can pause trading",
  "Co logic chan ban (honeypot)": "Contains logic that can block selling (honeypot)",
  "Phi giao dich cao bat thuong hoac owner chinh tuy y":
    "Unusually high fees, or fees the owner can change at will",
  "Contract la proxy, code thuc thi co the bi doi":
    "Contract is a proxy; the executed code can be swapped later",
  "Vi ca nhan lon nhat giu qua 50% supply": "The largest individual wallet holds over 50% of supply",
  "Vi ca nhan lon nhat giu qua 30% supply": "The largest individual wallet holds over 30% of supply",
  "It hon 50 vi dang giu token": "Fewer than 50 wallets hold this token",
  "Khong co pool thanh khoan tren GeckoTerminal": "No liquidity pool found on GeckoTerminal",
  "Thanh khoan pool duoi 5000 USD": "Pool liquidity is under $5,000",
  "Pool moi tao duoi 24 gio": "Pool was created less than 24 hours ago",
  "24h co nhieu lenh mua nhung khong co lenh ban nao (nghi honeypot)":
    "Many buys but zero sells in the last 24h (suspected honeypot)",
  "Co tu 3 vi lon doc lap tro len (phan tan tot)":
    "Three or more independent large holders (healthy distribution)",
  "Co it nhat 1 vi lon doc lap": "At least one independent large holder",
  "Khong co dau hieu nao duoc ghi nhan": "No signals recorded",
  "Khong doc duoc du lieu tu Blockscout/GeckoTerminal":
    "Could not read reliable data from Blockscout/GeckoTerminal",
};

export function translateFlag(flag: string): string {
  return FLAG_TRANSLATIONS[flag] ?? flag;
}
