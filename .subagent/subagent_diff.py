#!/usr/bin/env python3
"""Compute a concise delta between pre/post subagent patch snapshots.

Usage examples:
    python .subagent/subagent_diff.py --subagent implementation
    python .subagent/subagent_diff.py --subagent janitor

Outputs (written to .subagent/ by default):
    - delta_files_*.txt
    - delta_stat_*.txt
    - delta_*.patch (most useful)
"""

from __future__ import annotations

import argparse
import locale
import os
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable, NamedTuple

WORK_BASE_MARKER_NAME = ".subagent_work_base_marker"


def decode_bytes(data: bytes | None) -> str:
    """Decode bytes to text using UTF-8 with a locale fallback."""
    if not data:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        encoding = locale.getpreferredencoding(False) or "utf-8"
        return data.decode(encoding, errors="replace")


def run_git(
    args: Iterable[str],
    cwd: Path,
    allow_exit_codes: tuple[int, ...] = (0,),
    timeout: int = 300,
) -> str:
    """Run a git command and return cleaned stdout."""
    cmd = ["git", *args]
    allowed = frozenset(allow_exit_codes)
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
    if result.returncode not in allowed:
        raise subprocess.CalledProcessError(
            result.returncode,
            result.args,
            output=stdout,
            stderr=stderr,
        )
    return stdout.strip()


