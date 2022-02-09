import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as fs from 'fs';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@jongpie/sfdx-bummer-plugin', 'bummer');

export default class Retrieve extends SfdxCommand {
    public static description = messages.getMessage('retrieveCommandDescription');
    public static examples = [
        `$ sfdx bummer:package:versions:retrieve
        $ sfdx bummer:package:versions:retrieve --includeversionname
        $ sfdx bummer:package:versions:retrieve --includeversionname --released
        $ sfdx bummer:package:versions:retrieve --includeversionname --released --maxversions 5
    `
    ];

    protected static flagsConfig = {
        includeversionname: flags.boolean({ char: 'i', required: false, description: messages.getMessage('retrieveCommandReleasedFlagDescription') }),
        maxversions: flags.string({ char: 'm', required: false, description: messages.getMessage('retrieveCommandMaxVersionsFlagDescription') }),
        released: flags.boolean({ char: 'r', required: false, description: messages.getMessage('retrieveCommandDescription') })
    };
    protected static requiresDevhubUsername = true;
    protected static requiresProject = true;

    public async run() {
        const project = await this.project.resolveProjectConfig();
        if (project.packageAliases === undefined) {
            throw new SfdxError(`Could not find 'packageAliases' in sfdx-project.json`);
        }

        const packagesInProject = {};
        for (const [key, value] of Object.entries(project.packageAliases)) {
            if (!key.includes('@')) {
                packagesInProject[key] = value;
            }
        }
        const countOfPackagesInProject = Object.keys(packagesInProject).length;
        if (countOfPackagesInProject === 0) {
            throw new SfdxError(`No package IDs found in sfdx-project.json`);
        } else {
            this.ux.log(`Found ${countOfPackagesInProject} packages in sfdx-project.json`);
        }
        const packageVersionsByPackageId = await this.getPackageVersionsByPackageId(packagesInProject);
        const cleanedPackageAliases = this.generateCleanedPackageAliases(packagesInProject, packageVersionsByPackageId);
        project.packageAliases = cleanedPackageAliases;

        this.saveProject(project);
    }

    private getMetadataPackageQuery(packageIds) {
        const packageIdsFilter = "'" + packageIds.join("', '") + "'";
        return `SELECT Id, Name, SubscriberPackageId` + ` FROM Package2` + ` WHERE Id IN (${packageIdsFilter})` + ` ORDER BY Name, NamespacePrefix`;
    }

    private getMetadataPackageVersionQuery(packages) {
        const subscriberPackageIds = [];
        packages.records.forEach(pkg => subscriberPackageIds.push(pkg.Id));
        const subscriberPackageIdsFilter = "'" + subscriberPackageIds.join("', '") + "'";
        let query =
            `SELECT Id, Name, Package2Id, SubscriberPackageVersionId, MajorVersion, MinorVersion, PatchVersion, BuildNumber` +
            ` FROM Package2Version` +
            ` WHERE Package2Id IN (${subscriberPackageIdsFilter})`;

        if (this.flags.released) {
            query += ` AND IsReleased = true`;
        }

        query += ` ORDER BY MajorVersion, MinorVersion, PatchVersion, BuildNumber, CreatedDate`;

        return query;
    }

    private async getPackageVersionsByPackageId(packagesInProject) {
        const conn = this.hubOrg.getConnection();

        const packages = await conn.tooling.query<any>(this.getMetadataPackageQuery(Object.values(packagesInProject)));
        if (packages.totalSize == 0) {
            throw new SfdxError('Could not find any matching packages in devhub, please verify that the correct devhub has been specified');
        } else {
            this.ux.log(`Found ${packages.totalSize} matching packages in devhub`);
        }

        const packageVersions = await conn.tooling.query<any>(this.getMetadataPackageVersionQuery(packages));
        const packageVersionsByPackageId = {};
        packageVersions.records.forEach(packageVersion => {
            if (!packageVersionsByPackageId[packageVersion.Package2Id]) {
                packageVersionsByPackageId[packageVersion.Package2Id] = [];
            }
            packageVersionsByPackageId[packageVersion.Package2Id].push(packageVersion);
        });
        return packageVersionsByPackageId;
    }

    private generateCleanedPackageAliases(packagesInProject, packageVersionsByPackageId) {
        const cleanedPackageAliases = {};
        for (const [packageAlias, packageId] of Object.entries(packagesInProject)) {
            this.ux.log(`Adding package alias '${packageAlias} for package ID ${packageId}`);
            cleanedPackageAliases[packageAlias] = packageId;
            const matchingPackageVersions = packageVersionsByPackageId[packageId as any];
            if (matchingPackageVersions) {
                if (this.flags.maxversions && matchingPackageVersions.length > Number(this.flags.maxversions)) {
                    while (matchingPackageVersions.length > Number(this.flags.maxversions)) {
                        matchingPackageVersions.shift();
                    }
                }

                matchingPackageVersions.forEach(packageVersion => {
                    const packageVersionAlias = this.generatePackageVersionAlias(packageAlias, packageVersion);
                    this.ux.log(`Adding package version alias '${packageVersionAlias} for package version ID ${packageVersion.Id}`);
                    cleanedPackageAliases[packageVersionAlias] = packageVersion.SubscriberPackageVersionId;
                });
            }
        }
        return cleanedPackageAliases;
    }
    private generatePackageVersionAlias(packageAlias, packageVersion) {
        let packageVersionAlias =
            packageAlias +
            '@' +
            packageVersion.MajorVersion +
            '.' +
            packageVersion.MinorVersion +
            '.' +
            packageVersion.PatchVersion +
            '-' +
            packageVersion.BuildNumber;

        if (this.flags.includeversionname) {
            const nonAlphaNumeric = /[^A-Za-z0-9\-]/g;
            const simplifiedVersionName = packageVersion.Name.toLowerCase().replace(/ /g, '-').replace(/\-\-+/g, '-').replace(nonAlphaNumeric, '');
            packageVersionAlias += '-' + simplifiedVersionName;
        }

        return packageVersionAlias;
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
