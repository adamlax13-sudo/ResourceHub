# Scraper Claude Sonnet Upgrade Design

**Date:** 2026-02-21
**Status:** Approved
**Author:** Claude Code

## Problem Statement

The current scraper uses GPT-4o-mini for all AI extraction tasks. Users have reported:
- Inaccurate service details (wrong hours, contact info, eligibility)
- Hallucinated data (information not present in sources)
- Missing information (AI fails to find data that exists)
- Poor categorization (services miscategorized or mistagged)

## Solution

Replace GPT-4o-mini with Claude Sonnet 4.5 for all AI extraction tasks, with improved prompting strategies to reduce hallucinations and improve accuracy.

## Architecture

### Model Configuration

| Task | Current Model | New Model |
|------|---------------|-----------|
| Service discovery | GPT-4o-mini | Claude Sonnet 4.5 |
| 211/InformAlberta parsing | GPT-4o-mini | Claude Sonnet 4.5 |
| Website content extraction | GPT-4o-mini | Claude Sonnet 4.5 |
| Structured data extraction | GPT-4o-mini | Claude Sonnet 4.5 |
| Embeddings | text-embedding-3-small | text-embedding-3-small (unchanged) |

### New Components

#### 1. Claude Client Module (`scraper/claude_client.py`)

Anthropic SDK wrapper providing:
- Authenticated client initialization
- Tool-based structured extraction
- Retry logic with exponential backoff
- Rate limiting (respect API limits)
- Error handling and logging

#### 2. Prompt Templates (`scraper/prompts.py`)

Centralized prompt templates with:
- Anti-hallucination instructions
- Source citation requirements
- Service-type-aware context
- Field definitions with examples

#### 3. Tool Schemas

Structured tool definitions for reliable extraction:

**`extract_service_details`**
```python
{
    "name": "extract_service_details",
    "description": "Extract service information from webpage content",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {"type": "string", "description": "Service description, null if not found"},
            "description_source": {"type": "string", "description": "Exact quote from source"},
            "hours_of_operation": {"type": "string"},
            "hours_source": {"type": "string"},
            "contact": {"type": "string"},
            "contact_source": {"type": "string"},
            "eligibility": {"type": "string"},
            "eligibility_source": {"type": "string"},
            "website_url": {"type": "string"},
            "languages_supported": {"type": "array", "items": {"type": "string"}},
            "service_format": {"type": "string", "enum": ["in-person", "virtual", "hybrid", null]}
        }
    }
}
```

**`extract_process_steps`**
```python
{
    "name": "extract_process_steps",
    "description": "Extract intake process and requirements",
    "input_schema": {
        "type": "object",
        "properties": {
            "process_steps": {"type": "array", "items": {"type": "string"}},
            "process_source": {"type": "string"},
            "required_docs": {"type": "array", "items": {"type": "string"}},
            "docs_source": {"type": "string"},
            "requires_referral": {"type": "boolean"},
            "walk_in_available": {"type": "boolean"}
        }
    }
}
```

**`parse_discovery_results`**
```python
{
    "name": "parse_discovery_results",
    "description": "Parse search results into structured service list",
    "input_schema": {
        "type": "object",
        "properties": {
            "services": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "contact": {"type": "string"},
                        "location": {"type": "string"},
                        "website_url": {"type": "string"},
                        "hours_of_operation": {"type": "string"},
                        "eligibility": {"type": "string"},
                        "category": {"type": "string"}
                    },
                    "required": ["name"]
                }
            }
        }
    }
}
```

### Prompt Engineering Improvements

#### Anti-Hallucination Strategy

All extraction prompts will include:

```
CRITICAL INSTRUCTIONS:
1. Only extract information that is EXPLICITLY stated in the source text
2. Before extracting any field, quote the exact text you're extracting from
3. If information is not found, return null - DO NOT guess or infer
4. If information is ambiguous, return null with a note
5. Never combine information from your training data - only use the provided text
```

#### Source Citation Requirement

Each extracted field must include a `_source` companion field containing the exact quote from which the data was extracted. This enables:
- Auditing of extraction accuracy
- Debugging when extractions are wrong
- Confidence assessment based on quote quality

#### Service-Type Context

Prompts will include service type context to improve extraction relevance:

```
This is a {service_type} service in Alberta, Canada.
Focus on extracting information relevant to:
- {relevant_fields_for_type}
```

## Files to Modify

### Modified Files

1. **`scraper/scraper.py`**
   - Replace `OpenAIClient` initialization with Claude client
   - Update all `client.chat.completions.create()` calls to use Claude
   - Update all `client.responses.create()` (web search) calls
   - Modify extraction functions to use tool_use pattern

### New Files

2. **`scraper/claude_client.py`**
   - `ClaudeClient` class with Anthropic SDK
   - `extract_with_tool()` method for structured extraction
   - `search_web()` method for web search (if supported, else fallback)
   - Rate limiting and retry logic

3. **`scraper/prompts.py`**
   - `SYSTEM_PROMPTS` dict with role-specific system prompts
   - `EXTRACTION_PROMPTS` dict with task-specific prompts
   - `TOOL_SCHEMAS` dict with all tool definitions
   - Helper functions for prompt construction

## Web Search Consideration

The current scraper uses OpenAI's `responses.create()` with `tools=[{"type": "web_search"}]` for:
- Finding service websites
- Searching 211 Alberta
- Searching InformAlberta

**Options for Claude:**
1. **Keep OpenAI for web search only** - Use GPT-4o-mini just for web search, Claude for extraction
2. **Use external search API** - Integrate with Serper, Tavily, or similar
3. **Direct scraping** - Scrape 211.ca and informalberta.ca directly instead of AI search

**Recommendation:** Option 1 (hybrid) - Keep OpenAI for web search since it's already working, use Claude for all extraction/parsing. This minimizes risk and implementation complexity.

## Cost Analysis

### Current (GPT-4o-mini)
- ~$10-20/month for ~1000 services

### Projected (Claude Sonnet)
- Input: ~$3 per 1M tokens
- Output: ~$15 per 1M tokens
- Estimated: ~$30-60/month

### Cost Optimization
- Cache extraction results to avoid re-processing unchanged pages
- Skip services that are already complete (no empty fields)
- Batch similar extractions where possible

## Rollout Plan

1. **Phase 1:** Add Claude client and prompts modules
2. **Phase 2:** Update extraction functions (website enrichment first)
3. **Phase 3:** Update discovery and parsing functions
4. **Phase 4:** Test with dry-run on subset of services
5. **Phase 5:** Full production run with monitoring

## Success Metrics

- Reduction in null/empty fields after enrichment
- Decrease in obviously incorrect extractions (manual audit)
- Source citations available for all extracted fields
- No increase in hallucinated data (spot checks)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Claude API unavailable | Keep OpenAI as fallback, graceful degradation |
| Higher costs than estimated | Monitor usage, add cost alerts, optimize prompts |
| Different extraction behavior | Extensive testing before production rollout |
| Web search not supported | Hybrid approach with OpenAI for search only |

## Dependencies

- `anthropic` Python package
- Anthropic API key (`ANTHROPIC_API_KEY` env var)
- Keep existing `openai` package for embeddings and web search