def normalize_path_value(path: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize a path token by stripping worktree prefixes."""
    value = path.strip().strip('"').replace("\\", "/")
    prefixes = {
        pre_dir.as_posix(),
        post_dir.as_posix(),
    }
    for prefix in prefixes:
        if value.startswith(prefix + "/"):
            value = value[len(prefix) + 1 :]
        elif value == prefix:
            value = ""
    if value.startswith("pre/"):
        value = value[4:]
    elif value.startswith("post/"):
        value = value[5:]
    return value


def is_excluded_path(path: str) -> bool:
    """Return True for paths that should be excluded from diffs."""
    if not path:
        return True
    cleaned = path.strip().strip('"').replace("\\", "/")
    if cleaned.startswith("./"):
        cleaned = cleaned[2:]
    if cleaned.startswith("a/") or cleaned.startswith("b/"):
        cleaned = cleaned[2:]
    return cleaned == ".git" or cleaned.startswith(".git/")


def extract_normalized_path(token: str, pre_dir: Path, post_dir: Path) -> str:
    """Extract and normalize a diff path token."""
    text = token.strip()
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1]
    if text.startswith("a/") or text.startswith("b/"):
        text = text[2:]
    return normalize_path_value(text, pre_dir, post_dir)


def normalize_diff_token(token: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize a diff token while preserving diff prefixes."""
    text = token.strip()
    quoted = text.startswith('"') and text.endswith('"')
    if quoted:
        text = text[1:-1]
    prefix = ""
    for diff_prefix in ("a/", "b/"):
        if text.startswith(diff_prefix):
            prefix = diff_prefix
            text = text[len(diff_prefix) :]
            break
    text = normalize_path_value(text, pre_dir, post_dir)
    normalized = f"{prefix}{text}" if text else prefix.rstrip("/")
    return f'"{normalized}"' if quoted else normalized


def normalize_name_output(raw: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize name-only diff output into project-relative paths."""
    lines = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        normalized = normalize_path_value(line, pre_dir, post_dir)
        if normalized and not is_excluded_path(normalized):
            lines.append(normalized)
    return "\n".join(lines)


def normalize_stat_output(raw: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize diff stat output and filter excluded paths."""
    lines = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        if "|" in line:
            path_part, rest = line.split("|", 1)
            path_clean = normalize_path_value(path_part, pre_dir, post_dir)
            if not path_clean or is_excluded_path(path_clean):
                continue
            rest_clean = rest.strip()
            lines.append(f"{path_clean} | {rest_clean}")
        else:
            lines.append(line.lstrip())
    return "\n".join(lines)


def normalize_patch_metadata_line(line: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize diff metadata lines to stable, relative paths."""
    if line.startswith("--- ") or line.startswith("+++ "):
        prefix = line[:4]
        path_token = line[4:]
        if path_token.strip() == "/dev/null":
            return line
        normalized = normalize_diff_token(path_token, pre_dir, post_dir)
        return f"{prefix}{normalized}"
    if line.startswith("rename from "):
        path_token = line[len("rename from ") :]
        normalized = normalize_diff_token(path_token, pre_dir, post_dir)
        return f"rename from {normalized}"
    if line.startswith("rename to "):
        path_token = line[len("rename to ") :]
        normalized = normalize_diff_token(path_token, pre_dir, post_dir)
        return f"rename to {normalized}"
    return line


def handle_diff_header(
    line: str, pre_dir: Path, post_dir: Path
) -> tuple[bool, str | None]:
    """Return whether to skip a diff block and the normalized header."""
    prefix = "diff --git "
    if not line.startswith(prefix):
        return False, line
    remainder = line[len(prefix) :].strip()
    if not remainder:
        return False, line
    try:
        tokens = shlex.split(remainder)
    except ValueError:
        return False, line
    if len(tokens) != 2:
        return False, line

    def quote_if_needed(value: str) -> str:
        if any(ch.isspace() for ch in value):
            escaped = value.replace("\\", "\\\\").replace('"', '\\"')
            return f'"{escaped}"'
        return value

    left_token = quote_if_needed(tokens[0])
    right_token = quote_if_needed(tokens[1])
    left_path = extract_normalized_path(left_token, pre_dir, post_dir)
    right_path = extract_normalized_path(right_token, pre_dir, post_dir)
    if is_excluded_path(left_path) or is_excluded_path(right_path):
        return True, None
    left = normalize_diff_token(left_token, pre_dir, post_dir)
    right = normalize_diff_token(right_token, pre_dir, post_dir)
    return False, f"diff --git {left} {right}"


def normalize_patch_output(raw: str, pre_dir: Path, post_dir: Path) -> str:
    """Normalize a full patch output while dropping excluded blocks."""
    lines: list[str] = []
    skip_block = False
    for line in raw.splitlines():
        if line.startswith("diff --git "):
            skip_block, normalized = handle_diff_header(line, pre_dir, post_dir)
            if normalized:
                lines.append(normalized)
            continue
        if skip_block:
            continue
        lines.append(normalize_patch_metadata_line(line, pre_dir, post_dir))
    return "\n".join(lines)


def ensure_repo_root(repo_root: Path | None) -> Path:
    """Resolve the repository root, defaulting to the current git repo."""
    if repo_root:
        return repo_root.resolve()

    root = run_git(["rev-parse", "--show-toplevel"], Path.cwd())
    if not root:
        raise RuntimeError("Could not resolve repo root.")
    return Path(root).resolve()


def write_text(path: Path, content: str) -> None:
    """Write text to disk, ensuring a trailing newline when needed."""
    path.write_text(
        content + ("\n" if content and not content.endswith("\n") else ""),
        encoding="utf-8",
    )


def apply_patch(repo_root: Path, worktree_dir: Path, patch_path: Path) -> None:
    """Apply a patch within a detached worktree."""
    run_git(
        [
            "worktree",
            "add",
            "--detach",
            str(worktree_dir),
            "HEAD",
        ],
        repo_root,
    )
    try:
        run_git(
            ["-C", str(worktree_dir), "apply", "--whitespace=nowarn", str(patch_path)],
            repo_root,
        )
    except subprocess.CalledProcessError as exc:
        # Clean up the worktree before raising
        try:
            run_git(
                ["worktree", "remove", "-f", str(worktree_dir)],
                repo_root,
            )
        except subprocess.CalledProcessError:
            pass  # Best effort cleanup
        raise RuntimeError(
            f"Failed to apply patch: {patch_path}\nstderr: {exc.stderr}"
        ) from exc


def remove_worktree(repo_root: Path, worktree_dir: Path) -> None:
    """Remove a git worktree if it exists."""
    if worktree_dir.exists():
        run_git(
            ["worktree", "remove", "-f", str(worktree_dir)],
            repo_root,
            allow_exit_codes=(0, 128),
        )


class Paths(NamedTuple):
    """Bundle file system paths used by the delta workflow."""

    output_dir: Path
    pre_patch: Path
    post_patch: Path
    work_base: Path
    work_base_parent: Path
    work_marker: Path
    pre_dir: Path
    post_dir: Path
    delta_file: Path
    stat_file: Path
    name_file: Path


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for the delta script."""
    parser = argparse.ArgumentParser(
        description="Summarize pre/post subagent patch deltas."
    )
    parser.add_argument(
        "--subagent", choices=["implementation", "janitor"], default="implementation"
    )
    parser.add_argument("--repo-root", default="")
    parser.add_argument("--output-dir", default=".subagent")
    parser.add_argument(
        "--work-base",
        default="",
        help=(
            "Base directory for temporary worktrees. Defaults to a temp folder "
            "outside the repo to avoid editor file watcher exhaustion."
        ),
    )
    parser.add_argument("--pre-patch", default="")
    parser.add_argument("--post-patch", default="")
    parser.add_argument("--keep-worktrees", action="store_true")
    return parser.parse_args()


def build_paths(args: argparse.Namespace, repo_root: Path) -> Paths:
    """Construct the path bundle for a given subagent run."""
    output_dir = (repo_root / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    pre_patch = (
        Path(args.pre_patch).resolve()
        if args.pre_patch
        else output_dir / f"pre_{args.subagent}.patch"
    )
    post_patch = (
        Path(args.post_patch).resolve()
        if args.post_patch
        else output_dir / f"post_{args.subagent}.patch"
    )

    if args.work_base:
        work_base = Path(args.work_base)
        if not work_base.is_absolute():
            work_base = (repo_root / work_base).resolve()
        else:
            work_base = work_base.resolve()
    else:
        temp_root = Path(tempfile.gettempdir())
        work_base = (
            temp_root / f"subagent_{repo_root.name}_{args.subagent}_{os.getpid()}"
        ).resolve()
    pre_dir = work_base / "pre"
    post_dir = work_base / "post"
    work_base_parent = (
        work_base.parent.resolve()
        if args.work_base
        else Path(tempfile.gettempdir()).resolve()
    )
    work_marker = work_base / WORK_BASE_MARKER_NAME

    delta_file = output_dir / f"delta_{args.subagent}.patch"
    stat_file = output_dir / f"delta_stat_{args.subagent}.txt"
    name_file = output_dir / f"delta_files_{args.subagent}.txt"

    return Paths(
        output_dir=output_dir,
        pre_patch=pre_patch,
        post_patch=post_patch,
        work_base=work_base,
        work_base_parent=work_base_parent,
        work_marker=work_marker,
        pre_dir=pre_dir,
        post_dir=post_dir,
        delta_file=delta_file,
        stat_file=stat_file,
        name_file=name_file,
    )


def ensure_patches_exist(paths: Paths) -> None:
    """Validate that both pre and post patch files exist."""
    if not paths.pre_patch.exists():
        raise FileNotFoundError(f"Missing pre patch: {paths.pre_patch}")
    if not paths.post_patch.exists():
        raise FileNotFoundError(f"Missing post patch: {paths.post_patch}")


def is_relative_to(path: Path, parent: Path) -> bool:
    """Return True when path is within parent."""
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def is_top_level_path(path: Path) -> bool:
    """Return True when path resolves to a filesystem root."""
    resolved = path.resolve()
    return resolved.parent == resolved


def is_safe_work_base_target(paths: Paths, repo_root: Path) -> bool:
    """Validate that work_base is safe to delete."""
    work_base = paths.work_base.resolve()
    if not work_base.exists() or not work_base.is_dir():
        return False
    if is_top_level_path(work_base):
        return False

    repo_root_resolved = repo_root.resolve()
    expected_parent = paths.work_base_parent.resolve()
    if not (
        is_relative_to(work_base, repo_root_resolved)
        or is_relative_to(work_base, expected_parent)
    ):
        return False
    if work_base in (repo_root_resolved, expected_parent):
        return False

    marker_exists = paths.work_marker.exists()
    expected_name = "subagent_" in work_base.name
    return marker_exists or expected_name


def is_safe_worktree_dir(worktree_dir: Path, paths: Paths, repo_root: Path) -> bool:
    """Validate that worktree_dir is within the safe work_base boundary."""
    if not is_safe_work_base_target(paths, repo_root):
        return False
    worktree_resolved = worktree_dir.resolve()
    work_base = paths.work_base.resolve()
    if is_top_level_path(worktree_resolved) or worktree_resolved == work_base:
        return False
    return is_relative_to(worktree_resolved, work_base)


def prepare_work_base(paths: Paths, repo_root: Path) -> None:
    """Create a clean worktree base directory with a marker file."""
    if paths.work_base.exists():
        if not is_safe_work_base_target(paths, repo_root):
            raise RuntimeError(
                "Refusing to delete unsafe work_base: "
                f"{paths.work_base} (marker missing or outside expected parent)."
            )
        shutil.rmtree(paths.work_base)
    paths.work_base.mkdir(parents=True, exist_ok=True)
    write_text(paths.work_marker, "created-by=subagent_diff.py")


def generate_outputs(paths: Paths) -> int:
    """Generate normalized delta outputs and return file count."""
    diff_exit_codes = (0, 1)
    pre_rel = paths.pre_dir.relative_to(paths.work_base)
    post_rel = paths.post_dir.relative_to(paths.work_base)
    names = run_git(
        [
            "diff",
            "--no-index",
            "--name-only",
            str(pre_rel),
            str(post_rel),
        ],
        paths.work_base,
        allow_exit_codes=diff_exit_codes,
    )
    stat = run_git(
        [
            "diff",
            "--no-index",
            "--stat",
            "--stat-name-width=200",
            str(pre_rel),
            str(post_rel),
        ],
        paths.work_base,
        allow_exit_codes=diff_exit_codes,
    )

    normalized_names = normalize_name_output(names, paths.pre_dir, paths.post_dir)
    write_text(paths.name_file, normalized_names)
    write_text(
        paths.stat_file, normalize_stat_output(stat, paths.pre_dir, paths.post_dir)
    )

    delta = run_git(
        [
            "diff",
            "--no-index",
            str(pre_rel),
            str(post_rel),
        ],
        paths.work_base,
        allow_exit_codes=diff_exit_codes,
    )
    write_text(
        paths.delta_file,
        normalize_patch_output(delta, paths.pre_dir, paths.post_dir),
    )

    return len(normalized_names.splitlines()) if normalized_names else 0


def print_summary(subagent: str, files_changed: int, paths: Paths) -> None:
    """Print a human-friendly summary of generated files."""
    print(f"Subagent: {subagent}")
    print(f"Files changed: {files_changed}")
    print(f"Saved: {paths.name_file}")
    print(f"Saved: {paths.stat_file}")
    print(f"Saved: {paths.delta_file}")


def cleanup(repo_root: Path, paths: Paths, keep_worktrees: bool) -> None:
    """Clean up temporary worktrees and directories."""
    if keep_worktrees:
        return

    for worktree in (paths.pre_dir, paths.post_dir):
        if not is_safe_worktree_dir(worktree, paths, repo_root):
            continue
        try:
            remove_worktree(repo_root, worktree)
        except Exception:  # pylint: disable=broad-except
            pass  # Best effort cleanup
    try:
        if is_safe_work_base_target(paths, repo_root):
            shutil.rmtree(paths.work_base)
    except Exception:  # pylint: disable=broad-except
        pass  # Best effort cleanup


def main() -> int:
    """Run the delta generation workflow."""
    args = parse_args()
    repo_root = ensure_repo_root(Path(args.repo_root) if args.repo_root else None)
    paths = build_paths(args, repo_root)

    ensure_patches_exist(paths)
    prepare_work_base(paths, repo_root)

    try:
        apply_patch(repo_root, paths.pre_dir, paths.pre_patch)
        apply_patch(repo_root, paths.post_dir, paths.post_patch)
        files_changed = generate_outputs(paths)
        print_summary(args.subagent, files_changed, paths)
    finally:
        cleanup(repo_root, paths, args.keep_worktrees)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
