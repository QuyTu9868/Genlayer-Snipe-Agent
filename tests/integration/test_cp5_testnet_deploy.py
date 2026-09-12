"""CP5 - deploy that len GenLayer testnet Asimov (khong phai studionet nua),
chay full pipeline tren 1 token that, roi DOC LAI verdict qua 1 lan .call()
RIENG BIET de chung minh du lieu nam that tren chain, khong chi la leader
receipt cua tx ghi.

Run: gltest tests/integration/test_cp5_testnet_deploy.py -v -s --network testnet_asimov
"""

import pytest
from gltest import get_contract_factory

TOKEN_SAFE = "0x1c85e5fb478e91d8b769a509278f10e5e432754a"  # POPE, dung lai token da kiem chung o CP1-CP4


@pytest.mark.integration
def test_deploy_and_read_back_from_testnet():
    factory = get_contract_factory("RugRadar")
    contract = factory.deploy()
    print("CONTRACT_ADDRESS:", contract.address)  # dia chi that tren testnet Asimov, can luu lai cho CP6 frontend

    scan_receipt = contract.scan_token(args=[TOKEN_SAFE]).transact()
    print("scan tx:", scan_receipt.get("tx_id"), scan_receipt.get("status_name"))

    observe_receipt = contract.observe_token(args=[TOKEN_SAFE]).transact()
    print("observe tx:", observe_receipt.get("tx_id"), observe_receipt.get("status_name"))

    verdict_receipt = contract.compute_verdict(args=[TOKEN_SAFE]).transact()
    print("verdict tx:", verdict_receipt.get("tx_id"), verdict_receipt.get("status_name"))

    # doc lai bang 1 view call RIENG BIET (khong phai receipt cua tx ghi o tren)
    # -> chung minh du lieu that su nam trong state cua contract tren chain
    verdict = contract.get_verdict(args=[TOKEN_SAFE]).call()
    print("VERDICT DOC LAI TU CHAIN:", verdict)

    assert verdict["resolved"] is True
    assert verdict["verdict"] in ("SAFE", "SUSPICIOUS", "SCAM")
    assert 0 <= int(verdict["risk_score"]) <= 100
