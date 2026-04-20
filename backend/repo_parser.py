# backend/repo_parser.py
from git import Repo
import os

# Supported source code extensions
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".cpp", ".c", ".h", ".hpp",
    ".java", ".go", ".rs", ".rb",
    ".cs", ".swift", ".kt",
}

EXTENSION_LANGUAGE_MAP = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".jsx": "javascript", ".tsx": "typescript",
    ".cpp": "cpp", ".c": "c", ".h": "c", ".hpp": "cpp",
    ".java": "java", ".go": "go", ".rs": "rust", ".rb": "ruby",
    ".cs": "csharp", ".swift": "swift", ".kt": "kotlin",
}


def clone_repo(repo_url):
    """Clone a GitHub repository, or force-update if already cloned."""
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    path = f"repos/{repo_name}"

    if os.path.exists(path):
        # Force pull latest changes instead of serving stale cache
        import shutil
        shutil.rmtree(path)

    Repo.clone_from(repo_url, path)
    return path


def get_code_files(repo_path):
    """
    Walk the repo and return a list of dicts with file metadata:
    [{ 'path': absolute_path, 'relative_path': rel_path, 'language': lang }]
    """
    code_files = []

    for root, dirs, files in os.walk(repo_path):
        # Skip hidden directories and common non-source dirs
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
            'node_modules', 'venv', '__pycache__', '.git', 'dist', 'build'
        )]

        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, repo_path)
                language = EXTENSION_LANGUAGE_MAP.get(ext, "unknown")
                code_files.append({
                    "path": full_path,
                    "relative_path": rel_path.replace("\\", "/"),
                    "language": language,
                })

    return code_files