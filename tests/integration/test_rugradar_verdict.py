"""CP3 smoke test - chay that voi studionet, khong mock.
Muc dich: chung minh compute_verdict cham diem THUAN CODE tu Facts (CP1)
+ Observations (CP2) da luu, ra verdict + risk_score + flags dung spec.

Run: gltest tests/integration/test_rugradar_verdict.py -v -s
"""

import pytest  # framework test
from gltest import get_contract_factory  # gltest: lay factory de deploy contract da compile

# TOKEN_ADDRESS: token POPE tren Robinhood Chain, verified + co pool (dung chung CP1/CP2/CP3)
TOKEN_ADDRESS = "0x1c85e5fb478e91d8b769a509278f10e5e432754a"


@pytest.mark.integration  # danh dau day la test tich hop, can studionet
def test_full_pipeline_scan_observe_verdict():
    factory = get_contract_factory("RugRadar")  # lay factory ung voi contracts/rugradar.py
    contract = factory.deploy()  # deploy contract len studionet

    contract.scan_token(args=[TOKEN_ADDRESS]).transact()  # CP1: doc facts khach quan
    contract.observe_token(args=[TOKEN_ADDRESS]).transact()  # CP2: AI quan sat dong
    verdict_receipt = contract.compute_verdict(args=[TOKEN_ADDRESS]).transact()  # CP3: code cham diem
    print("verdict status:", verdict_receipt.get("status_name"), verdict_receipt.get("result_name"))  # in trang thai tx that

    verdict = contract.get_verdict(args=[TOKEN_ADDRESS]).call()  # doc lai Verdict qua view method
    print("verdict:", verdict)  # in ra de nhin bang mat ket qua that

    assert verdict["resolved"] is True  # phai cham diem duoc (co du du lieu)
    assert verdict["verdict"] in ("SAFE", "SUSPICIOUS", "SCAM")  # phai ra 1 trong 3 muc, khong UNRESOLVED
    assert 0 <= int(verdict["risk_score"]) <= 100  # risk_score phai trong bien 0-100
    assert isinstance(verdict["flags"], str) and len(verdict["flags"]) > 0  # phai co ly do kem theo


@pytest.mark.integration  # danh dau day la test tich hop, can studionet
def test_unresolved_when_no_facts_scanned():
    factory = get_contract_factory("RugRadar")  # lay factory ung voi contracts/rugradar.py
    contract = factory.deploy()  # deploy contract len studionet MOI, chua goi scan_token lan nao

    contract.compute_verdict(args=[TOKEN_ADDRESS]).transact()  # goi thang compute_verdict, bo qua CP1/CP2

    verdict = contract.get_verdict(args=[TOKEN_ADDRESS]).call()  # doc lai Verdict
    print("verdict (chua scan):", verdict)  # in ra de nhin bang mat

    assert verdict["resolved"] is False  # fail-closed: khong co facts thi UNRESOLVED
    assert verdict["verdict"] == "UNRESOLVED"  # phai dung chu UNRESOLVED
    assert int(verdict["risk_score"]) == 0  # khong doan diem khi chua co du lieu
