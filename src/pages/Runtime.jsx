import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import FzVariable from '../components/FzVariable'
import Task from '../components/Task'
import { v4 as uuidv4 } from 'uuid'
import { join, resolve } from '@tauri-apps/api/path'
import { removeDir, removeFile } from '@tauri-apps/api/fs'
import { useLocation } from 'wouter'
import { useFzContext } from '../FzContext'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/tauri'
import { ProgressSpinner } from 'primereact/progressspinner'
import { javaversion } from '../Utils'
let task
let uuid
//https://cdn.azul.com/zulu/bin/zulu8.66.0.15-ca-jre8.0.352-win_x64.zip

export default function Runtime(props) {

  const [output, setOutput] = useState([]);
  const [uuidTask, setUuuidTask] = useState(null)
  const fzContext = useFzContext();
  const [prefix, setPrefix] = useState("Téléchargement de Java")
  const [alreadyInit, setAlreadyInit] = useState(false)
  const [location, setLocation] = useLocation()

  const init = async () => {
    try {
      if (uuidTask !== null) return;
      javaversion(await join(fzContext.fzVariable.dirFzLauncherDatas, 'runtime', 'bin', 'java')).then(async(version) => {
        if(version !== "no install") {
          setLocation('/connected')
        }else{
          const dirRuntime = await join(fzContext.fzVariable.dirFzLauncherRuntime)
          uuid = uuidv4()
          setUuuidTask(uuid)
          console.log('BeforeTask', fzContext)
          task = new Task({
            type: 0,
            uuidDl: uuid,
            installerfileURL: 'https://download.frazionz.net/java/java-jdk-21.zip', //This is Java 21
            installerfilename: await join(dirRuntime, 'java.zip'),
            prefix: "Téléchargement de Java",
            update: false
          })
          fzContext.functionTask.add(task)
          task.start().then(async () => {
            task.constUpdate({
              type: 1,
              uuidDl: uuid,
              fileZipDepend: await resolve(dirRuntime, 'java.zip'),
              dirServer: await resolve(dirRuntime),
              target_folder: 'zulu21.34.19-ca-jre21.0.3-win_x64',
              prefix: "Extraction de Java",
              update: false
            })
            setPrefix("Extraction de Java")
            task.start().then(async () => {
              await removeFile(await resolve(dirRuntime, 'java.zip'))
              console.log('Navigate to connected')
              setLocation('/connected')
            })
          })
        }
      }) 
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {

  }, [fzContext.tasks])

  useEffect(() => {
    if (fzContext.contextInit) {
      init()
    }
  }, [fzContext.contextInit])

  let task = fzContext.tasks.find((task) => task.uuidDl == uuidTask)

  return (
    <div className="fz-h-100 flex flex-col items-center justify-center gap-30">
      <div className="flex content gap-8 align-center px-[4rem]">
        <div className="flex">
          <ProgressSpinner style={{ width: '60px', height: '60px' }} strokeWidth="8" animationDuration=".5s" />
        </div>
        <div className="flex direct-column gap-10 actionsText items-start w-full">
          <div className="flex w-full items-end justify-between">
            <div className="flex flex-col gap-1 text-white">
              <h4 className="text-[20px] font-bold" id="download-label">{prefix}</h4>
              <h4 className="text-[14px] font-light" style={{ width: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} id="download-label">
                Veuillez patienter..
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
