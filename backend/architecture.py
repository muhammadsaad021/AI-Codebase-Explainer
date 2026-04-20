# backend/architecture.py
"""
Analyze import/dependency relationships across a codebase
and build a directed graph using NetworkX.
"""
import os
import re
import networkx as nx


# ----- Language-specific import parsers -----

def _parse_python_imports(code, file_rel_path):
    """Extract Python import targets."""
    imports = []
    for line in code.split("\n"):
        line = line.strip()
        # from foo.bar import baz
        m = re.match(r"^from\s+([\w.]+)\s+import", line)
        if m:
            imports.append(m.group(1))
            continue
        # import foo, bar
        m = re.match(r"^import\s+([\w., ]+)", line)
        if m:
            for mod in m.group(1).split(","):
                imports.append(mod.strip().split(" as ")[0].strip())
    return imports


def _parse_js_ts_imports(code, file_rel_path):
    """Extract JS/TS import targets."""
    imports = []
    for m in re.finditer(r"""(?:import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))""", code):
        target = m.group(1) or m.group(2)
        imports.append(target)
    return imports


def _parse_c_cpp_includes(code, file_rel_path):
    """Extract C/C++ #include targets."""
    imports = []
    for m in re.finditer(r'#include\s*[<"](.+?)[>"]', code):
        imports.append(m.group(1))
    return imports


def _parse_java_imports(code, file_rel_path):
    """Extract Java import targets."""
    imports = []
    for m in re.finditer(r"^import\s+([\w.]+);", code, re.MULTILINE):
        imports.append(m.group(1))
    return imports


def _parse_go_imports(code, file_rel_path):
    """Extract Go import targets."""
    imports = []
    for m in re.finditer(r'"([\w./]+)"', code):
        imports.append(m.group(1))
    return imports


PARSERS = {
    "python": _parse_python_imports,
    "javascript": _parse_js_ts_imports,
    "typescript": _parse_js_ts_imports,
    "c": _parse_c_cpp_includes,
    "cpp": _parse_c_cpp_includes,
    "java": _parse_java_imports,
    "go": _parse_go_imports,
}


# ----- Graph builder -----

def build_architecture_graph(repo_path, code_files):
    """
    Build a directed dependency graph from a list of code file dicts
    (as returned by repo_parser.get_code_files).

    Returns a dict: { "nodes": [...], "edges": [...] }
    """
    G = nx.DiGraph()

    # Add all files as nodes
    for f in code_files:
        rel = f["relative_path"]
        G.add_node(rel, language=f["language"])

    # Build a lookup set of known relative paths (without extension too)
    known_paths = {f["relative_path"] for f in code_files}
    # Also map basenames / module names -> relative paths for fuzzy matching
    name_to_path = {}
    for f in code_files:
        rel = f["relative_path"]
        basename = os.path.splitext(os.path.basename(rel))[0]
        name_to_path.setdefault(basename, []).append(rel)
        # Also register dotted module path for Python (e.g., "backend.chunker")
        mod_path = rel.replace("/", ".").replace("\\", ".")
        mod_path = os.path.splitext(mod_path)[0]
        name_to_path.setdefault(mod_path, []).append(rel)

    # Parse each file and add edges
    for f in code_files:
        rel = f["relative_path"]
        lang = f["language"]
        parser = PARSERS.get(lang)
        if parser is None:
            continue

        try:
            with open(f["path"], "r", encoding="utf-8", errors="ignore") as fh:
                code = fh.read()
        except Exception:
            continue

        imports = parser(code, rel)

        for imp in imports:
            # Try exact match first
            target = None
            # Normalize the import for matching
            imp_normalized = imp.replace(".", "/").replace("\\", "/")

            # Check if any known file matches
            for known in known_paths:
                known_no_ext = os.path.splitext(known)[0]
                if known_no_ext == imp_normalized or known == imp_normalized:
                    target = known
                    break

            # Fuzzy: check basename / module name
            if target is None:
                imp_base = imp.split(".")[-1]
                candidates = name_to_path.get(imp_base, []) or name_to_path.get(imp, [])
                if candidates:
                    target = candidates[0]

            if target and target != rel:
                G.add_edge(rel, target)

    # Serialize
    nodes = []
    for node in G.nodes(data=True):
        nodes.append({
            "id": node[0],
            "label": os.path.basename(node[0]),
            "language": node[1].get("language", "unknown"),
        })

    edges = []
    for src, dst in G.edges():
        edges.append({"source": src, "target": dst})

    return {"nodes": nodes, "edges": edges}
