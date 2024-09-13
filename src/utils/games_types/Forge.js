import GameType from '../GameType';
import { getVersionManifestMojang, getInfosVersionManifestMojang, resolveMavenArtifact } from '../../Utils';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/tauri';
import axios from 'axios';
import { join } from '@tauri-apps/api/path';
import { createDir, exists } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';
import { Command } from '@tauri-apps/api/shell'

export default class Forge extends GameType {

    constructor() {
        super("forge");
    }

    async step_install(
        fzContext,
        data,
        infosVersionManifest,
        assetsDirectory,
        rootDirectory
    ) {
        return new Promise(async (resolve, reject) => {
            const task = await this.vanilla_game_universal(fzContext, data, assetsDirectory, rootDirectory, infosVersionManifest)
            await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation de Forge' }));
            await this.installForgeVersion(fzContext, data, task, rootDirectory)
            return resolve()
        })
    }

    installForgeVersion = async (fzContext, data, task, rootDirectory) => {
        return new Promise(async(resolve, reject) => {
            const responseForgeLoader = await axios.get(`https://api.curseforge.com/v1/minecraft/modloader/${data.game.modloader_version}`);
            const forgeLoader = responseForgeLoader.data.data;
            forgeLoader.installProfileJson = JSON.parse(forgeLoader.installProfileJson);
            forgeLoader.versionJson = JSON.parse(forgeLoader.versionJson);
            console.log('Forge Loader', forgeLoader)

            const directoryRoot = rootDirectory;
            const libsDir = await join(directoryRoot, "libraries");

            const files = [];
            for await (const lib of forgeLoader.versionJson.libraries) {
                const pathLibSplit = lib.downloads.artifact.path.split('/');
                const fileName = pathLibSplit[pathLibSplit.length - 1];
                files.push({
                    url: lib.downloads.artifact.url,
                    file: fileName,
                    path: await join(libsDir, lib.downloads.artifact.path.replace(`/${fileName}`, '')),
                    hash: lib.sha1
                })
            }

            for await (const lib of forgeLoader.installProfileJson.libraries) {
                const pathLibSplit = lib.downloads.artifact.path.split('/');
                const fileName = pathLibSplit[pathLibSplit.length - 1];
                files.push({
                    url: lib.downloads.artifact.url,
                    file: fileName,
                    path: await join(libsDir, lib.downloads.artifact.path.replace(`/${fileName}`, '')),
                    hash: lib.sha1
                })
            }

            console.log("Files Forge", files)

            let task_forge = {
                taskType: 1,
                uuid: uuidv4(),
                files: files,
                filePath: "",
                display: {
                    title: data?.name + ' - Téléchargements de Forge',
                    subtitle: ' - '
                }
            }

            //await invoke('add_task', task_forge);
            //await invoke('start_task', { uuid: task_forge.uuid })

            const installProfile = forgeLoader.installProfileJson;
            for await (const proc of installProfile.processors) {
                const resolveJar = await resolveMavenArtifact(libsDir + '/', proc.jar)
                const res = await invoke('read_file_from_zip_sync', { zipPath: resolveJar.url, fileName: 'META-INF/MANIFEST.MF' })
                const manifestSplit = res.split('\r\n');
                let mainClass = manifestSplit.find((entry) => entry.startsWith('Main-Class:'));
                if(!mainClass) continue;
                mainClass = mainClass.replace('Main-Class: ', '')
                let classPath = "";
                for await (const cp of proc.classpath) {
                    const resolveCP =  await resolveMavenArtifact(libsDir + '/', cp);
                    classPath +=  `${resolveCP.url};`   
                }
                const preArgs = proc.args;
                classPath += `${resolveJar.url};`
                const args = [];
                for await (let arg of preArgs) {
                    if(arg == "{SIDE}") {
                        console.log('SIDE DETECTED')
                        arg = 'client'
                    }else if(arg == "{MINECRAFT_JAR}") {
                        arg = await join(directoryRoot, 'minecraft.jar')
                    }else if(arg == "{MOJMAPS}") {
                        const outputClient = await resolveMavenArtifact(libsDir + '/', installProfile.data.MOJMAPS.client.replace('[', '').replace(']', ''))
                        arg = outputClient.url
                    }else if(arg == "{MC_OFF}") {
                        const outputClient = await resolveMavenArtifact(libsDir + '/', installProfile.data.MC_OFF.client.replace('[', '').replace(']', ''))
                        arg = outputClient.url
                    }else if(arg == "{PATCHED}") {
                        const outputClient = await resolveMavenArtifact(libsDir + '/', installProfile.data.PATCHED.client.replace('[', '').replace(']', ''))
                        arg = outputClient.url
                    }else if(arg == "{BINPATCH}") {
                        arg = installProfile.data.BINPATCH.client
                    }
                    args.push(arg)
                }
                console.log('Execute ', mainClass)
                await invoke('java_jar_spawn_command', { javaPath: await join(fzContext.fzVariable.dirFzLauncherRuntime, `jre${data?.jre}`, 'bin', 'java'), classPath: classPath, mainClass: mainClass, args: args });
                console.log('FINISHED!')
            }

            return resolve();

            /*let task_forge = {
                taskType: 1,
                uuid: task.uuid,
                files: files,
                filePath: "",
                display: {
                    title: data?.name + ' - Téléchargements de Forge',
                    subtitle: ' - '
                }
            }

            await invoke('update_task', task_forge);
            await invoke('start_task', { uuid: task_forge.uuid })

            return resolve();*/
        })

    }

}