import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import axios from "axios";

export function javaversion(path) {
    return new Promise(async function (resolve, reject) {
        const directoryJava = path;
        try {
            const unlisten = listen('process-output', (event) => {
                const data = event.payload;
                var javaVersion = new RegExp('openjdk version').test(data) ? data.split(' ')[2].replace(/"/g, '') : false;
                if (javaVersion != false) {
                    return resolve(javaVersion);
                } else {
                    return resolve("no install")
                }
            });
            await invoke('start_child_process', { command: directoryJava, args: ['-version'] });
        } catch (error) {
            return resolve("no install")
        }
    })

}

export async function getVersionManifestMojang(v) {
    return new Promise(async (resolve, reject) => {
        await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json').then((response) => {
            let version = response.data.versions.find(version => version.id == v);
            return resolve(version)
        }).catch((err) => {
            return reject(err);
        })
    })
}

export function resolveMavenArtifact(host, mv) {
    const mavenSplit = mv.split(':')
    const mavenPackage = mavenSplit[0].replaceAll('.', '/');
    const mavenArtifact = mavenSplit[1];
    const mavenVersion = mavenSplit[2];

    //CHECK EXTENSION SPECIFY
    let extension = '.jar'
    const splitExtension = mv.split('@');
    if(splitExtension.length > 1) {
        extension = `.${splitExtension[splitExtension.length - 1]}`;
    }

    const resourceFile = mavenArtifact + '-' + mavenVersion + extension;
    const path = mavenPackage + '/' + mavenArtifact + '/' + mavenVersion;
    const file = mavenPackage + '/' + mavenArtifact + '/' + mavenVersion + '/' + resourceFile;
    const url = host + path + '/' + resourceFile;
    return { url: url, file: file, path: path };
}

export async function getInfosVersionManifestMojang(version) {
    return new Promise(async (resolve, reject) => {
        getVersionManifestMojang(version).then(async (version) => {
            console.log(version)
            await axios.get(version.url).then((response) => {
                return resolve(response.data)
            }).catch((err) => {
                return reject(err);
            })
        })

    })
}