#!/usr/bin/env python3
"""Versioned, topic-neutral Git evidence collection. Python stdlib + Git only."""
import argparse
import collections
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import quote
from zoneinfo import ZoneInfo

VERSION = 1
UTC = dt.timezone.utc
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"


def timestamp(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include a timezone")
    return parsed.astimezone(UTC)


def now():
    return dt.datetime.now(UTC).isoformat()


def run(args, cwd=None):
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=240)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", "replace").strip())
    return result.stdout


def git(repo, *args):
    # No external diff/textconv, hooks, or project executables are used.
    return run(["git", "-c", "core.quotePath=false", "-C", str(repo), *args])


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")
    os.replace(temp, path)


def read_json(path):
    return json.loads(sys.stdin.read() if str(path) == "-" else Path(path).read_text())


def check_slug(slug):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", slug):
        raise ValueError("Expected owner/repo slug")
    if any(part in (".", "..") for part in slug.split("/")):
        raise ValueError("Invalid slug")
    return slug


def history(repo, revision):
    raw = git(repo, "log", "--first-parent", "-z",
              "--format=%H%x00%P%x00%aI%x00%cI%x00%s", revision, "--")
    fields = raw.decode("utf-8", "replace").split("\0")
    if fields[-1] == "":
        fields.pop()
    if len(fields) % 5:
        raise ValueError("Malformed Git log framing")
    return [dict(sha=fields[i], parents=fields[i+1].split(),
                 authored_at=fields[i+2], committed_at=fields[i+3],
                 subject=fields[i+4]) for i in range(0, len(fields), 5)]


def choose_snapshot(rows, until):
    return next((r for r in rows if timestamp(r["committed_at"]) < until), None)


def numstat(repo, row):
    parent = row["parents"][0] if row["parents"] else EMPTY_TREE
    raw = git(repo, "diff", "--no-ext-diff", "--no-textconv", "--no-renames",
              "--numstat", "-z", parent, row["sha"], "--")
    files = []
    for entry in raw.split(b"\0"):
        if not entry:
            continue
        added, deleted, path = entry.split(b"\t", 2)
        files.append({"path": path.decode("utf-8", "replace"),
                      "added": None if added == b"-" else int(added),
                      "deleted": None if deleted == b"-" else int(deleted)})
    return files


def candidates(rows, focus_prefixes=()):
    """Navigation only: no capability labels, intent inference, or automatic deletion."""
    largest = sorted(rows, key=lambda r: (-r["lines_changed"], r["sha"]))[:8]
    used = {r["sha"] for r in largest}
    sample = sorted((r for r in rows if r["sha"] not in used), key=lambda r: r["sha"])[:5]
    by_month = collections.defaultdict(list)
    for row in rows:
        by_month[timestamp(row["committed_at"]).strftime("%Y-%m")].append(row)
    focused = {}
    for prefix in focus_prefixes:
        scored = [(sum((f["added"] or 0) + (f["deleted"] or 0) for f in row["files"]
                       if f["path"] == prefix or f["path"].startswith(prefix.rstrip("/") + "/")), row)
                  for row in rows]
        focused[prefix] = [row["sha"] for score, row in sorted(scored, key=lambda x: (-x[0], x[1]["sha"]))[:8] if score]
    return {"candidate_method_version": 2,
            "method": "size + stable sample + per-month sample + explicitly selected path prefixes; not semantic importance",
            "largest": [r["sha"] for r in largest], "remaining_sample": [r["sha"] for r in sample],
            "per_month_sample": {m: [r["sha"] for r in sorted(rs, key=lambda r: r["sha"])[:3]]
                                 for m, rs in sorted(by_month.items())},
            "focus_prefixes": focused}


