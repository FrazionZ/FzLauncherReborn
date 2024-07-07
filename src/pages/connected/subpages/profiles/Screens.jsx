import { readDir, BaseDirectory, exists } from "@tauri-apps/api/fs"
import { join } from "@tauri-apps/api/path"
import { useEffect, useState } from "react"
import { useFzContext } from "../../../../FzContext"
import windowClose from '../../../../assets/img/icons/window_close.svg'
import { invoke } from "@tauri-apps/api/tauri";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from 'primereact/progressspinner';
import { MdOutlineError } from "react-icons/md";
import { HiOutlineCubeTransparent } from "react-icons/hi2";

export default function Screens({ data }) {

    const fzContext = useFzContext();
    const [screens, setScreens] = useState([])
    const [screenSelect, setScreenSelect] = useState(undefined);
    const [load, setLoad] = useState(false)
    const [error, setError] = useState(undefined)

    const getDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherMCVersions, data?.id, 'screenshots')
    }

    useEffect(() => {
        init()
    }, [])

    const init = async () => {
        try {
            const dirExists = await exists(await getDirectory());
            if (!dirExists) {
                setLoad(true)
                return;
            }
            const entries = await readDir('MCVersions/' + data?.id + '/screenshots', { dir: BaseDirectory.AppData, recursive: true });
            for await (const screen of entries) {
                screen.base64 = await invoke('get_base64_from_file', { path: screen.path })
            }
            setScreens(entries)
        } catch (err) {
            setError(err)
        } finally {
            setLoad(true)
        }
    }

    return (
        <div className="flex flex-wrap gap-6 h-full">
            {!load ?
                <div className="flex flex-col gap-4 w-full h-full justify-center items-center">
                    <ProgressSpinner style={{ width: '80px', height: '80px' }} strokeWidth="8" animationDuration=".5s" />
                    <div className="flex flex-col gap-2">
                        <span className="text-center leading-5">Chargement de vos <br /> magnifique screenshots</span>
                    </div>
                </div>
                :
                error ?

                    <div className="flex flex-col gap-8 w-full h-full justify-center items-center">
                        <MdOutlineError size={80} color="var(--color-2)" />
                        <div className="flex justify-center items-center flex-col gap-0">
                            <span className="text-center leading-5">Une erreur s'est produite lors de la lecture de vos screens</span>
                            <span className="text-[14px] text-center font-light whitespace-nowrap overflow-hidden text-ellipsis w-[650px]">{error}</span>
                        </div>
                    </div>
                    :
                    <>
                        {screens.length == 0 ?
                            <div className="flex flex-col gap-8 w-full h-full justify-center items-center">
                                <HiOutlineCubeTransparent size={80} color="var(--color-2)" />
                                <div className="flex justify-center items-center flex-col gap-0">
                                    <span className="text-center leading-5">Aucune captures d'écran trouvée</span>
                                    <span className="text-[14px] text-center font-light whitespace-nowrap overflow-hidden text-ellipsis w-[650px]">On a aucun souvenir à vous monter :(</span>
                                </div>
                            </div>
                            :
                            <>

                                {screens.map((screen, _) => {
                                    return (
                                        <div key={_} onClick={() => { setScreenSelect(screen) }} className="screen hover:scale-110 transition-all">
                                            <img width={200} className="rounded-lg" height={112} src={`data:image/png;base64,${screen.base64}`} />
                                        </div>
                                    )
                                })}
                            </>
                        }
                    </>
            }
            <Dialog header="Header" visible={screenSelect} showHeader={false} maskStyle={{ backdropFilter: 'blur(7.5px)', boxShadow: 'none' }} style={{ border: 'none', boxShadow: 'none' }} contentStyle={{ background: 'transparent', padding: 0, borderRadius: 0, boxShadow: 'none' }} onHide={() => { if (!screenSelect) return; setScreenSelect(undefined); }}>
                <div className="lmclose" onClick={() => { setScreenSelect(undefined) }} style={{ right: '-20px', left: 'auto', top: '-20px' }}>
                    <img src={windowClose} width={18} height={18} alt="" />
                </div>
                <img className="rounded-2xl" src={`data:image/png;base64,${screenSelect?.base64}`} alt="" srcset="" />
                <div className="flex justify-center py-4 gap-4">
                    <button>Partager</button>
                    <button className="danger">Supprimer</button>
                </div>
            </Dialog>
        </div>
    )

}