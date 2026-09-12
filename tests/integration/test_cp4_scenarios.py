"""CP4 - test cac nhanh chinh, chay that tren studionet (khong mock).

LUU Y (xem references/error-log.md muc 9b): gltest direct mode (test nhanh,
mock, khong can mang) hien KHONG chay duoc - loi packaging that cua
genlayer-test 0.29.2 (thieu asset genvm-universal.tar.xz o MOI platform,
khong rieng Windows). Nen CP4 phai test bang du lieu THAT tren studionet.

LUU Y 2: doc du lieu SONG qua eq_principle thinh thoang bi 1-2 validator lech
nhau thoang qua (xem error-log.md muc 7), lam scan_token tra resolved=False
GIA (khong phai loi code). Ham _scan_until_resolved retry vai lan cho on dinh,
giong cach 1 frontend that se cho nguoi dung bam "quet lai".

Run: gltest tests/integration/test_cp4_scenarios.py -v -s
"""

import pytest
from gltest import get_contract_factory

TOKEN_SAFE = "0x1c85e5fb478e91d8b769a509278f10e5e432754a"  # POPE: verified, pool tot, holder phan tan -> ky vong SAFE
TOKEN_RISKY = "0xed554e3049a7f0b65227ea6b01c96b127de598cd"  # ASSAY: 1 holder, thanh khoan mong, du lieu bat thuong -> ky vong risk cao hon SAFE
TOKEN_MISSING = "0x0000000000000000000000000000000000000001"  # dia chi khong phai token nao, Blockscout tra 404 "Not found"


def _scan_until_resolved(contract, token: str, max_attempts: int = 3) -> dict:  # _scan_until_resolved: retry khi gap flaky tam thoi cua du lieu song
    facts = None
    for _ in range(max_attempts):
        contract.scan_token(args=[token]).transact()
        facts = contract.get_facts(args=[token]).call()
        if facts["resolved"]:
            return facts
    return facts  # het luot retry ma van khong resolved -> tra ket qua cuoi de test tu fail ro rang


def _verdict_tier_matches_risk(risk_score: int, verdict: str) -> bool:  # kiem tra bat bien map risk -> verdict dung scoring-spec.md
    if risk_score <= 25:
        return verdict == "SAFE"
    if risk_score <= 60:
        return verdict == "SUSPICIOUS"
    return verdict == "SCAM"


@pytest.mark.integration
def test_safe_vs_risky_tokens_get_different_verdicts():
    """Nhanh 'token sach' + chong lan du lieu giua 2 token trong CUNG 1 contract."""
    factory = get_contract_factory("RugRadar")
    contract = factory.deploy()

    assert _scan_until_resolved(contract, TOKEN_SAFE)["resolved"] is True
    contract.observe_token(args=[TOKEN_SAFE]).transact()
    contract.compute_verdict(args=[TOKEN_SAFE]).transact()
    safe_verdict = contract.get_verdict(args=[TOKEN_SAFE]).call()
    print("SAFE token verdict:", safe_verdict)

    assert _scan_until_resolved(contract, TOKEN_RISKY)["resolved"] is True
    contract.observe_token(args=[TOKEN_RISKY]).transact()
    contract.compute_verdict(args=[TOKEN_RISKY]).transact()
    risky_verdict = contract.get_verdict(args=[TOKEN_RISKY]).call()
    print("RISKY token verdict:", risky_verdict)

    assert _verdict_tier_matches_risk(int(safe_verdict["risk_score"]), safe_verdict["verdict"])
    assert _verdict_tier_matches_risk(int(risky_verdict["risk_score"]), risky_verdict["verdict"])

    # token rui ro hon phai co risk_score CAO HON token sach
    assert int(risky_verdict["risk_score"]) > int(safe_verdict["risk_score"])
    assert safe_verdict["verdict"] == "SAFE"

    # 2 token khac dia chi PHAI ra 2 ket qua khac nhau -> chung minh key khong bi lan
    assert safe_verdict["flags"] != risky_verdict["flags"]


@pytest.mark.integration
def test_missing_token_is_unresolved():
    """Nhanh 'thieu du lieu' - dia chi khong ton tai phai fail-closed ve UNRESOLVED."""
    factory = get_contract_factory("RugRadar")
    contract = factory.deploy()

    contract.scan_token(args=[TOKEN_MISSING]).transact()
    contract.compute_verdict(args=[TOKEN_MISSING]).transact()

    verdict = contract.get_verdict(args=[TOKEN_MISSING]).call()
    print("MISSING token verdict:", verdict)

    assert verdict["resolved"] is False
    assert verdict["verdict"] == "UNRESOLVED"
    assert int(verdict["risk_score"]) == 0


@pytest.mark.integration
def test_rescan_same_token_stays_consistent():
    """Chong 'replay': scan lai CUNG 1 token nhieu lan phai luon cap nhat
    duoc facts (khong bi hong state vi goi lai). Chi kiem tra tang facts
    (CP1), khong chay lai ca pipeline de do thoi gian goi LLM that."""
    factory = get_contract_factory("RugRadar")
    contract = factory.deploy()

    first = _scan_until_resolved(contract, TOKEN_SAFE)
    second = _scan_until_resolved(contract, TOKEN_SAFE)  # goi lai lan 2 tren CUNG contract, CUNG token

    print("lan 1:", first)
    print("lan 2:", second)

    assert first["resolved"] is True
    assert second["resolved"] is True
    assert first["is_verified"] == second["is_verified"] == True  # du lieu on dinh giua 2 lan scan cung 1 token