def sync(args):
    slug = check_slug(args.slug)
    repo = Path(args.repo).resolve()
    url = "https://github.com/" + slug + ".git"
    if repo.exists():
        if git(repo, "rev-parse", "--is-bare-repository").strip() != b"true":
            raise ValueError("sync only updates a dedicated bare repository")
        origin = git(repo, "remote", "get-url", "origin").decode().strip()
        if origin != url:
            raise ValueError("Existing origin does not match requested slug")
        # Update the existing default branch; do not silently switch branch policy.
        branch = git(repo, "symbolic-ref", "HEAD").decode().strip()
        shallow = git(repo, "rev-parse", "--is-shallow-repository").strip() == b"true"
        git(repo, "fetch", "--no-tags", *(["--unshallow"] if shallow else []), "origin", "+" + branch + ":" + branch)
    else:
        repo.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", "--bare", "--single-branch", "--no-tags", url, str(repo)])
    print(json.dumps({"repo": str(repo), "head": git(repo, "rev-parse", "HEAD").decode().strip()}))


def collect(args):
    started = time.monotonic()
    repo, out = Path(args.repo).resolve(), Path(args.out).resolve()
    slug = check_slug(args.slug)
    since, until = timestamp(args.since), timestamp(args.until)
    if since >= until:
        raise ValueError("since must be earlier than until")
    if (out / "manifest.json").exists():
        raise ValueError("Collection exists; use a new output directory")
    if git(repo, "rev-parse", "--is-shallow-repository").strip() == b"true":
        raise ValueError("Shallow history cannot establish coverage; fetch full history first")
    origin = git(repo, "remote", "get-url", "origin").decode().strip()
    allowed = {"https://github.com/" + slug + ".git", "https://github.com/" + slug,
               "git@github.com:" + slug + ".git"}
    if origin not in allowed:
        raise ValueError("origin does not match slug; cannot produce trustworthy GitHub links")
    revision = git(repo, "rev-parse", "--verify", args.revision + "^{commit}").decode().strip()
    rows = history(repo, revision)
    selected = [r for r in rows if since <= timestamp(r["committed_at"]) < until]
    snapshot = choose_snapshot(rows, until)
    baseline = choose_snapshot(rows, since)
    anomalies = [{"child": a["sha"], "parent": b["sha"]} for a, b in zip(rows, rows[1:])
                 if timestamp(a["committed_at"]) < timestamp(b["committed_at"])]
    cache = Path(args.cache).resolve() if args.cache else out.parent / ".cache"
    hit, miss = 0, 0
    for row in selected:
        file = cache / ("v" + str(VERSION)) / slug / (row["sha"] + ".json")
        cached = read_json(file) if file.exists() else None
        if cached and cached.get("sha") == row["sha"] and cached.get("version") == VERSION:
            row["files"] = cached["files"]
            hit += 1
        else:
            row["files"] = numstat(repo, row)
            write_json(file, {"version": VERSION, "sha": row["sha"], "files": row["files"]})
            miss += 1
        row["lines_changed"] = sum((f["added"] or 0) + (f["deleted"] or 0) for f in row["files"])
        row["url"] = "https://github.com/" + slug + "/commit/" + row["sha"]
        # A PR-shaped reference is a lead only. It has not been fetched/read.
        row["pr_reference_leads"] = ["https://github.com/" + slug + "/pull/" + n
                                     for n in re.findall(r"\(#(\d+)\)", row["subject"])]
    out.mkdir(parents=True, exist_ok=True)
    with (out / "commits.jsonl").open("w") as stream:
        for row in selected:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    candidate_data = candidates(selected, getattr(args, "focus_prefix", None) or [])
    write_json(out / "candidates.json", candidate_data)
    manifest = {"schema_version": VERSION, "repo": slug, "local_repo": str(repo), "origin": origin,
                "observed_at": now(), "revision": revision, "since": since.isoformat(), "until": until.isoformat(),
                "history_policy": "complete reachable first-parent chain; committer timestamp proxy",
                "history_count": len(rows), "window_count": len(selected), "shallow": False,
                "snapshot": snapshot, "baseline": baseline, "date_inversions": anomalies,
                "cache_hits": hit, "cache_misses": miss,
                "candidate_method_version": candidate_data["candidate_method_version"],
                "focus_prefixes": list(candidate_data["focus_prefixes"]),
                "elapsed_seconds": round(time.monotonic() - started, 3),
                "limitations": ["Not a historical remote-HEAD archive; rewritten/deleted history unknown",
                                "No release publication or adoption data collected",
                                "PR references are unread leads; commit time is not verified merge time",
                                "Line counts include generated files, docs and tests; not effort or importance"]}
    # Avoid copying file stats into the snapshot when it also belongs to selected.
    for name in ("snapshot", "baseline"):
        if manifest[name]:
            manifest[name] = {k: v for k, v in manifest[name].items()
                              if k in ("sha", "parents", "authored_at", "committed_at", "subject")}
    write_json(out / "manifest.json", manifest)
    months = collections.Counter(timestamp(r["committed_at"]).strftime("%Y-%m") for r in selected)
    paths = collections.Counter(f["path"] for r in selected for f in r["files"])
    lines = ["# " + slug, "", "Window: `" + since.isoformat() + "` ≤ committer time < `" + until.isoformat() + "`",
             "", "Snapshot: `" + (snapshot["sha"] if snapshot else "none") + "`",
             "", f"{len(selected)} commits; {len(rows)} first-parent ancestors; {len(anomalies)} date inversions.",
             "", "## Monthly counts (UTC, not topic heat)", ""]
    lines += [f"- {month}: {count}" for month, count in sorted(months.items())]
    lines += ["", "## Most frequently changed paths", ""]
    lines += [f"- `{path}`: {count}" for path, count in paths.most_common(20)]
    lines += ["", "## All commit subjects (discovery input, not findings)", ""]
    for row in selected:
        subject = row["subject"].replace("[", "\\[").replace("]", "\\]")
        lines.append(f'- {row["committed_at"]} [{row["sha"][:10]}]({row["url"]}) {subject} ({row["lines_changed"]} lines, {len(row["files"])} paths)')
    (out / "index.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({k: manifest[k] for k in ("repo", "window_count", "cache_hits", "cache_misses", "elapsed_seconds")}, ensure_ascii=False))


def load_collection(path):
    path = Path(path)
    return read_json(path / "manifest.json"), [json.loads(line) for line in (path / "commits.jsonl").read_text().splitlines()]


def file_content(repo, sha, path):
    try:
        return git(repo, "show", sha + ":" + path)
    except RuntimeError:
        # Distinguish an absent path from corrupt/missing Git objects.
        git(repo, "cat-file", "-e", sha + "^{commit}")
        if not git(repo, "ls-tree", "-z", sha, "--", ":(literal)" + path):
            return None
        raise


def inspect(args):
    manifest, rows = load_collection(args.collection)
    sha = args.sha
    row = next((r for r in rows if r["sha"] == sha), None)
    if row is None:
        raise ValueError("inspect requires a full SHA present in this collection")
    repo, out = Path(manifest["local_repo"]), Path(args.out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Evidence output must be empty")
    out.mkdir(parents=True, exist_ok=True)
    parent = row["parents"][0] if row["parents"] else EMPTY_TREE
    literal_paths = [":(literal)" + p for p in (args.path or [])]
    patch = git(repo, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--unified=5", parent, sha, "--", *literal_paths)
    (out / "change.diff").write_bytes(patch[:args.max_bytes])
    meta = {"sha": sha, "parent": parent, "patch_bytes": len(patch),
            "patch_truncated": len(patch) > args.max_bytes, "files": []}
    for index, path in enumerate(args.path or []):
        for label, version in (("before", parent), ("after", sha)):
            raw = None if version == EMPTY_TREE else file_content(repo, version, path)
            item = {"side": label, "commit": version, "path": path, "exists": raw is not None}
            if raw is not None:
                filename = f"{index:02d}-{label}.txt"
                text = raw[:args.max_bytes].decode("utf-8", "replace")
                (out / filename).write_text("".join(f"{n}\t{line}\n" for n, line in enumerate(text.splitlines(), 1)))
                item.update({"bytes": len(raw), "truncated": len(raw) > args.max_bytes, "file": filename,
                             "url": f'https://github.com/{manifest["repo"]}/blob/{version}/{quote(path)}'})
            meta["files"].append(item)
    write_json(out / "metadata.json", meta)
    print(json.dumps(meta, ensure_ascii=False))


def snapshot_export(args):
    manifest, _ = load_collection(args.collection)
    if not manifest["snapshot"]:
        raise ValueError("No snapshot exists before until")
    sha, repo = manifest["snapshot"]["sha"], manifest["local_repo"]
    out = Path(args.out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Snapshot output must be empty")
    out.mkdir(parents=True, exist_ok=True)
    inventory = git(repo, "ls-tree", "-r", "-z", "--long", sha).decode("utf-8", "replace").split("\0")
    (out / "tree.txt").write_text("\n".join(r for r in inventory if r) + "\n")
    files = []
    for index, path in enumerate(args.path or []):
        raw = file_content(repo, sha, path)
        if raw is None:
            raise ValueError("Requested snapshot path absent: " + path)
        filename = f"{index:02d}.txt"
        text = raw[:args.max_bytes].decode("utf-8", "replace")
        (out / filename).write_text("".join(f"{n}\t{line}\n" for n, line in enumerate(text.splitlines(), 1)))
        files.append({"path": path, "file": filename, "bytes": len(raw), "truncated": len(raw) > args.max_bytes,
                      "url": f'https://github.com/{manifest["repo"]}/blob/{sha}/{quote(path)}'})
    meta = {"repo": manifest["repo"], "sha": sha, "files": files}
    write_json(out / "metadata.json", meta)
    print(json.dumps(meta, ensure_ascii=False))


def validated_events(args):
    datasets = {}
    for path in args.collection:
        manifest, rows = load_collection(path)
        slug = manifest["repo"]
        if slug in datasets:
            raise ValueError("Pass only one collection per repo to validate")
        datasets[slug] = (manifest, {r["sha"]: r for r in rows})
    doc = read_json(args.events)
    if doc.get("schema_version") != VERSION or not isinstance(doc.get("events"), list):
        raise ValueError("Invalid events schema")
    ids, count = set(), 0
    for event in doc["events"]:
        if not event.get("id") or event["id"] in ids:
            raise ValueError("Event IDs must be nonempty and unique")
        ids.add(event["id"])
        if not event.get("summary") or not event.get("problem_ids") or not event.get("claims"):
            raise ValueError("Event needs summary, problem_ids and claims")
        manifest, rows = datasets[event["repo"]]
        if not event.get("commit_shas") or any(s not in rows for s in event["commit_shas"]):
            raise ValueError("Event commits must belong to its collection")
        allowed = set(event["commit_shas"])
        for sha in event["commit_shas"]:
            allowed.update(rows[sha]["parents"][:1])
        for claim in event["claims"]:
            if claim.get("level") not in ("fact", "inference", "hypothesis") or not claim.get("text"):
                raise ValueError("Claim needs valid level and text")
            if claim["level"] != "hypothesis" and not claim.get("evidence"):
                raise ValueError("Fact/inference requires evidence")
            for ev in claim.get("evidence", []):
                if ev["commit"] not in allowed:
                    raise ValueError("Evidence must be at event commit or first parent")
                raw = file_content(manifest["local_repo"], ev["commit"], ev["path"])
                if raw is None:
                    raise ValueError("Evidence path does not exist")
                start, end = ev["start_line"], ev.get("end_line", ev["start_line"])
                if type(start) is not int or type(end) is not int or not 1 <= start <= end <= len(raw.splitlines()):
                    raise ValueError(f'Evidence line range does not exist: {event["id"]} '
                                     f'{ev["path"]}:{start}-{end}, file has {len(raw.splitlines())} lines')
                count += 1
    return doc, datasets, count


def validate(args):
    doc, _, count = validated_events(args)
    print(json.dumps({"events": len(doc["events"]), "evidence_ranges_checked": count,
                      "result": "references valid; claim truth and completeness require review"}))


def export_history(args):
    """Package authored history with checked, version-specific excerpts for study import."""
    doc, datasets, _ = validated_events(args)
    if len(datasets) != 1 or not doc.get("summary") or not doc.get("scope"):
        raise ValueError("Study history requires one collection, summary and scope")
    manifest, rows = next(iter(datasets.values()))
    events = []
    for event in doc["events"]:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", event["id"]):
            raise ValueError("History event id must use letters, digits, _ or -")
        item = dict(event)
        item["commits"] = [{"sha": s, "date": rows[s]["committed_at"], "subject": rows[s]["subject"],
                            "url": rows[s]["url"]} for s in event["commit_shas"]]
        item["date"] = min(item["commits"], key=lambda c: timestamp(c["date"]))["date"]
        item["claims"] = []
        for claim in event["claims"]:
            evidence = []
            for ev in claim.get("evidence", []):
                raw = file_content(manifest["local_repo"], ev["commit"], ev["path"])
                end = ev.get("end_line", ev["start_line"])
                excerpt = raw.splitlines()[ev["start_line"]-1:end]
                evidence.append({**ev, "end_line": end,
                                 "versionLabel": "该次提交后" if ev["commit"] in event["commit_shas"] else "该次提交前（父版本）",
                                 "text": b"\n".join(excerpt).decode("utf-8", "replace"),
                                 "url": f'https://github.com/{manifest["repo"]}/blob/{ev["commit"]}/{quote(ev["path"])}#L{ev["start_line"]}-L{end}'})
            item["claims"].append({**claim, "evidence": evidence})
        events.append(item)
    events.sort(key=lambda e: (timestamp(e["date"]), e["id"]))
    print(json.dumps({"revision": manifest["revision"], "repo": manifest["repo"],
                      "summary": doc["summary"], "scope": doc["scope"],
                      "since": manifest["since"], "until": manifest["until"],
                      "historyPolicy": manifest["history_policy"], "commitCount": manifest["window_count"],
                      "dateInversions": len(manifest["date_inversions"]), "events": events}, ensure_ascii=False))


def compare(args):
    old, oldrows = load_collection(args.old)
    new, newrows = load_collection(args.new)
    if old["repo"] != new["repo"]:
        raise ValueError("Cannot compare different repositories")
    oldids, newids = {r["sha"] for r in oldrows}, {r["sha"] for r in newrows}
    overlap_start = max(timestamp(old["since"]), timestamp(new["since"]))
    overlap_end = min(timestamp(old["until"]), timestamp(new["until"]))
    old_overlap = {r["sha"] for r in oldrows if overlap_start <= timestamp(r["committed_at"]) < overlap_end}
    new_overlap = {r["sha"] for r in newrows if overlap_start <= timestamp(r["committed_at"]) < overlap_end}
    chain = {r["sha"] for r in history(new["local_repo"], new["revision"])}
    old_still_on_chain = old["revision"] in chain
    result = {"repo": new["repo"], "added_to_window": sorted(newids - oldids),
              "removed_from_window": sorted(oldids - newids),
              "added_in_overlap": sorted(new_overlap - old_overlap),
              "removed_in_overlap": sorted(old_overlap - new_overlap),
              "old_revision_on_new_first_parent_chain": old_still_on_chain,
              "history_diverged": not old_still_on_chain,
              "window_changed": (old["since"], old["until"]) != (new["since"], new["until"]),
              "snapshot_changed": (old["snapshot"] or {}).get("sha") != (new["snapshot"] or {}).get("sha"),
              "interpretation_limit": "Window membership is not feature introduction/removal. Divergence may also mean a different selected revision."}
    write_json(args.out, result)
    print(json.dumps(result, ensure_ascii=False))


def render(args):
    # Render only the curated semantic input. No new interpretations are synthesized.
    doc, checked, _ = validated_events(args)
    datasets = {repo: rows for repo, (_, rows) in checked.items()}
    events = doc["events"]
    display_zone = ZoneInfo(args.timezone)
    def date(event):
        return min(timestamp(datasets[event["repo"]][s]["committed_at"]) for s in event["commit_shas"]).astimezone(display_zone)
    events = sorted(events, key=lambda e: (date(e), e["id"]))
    lines = ["# 已审阅事件时间轴", "", "由人工整理的 events.json 确定性生成；提交者时间不是已核实的合入/发布日期。", "",
             "展示时区：`" + args.timezone + "`。多提交事件按最早提交排序，以下保留每条提交的时间。", ""]
    for event in events:
        lines += ["## " + date(event).isoformat() + " · " + event["id"], "", event["repo"] + " — " + event["summary"], "",
                  "提交：" + ", ".join(f'[{s[:10]}]({datasets[event["repo"]][s]["url"]}) '
                  + timestamp(datasets[event["repo"]][s]["committed_at"]).astimezone(display_zone).isoformat()
                  for s in event["commit_shas"]), ""]
        for claim in event["claims"]:
            refs = []
            for e in claim.get("evidence", []):
                url = f'https://github.com/{event["repo"]}/blob/{e["commit"]}/{quote(e["path"])}#L{e["start_line"]}'
                refs.append(f'[{e["path"]}:{e["start_line"]}]({url})')
            lines += [f'- **{claim["level"]}**：{claim["text"]} ' + " · ".join(refs)]
        if event.get("missing_evidence"):
            lines += ["", "未知/未覆盖：" + event["missing_evidence"]]
        lines += [""]
    lines += ["# 问题索引", "", "问题标识来自人工发现与归类；关联不证明因果、传播或行业热度。", ""]
    problems = sorted({p for e in events for p in e["problem_ids"]})
    for problem in problems:
        lines += ["## " + problem, ""]
        for event in events:
            if problem in event["problem_ids"]:
                lines += [f'- {date(event).date()} · {event["repo"]} · {event["id"]}：{event["summary"]}']
        lines += [""]
    output = Path(args.out)
    if output.exists():
        raise ValueError("Rendered output exists; use a new path")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n")


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    q = sub.add_parser("sync")
    q.add_argument("--repo", required=True)
    q.add_argument("--slug", required=True)
    q.set_defaults(func=sync)
    q = sub.add_parser("collect")
    for name in ("repo", "slug", "since", "until", "out"):
        q.add_argument("--" + name, required=True)
    q.add_argument("--revision", default="HEAD")
    q.add_argument("--cache")
    q.add_argument("--focus-prefix", action="append")
    q.set_defaults(func=collect)
    q = sub.add_parser("inspect")
    for name in ("collection", "sha", "out"):
        q.add_argument("--" + name, required=True)
    q.add_argument("--path", action="append")
    q.add_argument("--max-bytes", type=int, default=200000)
    q.set_defaults(func=inspect)
    q = sub.add_parser("snapshot")
    q.add_argument("--collection", required=True)
    q.add_argument("--out", required=True)
    q.add_argument("--path", action="append")
    q.add_argument("--max-bytes", type=int, default=300000)
    q.set_defaults(func=snapshot_export)
    q = sub.add_parser("validate")
    q.add_argument("--events", required=True)
    q.add_argument("--collection", action="append", required=True)
    q.set_defaults(func=validate)
    q = sub.add_parser("export")
    q.add_argument("--events", required=True)
    q.add_argument("--collection", action="append", required=True)
    q.set_defaults(func=export_history)
    q = sub.add_parser("render")
    q.add_argument("--events", required=True)
    q.add_argument("--collection", action="append", required=True)
    q.add_argument("--out", required=True)
    q.add_argument("--timezone", default="UTC")
    q.set_defaults(func=render)
    q = sub.add_parser("compare")
    for name in ("old", "new", "out"):
        q.add_argument("--" + name, required=True)
    q.set_defaults(func=compare)
    return p


if __name__ == "__main__":
    try:
        args = parser().parse_args()
        if getattr(args, "max_bytes", 1) <= 0:
            raise ValueError("max-bytes must be positive")
        args.func(args)
    except (ValueError, RuntimeError, OSError, KeyError, subprocess.TimeoutExpired) as exc:
        print("error: " + str(exc), file=sys.stderr)
        sys.exit(1)
