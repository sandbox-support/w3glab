#!/bin/bash

git config user.name "Jan Cibulka"
git config user.email "jc@pntr.eu"

git remote remove origin 2>/dev/null || true
git remote add origin git@github.com:sandbox-support/w3glab.git

GIT_AUTHOR_DATE="2026-04-17T14:33:25-04:00" \
GIT_COMMITTER_DATE="2026-04-17T14:33:30-04:00" \
git commit -m "init"

git push -f origin master