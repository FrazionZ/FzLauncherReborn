import { Dialog } from "primereact/dialog";
import { SelectButton } from "primereact/selectbutton";
import { AutoComplete } from "primereact/autocomplete";
import { Dropdown } from "primereact/dropdown";
import windowClose from '../assets/img/icons/window_close.svg'
import ImportIcon from '../assets/img/icons/import'
import { useEffect, useState } from "react";
import { useFzContext } from "../FzContext";
import { InputSwitch } from "primereact/inputswitch";
import { open } from '@tauri-apps/api/dialog';
import { appDataDir, join, resolve } from "@tauri-apps/api/path";
import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { v4 as uuidv4 } from 'uuid';
import { copyFile, BaseDirectory } from '@tauri-apps/api/fs';
import FzToast from "./FzToast";
import DefaultIcon from "../assets/img/mc_logo.png"
import { getInfosVersionManifestMojang } from '../Utils'
import axios from "axios";

export default function AddProfilDialog({ isOpen, setIsOpen }) {

    const fzContext = useFzContext();
    const [name, setName] = useState("");
    const [typeProfile, setTypeProfile] = useState("vanilla");
    const [versionSelect, setVersionSelect] = useState("");
    const [items, setItems] = useState([]);
    const [withSnapshot, setWithSnapshot] = useState(false);
    const [icon, setIcon] = useState("");

    const typesProfile = [
        { name: 'Vanilla', value: 'vanilla', className: 'net.minecraft.client.main.Main' },
        { name: 'Fabric', value: 'fabric', className: 'net.fabricmc.loader.launch.knot.KnotClient' },
        { name: 'Forge', value: 'forge', className: 'net.minecraft.client.main.Main' },
        { name: 'NeoForge', value: 'neoforge', className: 'net.minecraft.client.main.Main' },
        { name: 'Quilt', value: 'quilt', className: 'org.quiltmc.loader.impl.launch.knot.KnotClient' }
    ];

    function filterWithLike(array, property, value) {
        const regex = new RegExp(value, 'i'); // 'i' flag makes the search case-insensitive
        return array.filter(item => regex.test(item[property]));
    }

    const search = (event) => {
        let versions = fzContext.mojang.versions;
        let _items = [...versions];
        if (withSnapshot) {
            setItems(filterWithLike(_items, 'id', event.query).map((v) => v.id));
        } else {
            setItems(filterWithLike(_items, 'id', event.query).filter((v) => v.type == "release").map((v) => v.id));
        }
    }

    const chooseIcon = async () => {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Image',
                extensions: ['png']
            }]
        });
        if (selected) {
            setIcon(selected)
        } else {
            // user selected a single directory
        }
    }

    useEffect(() => {
        const versions = [];
        fzContext.mojang.versions.forEach((v) => {
            if (withSnapshot) {
                versions.push({ name: v.id, code: v.id })
            } else if (v.type == "release") {
                versions.push({ name: v.id, code: v.id })
            }
        })
        setItems(versions)
        setVersionSelect(versions[0])
    }, [fzContext.mojang.versions])

    useEffect(() => {
        const versions = [];
        fzContext.mojang.versions.forEach((v) => {
            if (withSnapshot) {
                versions.push({ name: v.id, code: v.id })
            } else if (v.type == "release") {
                versions.push({ name: v.id, code: v.id })
            }
        })
        setItems(versions)
        setVersionSelect(versions[0])
    }, [withSnapshot])

    const addProfile = async () => {
        const uuid = uuidv4()
        const gameTypeData = typesProfile.find((tp) => tp.value == typeProfile);
        if (gameTypeData == undefined) return FzToast.error('GameType non valide.')
        if (name == "") return FzToast.error('Vous devez définir un nom')
        if (versionSelect == "") return FzToast.error('Vous devez choisir une version de jeu')

        let versionManifest = await getInfosVersionManifestMojang(versionSelect.code);
        let mainClass = gameTypeData.value == "vanilla" ? versionManifest.mainClass : gameTypeData.className;
        let modloader_version = "";
        let jvm_args = "";
        let custom_args = "";

        if(gameTypeData.value == "forge") {
            //Get information for Forge
            const response = await axios.get('https://api.curseforge.com/v1/minecraft/modloader');
            const modLoaderData = response.data.data;
            const forgeLoadersVersion = modLoaderData.filter((md) => md.gameVersion == versionSelect.code)
            const forgeLoaderSelect = forgeLoadersVersion.find((md) => md.latest || md.recommended);
            if(!forgeLoaderSelect) return FzToast.error('Aucune version de forge stable n\'a été trouvée dans cette version du jeu');
            const responseForgeLoader = await axios.get(`https://api.curseforge.com/v1/minecraft/modloader/${forgeLoaderSelect.name}`);
            const forgeLoader = responseForgeLoader.data.data;
            forgeLoader.installProfileJson = JSON.parse(forgeLoader.installProfileJson);
            forgeLoader.versionJson = JSON.parse(forgeLoader.versionJson);
            console.log("Forge Detected for Version: ", forgeLoader)
            mainClass = forgeLoader.versionJson.mainClass;
            modloader_version = forgeLoader.name

            let jvm = "";
            let custom = "";
            for await (const arg of forgeLoader.versionJson.arguments.jvm) {
                jvm += arg + " ";
            }
            for await (const arg of forgeLoader.versionJson.arguments.game) {
                custom += arg + " ";
            }
            jvm_args = jvm;
            custom_args = custom;

        }

        const dataProfile = {
            filePath: fzContext.fzVariable.shelfFzLauncherGameProfiles,
            uuid: uuid,
            name: name,
            icon: icon.startsWith("/src") ? "default" : await join(fzContext.fzVariable.dirFzLauncherProfileIcons, uuid + '.png'),
            version: versionSelect.name,
            jre: versionManifest.javaVersion.majorVersion.toString(),
            className: mainClass,
            modloaderVersion: modloader_version,
            gameType: gameTypeData.value,
            profileType: "custom",
            jvmArgs: jvm_args,
            customArgs: custom_args
        };

        let profile_game = await invoke('add_profile_custom', dataProfile)
        await fzContext.loadProfilesGame()
        setIsOpen(false)
        await copyFile(icon, `Launcher/icons/${profile_game.id}.png`, { dir: BaseDirectory.AppData });
        FzToast.success('Le profil de jeu a bien été ajouté')
        
        setName("")
        setVersionSelect("")
        setIcon("")
    }

    return (
        <Dialog header="" visible={isOpen} className="flex flex-col w-full" closable={false} maskStyle={{ backdropFilter: 'blur(15px)' }} headerStyle={{ background: "var(--fzbg-4)" }} contentClassName="flex-1" contentStyle={{ display: 'flex', flexDirection: 'column', background: "var(--fzbg-4)" }} position={"left"} style={{ borderColor: 'transparent', width: '60vw', height: 'fit-content', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, margin: 'auto' }} onHide={() => { if (!isOpen) return; setIsOpen(false); }} draggable={false} resizable={false}>
            <div className="lmclose right" onClick={() => { setIsOpen(false) }}>
                <img src={windowClose} width={18} height={18} alt="" />
            </div>
            <div className="flex flex-col gap-8 w-full">
                <h2 className="text-white text-[24px] font-bold">Ajout d'un profil de jeu</h2>
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="icon">
                            <img src={icon.startsWith("/src") ? icon : convertFileSrc(icon, "asset")} alt="iconServer" onError={() => setIcon(DefaultIcon)} className="object-cover" style={{ width: 64, height: 64 }} />
                        </div>
                        <div className="flex flex-col">
                            <button style={{ background: 'var(--gradient_green)' }} onClick={chooseIcon}><ImportIcon /> <span className="text-[#173117]">Importer</span></button>
                        </div>
                    </div>
                    <div className="input-group w-full">
                        <label>Nom</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full" name="" id="" />
                    </div>
                    <div className="input-group w-full">
                        <label>Type de jeu</label>
                        <SelectButton value={typeProfile} allowEmpty={false} onChange={(e) => setTypeProfile(e.value)} optionLabel="name" options={typesProfile} />
                    </div>
                    <div className="input-group w-full">
                        <label>Version du jeu</label>
                        <div className="flex gap-4 items-center">
                            <Dropdown style={{ background: 'var(--fzbg-1)', border: 'none' }}  value={versionSelect} onChange={(e) => setVersionSelect(e.value) } options={items} optionLabel="name" placeholder="" className="w-full md:w-14rem" />
                            <div className="flex gap-2">
                                <span>Avec les snapshots</span>
                                <InputSwitch checked={withSnapshot} onChange={(e) => { setWithSnapshot(e.value) }} />
                            </div>
                        </div>
                    </div>
                    <button className="w-fit" onClick={addProfile}>Créer le profil</button>
                </div>
            </div>
            <style>
                {`
                    div[data-pc-section="button"] {
                        background: var(--fzbg-1);
                        outline: none !important;
                        box-shadow: none !important;
                        border: none;
                    }
                    div[data-pc-section="button"]:hover {
                        background: var(--fzbg-2);
                    }
                    div[data-pc-section="button"][aria-pressed="true"] {
                        background: var(--btn-gradient);
                    }
                `}
            </style>
        </Dialog>
    )

}