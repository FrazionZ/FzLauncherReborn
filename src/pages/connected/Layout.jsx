import { invoke } from "@tauri-apps/api/tauri";
import { LogicalSize, PhysicalSize, appWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { useFzContext } from "../../FzContext";
import ProfileGame from "./subpages/ProfileGame";
import TaskManager from "./subpages/TaskManager";
import { FaCubesStacked } from "react-icons/fa6";
import HomeIcon from '../../assets/img/icons/home.png'

export default function Layout() {

    const fzContext = useFzContext();
    const [profileGameCurrent, setProfileGameCurrent] = useState(0)
    const [profilesGame, setProfilesGame] = useState([])
    const [subpage, setSubpage] = useState(undefined);

    const subpages = [
        {
            key: 'tasks',
            comp: <TaskManager />
        }
    ]

    const showSubpage = (comp) => {
        setSubpage(comp)
    }

    useEffect(() => {
        prepareWindow()
        initial()
    }, [])

    useEffect(() => {

    }, [fzContext])

    const prepareWindow = async () => {
        let minsize = new PhysicalSize(1280, 720);
        let maxsize = new PhysicalSize(1920, 1080);
        await appWindow.setSize(minsize)
        await appWindow.setMinSize(minsize)
        await appWindow.setMaxSize(maxsize)
        await appWindow.setResizable(true)
        invoke('center_window', {});
    }

    const initial = async () => {
        await fzContext.sessionMSA.update()
    }

    useEffect(() => {

    }, [fzContext.profilesGameInternal])

    useEffect(() => {

    }, [profileGameCurrent])

    useEffect(() => {

    }, [fzContext.sessionMSA.auth])

    const NavItem = ({ sp, children, onClick }) => {
        return (
            <div onClick={onClick} className={`${subpage == sp ? "bg-[#1a1d21]" : "bg-transparent"} profile flex justify-center items-center rounded-lg hover:bg-[#1A1D21] w-[48px] h-[48px]`}>
                {children}
            </div>
        )
    }

    const subpageCurrent = subpages.find((sp) => sp.key == subpage)

    return (
        <div className="flex h-full">
            <aside className="sidebar flex flex-col items-center w-[80px] gap-2 py-4" style={{ background: 'rgba(0, 0, 0, 0.35)' }}>
                <NavItem sp={"home"}>
                    <img src={HomeIcon} width={32} height={32} alt="home_icon" />
                </NavItem>
                <div className="border-b-2 border-[#1A1D21] w-12 h-[2px]" />
                <div className="profiles flex flex-col items-center flex-1 gap-2">

                    {fzContext.profilesGameInternal.map((profile, _) => {
                        return (
                            <NavItem sp={undefined} key={_} onClick={() => { setProfileGameCurrent(_); setSubpage(undefined); }}>
                                <img src={profile.icon} width={32} height={32} alt="" />
                            </NavItem>
                        )
                    })}
                </div>
                <div className="actions flex flex-col gap-2">
                    <NavItem sp={"tasks"} onClick={() => { setSubpage('tasks') }}>
                        <FaCubesStacked color="white" size={32} />
                    </NavItem>
                </div>
            </aside>
            <div className="flex flex-1 overflow-hidden">
                {fzContext.profilesGameInternal.map((profile, _) => {
                    const isActive = profileGameCurrent == _ && subpage == undefined;
                    return (
                        <div className={`${isActive ? 'flex' : 'hidden'} w-full`} key={_}>
                            <ProfileGame data={profile} />
                        </div>
                    )
                })}
                {subpages.map((sp) => {
                    const isActive = subpage == sp.key
                    return (
                        <div className={`${isActive ? 'flex' : 'hidden'} w-full`} key={sp.key}>
                            {sp.comp}
                        </div>
                    )
                })}
            </div>
        </div>
    )



}