import { useEffect, useReducer, useRef, useState } from 'react'
import BackgroundHeader from '../../../assets/img/wallpaper.png'
import SuperButton from '../../../components/SuperButton'
import { useFzContext } from '../../../FzContext'
import { appDataDir, join } from '@tauri-apps/api/path';
import { v4 as uuidv4 } from 'uuid'
import { exists, createDir, writeTextFile } from '@tauri-apps/api/fs';
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri';
import DirectoryIcon from '../../../assets/img/icons/directory'
import Task from '../../../components/Task'
import axios from 'axios';
import FzToast from '../../../components/FzToast';
import DefaultIcon from "../../../assets/img/mc_logo.png"
import Mods from './profiles/Mods'
import Rpacks from './profiles/Rpacks'
import Console from './profiles/Console'
import Screens from './profiles/Screens'
import { FaStop } from "react-icons/fa6";
import { listen } from '@tauri-apps/api/event';
import Settings from './profiles/Settings';
import MineParse from '../../../components/MineParse'
import '../../../assets/css/MinecraftText.css'
import { getVersionManifestMojang, getInfosVersionManifestMojang } from '../../../Utils';
import { useTranslation } from 'react-i18next';
//STATE_PROFILE_GAME! 0=Waiting, 1=Install, 2=Update, 3=Playable


