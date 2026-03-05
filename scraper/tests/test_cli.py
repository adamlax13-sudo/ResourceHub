import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch


def test_cli_accepts_phase_discover():
    with patch("sys.argv", ["scraper.py", "--phase", "discover"]):
        from scraper import parse_args
        args = parse_args()
        assert args.phase == "discover"


def test_cli_accepts_phase_enrich():
    with patch("sys.argv", ["scraper.py", "--phase", "enrich"]):
        from scraper import parse_args
        args = parse_args()
        assert args.phase == "enrich"


def test_cli_accepts_phase_finalize():
    with patch("sys.argv", ["scraper.py", "--phase", "finalize"]):
        from scraper import parse_args
        args = parse_args()
        assert args.phase == "finalize"


def test_cli_accepts_budget_flag():
    with patch("sys.argv", ["scraper.py", "--phase", "enrich", "--budget", "5.00"]):
        from scraper import parse_args
        args = parse_args()
        assert args.budget == 5.00


def test_cli_accepts_source_flag():
    with patch("sys.argv", ["scraper.py", "--source", "cra_charities"]):
        from scraper import parse_args
        args = parse_args()
        assert args.source == "cra_charities"


def test_cli_accepts_dry_run():
    with patch("sys.argv", ["scraper.py", "--dry-run"]):
        from scraper import parse_args
        args = parse_args()
        assert args.dry_run is True


def test_cli_accepts_full_flag():
    with patch("sys.argv", ["scraper.py", "--phase", "enrich", "--full"]):
        from scraper import parse_args
        args = parse_args()
        assert args.full is True


def test_cli_accepts_enrich_service():
    with patch("sys.argv", ["scraper.py", "--enrich-service", "Some Service Name"]):
        from scraper import parse_args
        args = parse_args()
        assert args.enrich_service == "Some Service Name"
