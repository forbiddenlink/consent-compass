# Changelog

## [1.0.6](https://github.com/forbiddenlink/consent-compass/compare/v1.0.5...v1.0.6) (2026-09-06)


### Bug Fixes

* **security:** pin transitive dependencies off their open advisories ([#67](https://github.com/forbiddenlink/consent-compass/issues/67)) ([ddef0d1](https://github.com/forbiddenlink/consent-compass/commit/ddef0d1862f624f4a6210404e8e8e51cfd9dfba8))

## [1.0.5](https://github.com/forbiddenlink/consent-compass/compare/v1.0.4...v1.0.5) (2026-09-03)


### Bug Fixes

* renovate config drift ([ee8b35f](https://github.com/forbiddenlink/consent-compass/commit/ee8b35ff7e1613c26f1947c0abc5ee6544907d6a))

## [1.0.4](https://github.com/forbiddenlink/consent-compass/compare/v1.0.3...v1.0.4) (2026-09-02)


### Bug Fixes

* **ci:** let pnpm/action-setup read the version from packageManager ([6feb1f1](https://github.com/forbiddenlink/consent-compass/commit/6feb1f1375964d74b5fd5fe32b819cbf7734f2f8))

## [1.0.3](https://github.com/forbiddenlink/consent-compass/compare/v1.0.2...v1.0.3) (2026-08-29)


### Bug Fixes

* **deps:** move resolution overrides to package.json and add missing patches ([#57](https://github.com/forbiddenlink/consent-compass/issues/57)) ([783786a](https://github.com/forbiddenlink/consent-compass/commit/783786a0f34abe9ae3aadf6840b3dddd2f1a86de))

## [1.0.2](https://github.com/forbiddenlink/consent-compass/compare/v1.0.1...v1.0.2) (2026-08-29)


### Bug Fixes

* **deps:** bump next to 16.3.3 for AVIF image RCE ([#55](https://github.com/forbiddenlink/consent-compass/issues/55)) ([311bcdf](https://github.com/forbiddenlink/consent-compass/commit/311bcdf70fddcaa05c25e2ea1ae2b2d3b3640ab9))

## [1.0.1](https://github.com/forbiddenlink/consent-compass/compare/v1.0.0...v1.0.1) (2026-08-29)


### Bug Fixes

* harden workflow supply chain ([e6413ee](https://github.com/forbiddenlink/consent-compass/commit/e6413eeb9e54dba3c0ae35566bc47b2cc92a20f5))

## 1.0.0 (2026-08-16)


### Features

* taste-first ui redesign and branding updates ([c96714e](https://github.com/forbiddenlink/consent-compass/commit/c96714e5b846cc632c5d2922f8f8a6550d0d6139))


### Bug Fixes

* add maxDuration to TriggerConfig ([3c0b4ce](https://github.com/forbiddenlink/consent-compass/commit/3c0b4ce53efe2e567324a620d3ea1391aafaea72))
* add missing Sentry import and remove env.ts import in next.config ([fac76a7](https://github.com/forbiddenlink/consent-compass/commit/fac76a738ab27e02ddce3cbf45c37e11accd8cc2))
* add required maxDuration to TriggerConfig ([0d68ed4](https://github.com/forbiddenlink/consent-compass/commit/0d68ed4b462bc759230cb4a924b80c84b644e150))
* add resend dependency to resolve module not found error ([47dc6ab](https://github.com/forbiddenlink/consent-compass/commit/47dc6ab27d6820ce50d8dfddc30ddf93d34016c6))
* cap cookie override below v2 to prevent @supabase/ssr build break ([d743f40](https://github.com/forbiddenlink/consent-compass/commit/d743f40b4223c5d7fa36920fdb90fe3a16b27479))
* **deps:** add pnpm-workspace overrides for security patches ([145015d](https://github.com/forbiddenlink/consent-compass/commit/145015dedd572baa44e9c2cee57f96f6b54d48f8))
* **deps:** clear high CVEs via same-major overrides ([217b740](https://github.com/forbiddenlink/consent-compass/commit/217b740ad9544e596e1df2fdecdc6e13e6c4d6d3))
* env.ts import, sentry paths, MSW types, safe-action api ([1dd8ead](https://github.com/forbiddenlink/consent-compass/commit/1dd8ead651123404d23b9f0a9e46eeff3f25866b))
* **lint:** downgrade eslint to ^9 to fix eslint-plugin-react v7 incompatibility ([#40](https://github.com/forbiddenlink/consent-compass/issues/40)) ([ad7f2ba](https://github.com/forbiddenlink/consent-compass/commit/ad7f2bad5b61bdbf98d863bb0c56452a046d9bf8))
* patch 7 security vulnerabilities ([63eb7e9](https://github.com/forbiddenlink/consent-compass/commit/63eb7e960b702f83bc26a25135897e169b65e44f))
* pin protobufjs to ^7.6.1 (CVSS 9.8 arbitrary code execution) ([#19](https://github.com/forbiddenlink/consent-compass/issues/19)) ([3168752](https://github.com/forbiddenlink/consent-compass/commit/31687526b7277b678b82fe5c0b209471d30c04e2))
* remove duplicate Sentry replay initialization ([fb8120b](https://github.com/forbiddenlink/consent-compass/commit/fb8120bc79d31905ec0b975a9960962bfdbd0880))
* remove invalid pnpm-workspace.yaml causing CI failures ([2e26a10](https://github.com/forbiddenlink/consent-compass/commit/2e26a10c606b55dcd93fe2c0c413cb033123af9d))
* remove unavailable socketsecurity/socket-action from security workflow ([9f2f2ee](https://github.com/forbiddenlink/consent-compass/commit/9f2f2ee12d3dd1b6e9e50e49bd8a3524ec2f2551))
* **security:** pin transitive deps to patched versions (Dependabot high alerts) ([361a02c](https://github.com/forbiddenlink/consent-compass/commit/361a02c91b2d582cfd5733f88f80b6cf5d6b300a))
* sentry instrumentation path and template artifacts ([aabe86d](https://github.com/forbiddenlink/consent-compass/commit/aabe86de0477f816ccbb5268a49de9729622688b))
* suppress eslint no-explicit-any for browser global ([1bf4df0](https://github.com/forbiddenlink/consent-compass/commit/1bf4df005edab2138fd542b0d66fc979b0dbb24b))
