#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REF_DIR="$SCRIPT_DIR/references"

rm -rf "$REF_DIR"
mkdir -p "$REF_DIR"

git clone git@github.com:tscircuit/jscad-electronics "$REF_DIR/jscad-electronics"
git clone git@github.com:tscircuit/jscad-fiber "$REF_DIR/jscad-fiber"
git clone git@github.com:tscircuit/jscad-planner "$REF_DIR/jscad-planner"
git clone git@github.com:tscircuit/jscad-to-gltf "$REF_DIR/jscad-to-gltf"
