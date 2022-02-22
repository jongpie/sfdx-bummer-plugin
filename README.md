# SFDX Bummer Plugin

A plugin for SFDX CLI to help update `sfdx-project.json` with package versions in your devhub.

## Setup

### Install as plugin

1. Install plugin: `sfdx plugins:install @jongpie/sfdx-bummer-plugin`

### Install from source

1. Install the SDFX CLI.

2. Clone the repository: `git clone git@github.com:jongpie/sfdx-bummer-plugin.git`

3. Install npm modules: `npm install` or `yarn install`

4. Link the plugin: `sfdx plugins:link` .

## Commands

### `sfdx bummer:package:aliases:sort`

Sorts `packageAliases` in `sfdx-project.json`, based on each package's name, major version, minor version, patch version, and build number

### `sfdx bummer:package:versions:retrieve`

Scans the `packageAliases` in `sfdx-project.json`, and retrieves package versions for any packages listed. All 3 parameters are optional

-   `--released`: Only include package versions that have been released
-   `--includeversionname`: appends the package version's name to the package version's alias in `sfdx-project.json`
-   `--maxversions 10`: Limits the number of package versions to retrieve per package
