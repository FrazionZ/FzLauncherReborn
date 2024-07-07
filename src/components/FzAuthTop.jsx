import { useState, useEffect } from 'react';
import FzVariable from './FzVariable';
import FzToast from './FzToast';
import { useLocation } from 'wouter';
//import { ipcRenderer } from 'electron';

export default function FzAuthTop() {


    const auth = new Authentication();
    const [isOpen, setIsOpen] = useState(false);
    const [session, setSession] = useState(JSON.parse(sessionStorage.getItem('mcProfile')))
 
    const [location, setLocation] = useLocation();

    function refreshSession(bool) {
        const rfSession = JSON.parse(sessionStorage.getItem('mcProfile'));
        setSession(rfSession);
        if (bool) {
            fzVariable.store.set('lastProfileID', rfSession.logProfile.mcProfile.id)
            FzToast.success('Connecté en tant que ' + rfSession.logProfile.mcProfile.name)
        }
    }

    function closeConsentModal() {
        setIsOpen(false);
    }

    async function openConsentModal() {
        await setIsOpen(true);
    }

    /*ipcRenderer.removeAllListeners('refreshSession')
    ipcRenderer.on('refreshSession', (e, args) => {
        refreshSession(args.bool)
    })*/

    const appPageCurrent = sessionStorage.getItem('appPageCurrent')
    const showButtonAuth = location.pathname == "/connected"
    
    return (
        <>
            
            <a onClick={() => {
                /*ipcRenderer.send('sendLateralModal',
                    {
                        id: 'profiles',
                        title: 'Profiles',
                        state: 'open'
                    }
                )*/
            }} className={`btn auth ${session == null ? "disconnect" : "connected"} ${showButtonAuth ? "" : "hidden"}`}>
                {session == null &&
                    <>
                        <img src={"https://mc-heads.net/head/MHF_Steve"} alt="avatar" />
                        <span>Se connecter</span>
                    </>
                }
                {session !== null &&
                    <>
                        <img src={`https://mc-heads.net/head/${session.logProfile.mcProfile.id}`} alt="avatar" />
                        <span>{session.logProfile.mcProfile.name}</span>
                    </>
                }
            </a>
        </>
    )



}