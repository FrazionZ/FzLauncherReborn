// MyContext.js
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import FzVariable from './components/FzVariable';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import axios from 'axios';
import { exists } from '@tauri-apps/api/fs';
import { join } from '@tauri-apps/api/path';
import GameManager from './utils/GameManager';
// Créer le contexte
const FzContext = createContext();

// Créer un fournisseur personnalisé pour le contexte
export function FzContextProvider({ children }) {

    const [session, setSession] = useState(null)
    const [profilesGameInternal, setProfilesGameInternal] = useState([])
    const [profilesGameCustom, setProfilesGameCustom] = useState([])
    const [tasks, setTasks] = useState([])
    const [contextInit, setContextInit] = useState(false)
    const [classInstance, setClassInstance] = useState(null);
    const gameManager = useRef(new GameManager())
    const versionsMojang = useRef([]);
    const instanceLaunched = useRef(false);

    const addTask = (task) => {
        const copyTasks = [...tasks];
        copyTasks.push(task);
        setTasks(copyTasks);
    }

    useEffect(() => {
        let unlistenDownloadTasks = undefined
        let unlistenExtractTasks = undefined
        async function initializeClass() {
            setSession(await invoke('get_session', { sessionId: "msa_session" }))
            const instance = new FzVariable();
            await instance.init();
            setClassInstance(instance);

            await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')
                .then((response) => {
                    if (!response.data.versions) return;
                    versionsMojang.current = response.data.versions
                })

            await loadProfilesGame()

            await gameManager.current.register();

            setContextInit(true)
            unlistenDownloadTasks = await listen('download-progress-frazionz', (event) => {
                /*const copyTask = [...tasks];
                const task = copyTask.find((task) => task.uuidDl == event.payload.uuid_download);
                if(task) {
                    task.state.percentage = event.payload.percentage;
                }
                setTasks(copyTask);*/
            });

            unlistenExtractTasks = await listen('extract-progress-frazionz', (event) => {
                /*const copyTask = [...tasks];
                const task = copyTask.find((task) => task.uuidDl == event.payload.uuid_extract);
                if(task) {
                    task.state.file = event.payload.file_name;
                    task.state.percentage = event.payload.percentage;
                }
                setTasks(copyTask);*/
            });


        }

        initializeClass();

        return () => {
            if (unlistenDownloadTasks) unlistenDownloadTasks();
            if (unlistenExtractTasks) unlistenExtractTasks();
        };
    }, []);

    const loadProfilesGame = async() => {
        const listProfilesGameInternal = await invoke('get_profiles_game');
        const listProfilesGameCustom = await invoke('get_profiles_game_user');
        for await (const profile of listProfilesGameCustom) {
            if(profile.icon !== "default") {
                const isExist = await exists(await join(profile.icon));
                if(!isExist) profile.icon = "default";
            }
            listProfilesGameInternal.push(profile)
        }
        setProfilesGameInternal(listProfilesGameInternal)
    }

    const updateSession = async () => {
        return new Promise(async (resolve, reject) => {
            const sessionMSA = await invoke('get_session', { sessionId: "msa_session" })
            console.log('Update Session: ', sessionMSA)
            setSession(sessionMSA)
            return resolve()
        })
    }

    const disconnectSession = async () => {
        return new Promise(async (resolve, reject) => {
            setSession(null)
            await invoke('delete_session', { sessionId: "msa_session" })
            return resolve()
        })
    }

    return (
        <FzContext.Provider value={{ tasks: tasks, instance: { launched: instanceLaunched.current }, gameManager: gameManager.current, mojang: { versions: versionsMojang.current }, sessionMSA: { auth: session?.mcProfile, update: updateSession, disconnect: disconnectSession }, loadProfilesGame: loadProfilesGame, profilesGameInternal: profilesGameInternal, profilesGameCustom: profilesGameCustom, functionTask: { add: addTask }, contextInit: contextInit, fzVariable: classInstance }}>
            {children}
        </FzContext.Provider>
    );

}

export function useFzContext() {
    return useContext(FzContext);
}

