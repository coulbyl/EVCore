"""Offline, restricted JSON CLI for the pinned Machina computation module."""

import argparse
import json
import math
import sys

import _calcs


COMMANDS = {
    "convert_odds": {"odds", "from_format"},
    "devig": {"odds", "format"},
    "find_edge": {"fair_prob", "market_prob"},
    "kelly_criterion": {"fair_prob", "market_prob"},
    "find_arbitrage": {"market_probs", "labels"},
    "parlay_analysis": {"legs", "parlay_odds", "odds_format", "correlation"},
}


def numbers(value):
    values = value.split(",") if isinstance(value, str) else value
    if not isinstance(values, list):
        values = [values]
    if any(isinstance(item, bool) for item in values):
        raise ValueError("booleans are not numeric inputs")
    result = [float(item) for item in values]
    if not result or not all(math.isfinite(item) for item in result):
        raise ValueError("numbers must be nonempty and finite")
    return result


def validate(command, params):
    if not isinstance(params, dict) or set(params) - COMMANDS[command]:
        raise ValueError("expected a params object with supported keys only")
    for key in set(params) - {"format", "from_format", "odds_format", "labels"}:
        numbers(params[key])
    if command in {"devig", "convert_odds"}:
        fmt = params.get("format" if command == "devig" else "from_format", "american")
        if fmt not in {"american", "decimal", "probability"}:
            raise ValueError("unsupported odds format")
        odds = numbers(params.get("odds", []))
        if fmt == "decimal" and any(item <= 1 for item in odds):
            raise ValueError("decimal odds must exceed 1")
        if fmt == "probability" and any(not 0 < item < 1 for item in odds):
            raise ValueError("probabilities must be between 0 and 1")
    if command == "parlay_analysis":
        if float(params.get("correlation", 0)) != 0:
            raise ValueError("correlated parlays require EVCore joint calibration")
        if len(numbers(params.get("legs", []))) < 2:
            raise ValueError("parlays require at least two legs")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=COMMANDS)
    args = parser.parse_args()
    try:
        params = json.load(sys.stdin)
        validate(args.command, params)
        result = getattr(_calcs, args.command)({"params": params})
        output = json.dumps(result, allow_nan=False)
    except (ValueError, TypeError, OverflowError, ZeroDivisionError) as error:
        result = {"status": False, "data": None, "message": str(error)}
        output = json.dumps(result)
    print(output)
    return 0 if result["status"] else 1


if __name__ == "__main__":
    sys.exit(main())
