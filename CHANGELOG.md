# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-24

### Added

- Dual CommonJS export via tsup (`require()` → `dist/index.cjs`)

### Fixed

- Query logs record `[n params]` instead of raw parameter values
- Constructor throws if no connection string, pool config, `DATABASE_URL`, or injected pool is provided

## [1.0.2] - 2026-07-16

### Changed

- Improved npm keywords for better discoverability

## [1.0.1] - 2026-07-16

### Changed

- Version bump for npm registry publish

## [1.0.0] - 2026-07-15

### Added
- Initial production release / packaging standards (types, exports, changelog)
