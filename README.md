# Filestore Component for Node.js

A robust Node.js component for interacting with a Filestore API, supporting file upload, update, lookup, deletion, and custom raw requests. Designed for use in integration platforms and automation scenarios.

## Actions

- **uploadFile** Uploades file to filestore with support for chunked/resumable uploads
- **updateFile** Updates file with the new content or new localization within the filestore
- **lookupFileById** Fetches the data about the file with the provided id
- **deleteFileById** Deletes file with the provided id
- **rawRequest**: Makes a custom API calls to the filestore (supports all HTTP methods and custom headers)

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Usage

This component is intended to be used as part of a Connect flow.
To use it in Connect you need to set the remote URL of your connect repo and push the code.
Each change in the code requeires component version bump.

### File structure

The main logic for each action is in the `lib/actions/` directory.

The tests for each action can be found in the `tests/` directory.

Schemas (which are used in Connect to create user-friendly interface to provide data) are in the `lib/schemas/`.
`[filename].in.json` is a schema of data to provide to the action
`[filename].out.json` is a schema of data which are returned

### Running Tests

This project uses **Jest** for testing. To run all tests:

```bash
npm test
```

### Checking Test Coverage

To generate a test coverage report:

```bash
npm test -- --coverage
```

After running, open `coverage/lcov-report/index.html` in your browser for a detailed report.

## Directory Structure

```
├── lib/
│   └── actions/
│       ├── uploadFile.js
│       ├── updateFile.js
│       ├── lookupFileById.js
│       ├── deleteFileById.js
│       └── rawRequest.js
├── tests/
│   └── *.test.js
├── package.json
├── README.md
└── ...
```

The main logic for each action is in the `lib/actions/` directory.

The tests for each action can be found in the `tests/` directory.

Schemas (which are used in connect to create user-friendly interface to provide data) are in the `lib/schemas/`.
`[filename].in.json` is a schema of data to provide to the action
`[filename].out.json` is a schema of data which are returned

`verifyCredentials.js` contains a function which is triggered to verify provided credentials in Connect

## License

[MIT](LICENSE)
