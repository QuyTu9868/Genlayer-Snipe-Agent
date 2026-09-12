"""CP2 smoke test - chay that voi studionet, khong mock.
Muc dich: chung minh observe_token doc source code that va AI tra ve
quan sat dong (chi true/false) qua gl.eq_principle.strict_eq.

Run: gltest tests/integration/test_rugradar_observe.py -v -s
"""

import pytest  # framework test
from gltest import get_contract_factory  # gltest: lay factory de deploy contract da compile

# TOKEN_ADDRESS: token POPE tren Robinhood Chain, da verify source code (dung cho CP1/CP2 smoke test)
TOKEN_ADDRESS = "0x1c85e5fb478e91d8b769a509278f10e5e432754a"


@pytest.mark.integration  # danh dau day la test tich hop, can studionet
def test_observe_token_reads_real_source():
    factory = get_contract_factory("RugRadar")  # lay factory ung voi contracts/rugradar.py
    contract = factory.deploy()  # deploy contract len studionet

    receipt = contract.observe_token(args=[TOKEN_ADDRESS]).transact()  # goi method ghi observe_token
    print("observe status:", receipt.get("status_name"), receipt.get("result_name"))  # in trang thai tx that

    observations = contract.get_observations(args=[TOKEN_ADDRESS]).call()  # doc lai Observations qua view method
    print("observations:", observations)  # in ra de nhin bang mat ket qua AI quan sat that

    assert observations["observed"] is True  # phai doc va phan tich duoc source code
    assert isinstance(observations["has_mint"], bool)  # phai la bool, khong phai text tu do
    assert isinstance(observations["is_proxy"], bool)  # phai la bool, khong phai text tu do
