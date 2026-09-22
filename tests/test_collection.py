import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "skills/how-this-works/scripts/collection.py"
spec = importlib.util.spec_from_file_location("collection", SCRIPT)
collection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collection)


class CollectionLifecycle(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.catalog = self.root / "catalog"
        self.old = self.delivery("old", "owner/old", "a" * 40, "first")
        self.call("init", {"projects": [{"repo": "owner/old", "repositoryId": 1, "delivery": str(self.old), "studyUrl": "https://example.test/old/"}]})

    def tearDown(self):
        self.tmp.cleanup()

    def delivery(self, name, repo, revision, content):
        path = self.root / name
        path.mkdir()
        (path / "index.html").write_text(content)
        collection.write(path / "understanding.json", {"repo": repo, "revision": revision, "modelHash": content, "intro": {"title": name, "text": content}})
        return path

    def call(self, command, data, **kwargs):
        request = self.root / "input.json"
        collection.write(request, data)
        args = SimpleNamespace(catalog=str(self.catalog), source=str(request), **kwargs)
        return getattr(collection, command)(args)

    def plan(self, batch, candidates, top=50):
        return self.call("plan", {"basis": "fixture ordering", "source": "synthetic unit-test data", "observedAt": "2026-09-22T00:00:00Z", "candidates": candidates}, batch=batch, period="2026-09", top=top)

    def test_incremental_lifecycle_preserves_history_and_deduplicates(self):
        result = self.plan("first", [
            {"repo": "owner/renamed", "repositoryId": 1, "revision": "b" * 40},
            {"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40},
            {"repo": "owner/new", "repositoryId": 2, "revision": "c" * 40},
        ], top=2)
        self.assertEqual([e["action"] for e in result["selected"]], ["update", "new"])
        frozen = collection.read(self.catalog / "catalog.json")["projects"]["github:1"]["versions"][0]
        self.assertEqual((self.catalog / "site" / frozen["url"] / "index.html").read_text(), "first")
        (self.old / "index.html").write_text("source page changed after planning")
        updated = self.delivery("updated", "owner/renamed", "b" * 40, "second")
        self.call("record", {"repo": "owner/renamed", "repositoryId": 1, "revision": "b" * 40, "delivery": str(updated), "summary": "fixture update"}, batch="first")
        new = self.delivery("new", "owner/new", "c" * 40, "third")
        self.call("record", {"repo": "owner/new", "repositoryId": 2, "revision": "c" * 40, "delivery": str(new), "summary": "fixture new study"}, batch="first")
        state = collection.read(self.catalog / "catalog.json")
        self.assertEqual(len(state["projects"]), 2)
        self.assertEqual(len(state["projects"]["github:1"]["versions"]), 2)
        self.assertIn("owner/old", state["projects"]["github:1"]["aliases"])
        self.assertEqual((self.catalog / "site" / frozen["url"] / "index.html").read_text(), "first")
        next_batch = self.plan("next", [{"repo": "owner/renamed", "repositoryId": 1, "revision": "b" * 40}])
        self.assertEqual(next_batch["selected"][0]["action"], "reuse")
        self.assertIn("github:2", collection.read(self.catalog / "catalog.json")["projects"])
        collection.build(SimpleNamespace(catalog=str(self.catalog)))
        public = collection.read(self.catalog / "site/collection.json")
        self.assertNotIn("delivery", public["projects"]["github:1"]["versions"][0])

    def test_review_without_relabeling_old_evidence(self):
        self.plan("review", [{"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40}])
        result = self.call("record", {"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40, "summary": "fixture diff does not affect prior explanation", "reviewEvidence": ["https://example.test/diff"]}, batch="review")
        self.assertEqual(result["reviewedRevision"], "b" * 40)
        self.assertEqual(result["studyRevision"], "a" * 40)
        result = self.plan("following", [{"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40}])
        self.assertEqual(result["selected"][0]["action"], "reuse")

    def test_failed_record_does_not_replace_catalog(self):
        self.plan("bad", [{"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40}])
        before = (self.catalog / "catalog.json").read_bytes()
        with self.assertRaises(ValueError):
            self.call("record", {"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40, "delivery": str(self.old), "summary": "wrong version"}, batch="bad")
        self.assertEqual(before, (self.catalog / "catalog.json").read_bytes())
        with self.assertRaises(ValueError):
            self.plan("bad", [])

    def test_unknown_version_is_not_reused_and_duplicates_do_not_consume_n(self):
        result = self.plan("unknown", [{"repo": "owner/old", "repositoryId": 1}, {"repo": "owner/old"}, {"repo": "owner/new", "repositoryId": 2, "revision": "c" * 40}], top=2)
        self.assertEqual([e["action"] for e in result["selected"]], ["inspect", "new"])
        with self.assertRaises(ValueError):
            self.call("record", {"repo": "owner/new", "repositoryId": 2, "revision": "c" * 40, "summary": "cannot skip initial study", "reviewEvidence": ["https://example.test/diff"]}, batch="unknown")

    def test_observations_retain_corrections_and_do_not_fill_missing_values(self):
        first = {"metric": "stars", "label": "fixture star events", "period": "2026-09", "source": "fixture", "observedAt": "2026-10-01T08:00:00+08:00", "values": [{"repo": "owner/old", "repositoryId": 1, "value": 0}]}
        self.call("observe", first)
        self.call("observe", first)
        self.call("observe", {**first, "observedAt": "2026-10-02T00:00:00Z", "values": []})
        rows = collection.read(self.catalog / "catalog.json")["observations"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["observedAt"], "2026-10-01T00:00:00+00:00")
        self.assertEqual(rows[0]["values"], {"github:1": 0})
        self.assertEqual(rows[1]["values"], {})

    def test_rename_on_unchanged_revision_updates_name_without_duplicate(self):
        result = self.plan("rename", [{"repo": "owner/new-name", "repositoryId": 1, "revision": "a" * 40}])
        self.assertEqual(result["selected"][0]["action"], "reuse")
        projects = collection.read(self.catalog / "catalog.json")["projects"]
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects["github:1"]["repo"], "owner/new-name")
        self.assertIn("owner/old", projects["github:1"]["aliases"])

    def test_archived_reader_returns_to_collection_project(self):
        html = '<html><head><meta name="htw-home" content="../../"></head>first</html>'
        (self.old / "index.html").write_text(html)
        self.plan("links", [{"repo": "owner/old", "repositoryId": 1, "revision": "b" * 40}])
        version = collection.read(self.catalog / "catalog.json")["projects"]["github:1"]["versions"][0]
        archived = (self.catalog / "site" / version["url"] / "index.html").read_text()
        self.assertIn('../../../#project=github%3A1', archived)
        self.assertEqual(archived.count('name="htw-home"'), 1)
        self.assertEqual((self.old / "index.html").read_text(), html)


if __name__ == "__main__":
    unittest.main()
