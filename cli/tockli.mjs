#!/usr/bin/env node

import { runCli } from "./tockli-cli.mjs";

process.exitCode = await runCli();
