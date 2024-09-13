import { Dialog } from "primereact/dialog";
import { useState, useEffect } from "react";
import SettingsIcon from '../../../../assets/img/icons/settings'
import windowClose from '../../../../assets/img/icons/window_close.svg'
import { Slider } from "primereact/slider"; 
import { useFzContext } from '../../../../FzContext'
import { LuMemoryStick } from "react-icons/lu";
import { invoke } from "@tauri-apps/api/tauri";
import { join } from "@tauri-apps/api/path";

export default function Settings({ dataID }) {

    const fzContext = useFzContext();
    const [showSettings, setShowSettings] = useState(false) 
    const [settings, setSettings] = useState({
        ramValue: 1
    })

    const getDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherMCVersions, dataID)
    }

    const handle_update = async(key, value) => {
        await invoke('update_config_profile', { filePath: await join(await getDirectory(), 'config.json'), key: key, newValue: value.toString() })
    }

    return (
        <>

            <button onClick={() => { setShowSettings(true) }} className='testbutton right-0 gap-0 rounded-full overflow-hidden text-center flex w-[68px] h-[68px]' style={{ padding: '0', background: 'var(--gradient_blue)' }}>
                <div className="label flex flex-1 whitespace-nowrap justify-center overflow-hidden text-ellipsis">
                    Paramètres
                </div>
                <div className="absolute right-0 min-w-[68px] h-full flex justify-center items-center">
                    <SettingsIcon size={32} />
                </div>
            </button>
            <Dialog header="" visible={showSettings} className="flex flex-col" closable={false} maskStyle={{ backdropFilter: 'blur(15px)' }} headerStyle={{ background: "var(--fzbg-4)" }} contentClassName="flex-1" contentStyle={{ display: 'flex', flexDirection: 'column', background: "var(--fzbg-4)", flex: '1 1 0' }} position={"right"} style={{ borderColor: 'transparent', width: '60vw', height: '100vh', position: 'absolute', right: '34px' }} onHide={() => { if (!showSettings) return; setShowSettings(false); }} draggable={false} resizable={false}>
                <div className="lmclose" onClick={() => { setShowSettings(false) }}>
                    <img src={windowClose} width={18} height={18} alt="" />
                </div>
                <div className="flex flex-col items-center h-full">
                    <div className="flex flex-col items-center w-full h-full gap-6">
                        <div className="title">
                            <h2 className="text-[24px] font-bold">Paramètres</h2>
                        </div>
                        <div className="flex flex-1 gap-4 overflow-y-auto flex-col w-full">
                            <div className="card flex gap-8 items-center" style={{ padding: 12 }}>
                                <div className="flex flex-1 gap-3 items-center">
                                    <div className="icon"><LuMemoryStick size={48} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[18px] font-bold">Allocation de la RAM</span>
                                        <span className="text-[14px] font-light">Vous permet de choisir la ram à alloué à votre instance de jeu</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Slider value={settings.ramValue} min={1} max={16} onChange={(e) => {
                                        handle_update('ram_allocate', e.value)
                                        setSettings({ ...settings, ramValue: e.value })
                                    }} className="w-14rem" />
                                    <span style={{ width: 50, textAlign: 'center' }}>{settings.ramValue} Go</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Dialog>

            <style>
                {`
                    div[data-pc-name="slider"][data-pc-section="root"] {
                        background: var(--fzbg-4);
                        border-radius: 8px;
                    }
                    span[data-pc-section="range"] {
                        border-radius: 4px;
                        background: var(--gradient) !important;
                    }
                    div[data-pc-name="slider"] span[data-pc-section="handle"] {
                        border-color: var(--color-2);
                        background: var(--color-2) !important;
                    }
                    div[data-pc-name="slider"] span[data-pc-section="handle"]:hover {
                        background: var(--color-2) !important;
                    }
                `}
            </style>
        </>
    )

} 