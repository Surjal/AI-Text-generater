from __future__ import annotations

from pathlib import Path
from urllib.request import urlretrieve

# Add your real model URLs here when needed.
# Keys are local file paths relative to backend/.
MODEL_ASSETS: dict[str, str] = {
    # "models/example-model.bin": "https://your-storage.example.com/path/model.bin",
}


def download_asset(relative_path: str, url: str, backend_root: Path) -> None:
    target = backend_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() and target.stat().st_size > 0:
        print(f"[skip] {relative_path} already exists")
        return

    print(f"[download] {relative_path}")
    urlretrieve(url, target)
    print(f"[ok] saved to {target}")


def main() -> None:
    backend_root = Path(__file__).resolve().parents[1]

    if not MODEL_ASSETS:
        print("No model assets configured.")
        print("Edit MODEL_ASSETS in scripts/download_models.py and add your URLs.")
        return

    for relative_path, url in MODEL_ASSETS.items():
        try:
            download_asset(relative_path, url, backend_root)
        except Exception as exc:
            print(f"[error] {relative_path}: {exc}")


if __name__ == "__main__":
    main()
