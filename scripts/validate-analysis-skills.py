"""Validate repository analysis skills and exercise the offline diagnostic."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / ".agents/skills"
NAMES = ("betting", "evcore-forecast-audit", "evcore-coupon-review")
CLI = SKILLS / "betting/scripts/calculate.py"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def run(command, params, success=True):
    completed = subprocess.run(
        [sys.executable, "-B", str(CLI), command],
        input=json.dumps(params), capture_output=True, text=True, check=False,
    )
    result = json.loads(completed.stdout)
    require(result["status"] is success, f"{command}: {result}")
    require(completed.returncode == (0 if success else 1), "unexpected exit code")
    return result["data"]


def main():
    for name in NAMES:
        text = (SKILLS / name / "SKILL.md").read_text()
        require(text.startswith("---\n"), f"{name}: missing frontmatter")
        header = text.split("---", 2)[1].strip().splitlines()
        require(len(header) == 2, f"{name}: expected name and description")
        require(header[0] == f"name: {name}", f"{name}: wrong name")
        require(header[1].startswith("description: "), f"{name}: description")
        link = ROOT / ".claude/skills" / name
        require(link.is_symlink() and link.resolve() == SKILLS / name,
                f"{name}: Claude link missing or incorrect")
    manifest = json.loads((SKILLS / "betting/references/provenance.json").read_text())
    for entry in manifest["files"]:
        actual = hashlib.sha256((SKILLS / "betting" / entry["path"]).read_bytes()).hexdigest()
        require(actual == entry["sha256"], f"upstream file changed: {entry['path']}")
    require((SKILLS / "evcore-forecast-audit/references/repository-map.md").is_file(),
            "repository map missing")
    data = run("devig", {"odds": [2, 3.5, 4], "format": "decimal"})
    require(abs(sum(x["fair_prob"] for x in data["outcomes"]) - 1) < 2e-6,
            "1X2 de-vig must sum to one")
    data = run("find_edge", {"fair_prob": 0.6, "market_prob": 0.5})
    require(data["ev_per_dollar"] == 0.2, "offered-price EV incorrect")
    data = run("kelly_criterion", {"fair_prob": 0.4, "market_prob": 0.5})
    require(data["kelly_fraction"] < 0 and data["recommendation"] == "no bet",
            "negative Kelly must indicate no bet")
    data = run("convert_odds", {"odds": -200, "from_format": "american"})
    require(abs(data["implied_probability"] - 2 / 3) < 1e-5, "conversion")
    data = run("find_arbitrage", {"market_probs": [0.48, 0.49]})
    require(data["arbitrage_found"], "complete-market theoretical arbitrage")
    data = run("parlay_analysis", {"legs": [0.7] * 5,
                                   "parlay_odds": 7, "odds_format": "decimal"})
    require(abs(data["combined_fair_prob"] - 0.7 ** 5) < 1e-5,
            "independent five-leg probability")
    for params in ({"odds": [1, 2], "format": "decimal"},
                   {"odds": "nan,2", "format": "decimal"},
                   {"odds": "inf,2", "format": "decimal"},
                   {"odds": [True, 2], "format": "decimal"},
                   {"odds": [0.5, 1.2], "format": "probability"},
                   {"odds": [2, 3], "format": "unknown"}):
        run("devig", params, success=False)
    run("parlay_analysis", {"legs": [0.7, 0.7], "parlay_odds": 4,
                            "odds_format": "decimal", "correlation": 0.1}, False)
    run("find_edge", {"fair_prob": 0.6, "market_prob": 0}, False)
    run("devig", [], False)
    run("find_edge", {"fair_prob": 0.6, "market_prob": 0.5, "extra": 1}, False)
    print("Validated 3 skills, Claude links, upstream hashes and offline calculations.")


if __name__ == "__main__":
    main()
