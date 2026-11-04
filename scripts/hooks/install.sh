#!/bin/sh
set -e
git config core.hooksPath .githooks
echo "Git hooks enabled: .githooks/pre-push"
