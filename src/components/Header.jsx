import React, { useEffect, useRef, useState } from 'react'

import { appWindow } from '@tauri-apps/api/window';
import FzPackage from '../../package.json'
import logo from '../assets/img/icons/fz_logo.svg'
import windowReduce from '../assets/img/icons/window_reduce.svg'
import windowMax from '../assets/img/icons/window_max.svg'
import windowClose from '../assets/img/icons/window_close.svg'
import FzToast from './FzToast'
import FzAuthTop from './FzAuthTop'
import LateralModal from './LateralModal'
import UserComponent from './UserComponent'
import DoubleClickComponent from './DoubleClickComponent';
import { exit } from '@tauri-apps/api/process';
import { useLocation } from 'wouter';
const Header = (props) => {

  const [location, setLocation] = useLocation()
  const [startX, setStartX] = useState(null);
  const [startY, setStartY] = useState(null);
  let clickCount = 0;
  let timeout;

  const toggleReduceApp = async() => {
    await appWindow.minimize();
  }

  const toggleMaximizeApp = async() => {
    const isMaximized = await appWindow.isMaximized();
    isMaximized ? await appWindow.unmaximize() : await appWindow.maximize()
  }

  const closeApp = async() => {
    await appWindow.close();
    exit(0)
  }

  const handleMouseDown = async (e) => {
    await appWindow.startDragging();
  };

  return (
    <div data-tauri-drag-region className="flex justify-between items-center header relative">
      <div className="drag" onMouseDown={handleMouseDown} />
      <div className="icon">
        <img src={logo} width="48" alt="Logo" />
        <div className="flex flex-col">
          <h4>Launcher</h4>
          <span className="text-[16px] font-light">v {FzPackage.version}</span>
        </div>
      </div>
      <div className="actions relative z-99">
        {location == "/connected" && <UserComponent />}
        <div className="grid grid-cols-3 grid-flow-col rounded-[8px]">
          <div
            onClick={toggleReduceApp}
            className="window window_reduce flex items-center text-lg justify-center text-white"
          >
            <img src={windowReduce} width={48} alt="icon_wreduce" />
          </div>
          <div
            onClick={toggleMaximizeApp}
            className="window window_maximize flex items-center text-lg justify-center text-white"
          >
            <img src={windowMax} width={48} alt="icon_wmax" />
          </div>
          <div
            onClick={closeApp}
            className="window window_close flex items-center text-lg justify-center text-white"
          >
            <img src={windowClose} width={48} alt="icon_wclose" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header
