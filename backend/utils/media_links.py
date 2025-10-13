# === MEDIA_LINKS MODULE v1 ===
import re
from collections import defaultdict
from typing import Callable, Dict, List, Set, Union

ID_PATTERN = re.compile(r"\bPDM-\d{4}-\d{5}\b", re.IGNORECASE)

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()

def _safe_word_pat(s: str) -> re.Pattern:
    return re.compile(rf"\b{re.escape(s)}\b", re.IGNORECASE)

def _initial(s: str) -> str:
    return (s[:1].upper() + ".") if s else ""

def name_aliases(meta: dict) -> List[str]:
    """Generate robust name variants for matching."""
    fn = (meta.get("first_name") or meta.get("given_name") or "").strip()
    mn = (meta.get("middle_name") or "").strip()
    ln = (meta.get("surname") or meta.get("last_name") or "").strip()
    full = (meta.get("full_name") or "").replace(",", " ").strip()

    aliases: Set[str] = set()
    if full:
        aliases.add(full)
    if fn and ln:
        aliases.update({f"{fn} {ln}", f"{ln}, {fn}", f"{ln} {fn}"})
        if mn:
            aliases.update({
                f"{fn} {mn} {ln}",
                f"{fn} {mn[:1]}. {ln}",
                f"{_initial(fn)} {ln}",
                f"{ln}, {fn} {mn[:1]}.",
            })

    # Deduplicate/normalize whitespace
    return [a for a in {re.sub(r"\s+", " ", a).strip() for a in aliases} if a]

def default_url_builder(base_url: str) -> Callable[[dict], Union[str, None]]:
    """
    Returns a function(meta)->url that prefers student_id, then _id, then full_name.
    You can pass your own builder if your routes differ.
    """
    def _build(meta: dict) -> Union[str, None]:
        sid = str(meta.get("student_id") or "").strip()
        if sid:
            return f"{base_url}/api/student_image/{sid}"
        oid = str(meta.get("_id") or "").strip()
        if oid:
            return f"{base_url}/api/student_image/by_oid/{oid}"
        nm = (meta.get("full_name")
              or f"{meta.get('first_name','')} {meta.get('surname','')}".strip())
        if nm:
            return f"{base_url}/api/student_image/by_name/{re.sub(r'\\s+','%20', nm)}"
        return None
    return _build

# === DO NOT EDIT NAME OR INDENTATION BELOW ===
def build_image_link_map(
    final_text: str,
    collected_docs: List[dict],
    url_for: Callable[[dict], Union[str, None]],
    allow_ambiguous_single_tokens: bool = True
) -> Dict[str, Dict[str, Union[str, List[str]]]]:
    """
    Create a dict mapping:
      - by_id:  PDM-IDs -> image URL
      - by_name: matched names/aliases -> image URL (or list if ambiguous)

    NOTE: This runs AFTER LLM. Do not call inside prompts.
    """
    text = final_text or ""
    text_lc = text.lower()

    # IDs mentioned verbatim
    mentioned_ids = {m.group(0).upper() for m in ID_PATTERN.finditer(text)}

    by_id: Dict[str, str] = {}
    by_name: Dict[str, Union[str, List[str]]] = {}

    alias_to_urls: Dict[str, Set[str]] = defaultdict(set)
    first_to_urls: Dict[str, Set[str]] = defaultdict(set)
    last_to_urls: Dict[str, Set[str]] = defaultdict(set)
    sid_to_url: Dict[str, str] = {}

    # Index docs
    for d in (collected_docs or []):
        meta = d.get("metadata", d) if isinstance(d, dict) else {}
        url = url_for(meta)
        if not url:
            continue

        sid = str(meta.get("student_id") or "").upper()
        if sid:
            sid_to_url[sid] = url

        for alias in name_aliases(meta):
            alias_to_urls[_norm(alias)].add(url)

        fn = _norm(meta.get("first_name") or meta.get("given_name") or "")
        ln = _norm(meta.get("surname") or meta.get("last_name") or "")
        if fn:
            first_to_urls[fn].add(url)
        if ln:
            last_to_urls[ln].add(url)

    # Map IDs found in text
    for sid in mentioned_ids:
        if sid in sid_to_url:
            by_id[sid] = sid_to_url[sid]

    # Multi-token alias matches (precise)
    for alias_norm, urls in alias_to_urls.items():
        if _safe_word_pat(alias_norm).search(text_lc):
            by_name[alias_norm] = next(iter(urls)) if len(urls) == 1 else sorted(urls)

    # Single-token names (first/last); may be ambiguous
    tokens = set(re.findall(r"\b[^\W\d_]+\b", text_lc))
    for tok in tokens:
        if tok not in by_name and tok in first_to_urls:
            urls = first_to_urls[tok]
            if len(urls) == 1 or allow_ambiguous_single_tokens:
                by_name[tok] = next(iter(urls)) if len(urls) == 1 else sorted(urls)
        if tok not in by_name and tok in last_to_urls:
            urls = last_to_urls[tok]
            if len(urls) == 1 or allow_ambiguous_single_tokens:
                by_name[tok] = next(iter(urls)) if len(urls) == 1 else sorted(urls)

    return {"by_id": by_id, "by_name": by_name}

__all__ = ["build_image_link_map", "default_url_builder", "name_aliases"]
