#!/usr/bin/env python3
"""Fetch the pinned browser compiler without committing large generated assets."""
import argparse
import hashlib
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.request import urlopen

URL = "https://github.com/TeXlyre/texlyre-busytex/releases/download/assets-v1.4.0/busytex-assets.tar.gz"
SHA256 = "1caa434fb5aab5bdd59dc303bca2ac7b9b9af02ef1627bf8652caabfa1b7cd2b"
FILES = (
    "busytex.js", "busytex.wasm", "busytex_worker.js", "busytex_pipeline.js",
    "busytex_biber.js", "texlive-basic.js", "texlive-basic.data", "texmf.cnf",
    "biber.js", "biber.wasm", "biber.data", "versions.txt",
)


def prepare(archive, output):
    with archive.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != SHA256:
        raise ValueError("Compiler archive checksum mismatch; refusing to publish it.")
    output.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as bundle:
        for name in FILES:
            member = bundle.getmember(f"busytex/{name}")
            if not member.isfile():
                raise ValueError(f"Expected a regular runtime file: {name}")
            with bundle.extractfile(member) as source, (output / name).open("wb") as target:
                shutil.copyfileobj(source, target)
    print(f"Prepared {len(FILES)} verified compiler assets in {output}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Use a previously downloaded release archive")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "runtime")
    args = parser.parse_args()
    if args.archive:
        prepare(args.archive, args.output)
        return
    with tempfile.TemporaryDirectory(prefix="minnesota-compiler-") as directory:
        archive = Path(directory) / "busytex-assets.tar.gz"
        print("Downloading pinned TeXlyre BusyTeX v1.4.0 assets…", flush=True)
        with urlopen(URL, timeout=120) as response, archive.open("wb") as target:
            shutil.copyfileobj(response, target)
        prepare(archive, args.output)


if __name__ == "__main__":
    main()