export default function ProfileGame({ data }) {

    
    const { t } = useTranslation()
    const mineParse = new MineParse();
    const [tabs, setTabs] = useState([
        {
            key: "home",
            name: "Accueil",
            restricted_level: 1,
            component: <>Oué</>
        },
        {
            key: "mods",
            name: "Mods",
            restricted_level: 2,
            component: <Mods data={data} />
        },
        {
            key: "rpacks",
            name: "Resources Pack",
            restricted_level: 0,
            component: <Rpacks data={data} />
        },
        {
            key: "screens",
            name: "Screenshots",
            restricted_level: 0,
            component: <Screens data={data} />
        }
    ])

    const fzContext = useFzContext();
    let tabsList = [...tabs];
    if (data?.profile_type !== "server") {
        tabsList = tabsList.filter((tab) => tab.restricted_level !== 1);
    }
    if (data?.game_type == "vanilla") {
        tabsList = tabsList.filter((tab) => tab.restricted_level !== 2);
    }
    const [icon, setIcon] = useState(data?.profile_type == "server" ? data.icon : data.icon == "default" ? DefaultIcon : convertFileSrc(data.icon, "asset"))
    const [tabCurrent, setTab] = useState(data?.profile_type == "server" ? 'home' : data?.game_type == "vanilla" ? 'mods' : 'rpacks')
    const [profileInit, setProfileInit] = useState()
    const [button, setButton] = useState({ state: false, label: "En attente" })
    const pid_instance = useRef(null)
    const infosVersionManifest = useRef(undefined)
    const isConnected = useRef(fzContext.sessionMSA.auth !== undefined);
    const [, forceUpdate] = useReducer((x) => x + 1, 0)

    useEffect(() => {
        isConnected.current = fzContext.sessionMSA.auth !== undefined
    }, [fzContext.sessionMSA.auth])

    useEffect(() => {
        if (pid_instance.current !== null) {
            const copyTabs = [...tabs];
            copyTabs.push({
                key: "console",
                name: "Console",
                restricted_level: 0,
                component: <Console data={data} pid={pid_instance.current} />
            })
            setTabs(copyTabs)
            setTab('console')
        } else {
            setTab(data?.profile_type == "server" ? 'home' : 'mods')
            let copyTabs = [...tabs];
            copyTabs = copyTabs.filter(t => t.key !== "console");
            setTabs(copyTabs)
        }
    }, [pid_instance.current])

    useEffect(() => {
        console.log('Check install and has update available', data)
        updateStateProfileGame(0)
        setProfileInit(data?.id)
        let unlistenInstanceLaunch = () => { };
        init().then(async (res) => {
            updateStateProfileGame(res.state)
            unlistenInstanceLaunch = await listen('launch-game-profile-frazionz', async (event) => {
                console.log('LAUNCH GAME DATA', event.payload)
                if (event.payload == null) {
                    pid_instance.current = null
                    forceUpdate()
                    return updateStateProfileGame(3);
                }
                if(event.payload.game_id !== data?.id) return;
                pid_instance.current = event.payload.id
                forceUpdate()
            });
        })
        return () => {
            unlistenInstanceLaunch();
        }
    }, [data])

    useEffect(() => {
    }, [])

    const updateButton = (state, label, callback) => {
        setButton({ state: state, label: label, callback: callback })
    }

    const updateStateProfileGame = (stateProfileGame) => {
        if (!pid_instance.current) {
            switch (stateProfileGame) {
                case 0:
                    updateButton(false, "En attente", () => { })
                    break;
                case 1:
                    updateButton(true, "Installer", installProfileGame)
                    break;
                case 2:
                    updateButton(true, "Mettre à jour", () => { })
                    break;
                case 3:
                    updateButton(true, "Jouer", launchGame)
                    break;
                default:
                    break;
            }
        }
    }

    const init = async () => {
        return new Promise(async (resolve, reject) => {
            const dirVersion = await getDirectory()
            const clientExist = await join(dirVersion, data?.game?.clientJarName)

            console.log("CHECK INSTANCE GAME")
            const test = await invoke('get_instance_from_gameid', { gameId: data?.id })
            if (test !== null) {
                pid_instance.current = test?.id
                updateButton(false, "Jeu en cours..", () => { })
                forceUpdate()
            }

            const ivm = await getInfosVersionManifestMojang(data?.game?.version);
            infosVersionManifest.current = ivm;
            console.log('New infos version manifest', ivm, infosVersionManifest.current)

            console.log("CHECK DIRECTORY")
            if (!await exists(dirVersion)) {
                await createDir(dirVersion);
                return resolve({ state: 1 })
            }

            if (!await exists(clientExist)) {
                return resolve({ state: 1 })
            }

            await invoke('init_config_profile', { filePath: await join(dirVersion, 'config.json') })

            const isEmpty = await invoke('is_directory_empty', { directoryPath: dirVersion })
            if (isEmpty) return resolve({ state: 1 })
            return resolve({ state: 3 })

        })
    }

    const getDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherMCVersions, data?.id)
    }

    const getAssetsDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzMetaDatas, "assets")
    }

    const getRuntimeDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherDatas, "runtime", `jre${data?.jre}`, "bin", "java")
    }

    const getAssets = async (manifest) => {
        const assetsDir = await getAssetsDirectory();
        if (!await exists(assetsDir)) createDir(assetsDir);

        return new Promise(async (resolve, reject) => {
            await axios.get(manifest.assetIndex.url).then(async (response) => {
                const indexes = response.data;

                const dirAssetsIndexes = await join(assetsDir, "indexes");
                if (!await exists(dirAssetsIndexes)) await createDir(dirAssetsIndexes);
                await writeTextFile(await join(dirAssetsIndexes, manifest.assetIndex.id + ".json"), JSON.stringify(indexes));

                const assetsDownload = []
                for await (const asset of Object.keys(indexes.objects)) {
                    const hash = indexes.objects[asset].hash
                    const subhash = hash.substring(0, 2)
                    const subAsset = await join(assetsDir, 'objects', subhash)
                    const url = 'https://resources.download.minecraft.net/' + subhash + '/' + hash
                    if (!await exists(await join(subAsset, hash))) {
                        assetsDownload.push({ url: url, file: hash, path: subAsset, hash: hash })
                    }
                }
                return resolve(assetsDownload)

            }).catch((err) => {
                return reject(err);
            })
        })
    }

    const getLibs = async (manifest) => {
        const directoryRoot = await getDirectory();
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
                    obj = { url: lib.downloads.artifact.url, file: file, path: await join(libsDir), hash: lib.downloads.artifact.sha1 };
                    const fileLibLocal = await join(libsDir, file);
                    if (await exists(fileLibLocal)) {
                        //const sha1Get = await sha1FileSync(fzVariable.path.join(libsDir, file));
                        //if (sha1Get !== lib.downloads.artifact.sha1) libsDownload.push(obj)
                    } else libsDownload.push(obj)
                }


            }))
            return resolve({ ld: libsDownload, nd: nativesExtract })
        });
    }



    const getClient = async (manifest) => {
        return new Promise(async (resolve, reject) => {
            const file = data.game.clientJarName
            const directoryRoot = await getDirectory();
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

    const taskEmptyLoader = ({ uuid, title }) => {
        return {
            taskType: 0,
            uuid: uuid,
            files: [],
            display: {
                title: data?.name + ' - ' + title,
                subtitle: 'Veuillez patienter'
            }
        }
    }

    const installProfileGame = async () => {
        if (infosVersionManifest.current == undefined) return;
        updateButton(false, "Installation..", () => { })
        console.log("Install profile game", infosVersionManifest)
        const fabricTest = fzContext.gameManager.get_class(data?.game_type);
        console.log("Profile type class: ", fabricTest)
        if(fabricTest == undefined) return;
        await fabricTest.instance.step_install(
            fzContext,
            data, 
            infosVersionManifest,
            await getAssetsDirectory(),
            await getDirectory()
        );
        console.log('Game type downloaded')
        console.log('GAME READY')
        updateStateProfileGame(3)
        /*var uuidTaskInstall = uuidv4()
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
        await getAssets(infosVersionManifest.current).then(async (assets) => {
            console.log('Assets download: ', assets)
            task = {
                taskType: 1,
                uuid: uuidTaskInstall,
                files: assets,
                display: {
                    title: data?.name + ' - Téléchargements des assets',
                    subtitle: ' - '
                }
            }
            await invoke('update_task', task);
            await invoke('start_task', { uuid: task.uuid })
            console.log('Assets downloaded')
            console.log('Prepare download librairies')
            await invoke('update_task', taskEmptyLoader({ uuid: task.uuid, title: 'Préparation des fichiers librairies' }));
            await getLibs(infosVersionManifest.current).then(async (libs) => {
                task = {
                    taskType: 1,
                    uuid: uuidTaskInstall,
                    files: libs.ld,
                    display: {
                        title: data?.name + ' - Téléchargements des librairies',
                        subtitle: ' - '
                    }
                }
                await invoke('update_task', task);
                await invoke('start_task', { uuid: task.uuid })
                await invoke('update_task', taskEmptyLoader({ uuid: task.uuid, title: 'Préparation du client' }));
                await getClient(infosVersionManifest.current).then(async (client) => {
                    task = {
                        taskType: 1,
                        uuid: uuidTaskInstall,
                        files: client,
                        display: {
                            title: data?.name + ' - Téléchargements du client',
                            subtitle: ' - '
                        }
                    }
                    await invoke('update_task', task);
                    await invoke('start_task', { uuid: task.uuid })
                    if (data?.game_type == "vanilla") {
                        console.log('GAME READY')
                        updateStateProfileGame(3)
                    } else if (data?.game_type == "fabric") {
                        await invoke('update_task', taskEmptyLoader({ uuid: task.uuid, title: 'Préparation de Fabric' }));
                        console.log('Prepare for fabric version')
                        installFabricVersion(task)
                    }
                })
            })*/
            /*task.start().then(async () => {
                console.log('Assets downloaded')
                console.log('Prepare download librairies')
                await getLibs(infosVersionManifest.current).then((libs) => {
                    task.constUpdate({
                        type: 2,
                        uuidDl: uuidTaskInstall,
                        files: libs.ld,
                        prefix: `${data.name} - Libraries`,
                    })
                    task.start().then(async (result) => {
                        console.log('Librairies downloaded')
                        console.log('Extract natives')
                        task.constUpdate({
                            type: 3,
                            uuidDl: uuidTaskInstall,
                            files: libs.nd,
                            dirServer: await join(await getDirectory(), "natives"),
                            prefix: "Extraction des fichiers natives",
                            update: false
                        })
                        task.start().then(async () => {
                            console.log('Extracted natives finished')
                            await getClient(infosVersionManifest.current).then((client) => {
                                task.constUpdate({
                                    type: 2,
                                    uuidDl: uuidTaskInstall,
                                    files: client,
                                    lastTask: true,
                                    prefix: `${data.name} - Client`,
                                })
    
                                task.start().then(async (result) => {
    
                                    if (data?.game_type == "vanilla") {
                                        console.log('GAME READY')
                                        updateStateProfileGame(3)
                                    } else if (data?.game_type == "fabric") {
                                        console.log('Prepare for fabric version')
                                        installFabricVersion(task)
                                    }
                                }).catch((err) => {
                                    console.error(err)
                                })
                            })
                        })
    
                    })
                })
            })
        })*/
    }

    const installFabricVersion = async (task) => {
        const host = "https://maven.fabricmc.net/"
        const resolveMavenArtifact = async (mv) => {
            const mavenSplit = mv.split(':')
            const mavenPackage = mavenSplit[0].replaceAll('.', '/');
            const mavenArtifact = mavenSplit[1];
            const mavenVersion = mavenSplit[2];
            const jarFile = mavenArtifact + '-' + mavenVersion + '.jar';
            const url = host + mavenPackage + '/' + mavenArtifact + '/' + mavenVersion + '/' + jarFile;
            return { url: url, file: jarFile };
        }
        const getLoaderFabric = async () => {
            return new Promise(async (resolve, reject) => {
                const directoryRoot = await getDirectory();
                const libsDir = await join(directoryRoot, "libraries");
                if (!await exists(libsDir)) createDir(libsDir);

                await axios.get('https://meta.fabricmc.net/v2/versions/loader/' + data.game.version)
                    .then(async (response) => {
                        const files = [];
                        const loaderTarget = response.data[0];

                        const loaderFabric = await resolveMavenArtifact(loaderTarget.loader.maven);
                        files.push({
                            url: loaderFabric.url,
                            file: loaderFabric.file,
                            path: await join(libsDir),
                            hash: null
                        })

                        const intermediaryFabric = await resolveMavenArtifact(loaderTarget.intermediary.maven);
                        files.push({
                            url: intermediaryFabric.url,
                            file: intermediaryFabric.file,
                            path: await join(libsDir),
                            hash: null
                        })

                        for await (const lib of loaderTarget.launcherMeta.libraries.common) {
                            const fileResolve = await resolveMavenArtifact(lib.name);
                            console.log(fileResolve)
                            files.push({
                                url: fileResolve.url,
                                file: fileResolve.file,
                                path: await join(libsDir),
                                hash: lib.sha1
                            })
                        }

                        let task_fabric = {
                            taskType: 1,
                            uuid: task.uuid,
                            files: files,
                            display: {
                                title: data?.name + ' - Téléchargements de Fabric',
                                subtitle: ' - '
                            }
                        }
                        await invoke('update_task', task_fabric);
                        await invoke('start_task', { uuid: task_fabric.uuid })

                        console.log('Fabric downloaded')
                        console.log('GAME READY')
                        updateStateProfileGame(3)
                    })
            })
        }
        await getLoaderFabric();

    }

    const launchGame = async () => {
        if (!isConnected.current) return FzToast.error('Vous devez être connecté pour lancer le jeu')
        const ivm = infosVersionManifest.current;
        const directoryRoot = await getDirectory();
        const jarFile = await join(directoryRoot, data.game_type == "custom" ? data.game.clientJarName : "minecraft.jar")
        const gameDir = await join(directoryRoot)
        const assetsDir = await getAssetsDirectory();
        const runtimeDir = await getRuntimeDirectory();
        const libsDir = await join(directoryRoot, "libraries")
        const nativesDir = await join(directoryRoot, "natives")
        fzContext.instance.launched = true;
        updateButton(false, "Jeu en cours..", () => { })
        await invoke('launch_minecraft', { data: data, assetIndex: ivm.assetIndex.id, minecraftArgs: ivm.minecraftArguments, minecraftJarPath: jarFile, gameDir: gameDir, runtimeDir: runtimeDir, assetsDir: assetsDir, nativesDir: nativesDir, libsDir: libsDir })
        updateButton(true, "Jouer", launchGame)
    }

    const stopInstance = async () => {
        if (pid_instance.current == null) return;
        await invoke('kill_process_command', { pid: pid_instance.current })
    }
    /*
    <div className="flex flex-col px-10 pt-10 w-full" style={{ }}>
                <div className="flex flex-col w-[38rem] gap-4">
                    <div className="px-8 pt-8 flex gap-4 items-center">
                        <img width={64} src={data?.icon} alt="" />
                        <span className='text-[24px] font-bold'>{data?.name}</span>
                    </div>
                    <span className='px-8 text-[20px] text-white'>{data?.description}</span>
                </div>
                <div className="flex justify-center mt-10">
                    <SuperButton id="btnDLGFirst" className="disabled" disabled={!button.state} onClick={() => { button.callback() }} text={button.label} />
                </div>
            </div>
            */

    const TabItem = ({ tab }) => {
        const isActive = tab.key == tabCurrent
        return (
            <div onClick={() => setTab(tab.key)} style={{ boxShadow: isActive ? '0px 4px 4px 0px rgba(0, 0, 0, 0.25)' : 'none' }} className={`cursor-pointer ${isActive ? 'bg-[#494C53]' : 'bg-[var(--fzbg-1)]'} transition-all flex px-6 py-3 rounded-lg text-white text-[16px] font-bold h-[48px] items-center`}>
                {tab.name}
            </div>
        )
    }

    let tabTarget = tabs.find((t) => t.key == tabCurrent)

    return (
        <>
            <div className="profile_game_content flex flex-col gap-4 px-6 pt-6 pb-4 w-full" style={{ borderRadius: '0px' }}>
                <div className="flex justify-between py-0 items-center">
                    <div className="flex items-center gap-4">
                        <div className="icon_profile_game">
                            <img src={icon} onError={() => setIcon(DefaultIcon)} style={{ width: 64, height: 64, objectFit: 'cover' }} alt={data?.id} />
                        </div>
                        <div className="flex flex-col">
                            <span className='text-[24px] font-bold'>{data?.name}</span>
                            <span className='text-[16px] font-light'>{data?.game_type.charAt(0).toUpperCase() + data?.game_type.slice(1)} {data?.game?.version}</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {tabsList.map((tab, _) => {
                            return (
                                <TabItem key={tab.key} tab={tab} />
                            )
                        })}
                    </div>
                </div>
                <div className="content overflow-y-auto flex-1">
                    {tabTarget !== undefined && tabTarget?.component}
                </div>
                <div className="flex justify-center relative h-[84px]">
                    <div className="flex absolute py-2 justify-center h-full gap-6 w-[484px]">
                        <button onClick={async () => {
                            FzToast.info('Ouverture du dossier du profil de jeu')
                            await invoke('open_directory', { path: await getDirectory() })
                        }} className='testbutton left-0 gap-0 rounded-full overflow-hidden text-center flex w-[68px] h-[68px]' style={{ padding: '0', background: 'var(--gradient_purple)' }}>
                            <div className="absolute min-w-[68px] h-full flex justify-center items-center">
                                <DirectoryIcon size={32} />
                            </div>
                            <div className="label flex flex-1 whitespace-nowrap justify-center overflow-hidden text-ellipsis">
                                Fichiers
                            </div>
                        </button>
                        <button onClick={button.callback} disabled={!button.state} className='testbutton w-[284px] rounded-full h-[68px] text-center flex justify-center text-[28px] font-bold uppercase'>{button.label}</button>
                        <Settings dataID={data?.id} />
                    </div>
                    {pid_instance.current &&
                        <button onClick={stopInstance} className='absolute right-0 bottom-0 top-0 my-auto mx-0 gap-0 rounded-full overflow-hidden text-center flex justify-center items-center w-[68px] h-[68px]' style={{ padding: '0', background: 'var(--gradient_red)' }}>
                            <FaStop color='white' size={32} />
                        </button>
                    }
                </div>
            </div>
            <style>
                {`
                .testbutton {
                    position:absolute;
                    transition: all 0.25s ease-in-out;
                }
                .testbutton .label {
                    opacity: 0;
                    text-transform: uppercase;
                    color: white;
                    transition: all 0.25s; 
                }
                .testbutton:disabled {
                    background: var(--btn-gradient-disable);
                }
                .testbutton:not(:disabled):hover {
                    width: 100.9%;
                    animation: example 1s forwards;
                    transition: all 0.25s; 
                }
                .testbutton:hover .label {
                    opacity: 1;
                }
                .testbutton:not(:hover) {
                    animation: example-reverse 1s forwards;
                }
                @keyframes example {
                    0% {
                        z-index: 1;
                    }
                    1% {
                        z-index: 999;
                    }
                    100% {
                        z-index: 999;
                    }
                }
                @keyframes example-reverse {
                    0% {
                        z-index: 999;
                    }
                    1% {
                        z-index: 999;
                    }
                    100% {
                        z-index: 1;
                    }
                }
                `}
            </style>
        </>
    )

}