"""
Tests for api/v1/rewards.py and its interaction with api/v1/games.py.

Covers: a new patient starts at a zero balance, completing a game session
earns coins via the RewardTransaction ledger, spending debits the ledger,
and spending more than the balance is rejected (and doesn't touch the
ledger).
"""


def test_new_patient_balance_is_zero(client):
    resp = client.get("/api/v1/rewards/wallet/42")
    assert resp.status_code == 200
    assert resp.json() == {"patient_id": 42, "balance": 0}


def test_game_session_awards_coins_reflected_in_wallet(client):
    resp = client.post(
        "/api/v1/games/metrics",
        json={
            "patient_id": 7,
            "game_name": "eye-game",
            "accuracy": 1.0,
            "reaction_time": 1.5,
            "mistakes": 0,
            "breaks": 1,
            "difficulty": "adaptive",
            "session_duration": 45,
        },
    )
    assert resp.status_code == 200
    coins_awarded = resp.json()["coins_awarded"]
    assert coins_awarded == 20  # base 10 + round(1.0 * 10) accuracy bonus

    wallet = client.get("/api/v1/rewards/wallet/7").json()
    assert wallet["balance"] == coins_awarded


def test_multiple_sessions_accumulate_balance(client):
    for _ in range(3):
        client.post(
            "/api/v1/games/metrics",
            json={
                "patient_id": 8,
                "game_name": "box-breathing",
                "accuracy": 0.5,
                "reaction_time": 2.0,
                "mistakes": 1,
                "breaks": 1,
                "difficulty": "easy",
                "session_duration": 30,
            },
        )
    wallet = client.get("/api/v1/rewards/wallet/8").json()
    # base 10 + round(0.5*10)=5 -> 15 coins per session, 3 sessions
    assert wallet["balance"] == 45


def test_spend_debits_balance(client):
    client.post(
        "/api/v1/games/metrics",
        json={
            "patient_id": 9,
            "game_name": "dance-reset",
            "accuracy": 1.0,
            "reaction_time": 1.0,
            "mistakes": 0,
            "breaks": 0,
            "difficulty": "hard",
            "session_duration": 60,
        },
    )
    starting_balance = client.get("/api/v1/rewards/wallet/9").json()["balance"]

    resp = client.post(
        "/api/v1/rewards/wallet/9/spend",
        json={"amount": 5, "reason": "dopamine_menu_redeem"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["spent"] == 5
    assert body["balance"] == starting_balance - 5

    wallet = client.get("/api/v1/rewards/wallet/9").json()
    assert wallet["balance"] == starting_balance - 5


def test_spend_more_than_balance_is_rejected(client):
    resp = client.post(
        "/api/v1/rewards/wallet/10/spend",
        json={"amount": 100, "reason": "dopamine_menu_redeem"},
    )
    assert resp.status_code == 400

    # Balance must be untouched by the rejected spend.
    wallet = client.get("/api/v1/rewards/wallet/10").json()
    assert wallet["balance"] == 0


def test_spend_amount_must_be_positive(client):
    resp = client.post(
        "/api/v1/rewards/wallet/11/spend",
        json={"amount": 0, "reason": "dopamine_menu_redeem"},
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/v1/rewards/wallet/11/spend",
        json={"amount": -10, "reason": "dopamine_menu_redeem"},
    )
    assert resp.status_code == 422


def test_wallets_are_isolated_per_patient(client):
    client.post(
        "/api/v1/games/metrics",
        json={
            "patient_id": 20,
            "game_name": "eye-game",
            "accuracy": 1.0,
            "reaction_time": 1.0,
            "mistakes": 0,
            "breaks": 0,
            "difficulty": "adaptive",
            "session_duration": 30,
        },
    )
    other_wallet = client.get("/api/v1/rewards/wallet/21").json()
    assert other_wallet["balance"] == 0
