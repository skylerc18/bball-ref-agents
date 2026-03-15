#!/bin/sh
set -eu

if [ -f package-lock.json ]; then
  npm ci
elif [ -f npm-shrinkwrap.json ]; then
  npm ci
elif [ -f pnpm-lock.yaml ]; then
  yarn global add pnpm
  pnpm i
else
  npm i
fi
