import React, { useState } from 'react'
import { FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa'
import logo from '../assets/img/icons/fz_logo.svg'
import FzToast from '../components/FzToast'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useFzContext } from '../FzContext';

/*const Store = require('electron-store')
const store = new Store()*/ 

export default function Login(props) {

  const [location, setLocation] = useLocation();
  const auth = new Authentication()
  const fzContext = useFzContext();
  const fzProfile = new FzProfile()
  const [session, setSession] = useState(JSON.parse(sessionStorage.getItem('mcProfile')))
  const lastProfileID = fzContext.fzVariable.store.has('lastProfileID') ? fzProfile.getProfileFromID(fzContext.fzVariable.store.get('lastProfileID')) : undefined

  function startLogProfileFromToken() {
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
  }, [])



  return (
    <div className="login">
      <div className="flex flex-col items-center justify-center gap-[4rem]">
        <div className="loader-3"></div>
        <div className="flex gap-[1rem] items-center justify-center flex-col">
          <h6 className='text-center text-2xl'>Connexion automatique <br />à votre compte Microsoft..</h6>
          <h6 className='flex items-center gap-2 text-center text-xs'>Veuillez ne pas fermer <br />le launcher pendant la connexion !</h6>
        </div>
      </div>
    </div>

  )
}
