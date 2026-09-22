#!/usr/bin/env python3
"""Plan ranked additions, retain study versions, and build a project collection."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys
import tempfile
from urllib.parse import quote


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False, encoding="utf-8") as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.write("\n")
        temporary = Path(out.name)
    temporary.replace(path)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def source(args):
    return json.load(sys.stdin) if args.source == "-" else read(args.source)


def observed_at(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, "observedAt requires a timezone")
    return parsed.astimezone(dt.timezone.utc).isoformat()


def key(item):
    return "github:" + str(item["repositoryId"]) if item.get("repositoryId") is not None else "repo:" + item["repo"].lower()


def locate(catalog, item):
    identity = key(item)
    if identity in catalog["projects"]:
        return identity
    if item.get("repositoryId") is not None:
        for existing_key, project in catalog["projects"].items():
            if project.get("repositoryId") is not None and str(project["repositoryId"]) == str(item["repositoryId"]):
                return existing_key
    matches = [k for k, p in catalog["projects"].items() if item["repo"].lower() in {n.lower() for n in [p["repo"], *p.get("aliases", [])]}]
    for match in matches:
        p = catalog["projects"][match]
        if item.get("repositoryId") is None or p.get("repositoryId") is None or item["repositoryId"] == p["repositoryId"]:
            return match
    return None


def safe_id(value):
    require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}", value) is not None, "ID must contain only letters, digits, dot, underscore, hyphen")
    return value


def load(args):
    root = Path(args.catalog).resolve()
    return root, read(root / "catalog.json")


def freeze(root, identity, version):
    if version.get("archived"):
        require((root / "site" / version["url"] / "index.html").is_file(), "Archived delivery is missing")
        link_home(root / "site" / version["url"], identity)
        return
    path = Path(version["delivery"])
    model = read(path / "understanding.json")
    require(model["revision"] == version["revision"], "Existing delivery was overwritten; recover its old version before updating")
    require(model.get("modelHash") == version.get("modelHash"), "Existing interpretation changed before archival; register that study explicitly")
    slug = hashlib.sha256(identity.encode()).hexdigest()[:16]
    edition = hashlib.sha256((version["revision"] + str(version.get("modelHash"))).encode()).hexdigest()[:16]
    relative = f"versions/{slug}/{edition}"
    target = root / "site" / relative
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=".copy-", dir=target.parent))
        try:
            shutil.copytree(path, staging, dirs_exist_ok=True)
            staging.rename(target)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    saved = read(target / "understanding.json")
    require(saved["revision"] == version["revision"] and saved.get("modelHash") == version.get("modelHash"), "Snapshot identity mismatch")
    link_home(target, identity)
    version.update(url=relative + "/", archived=True)


def link_home(target, identity):
    # The reader already consumes this metadata (see site.mjs); only routing changes.
    file = target / "index.html"
    html = file.read_text()
    home = "../../../#project=" + quote(identity, safe="")
    updated = re.sub(r'<meta name="htw-home"[^>]*>', "", html).replace("</head>", f'<meta name="htw-home" content="{home}"></head>')
    if updated != html:
        file.write_text(updated)


def init(args):
    root = Path(args.catalog).resolve()
    require(not (root / "catalog.json").exists(), "Collection already exists")
    doc = source(args)
    catalog = {"schema_version": 1, "title": doc.get("title", "How This Works"), "domains": doc.get("domains", []), "directions": doc.get("directions", []), "projects": {}, "batches": {}, "observations": []}
    for item in doc.get("projects", []):
        p = copy.deepcopy(item)
        identity = key(p)
        require(locate(catalog, p) is None, "Duplicate project identity")
        p.setdefault("aliases", [])
        p.setdefault("versions", [])
        if p.get("delivery"):
            delivery = Path(p.pop("delivery")).resolve()
            model = read(delivery / "understanding.json")
            require(model["repo"].lower() == p["repo"].lower(), "Study repository mismatch")
            require((delivery / "index.html").is_file(), "Study page missing")
            p["versions"].append({"revision": model["revision"], "modelHash": model.get("modelHash"), "delivery": str(delivery), "url": p.pop("studyUrl", ""), "archived": False})
            p["reviewedRevision"] = model["revision"]
        require(p["versions"] or not p.get("reviewedRevision"), "A reviewed revision requires an existing study")
        catalog["projects"][identity] = p
    write(root / "catalog.json", catalog)
    return {"catalog": str(root), "projects": len(catalog["projects"])}


def plan(args):
    root, catalog = load(args)
    doc = source(args)
    require(doc.get("basis") and doc.get("source") and doc.get("observedAt"), "Candidates require basis, source and observedAt")
    require(isinstance(doc.get("candidates"), list), "candidates must be an already ranked list")
    doc["observedAt"] = observed_at(doc["observedAt"])
    require(args.top > 0, "top must be positive")
    batch_id = safe_id(args.batch)
    require(batch_id not in catalog["batches"], "Batch already exists; use status to resume, or a new batch ID for another selection")
    seen, seen_names, selected = set(), set(), []
    for candidate in doc["candidates"]:
        identity = locate(catalog, candidate) or key(candidate)
        if identity in seen or candidate["repo"].lower() in seen_names:
            continue
        seen.add(identity)
        seen_names.add(candidate["repo"].lower())
        old = catalog["projects"].get(identity)
        if old and old.get("repositoryId") is None and candidate.get("repositoryId") is not None:
            old["repositoryId"] = candidate["repositoryId"]
        if old and old["repo"].lower() != candidate["repo"].lower():
            require(old.get("repositoryId") is not None and str(old["repositoryId"]) == str(candidate.get("repositoryId")), "A rename requires a matching repositoryId")
            old["aliases"] = sorted(set(old["aliases"] + [old["repo"]]))
            old["repo"] = candidate["repo"]
        head = candidate.get("revision")
        base = old.get("reviewedRevision") if old else None
        action = "new" if old is None or not old["versions"] else "inspect" if not head else "reuse" if head == base else "update"
        if old and action in {"update", "inspect"}:
            for version in old["versions"]:
                freeze(root, identity, version)
        selected.append({**candidate, "identity": identity, "baseRevision": base, "action": action, "status": "done" if action == "reuse" else "pending"})
        if len(selected) == args.top:
            break
    batch = {"id": batch_id, "period": args.period, "top": args.top, "basis": doc["basis"], "source": doc["source"], "observedAt": doc["observedAt"], "candidateCount": len(doc["candidates"]), "selected": selected}
    catalog["batches"][batch_id] = batch
    write(root / "catalog.json", catalog)
    return batch


def record(args):
    root, catalog = load(args)
    item = source(args)
    batch = catalog["batches"][args.batch]
    identity = locate(catalog, item) or key(item)
    entry = next((e for e in batch["selected"] if e["identity"] == identity), None)
    require(entry is not None, "Project not selected in this batch")
    revision = item.get("revision")
    require(revision and (not entry.get("revision") or revision == entry["revision"]), "Reviewed revision must match the selected revision")
    require(item.get("summary"), "Record a concise explanation of what changed or why existing understanding remains applicable")
    p = catalog["projects"].get(identity)
    classification_before = {field: (p or {}).get(field) for field in ("domain", "direction", "method")}
    require(item.get("delivery") or (p is not None and p["versions"]), "A new project requires a completed study delivery")
    require(item.get("delivery") or item.get("reviewEvidence"), "A review without a new delivery requires evidence references")
    if p is None:
        p = {"repo": item["repo"], "repositoryId": item.get("repositoryId"), "aliases": [], "versions": []}
        catalog["projects"][identity] = p
    if p["repo"].lower() != item["repo"].lower():
        require(p.get("repositoryId") is not None and p["repositoryId"] == item.get("repositoryId"), "A rename requires a matching repositoryId")
        p["aliases"] = sorted(set(p["aliases"] + [p["repo"]]))
        p["repo"] = item["repo"]
    if item.get("delivery"):
        delivery = Path(item["delivery"]).resolve()
        model = read(delivery / "understanding.json")
        require(model["revision"] == revision, "Delivery revision does not match reviewed revision")
        require(model["repo"].lower() in {p["repo"].lower(), *(a.lower() for a in p["aliases"])}, "Delivery repository mismatch")
        require((delivery / "index.html").is_file(), "Delivery website is missing")
        for old in p["versions"]:
            freeze(root, identity, old)
        existing = next((v for v in p["versions"] if v["revision"] == revision and v.get("modelHash") == model.get("modelHash")), None)
        if existing is None:
            version = {"revision": revision, "modelHash": model.get("modelHash"), "delivery": str(delivery), "archived": False}
            freeze(root, identity, version)
            p["versions"].append(version)
        p["title"] = model.get("intro", {}).get("title", p["repo"])
        p["description"] = model.get("intro", {}).get("text", "")
    p["reviewedRevision"] = revision
    for field in ("domain", "direction", "method", "scope", "history"):
        if field in item:
            p[field] = item[field]
    entry.update(status="done", reviewedRevision=revision, summary=item["summary"], reviewEvidence=item.get("reviewEvidence", []))
    entry.setdefault("classificationBefore", classification_before)
    entry["classificationAfter"] = {field: p.get(field) for field in ("domain", "direction", "method")}
    write(root / "catalog.json", catalog)
    return {"repo": p["repo"], "reviewedRevision": revision, "studyRevision": p["versions"][-1]["revision"], "versions": len(p["versions"])}


def edit(args):
    root, catalog = load(args)
    data = source(args)
    require(set(data) <= {"title", "domains", "directions"}, "Edit supports collection title, domains and directions; project changes use record")
    catalog.update(data)
    write(root / "catalog.json", catalog)
    return {"saved": True}


def observe(args):
    root, catalog = load(args)
    doc = source(args)
    require(all(doc.get(k) for k in ("metric", "label", "period", "source", "observedAt")), "Observation requires metric, label, period, source and observedAt")
    require(re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", doc["period"]) is not None, "Observation period must be YYYY-MM")
    values = {}
    for item in doc.get("values", []):
        value = item["value"]
        require(type(value) in (int, float) and math.isfinite(value), "Observation values must be finite numbers")
        identity = locate(catalog, item) or key(item)
        require(identity not in values, "Duplicate observation identity")
        values[identity] = value
    entry = {k: doc[k] for k in ("metric", "label", "period", "source", "observedAt")}
    entry["observedAt"] = observed_at(doc["observedAt"])
    entry.update(values=values, warning=doc.get("warning", ""))
    observations = catalog.setdefault("observations", [])
    if entry not in observations:
        observations.append(entry)
        write(root / "catalog.json", catalog)
    return {"recorded": len(values), "period": doc["period"], "snapshots": len(observations)}


def build(args):
    root, catalog = load(args)
    for identity, project in catalog["projects"].items():
        for version in project["versions"]:
            if version.get("archived"):
                link_home(root / "site" / version["url"], identity)
    public = copy.deepcopy(catalog)
    for p in public["projects"].values():
        for v in p["versions"]:
            v.pop("delivery", None)
    for b in public["batches"].values():
        for entry in b["selected"]:
            entry.pop("delivery", None)
    template = Path(__file__).resolve().parents[1] / "assets/collection.html"
    payload = json.dumps(public, ensure_ascii=False).replace("<", "\\u003c")
    (root / "site").mkdir(exist_ok=True)
    (root / "site/index.html").write_text(template.read_text().replace("__COLLECTION__", payload))
    write(root / "site/collection.json", public)
    return {"site": str(root / "site/index.html"), "projects": len(public["projects"]), "batches": len(public["batches"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("init", "plan", "record", "edit", "observe", "status", "build"):
        p = commands.add_parser(command)
        p.add_argument("--catalog", required=True)
        if command in {"init", "plan", "record", "edit", "observe"}:
            p.add_argument("--from", dest="source", default="-")
        if command in {"plan", "record"}:
            p.add_argument("--batch", required=True)
        if command == "plan":
            p.add_argument("--period", required=True)
            p.add_argument("--top", required=True, type=int)
        if command == "status":
            p.add_argument("--batch")
    args = parser.parse_args()
    try:
        if args.command == "status":
            _, catalog = load(args)
            result = catalog["batches"][args.batch] if args.batch else {"projects": len(catalog["projects"]), "batches": [{"id": b["id"], "period": b["period"], "pending": sum(e["status"] != "done" for e in b["selected"])} for b in catalog["batches"].values()]}
        else:
            result = globals()[args.command](args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, str(error) + "\n")


if __name__ == "__main__":
    main()
