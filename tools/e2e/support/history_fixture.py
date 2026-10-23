"""Legacy-browser tests need a real historical tree, absent from source ZIPs."""
import subprocess


def require_git_ref(root, ref):
    try:
        result = subprocess.run(
            ["git", "cat-file", "-e", ref + "^{tree}"],
            cwd=root, capture_output=True,
        )
    except FileNotFoundError:
        result = None
    if result is None or result.returncode:
        print(f"SKIP: Bu test git geçmişindeki {ref} ağacını gerektirir; kaynak ZIP'inde bulunmaz.", flush=True)
        raise SystemExit(77)
