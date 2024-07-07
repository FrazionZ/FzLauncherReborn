import {
  checkUpdate,
  installUpdate,
  onUpdaterEvent,
} from '@tauri-apps/api/updater'
import { relaunch } from '@tauri-apps/api/process'
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { javaversion } from '../Utils'
import { useFzContext } from '../FzContext';
import { appDataDir, join } from '@tauri-apps/api/path';
let branch

function Updater() {

  const fzContext = useFzContext()
  const [location, setLocation] = useLocation();
  const [stateUpdate, setStateUpdate] = useState("Recherche de mises à jours..")
  useEffect(() => {
    const initUnlistenUpdater = init()
    return () => (
      initUnlistenUpdater
    );
  }, [])

  const init = async() => {
    const jv = await javaversion(await join(await appDataDir(), 'Launcher', 'runtime', 'bin', 'java'))
    const unlisten = await onUpdaterEvent(({ error, status }) => {
      console.log('Updater event', error, status)
    })
    try {
      const { shouldUpdate, manifest } = await checkUpdate()
    
      if (shouldUpdate) {
        console.log(
          `Installing update ${manifest?.version}, ${manifest?.date}, ${manifest?.body}`
        )

        setStateUpdate('Mise à jour disponible, installation en cours..')
        await installUpdate()
      }else{
        setLocation(jv == "no install" ? '/runtime' : '/connected')
      }
    } catch (error) {
      setLocation(jv == "no install" ? '/runtime' : '/connected')
    }
    return unlisten;
  } 

  return (
    <div className="updater flex align-center justify-center h-[inherit]">
      <div className="flex items-center justify-center gap-30">
        <div className="loader-3"></div>
        <div className="flex flex-col gap-1 w-75">
          <div className="flex gap-10 align-end">
            <h6 id="downloadhtml">{stateUpdate}</h6>
            <h5 id="downloadpercent"></h5>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Updater
