import { SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as fs from 'fs';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@jongpie/sfdx-bummer-plugin', 'bummer');

export default class Sort extends SfdxCommand {
    public static description = messages.getMessage('sortCommandDescription');
    public static examples = [`$ sfdx bummer:package:aliases:sort`];

    protected static requiresProject = true;

    public async run() {
        const project = await this.project.resolveProjectConfig();
        if (project.packageAliases === undefined) {
            throw new SfdxError(`Could not find 'packageAliases' in sfdx-project.json`);
        }

        const sortedPackageAliases = Object.keys(project.packageAliases)
            // Use a custom sort function so that multiple attributes can be checked for sorting
            .sort((firstItem, secondItem) => {
                const firstPackage = this.convertToObject(firstItem);
                const secondPackage = this.convertToObject(secondItem);
                const propertiesToCheck = ['name', 'majorVersion', 'minorVersion', 'patchVersion', 'buildNumber'];
                for (let i = 0; i < propertiesToCheck.length; i++) {
                    // Prep the data
                    const propertyName = propertiesToCheck[i];
                    const firstValue = isNaN(firstPackage[propertyName] as any) ? firstPackage[propertyName] : Number(firstPackage[propertyName]);
                    const secondValue = isNaN(secondPackage[propertyName] as any) ? secondPackage[propertyName] : Number(secondPackage[propertyName]);

                    // Compare the data
                    if ((!firstValue && !!secondValue) || firstValue < secondValue) {
                        return -1;
                    } else if ((!!firstValue && !secondValue) || firstValue > secondValue) {
                        return 1;
                    }
                }
                return 0;
            })
            .reduce(function (result, key) {
                // Copy the sorted key-value pairs to the new result object
                result[key] = project.packageAliases[key];
                return result;
            }, {});

        project.packageAliases = sortedPackageAliases;

        this.saveProject(project);
    }

    private convertToObject(packageAlias) {
        // Expected formats for alias:
        // some package
        // some package@1.2.3-99
        // some package@1.2.3-99-some-description-or-name-or-something
        let aliasPieces = [packageAlias.split('@')[0]];
        if (packageAlias.split('@').length > 1) {
            aliasPieces = aliasPieces.concat(packageAlias.split('@')[1].replace('-', '.').split('.'));
        }

        return {
            name: aliasPieces[0],
            majorVersion: aliasPieces[1],
            minorVersion: aliasPieces[2],
            patchVersion: aliasPieces[3],
            buildNumber: aliasPieces[4]?.includes('-') ? aliasPieces[4].split('-')[0] : aliasPieces[4]
        };
    }

    private saveProject(project) {
        if (project.defaultdevhubusername) {
            delete project.defaultdevhubusername;
        }
        if (project.defaultusername) {
            delete project.defaultusername;
        }
        const outputPath = 'sfdx-project.json';
        this.ux.log(`Saving changes to ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(project, null, 4));
    }
}
