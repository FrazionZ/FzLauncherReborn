import { readDir, BaseDirectory, exists } from "@tauri-apps/api/fs"
import { join } from "@tauri-apps/api/path"
import { useEffect, useReducer, useRef, useState } from "react"
import { useFzContext } from "../../../../FzContext"
import windowClose from '../../../../assets/img/icons/window_close.svg'
import { invoke } from "@tauri-apps/api/tauri";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from 'primereact/progressspinner';
import { MdOutlineError } from "react-icons/md";
import { HiOutlineCubeTransparent } from "react-icons/hi2";
import { listen } from "@tauri-apps/api/event"
import { Terminal } from 'primereact/terminal';
import MineParse from '../../../../components/MineParse'
import mccolors from 'minecraft-colors'; 
import '../../../../assets/css/MinecraftText.css'

export default function Console({ data, pid }) {

    const fzContext = useFzContext();
    const [screens, setScreens] = useState([])
    const [screenSelect, setScreenSelect] = useState(undefined);
    const [load, setLoad] = useState(false)
    const [error, setError] = useState(undefined)
    const logs = useRef([])
    const [, forceUpdate] = useReducer((x) => x + 1, 0)
    const messagesEndRef = useRef(null);
    const mineParse = new MineParse()

    useEffect(() => {
        let unlistenConsoleInstance = () => { };
        init().then(async () => {
            unlistenConsoleInstance = await listen('console-game-profile-frazionz-' + pid, async (event) => {
                if (logs.current.length >= 100) {
                    logs.current.shift(); // Supprime le premier élément
                }
                logs.current.push(event.payload)
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
                forceUpdate()
            });
        })
        return () => {
            unlistenConsoleInstance();
        }
    }, [])

    const init = async () => {
        return new Promise(async (resolve, reject) => {
            return resolve()
        })
    }

    return (
        <div className="logs bg-[var(--fzbg-1)]  flex flex-col   w-full h-full rounded-lg p-4 overflow-y-auto">
            <div className="flex flex-col w-full text-wrap overflow-y-auto overflow-x-hidden">
                <div className="flex-1">
                    {logs.current.map((s, _) => {
                        return (
                            <div key={_} className="flex w-full">
                                <span>{mineParse.transformToMinecraftColor(s)}</span><br />
                            </div>
                        )
                    })}
                </div>
                <div ref={messagesEndRef} />
            </div>
        </div>
    )

}