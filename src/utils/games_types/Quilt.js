import GameType from '../GameType';
import { getVersionManifestMojang, getInfosVersionManifestMojang, resolveMavenArtifact } from '../../Utils';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/tauri';
import axios from 'axios';
import { join } from '@tauri-apps/api/path';
import { createDir, exists } from '@tauri-apps/api/fs';

export default class Quilt extends GameType {

    constructor() {
        super("quilt");
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
            await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation de Quilt' }));
            await this.installQuiltVersion(data, task, rootDirectory)
            return resolve()
        })
    }

    installQuiltVersion = async (data, task, rootDirectory) => {
        const host_fabric = "https://maven.fabricmc.net/"
        const host_quilt = "https://maven.quiltmc.org/repository/release/"
        const getLoaderQuilt = async () => {
            return new Promise(async (resolve, reject) => {
                const directoryRoot = rootDirectory;
                const libsDir = await join(directoryRoot, "libraries");
                if (!await exists(libsDir)) await createDir(libsDir);

                await axios.get('https://meta.quiltmc.org/v3/versions/loader/' + data.game.version)
                    .then(async (response) => {
                        const files = [];
                        const loaderTarget = response.data[0];

                        const loaderQuilt = await resolveMavenArtifact(host_quilt, loaderTarget.loader.maven);
                        files.push({
                            url: loaderQuilt.url,
                            file: loaderQuilt.file,
                            path: await join(libsDir, loaderQuilt.path),
                            hash: null
                        })

                        const intermediaryFabric = await resolveMavenArtifact(host_fabric, loaderTarget.intermediary.maven);
                        files.push({
                            url: intermediaryFabric.url,
                            file: intermediaryFabric.file,
                            path: await join(libsDir, intermediaryFabric.path),
                            hash: null
                        })

                        for await (const lib of loaderTarget.launcherMeta.libraries.common) {
                            const fileResolve = await resolveMavenArtifact(lib.url, lib.name);
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
                                title: data?.name + ' - Téléchargements de Quilt',
                                subtitle: ' - '
                            }
                        }
                        await invoke('update_task', task_fabric);
                        await invoke('start_task', { uuid: task_fabric.uuid })

                        return resolve()
                    })
            })
        }
        await getLoaderQuilt();
    }

}