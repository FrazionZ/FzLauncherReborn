import { join } from "@tauri-apps/api/path";
import { exists, writeTextFile, createDir, removeFile } from "@tauri-apps/api/fs";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { invoke } from "@tauri-apps/api/tauri";
import { javaversion } from "../Utils";

export default class GameType {

    constructor(id) {
        this.id = id;
    }

    update_task_obj = (task, taskType, files, filePath, display) => {
        task.taskType = taskType;
        task.filePath = filePath;
        task.files = files;
        task.display = display;
        return task;
    }

    getAssets = async (manifest, assetsDirectory) => {
        const assetsDir = assetsDirectory;
        if (!await exists(assetsDir)) await createDir(assetsDir);

        return new Promise(async (resolve, reject) => {
            await axios.get(manifest.assetIndex.url).then(async (response) => {
                const indexes = response.data;

                const dirAssetsIndexes = await join(assetsDir, "indexes");
                if (!await exists(dirAssetsIndexes)) await createDir(dirAssetsIndexes);
                await writeTextFile(await join(dirAssetsIndexes, manifest.assetIndex.id + ".json"), JSON.stringify(indexes));

                const assetsDownload = []
                if(indexes.map_to_resources) {
                    for await (const asset of Object.keys(indexes.objects)) {
                        const file = asset.split('/').slice(-1)[0];
                        const hash = indexes.objects[asset].hash
                        const subhash = hash.substring(0, 2)
                        const subAsset = await join(assetsDir, asset.replace(`/${file}`, ''))
                        const url = 'https://resources.download.minecraft.net/' + subhash + '/' + hash
                        if (!await exists(subAsset)) {
                            assetsDownload.push({ url: url, file: file, path: subAsset, hash: hash })
                        }
                    }
                }else{
                    for await (const asset of Object.keys(indexes.objects)) {
                        const hash = indexes.objects[asset].hash
                        const subhash = hash.substring(0, 2)
                        const subAsset = await join(assetsDir, 'objects', subhash)
                        const url = 'https://resources.download.minecraft.net/' + subhash + '/' + hash
                        if (!await exists(await join(subAsset, hash))) {
                            assetsDownload.push({ url: url, file: hash, path: subAsset, hash: hash })
                        }
                    }
                }
                return resolve(assetsDownload)

            }).catch((err) => {
                return reject(err);
            })
        })
    }

    getLibs = async (manifest, dirRoot) => {
        const directoryRoot = dirRoot;
        const libsDir = await join(directoryRoot, "libraries");
        if (!await exists(libsDir)) createDir(libsDir);
        const nativesDir = await join(directoryRoot, "natives");
        if (!await exists(nativesDir)) createDir(nativesDir);

        return new Promise(async (resolve, reject) => {
            const libsDownload = [];
            const nativesExtract = [];
            await Promise.all(manifest.libraries.map(async lib => {

                let file = undefined
                let obj = { url: undefined, file: undefined, path: undefined };

                if (lib.downloads.classifiers?.['natives-windows'] !== undefined) {
                    file = lib.downloads.classifiers['natives-windows'].path.split('/').pop()
                    obj = { url: lib.downloads.classifiers['natives-windows'].url, file: file, path: await join(nativesDir), hash: lib.downloads.classifiers['natives-windows'].sha1 };
                    nativesExtract.push({ file: file, path: await join(nativesDir) })
                    const fileLibLocal = await join(nativesDir, file);
                    if (await exists(fileLibLocal)) {
                        //const sha1Get = await sha1FileSync(fzVariable.path.join(libsDir, file));
                        //if (sha1Get !== lib.downloads.artifact.sha1) libsDownload.push(obj)
                    } else libsDownload.push(obj)
                } else if (lib.downloads.artifact !== undefined) {
                    file = lib.downloads.artifact.path.split('/').pop()
                    obj = { url: lib.downloads.artifact.url, file: file, path: await join(libsDir, lib.downloads.artifact.path.replace(`/${file}`, '')), hash: lib.downloads.artifact.sha1 };
                    const fileLibLocal = await join(libsDir, lib.downloads.artifact.path);
                    if (await exists(fileLibLocal)) {
                        //const sha1Get = await sha1FileSync(fzVariable.path.join(libsDir, file));
                        //if (sha1Get !== lib.downloads.artifact.sha1) libsDownload.push(obj)
                    } else libsDownload.push(obj)
                }


            }))
            return resolve({ ld: libsDownload, nd: nativesExtract })
        });
    }

