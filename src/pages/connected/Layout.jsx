import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { LogicalSize, PhysicalSize, appWindow } from "@tauri-apps/api/window";
import { removeDir } from "@tauri-apps/api/fs";
import { useEffect, useRef, useState } from "react";
import { useFzContext } from "../../FzContext";
import ProfileGame from "./subpages/ProfileGame";
import TaskManager from "./subpages/TaskManager";
import { FaCubesStacked } from "react-icons/fa6";
import HomeIcon from '../../assets/img/icons/home.png'
import AddIcon from '../../assets/img/icons/add.png'
import { Dialog } from "primereact/dialog";
import AddProfilDialog from "../../components/AddProfilDialog";
import DefaultIcon from "../../assets/img/mc_logo.png"
import { ContextMenu } from 'primereact/contextmenu';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import FzToast from "../../components/FzToast";
import { join } from "@tauri-apps/api/path";

export default function Layout() {

    const fzContext = useFzContext();
    const [profileGameCurrent, setProfileGameCurrent] = useState(0)
    const [profilesGame, setProfilesGame] = useState([])
    const [subpage, setSubpage] = useState(undefined);
    const [showAddProfileGame, setShowAddProfileGame] = useState(false);

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

    }, [fzContext.profilesGameCustom])

    useEffect(() => {

    }, [profileGameCurrent])

    useEffect(() => {

    }, [fzContext.sessionMSA.auth])

    const NavItem = ({ isActive, children, onClick, onContextMenu }) => {
        return (
            <div onClick={onClick} onContextMenu={onContextMenu} className={`${isActive ? "bg-[#1a1d21]" : "bg-transparent"} profile flex justify-center items-center rounded-lg hover:bg-[#1A1D21] w-[48px] h-[48px]`}>
                {children}
            </div>
        )
    }

    const subpageCurrent = subpages.find((sp) => sp.key == subpage)

    const NavItemProfileGame = ({profile, key, index}) => {
        const cm = useRef(null);

        const accept = async() => {
            //removeDir
            await invoke('remove_profile', { filePath: fzContext.fzVariable.shelfFzLauncherGameProfiles, uuid: profile.id })
            await removeDir(await join(fzContext.fzVariable.dirFzLauncherMCVersions, profile?.id), { recursive: true })
            await fzContext.loadProfilesGame() 
            if(profileGameCurrent == key) {
                setProfileGameCurrent(0);
            }
            FzToast.success('Le profil a bien été supprimé')
        }
    
        const reject = () => {
            
        }

        const items = [
            { label: 'Éditer', command: () => { alert('Not available') }},
            { label: 'Supprimer', command: (e) => { 
                confirmDialog({
                    message: 'Êtes-vous sûr de vouloir supprimer ce profil de jeu ? En continuant, vous prenez conscience que les données liées à ce profil seront supprimées.',
                    header: 'Confirmation de suppression',
                    icon: 'pi pi-info-circle',
                    defaultFocus: 'reject',
                    rejectClassName: 'default',
                    contentClassName: 'p-0',
                    acceptClassName: 'danger hover:bg-[green]',
                    acceptLabel: "Oui, supprimer",
                    rejectLabel: "Non",
                    accept,
                    reject
                });
            }}
        ];

        return (
            <div className="flex">
                {profile.profile_type !== "server" && <ContextMenu model={items} ref={cm} breakpoint="767px" />}
                <NavItem isActive={profileGameCurrent == index} sp={undefined} onContextMenu={(e) => profile.profile_type !== "server" && cm.current.show(e)} onClick={() => { setProfileGameCurrent(index); setSubpage(undefined); }}>
                    <img src={profile?.profile_type == "server" ? profile.icon : profile.icon == "default" ? DefaultIcon : convertFileSrc(profile.icon, "asset")} onError={(e) => e.target.src = DefaultIcon} width={32} height={32} alt="" />
                </NavItem>
            </div>
        )
    }

    return (
        <div className="flex h-full">
            <aside className="sidebar flex flex-col items-center w-[80px] gap-2 py-4" style={{ background: 'rgba(0, 0, 0, 0.35)' }}>
                <NavItem sp={"home"}>
                    <img src={HomeIcon} width={32} height={32} alt="home_icon" />
                </NavItem>
                <div className="border-b-2 border-[#1A1D21] w-12 h-[2px]" />
                <div className="profiles flex flex-col items-center flex-1 gap-2"> 
                    <ConfirmDialog closable={false} />
                    {fzContext.profilesGameInternal.map((profile, _) => {
                        return (
                            <NavItemProfileGame key={_} index={_} profile={profile} />
                        )
                    })}
                </div>
                <div className="actions flex flex-col gap-2">
                    <NavItem isActive={"add_profile" == subpage} onClick={() => { setShowAddProfileGame(true) }} sp={"add_profile"}>
                        <img src={AddIcon} width={32} height={32} alt="home_icon" />
                    </NavItem>
                    <NavItem isActive={"tasks" == subpage} sp={""} onClick={() => { setSubpage('tasks') }}>
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
            <AddProfilDialog isOpen={showAddProfileGame} setIsOpen={setShowAddProfileGame} />
        </div>
    )



}