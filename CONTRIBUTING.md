# Contributing to Stream Deck Launcher

Thank you for considering contributing! This project is built with Node.js and Electron. The following guide explains how to set up your environment, follow our coding standards, and submit pull requests.

## Development Setup

1. **Use Node.js 18** – The required version is listed in `.nvmrc`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests and lint checks before committing:
   ```bash
   npm test
   npm run lint
   ```

## Coding Standards

* The codebase uses the [ESLint](https://eslint.org/) recommended rules. Run `npm run lint` to check your code.
* Include tests when adding new functionality.
* Keep commit messages concise and descriptive.

## Submitting Pull Requests

1. Fork the repository and create a new branch for your change.
2. Ensure `npm test` and `npm run lint` pass.
3. Open a pull request on GitHub targeting the `main` branch and describe your changes.
4. A project maintainer will review your PR. Please respond to feedback and update your branch if requested.

We appreciate your contributions!
