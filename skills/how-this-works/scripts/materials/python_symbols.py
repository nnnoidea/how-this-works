#!/usr/bin/env python3
"""Parse supplied immutable UTF-8 material files; never import repository code."""
import ast
import json
import sys


def extract(text, filename):
    anchors = []
    imports = []
    try:
        tree = ast.parse(text, filename=filename)
    except (SyntaxError, ValueError, RecursionError) as error:
        return {"parser": "python-ast", "anchors": [], "imports": [],
                "diagnostics": [{"line": getattr(error, "lineno", 1), "message": getattr(error, "msg", str(error))}]}

    def walk(node, scope="", local=False):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            qualified = ".".join(filter(None, [scope, node.name]))
            start = min([node.lineno] + [d.lineno for d in node.decorator_list])
            anchors.append({"kind": type(node).__name__, "name": node.name,
                            "qualified": qualified, "start": start, "end": node.end_lineno})
            for child in node.body:
                walk(child, qualified, not isinstance(node, ast.ClassDef))
            return
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            imports.append({"module": getattr(node, "module", None),
                            "level": getattr(node, "level", 0),
                            "names": [{"name": a.name, "alias": a.asname} for a in node.names],
                            "start": node.lineno, "end": node.end_lineno,
                            "resolution": "unresolved-syntax"})
        if not local and isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                for name in ast.walk(target):
                    if isinstance(name, ast.Name) and isinstance(name.ctx, ast.Store):
                        anchors.append({"kind": "Assignment", "name": name.id,
                                        "qualified": ".".join(filter(None, [scope, name.id])),
                                        "start": node.lineno, "end": node.end_lineno})
        for child in ast.iter_child_nodes(node):
            walk(child, scope, local)

    walk(tree)
    return {"parser": "python-ast", "anchors": anchors, "imports": imports, "diagnostics": []}


if __name__ == "__main__":
    requests = json.load(sys.stdin)
    results = {}
    for item in requests:
        with open(item["raw"], encoding="utf-8") as source:
            results[item["key"]] = extract(source.read(), item["path"])
    json.dump(results, sys.stdout, ensure_ascii=False)
