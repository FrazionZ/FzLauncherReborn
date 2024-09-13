import React, { useState } from 'react'
import { FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa'
import logo from '../assets/img/icons/fz_logo.svg'
import FzToast from '../components/FzToast'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useFzContext } from '../FzContext';
import { ProgressSpinner } from 'primereact/progressspinner'
import { invoke } from '@tauri-apps/api/tauri'
/*const Store = require('electron-store')
const store = new Store()*/ 

export default function Login(props) {

  const fzContext = useFzContext();
  const [location, setLocation] = useLocation();
  /*const auth = new Authentication()
  const fzContext = useFzContext();
  const fzProfile = new FzProfile()
  const [session, setSession] = useState(JSON.parse(sessionStorage.getItem('mcProfile')))
  const lastProfileID = fzContext.fzVariable.store.has('lastProfileID') ? fzProfile.getProfileFromID(fzContext.fzVariable.store.get('lastProfileID')) : undefined*/

  /*function startLogProfileFromToken() {
    if (!fzContext.fzVariable.store.get("launcher__logauto", true)) return setLocation('/connected')
    if (lastProfileID == undefined) return setLocation('/connected')
    const checkSession = sessionStorage.getItem('mcProfile')
    if (checkSession !== null) return setLocation('/connected')
    auth.logProfileFromToken(lastProfileID).then(() => {
      setLocation('/connected')
      finish(true)
    }).catch((err) => {
      setLocation('/connected')
      console.log(err)
      FzToast.error('Une erreur est survenue lors de la connexion au compte..')
    })
  }

  function finish(refreshSession) {
    setSession(JSON.parse(sessionStorage.getItem('mcProfile')))
    ipcRenderer.send('refreshSession', { bool: refreshSession });
    ipcRenderer.send('sendLateralModal', { state: 'close' })
  }

  useEffect(() => {
    startLogProfileFromToken()
  }, [])*/

  const autoConnect = async() => {
    const profiles = await invoke('get_profiles', {})
    if (profiles.length > 0) {
      refreshMSA(profiles[0].refresh_token)
    }else{
      setLocation('/connected')
    }
  }

  useEffect(() => { 
    autoConnect()
  }, [])

  const refreshMSA = async(refresh_token) => { 
    invoke('authenticate_microsoft', { source: 'refresh_account', dataSource: refresh_token }).then(async (response) => {
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
          setLocation('/connected')
        })
  }

  return (
    <div className="flex h-full flex-col items-center justify-center w-full text-white">
      <div className="flex flex-col items-center justify-center gap-[6rem]">
        <ProgressSpinner style={{width: '80px', height: '80px'}} strokeWidth="4" fill="transparent" color='white' animationDuration=".5s" />
        <div className="flex gap-[1.4rem] items-center justify-center flex-col">
          <div className="flex flex-col gap-2">
            <h6 className='text-center text-2xl leading-3 font-bold'>Connexion à votre profil Minecraft..</h6>
            <h6 className='flex items-center gap-2 text-center text-md font-extralight'>Veuillez ne pas fermer  le launcher pendant la connexion</h6>
          </div>
          <hr className='w-full' />
          <div className="flex items-center gap-4">
            <div className="avatar">
              <img src="https://mc-heads.net/head/SunshineDev/right" className='w-16 h-16' alt="head_profile" />
            </div>
            <div className="flex flex-col">
              <span className='text-[20px] font-medium'>Bonjour <span className='font-bold'>USERNAME</span> !</span>
              <span className='text-[14px] font-extralight'>Dernière connexion le XX/XX/XXXX</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  )
}
