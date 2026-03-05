"""Tests for Claude client batch enrichment and inference methods."""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from claude_client import ClaudeClient
from enrichment import EnrichmentResult


def test_batch_enrich_returns_enrichment_results():
    """batch_enrich_services should return a list of EnrichmentResult objects."""
    client = ClaudeClient.__new__(ClaudeClient)
    client.client = MagicMock()
    client.model = "claude-sonnet-4-5-20250929"

    services = [
        MagicMock(service_id="svc-1", name="Service A", category="addiction", location="Calgary", website_url="https://a.com"),
        MagicMock(service_id="svc-2", name="Service B", category="addiction", location="Edmonton", website_url="https://b.com"),
    ]

    # Mock the API response
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="tool_use", input={"services": [
        {
            "service_name": "Service A",
            "process_steps": [{"step": "Call intake", "action": "Phone", "details": "403-555-1234", "source_url": "https://a.com/intake"}],
            "required_docs": [],
            "eligibility": {"age_range": "18+", "source_url": "https://a.com"},
            "wait_times": None,
            "cost": {"is_free": True, "source_url": "https://a.com"},
            "confidence": 80,
            "source_urls": ["https://a.com/intake"],
        },
        {
            "service_name": "Service B",
            "process_steps": None,
            "required_docs": None,
            "eligibility": None,
            "wait_times": None,
            "cost": None,
            "confidence": 30,
            "source_urls": [],
        },
    ]})]
    mock_response.usage = MagicMock(input_tokens=500, output_tokens=500)
    client.client.messages.create.return_value = mock_response

    results = client.batch_enrich_services(services)
    assert len(results) == 2
    assert all(isinstance(r, EnrichmentResult) for r in results)
    assert results[0].confidence == 80
    assert results[0].process_steps[0]["step"] == "Call intake"


def test_batch_enrich_prompt_includes_all_services():
    """The prompt should include all service names."""
    client = ClaudeClient.__new__(ClaudeClient)
    client.client = MagicMock()
    client.model = "claude-sonnet-4-5-20250929"

    services = [
        MagicMock(service_id="svc-1", name="Service A", category="addiction", location="Calgary", website_url="https://a.com"),
        MagicMock(service_id="svc-2", name="Service B", category="addiction", location="Edmonton", website_url="https://b.com"),
    ]

    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="tool_use", input={"services": []})]
    mock_response.usage = MagicMock(input_tokens=100, output_tokens=100)
    client.client.messages.create.return_value = mock_response

    client.batch_enrich_services(services)

    call_args = client.client.messages.create.call_args
    messages = call_args.kwargs.get("messages") or call_args[1].get("messages")
    prompt_text = str(messages)
    assert "Service A" in prompt_text
    assert "Service B" in prompt_text


def test_infer_from_similar_returns_enrichment_result():
    """infer_from_similar should return an EnrichmentResult."""
    client = ClaudeClient.__new__(ClaudeClient)
    client.client = MagicMock()
    client.model = "claude-sonnet-4-5-20250929"

    service = MagicMock(service_id="svc-new", name="New Rehab", category="addiction", location="Calgary")
    similar = [
        MagicMock(name="Existing Rehab", process_steps=[{"step": "Call intake", "action": "Phone"}]),
    ]

    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="tool_use", input={
        "process_steps": [{"step": "Call intake line", "action": "Phone", "details": "Likely phone-based", "source_url": None}],
        "required_docs": [{"document": "Photo ID", "context": "Standard for rehab programs", "source_url": None}],
        "eligibility": {"age_range": "18+"},
        "confidence": 40,
    })]
    mock_response.usage = MagicMock(input_tokens=200, output_tokens=200)
    client.client.messages.create.return_value = mock_response

    result = client.infer_from_similar(service, similar)
    assert isinstance(result, EnrichmentResult)
    assert result.process_steps is not None
