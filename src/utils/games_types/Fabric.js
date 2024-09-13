import GameType from '../GameType';
import { getVersionManifestMojang, getInfosVersionManifestMojang, resolveMavenArtifact } from '../../Utils';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/tauri';
import axios from 'axios';
import { join } from '@tauri-apps/api/path';
import { createDir, exists } from '@tauri-apps/api/fs';

export default class Fabric extends GameType {

    constructor() {
        super("fabric");
    }
    
    async step_install(
        fzContext,
        data, 
        infosVersionManifest, 
        assetsDirectory,
        rootDirectory
    ) {
        return new Promise(async(resolve, reject) => {
            const task = await this.vanilla_game_universal(fzContext, data, assetsDirectory, rootDirectory, infosVersionManifest)
            await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation de Fabric' }));
            await this.installFabricVersion(data, task, rootDirectory)
            return resolve()
        })
    }

    installFabricVersion = async (data, task, rootDirectory) => {
        const host = "https://maven.fabricmc.net/"
        const getLoaderFabric = async () => {
            return new Promise(async (resolve, reject) => {
                const directoryRoot = rootDirectory;
                const libsDir = await join(directoryRoot, "libraries");
                if (!await exists(libsDir)) await createDir(libsDir);

                await axios.get('https://meta.fabricmc.net/v2/versions/loader/' + data.game.version)
                    .then(async (response) => {
                        const files = [];
                        const loaderTarget = response.data[0];

                        const loaderFabric = await resolveMavenArtifact(host, loaderTarget.loader.maven);
                        files.push({
                            url: loaderFabric.url,
                            file: loaderFabric.file,
                            path: await join(libsDir, loaderFabric.path),
                            hash: null
                        })

                        const intermediaryFabric = await resolveMavenArtifact(host, loaderTarget.intermediary.maven);
                        files.push({
                            url: intermediaryFabric.url,
                            file: intermediaryFabric.file,
                            path: await join(libsDir, intermediaryFabric.path),
                            hash: null
                        })

                        for await (const lib of loaderTarget.launcherMeta.libraries.common) {
                            const fileResolve = await resolveMavenArtifact(host, lib.name);
                            files.push({
                                url: fileResolve.url,
                                file: fileResolve.file,
                                path: await join(libsDir, fileResolve.path),
                                hash: lib.sha1
                            })
                        }

                        let task_fabric = {
                            taskType: 1,
                            uuid: task.uuid,
                            files: files,
                            filePath: "",
                            display: {
                                title: data?.name + ' - Téléchargements de Fabric',
                                subtitle: ' - '
                            }
                        }
                        await invoke('update_task', task_fabric);
                        await invoke('start_task', { uuid: task_fabric.uuid })

                        return resolve()
                    })
            })
        }
        await getLoaderFabric();

    }

}