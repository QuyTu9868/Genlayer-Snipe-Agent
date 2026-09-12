"""CP1 smoke test - chay that voi studionet, khong mock.
Muc dich: chung minh scan_token doc duoc facts that tu Blockscout + GeckoTerminal.

Run: gltest tests/integration/test_rugradar_smoke.py -v -s
"""

import pytest  # framework test
from gltest import get_contract_factory  # gltest: lay factory de deploy contract da compile

# TOKEN_ADDRESS: token that tren Robinhood Chain (POPE/WETH pool, verified),
# lay tu GeckoTerminal trending_pools ngay 7/9/2026, chi dung de smoke test.
TOKEN_ADDRESS = "0x1c85e5fb478e91d8b769a509278f10e5e432754a"


@pytest.mark.integration  # danh dau day la test tich hop, can studionet
def test_scan_token_reads_real_data():
    factory = get_contract_factory("RugRadar")  # lay factory ung voi contracts/rugradar.py
    contract = factory.deploy()  # deploy contract len studionet

    scan_receipt = contract.scan_token(args=[TOKEN_ADDRESS]).transact()  # goi method ghi scan_token
    print("scan status:", scan_receipt.get("status_name"), scan_receipt.get("result_name"))  # in trang thai tx that

    facts = contract.get_facts(args=[TOKEN_ADDRESS]).call()  # doc lai Facts qua view method
    print("facts:", facts)  # in ra de nhin bang mat ket qua that

    assert facts["resolved"] is True  # phai doc duoc du lieu loi
    assert facts["is_verified"] is True  # POPE da verify source code
    assert facts["has_pool"] is True  # POPE co pool tren GeckoTerminal
    assert int(facts["holders_count"]) > 0  # phai co holder
    assert float(facts["reserve_in_usd"]) > 0  # phai co thanh khoan
