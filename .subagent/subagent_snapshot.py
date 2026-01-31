#!/usr/bin/env python3
"""Capture git diff snapshots for subagent reporting.
Use this rather than shell redirection to avoid manual approval prompts.

Usage examples:
    python .subagent/subagent_snapshot.py --subagent implementation --phase pre
    python .subagent/subagent_snapshot.py --subagent implementation --phase post
    python .subagent/subagent_snapshot.py --subagent implementation --clean
"""

from __future__ import annotations

import argparse
import locale
import subprocess
from pathlib import Path
from typing import Iterable


def decode_bytes(data: bytes | None) -> str:
    """Decode bytes to text using UTF-8 with a locale fallback."""
    if not data:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        encoding = locale.getpreferredencoding(False) or "utf-8"
        return data.decode(encoding, errors="replace")


def run_git(args: Iterable[str], cwd: Path, timeout: int = 300) -> str:
    """Run a git command and return cleaned stdout."""
    cmd = ["git", *args]
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Git command timed out after {timeout}s: {' '.join(cmd)}"
        ) from exc
    stdout = decode_bytes(result.stdout)
    stderr = decode_bytes(result.stderr)
    if result.returncode != 0:
        raise subprocess.CalledProcessError(
            result.returncode,
            result.args,
            output=stdout,
            stderr=stderr,
        )
    return stdout.strip()


def resolve_repo_root(repo_root: str | None) -> Path:
    """Resolve the repository root, defaulting to the current git repo."""
    if repo_root:
        path = Path(repo_root).resolve()
        if not path.is_dir():
            raise RuntimeError(f"Provided repo root does not exist: {path}")
        # Validate it's actually a git repository
        try:
            run_git(["rev-parse", "--git-dir"], path)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                f"Provided path is not a git repository: {path}"
            ) from exc
        return path
    try:
        root = run_git(["rev-parse", "--show-toplevel"], Path.cwd())
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            "Could not resolve repo root. Are you inside a git repository?"
        ) from exc
    return Path(root).resolve()


def write_text(path: Path, content: str) -> None:
    """Write text to disk, ensuring a trailing newline when needed."""
    path.write_text(
        content + ("\n" if content and not content.endswith("\n") else ""),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for snapshot capture."""
    parser = argparse.ArgumentParser(
        description="Capture or clean pre/post git diff snapshots."
    )
    parser.add_argument(
        "--subagent", choices=["implementation", "janitor"], required=True
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--phase", choices=["pre", "post"])
    mode.add_argument(
        "--clean",
        action="store_true",
        help="Delete pre/post snapshot files for the selected subagent.",
    )
    parser.add_argument(
        "--repo-root",
        default="",
        help="Path to git repository root (auto-detected if not provided).",
    )
    parser.add_argument(
        "--output-dir",
        default=".subagent",
        help="Directory for snapshot files, relative to repo root.",
    )
    return parser.parse_args()


def main() -> None:
    """Run snapshot capture."""
    args = parse_args()
    repo_root = resolve_repo_root(args.repo_root or None)
    output_dir = (repo_root / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.clean:
        deleted = 0
        for phase in ("pre", "post"):
            name_path = output_dir / f"{phase}_files_{args.subagent}.txt"
            patch_path = output_dir / f"{phase}_{args.subagent}.patch"
            if name_path.exists():
                name_path.unlink()
                deleted += 1
            if patch_path.exists():
                patch_path.unlink()
                deleted += 1
        print(f"Deleted {deleted} snapshot file(s) in {output_dir}")
        return

    name_output = run_git(["diff", "--name-only"], repo_root)
    patch_output = run_git(["diff"], repo_root)

    name_path = output_dir / f"{args.phase}_files_{args.subagent}.txt"
    patch_path = output_dir / f"{args.phase}_{args.subagent}.patch"

    write_text(name_path, name_output)
    write_text(patch_path, patch_output)

    print(f"Saved: {name_path}")
    print(f"Saved: {patch_path}")


if __name__ == "__main__":
    main()
