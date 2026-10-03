import asyncio
import importlib.util
from pathlib import Path


def test_all_48_fixtures_pass_fixed_quality_thresholds() -> None:
    path = Path("scripts/evaluate_wi004.py")
    spec = importlib.util.spec_from_file_location("evaluate_wi004", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = asyncio.run(module.evaluate())
    assert len(report["fixtures"]) == 48
    assert report["passed"] is True
    assert report["configuration"]["hosted_output_enabled"] is False