    getClient = async (manifest, clientJarName, dirRoot) => {
        return new Promise(async (resolve, reject) => {
            const file = clientJarName
            const directoryRoot = dirRoot;
            const fileJarClient = await join(directoryRoot, file);
            const obj = { url: manifest.downloads.client.url, file: file, path: directoryRoot, hash: manifest.downloads.client.sha1 };
            if (await exists(fileJarClient)) {
                //const sha1Get = await sha1FileSync(fzVariable.path.join(path, file));
                //if (sha1Get !== manifest.downloads.client.sha1) return resolve([obj])
                //else return resolve([])
                return resolve([])
            } else return resolve([obj])
        });
    }

    step_install() {

    }

    taskEmptyLoader = ({ data, uuid, title }) => {
        return {
            taskType: 0,
            uuid: uuid,
            files: [],
            filePath: "",
            display: {
                title: data?.name + ' - ' + title,
                subtitle: 'Veuillez patienter'
            }
        }
    }

    async get_java_version(fzContext, javaVersion) {
        const version = await javaversion(await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime', 'jre' + javaVersion, 'bin', 'java'));
        return new Promise(async(resolve, reject) => {
            if (version !== "no install") return resolve()
            const runtimeZulu = await invoke('get_java_data', { javaVersion })
            const runtime = JSON.parse(JSON.parse(runtimeZulu))[0];
            const uuidTaskRuntime = uuidv4()
            const dirName = runtime.name.replace('.zip', '')
            const pathRuntime = await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime');
            if(!await exists(pathRuntime)) {
                await createDir(pathRuntime)
            }
            const files = [{ url: runtime.download_url, file: await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime', runtime.name), path: await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime'), hash: "" }]
            let task = {
                taskType: 1,
                uuid: uuidTaskRuntime,
                files: files,
                display: {
                    title: 'Téléchargement du moteur Java',
                    subtitle: 'Veuillez patienter'
                }
            }
            try {
                await invoke('add_task', task)
                await invoke('start_task', { uuid: task.uuid })
                const fileExtract = [{  file: await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime', runtime.name), path: pathRuntime }]
                task = this.update_task_obj(task, 2, fileExtract, pathRuntime.toString(), {
                    title: 'Extraction du moteur Java',
                    subtitle: ' - '
                })
                await invoke('update_task', task);
                await invoke('start_task', { uuid: task.uuid })

                await invoke('rename_directory', { oldPath: await join(pathRuntime, dirName), newPath: await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime', "jre" + javaVersion) })
                await removeFile(await join(pathRuntime, runtime.name))
                
                return resolve();
            }catch(e) {
                console.log(e)
                return reject();
            }
        })
    }

    async vanilla_game_universal(fzContext, data, assetsDirectory, rootDirectory, ivm) {

        //GET RUNTIME IF REQUIRED
        const result = await this.get_java_version(fzContext, data?.jre);
        console.log("OUE", result)

        var uuidTaskInstall = uuidv4()
        let task = {
            taskType: 0,
            uuid: uuidTaskInstall,
            files: [],
            display: {
                title: data?.name + ' - Préparation du profil de jeu',
                subtitle: 'Veuillez patienter'
            }
        }
        await invoke('add_task', task)
        console.log("get assets..")
        const assets = await this.getAssets(ivm.current, assetsDirectory);
        task = this.update_task_obj(task, 1, assets, "", {
            title: data?.name + ' - Téléchargements des assets',
            subtitle: ' - '
        })
        console.log(task)
        await invoke('update_task', task);
        await invoke('start_task', { uuid: task.uuid })
        console.log('Assets downloaded')
        console.log('Prepare download librairies')
        await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation des fichiers librairies' }));
        const libs = await this.getLibs(ivm.current, rootDirectory)
        task = this.update_task_obj(task, 1, libs.ld, "", {
            title: data?.name + ' - Téléchargements des librairies',
            subtitle: ' - '
        })
        await invoke('update_task', task);
        await invoke('start_task', { uuid: task.uuid })

        await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation des fichiers natives' }));
        for await (const file of libs.nd) {
            file.file = await join(file.path, file.file);
        }
        task = this.update_task_obj(task, 2, libs.nd, (await join(rootDirectory, "natives")).toString(), {
            title: data?.name + ' - Extraction des fichiers natives',
            subtitle: ' - '
        })
        await invoke('update_task', task);
        await invoke('start_task', { uuid: task.uuid })

        await invoke('update_task', this.taskEmptyLoader({ data: data, uuid: task.uuid, title: 'Préparation du client' }));
        const client = await this.getClient(ivm.current, data.game.clientJarName, rootDirectory);
        task = this.update_task_obj(task, 1, client, "", {
            title: data?.name + ' - Téléchargements du client',
            subtitle: ' - '
        })
        await invoke('update_task', task);
        await invoke('start_task', { uuid: task.uuid })

        return task;
    }

}