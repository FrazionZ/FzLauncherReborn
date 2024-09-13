import { useEffect, useState } from "react";
import { useFzContext } from "../FzContext";
import windowClose from '../assets/img/icons/window_close.svg'
import { Dialog } from "primereact/dialog";
import backgroundProfile from '../assets/img/wallpaper.png'
import microsoftIcon from '../assets/img/microsoft.png'
import FzToast from "./FzToast";
import { invoke } from "@tauri-apps/api/tauri";
import { ProgressSpinner } from 'primereact/progressspinner';


export default function UserComponent() {


    const fzContext = useFzContext();
    const [showProfile, setShowProfile] = useState(false);
    const [isConnected, setIsConnected] = useState(fzContext.sessionMSA.auth !== undefined);
    const [processAuth, setProcessAuth] = useState(false)
    const [profiles, setProfiles] = useState([])

    useEffect(() => {
        setIsConnected(fzContext.sessionMSA.auth !== undefined)
    }, [fzContext.sessionMSA.auth])

    const startMSA = () => {
        setProcessAuth(true)
        invoke('authenticate_microsoft', { source: 'add_account' }).then(async (response) => {
            console.log('Response: ', response)
            await invoke('create_session', { sessionId: "msa_session", mcSession: response })
            await fzContext.sessionMSA.update()
            FzToast.success(`Bienvenue ${response.mcProfile.name} !`)
            await invoke('add_profile', { name: response.mcProfile.name, id: response.mcProfile.id, refreshToken: response.refreshToken })
        })
            .catch((err) => {
                FzToast.error("Une erreur est survenue lors de la connexion à Microsoft")
            })
            .finally(() => {
                setProcessAuth(false)
                refreshListProfiles()
            })
    }

    const refreshMSA = async (refresh_token) => {
        await disconnectMSA();
        setProcessAuth(true)
        invoke('authenticate_microsoft', { source: 'refresh_account', dataSource: refresh_token }).then(async (response) => {
            console.log('Response: ', response)
            await invoke('create_session', { sessionId: "msa_session", mcSession: response })
            await fzContext.sessionMSA.update()
            FzToast.success(`Bienvenue ${response.mcProfile.name} !`)
            await invoke('add_profile', { name: response.mcProfile.name, id: response.mcProfile.id, refreshToken: response.refreshToken })
            setProcessAuth(false)
        })
            .catch((err) => {
                startMSA()
                FzToast.error("Une erreur est survenue lors de la connexion à Microsoft")
            }) 
    }

    useEffect(() => {
        refreshListProfiles()
    }, [])

    const refreshListProfiles = async () => {
        const profiles = await invoke('get_profiles', {})
        setProfiles(profiles)
    }

    const disconnectMSA = async () => {
        await fzContext.sessionMSA.disconnect()
    }

    return (
        <>
            <div className={`${processAuth ? "cursor-default" : "cursor-pointer"} flex items-center justify-center w-fit gap-4 px-6 py-2 rounded-lg`} onClick={() => setShowProfile(true)} style={{ background: isConnected && !processAuth ? 'var(--btn-gradient)' : 'var(--fzbg-1)' }}>
                <div className="flex items-center">
                    <img title={fzContext.sessionMSA?.auth?.name} style={{ width: '32px', height: '32px' }} className="rounded-lg" src={`https://mc-heads.net/head/${isConnected ? fzContext.sessionMSA?.auth?.id : '37bb12418e4842c38f649cecc340eefe'}/100`} alt="" />

                </div>
                <div className="flex-1 flex justify-center">
                    <span className={`text-[16px] font-bold`} style={{ color: isConnected && !processAuth ? 'var(--btn-text)' : '#ffffff' }}>
                        {processAuth ? "Authentification.." : isConnected ? fzContext.sessionMSA?.auth?.name : "Se connecter"}
                    </span>
                </div>
            </div>

            <Dialog header="" visible={showProfile} className="flex flex-col" closable={false} maskStyle={{ backdropFilter: 'blur(15px)' }} headerStyle={{ background: "var(--fzbg-4)" }} contentClassName="flex-1" contentStyle={{ display: 'flex', flexDirection: 'column', background: "var(--fzbg-4)", flex: '1 1 0' }} position={"right"} style={{ borderColor: 'transparent', width: '60vw', height: '100vh', position: 'absolute', right: '34px' }} onHide={() => { if (!showProfile) return; setShowProfile(false); }} draggable={false} resizable={false}>
                {processAuth ?
                    <div className="flex flex-col gap-8 h-full justify-center items-center">
                        <ProgressSpinner style={{ width: '80px', height: '80px' }} strokeWidth="8" animationDuration=".5s" />
                        <div className="flex gap-2 flex-col items-center">
                            <span className="text-[24px] font-bold">Connexion en cours</span>
                            <span className="text-[16px] font-light">Nous chargeons les données de la session..</span>
                        </div>
                    </div>
                    :
                    <>
                        <div className="lmclose" onClick={() => { setShowProfile(false) }}>
                            <img src={windowClose} width={18} height={18} alt="" />
                        </div>
                        <div className="userCard flex flex-col rounded-lg overflow-hidden h-[300px]">
                            <div className="skin flex-1 flex justify-center relative overflow-hidden" style={{ background: `url(${backgroundProfile})`, height: '250px', backgroundSize: 'cover' }}>
                                <img className="absolute top-[50px]" style={{ width: '236px', height: '408px' }} src={`https://starlightskins.lunareclipse.studio/render/dungeons/${isConnected ? fzContext.sessionMSA?.auth?.id : "steve"}/full`} alt="" srcset="" />
                            </div>
                            <div className="h-16 bg-[var(--fzbg-1)] flex justify-center items-center">
                                <span className="text-xl font-bold">
                                    {isConnected ? fzContext.sessionMSA?.auth?.name : "Non connecté"}
                                </span>
                            </div>
                        </div>
                        <div className="listProfile flex gap-6 mt-6 flex-col h-full overflow-y-auto flex-1">
                            {profiles.map((profile, _) => {
                                const isActive = fzContext.sessionMSA.auth?.id == profile?.id;
                                return (
                                    <div key={_} onClick={() => {
                                        refreshMSA(profile.refresh_token);
                                    }} className="flex rounded-[4px] justify-between items-center px-6 bg-[var(--fzbg-1)] h-[64px]">
                                        <div className="flex gap-4">
                                            <div className="avatar">
                                                <img className="rounded-md" width={24} height={24} src={`https://mc-heads.net/avatar/${profile.id}/50`} />
                                            </div>
                                            <span>{profile.name}</span>
                                        </div>
                                        <div className="px-4 py-2 rounded-[4px] text-[14px] font-medium" style={{ background: isActive ? 'var(--gradient_green)' : 'var(--gradient_red)' }}>
                                            {isActive ? "Active" : "Inactive"}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex w-full justify-center gap-2">
                            <button className="default" onClick={startMSA}>
                                <img src={microsoftIcon} alt="" srcset="" />
                                <span>Ajouter un Compte Microsoft</span>
                            </button>
                            {isConnected &&
                                <button className="danger" onClick={disconnectMSA}>
                                    <span>Déconnexion</span>
                                </button>
                            }
                        </div>
                    </>
                }
            </Dialog>
        </>
    )

}