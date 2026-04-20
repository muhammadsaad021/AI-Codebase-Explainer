# backend/chunker.py


def chunk_code(text, file_path="unknown", language="unknown", chunk_size=200):
    """
    Split source code into chunks of `chunk_size` lines.
    Each chunk carries metadata: file path, language, line range.

    Returns a list of dicts:
    [{ 'code': str, 'file_path': str, 'language': str, 'start_line': int, 'end_line': int }]
    """
    lines = text.split("\n")
    chunks = []

    for i in range(0, len(lines), chunk_size):
        chunk_lines = lines[i:i + chunk_size]
        chunks.append({
            "code": "\n".join(chunk_lines),
            "file_path": file_path,
            "language": language,
            "start_line": i + 1,
            "end_line": min(i + chunk_size, len(lines)),
        })

    return chunks