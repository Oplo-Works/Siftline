"""
hashnode_publish.py
-------------------
Reads builder_substack.md from the latest outputs/v*/builder_substack.md,
strips YAML frontmatter, replaces 📷 image markers with placeholder text,
then creates a DRAFT post on Hashnode via GraphQL API.

Usage:
    python hashnode_publish.py

The draft will appear in your Hashnode dashboard.
Add screenshots there before publishing.
"""

import json
import os
import re
import urllib.request
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────
HASHNODE_TOKEN = "4d9e0830-ec05-4c97-99a1-a97859954328"
HASHNODE_HOST  = "minkyu.hashnode.dev"
HASHNODE_API   = "https://gql.hashnode.com"

BASE_DIR    = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"
# ──────────────────────────────────────────────────────────────────────────────


def find_latest_post() -> Path:
    """Return the most recently modified builder_substack.md under outputs/."""
    candidates = sorted(
        OUTPUTS_DIR.glob("*/builder_substack.md"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError("No builder_substack.md found under outputs/")
    return candidates[0]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML-style --- frontmatter and return (meta, body)."""
    meta = {}
    if text.startswith("---"):
        end = text.index("---", 3)
        fm_block = text[3:end].strip()
        body = text[end + 3:].strip()
        for line in fm_block.splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                meta[key.strip()] = val.strip()
    else:
        body = text
    return meta, body


def replace_image_markers(content: str) -> str:
    """
    Replace lines like:
        📷 img_02_deepseek_reviewer_role.png
    with a Hashnode-friendly placeholder that reminds you to insert a screenshot.
    """
    def replacer(m):
        filename = m.group(1)
        label = filename.replace("img_", "").replace("_", " ").replace(".png", "").title()
        return f"\n> 📷 **[Insert screenshot: {label}]** — replace with `{filename}`\n"

    return re.sub(r"📷\s+(img_[\w.]+\.png)", replacer, content)


def gql(query: str, variables: dict | None = None) -> dict:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        HASHNODE_API,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": HASHNODE_TOKEN,
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def get_publication_id(host: str) -> str:
    result = gql('{ publication(host: "%s") { id title } }' % host)
    pub = result["data"]["publication"]
    print(f"  Publication: {pub['title']} (id: {pub['id']})")
    return pub["id"]


def create_draft(publication_id: str, title: str, subtitle: str, content_md: str) -> dict:
    mutation = """
    mutation CreateDraft($input: CreateDraftInput!) {
      createDraft(input: $input) {
        draft {
          id
          title
          slug
        }
      }
    }
    """
    variables = {
        "input": {
            "publicationId": publication_id,
            "title": title,
            "subtitle": subtitle,
            "contentMarkdown": content_md,
            "tags": [],
        }
    }
    result = gql(mutation, variables)
    if "errors" in result:
        raise RuntimeError(f"GraphQL errors: {result['errors']}")
    return result["data"]["createDraft"]["draft"]


def main():
    print("=" * 60)
    print("  Hashnode Draft Publisher")
    print("=" * 60)

    # 1. Find and read the markdown file
    post_path = find_latest_post()
    print(f"\n✓ Reading: {post_path.relative_to(BASE_DIR)}")
    raw = post_path.read_text(encoding="utf-8")

    # 2. Parse frontmatter
    meta, body = parse_frontmatter(raw)
    title    = meta.get("title", "AI Council v1.0.8")
    subtitle = meta.get("subtitle", "")
    print(f"  Title:    {title}")
    print(f"  Subtitle: {subtitle}")

    # 3. Replace image markers with placeholders
    body = replace_image_markers(body)

    # 4. Get publication ID
    print(f"\n✓ Fetching publication ID for {HASHNODE_HOST} ...")
    pub_id = get_publication_id(HASHNODE_HOST)

    # 5. Create draft
    print("\n✓ Creating draft on Hashnode ...")
    draft = create_draft(pub_id, title, subtitle, body)

    print(f"\n{'=' * 60}")
    print(f"  ✅ Draft created!")
    print(f"  ID:   {draft['id']}")
    print(f"  Slug: {draft['slug']}")
    print(f"\n  Open your dashboard to add screenshots and publish:")
    print(f"  https://hashnode.com/draft/{draft['id']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
