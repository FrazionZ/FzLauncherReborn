import { readDir, BaseDirectory, renameFile, removeFile } from "@tauri-apps/api/fs"
import { join, resolve } from "@tauri-apps/api/path"
import { useEffect, useState } from "react"
import { useFzContext } from "../../../../FzContext"
import windowClose from '../../../../assets/img/icons/window_close.svg'
import { invoke } from "@tauri-apps/api/tauri";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from 'primereact/progressspinner';
import { MdOutlineError } from "react-icons/md";
import SearchIcon from '../../../../assets/img/icons/search'
import ImportIcon from '../../../../assets/img/icons/import' 
import { InputSwitch } from 'primereact/inputswitch'
import mccolors from 'minecraft-colors'; 
import { HiTrash } from "react-icons/hi2";
import { v4 as uuidv4 } from 'uuid';

export default function Rpacks({ data }) {
 
    const fzContext = useFzContext();
    const [rpacks, setRpacks] = useState([])
    const [load, setLoad] = useState(false)
    const [error, setError] = useState(undefined)
    const [query, setQuery] = useState("")

    const getDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherMCVersions, data?.id, 'resourcepacks')
    }

    const openDirectory = async () => {
        await invoke('open_directory', { path: await getDirectory() })
    }

    useEffect(() => {
        init()
    }, [])

    const init = async () => {
        try {
            let entries = await readDir('MCVersions/' + data?.id + '/resourcepacks', { dir: BaseDirectory.AppData, recursive: true });
            entries = entries.filter((f) => f.name.endsWith('.zip') || f.name.endsWith('.disabled'))
            for await (const rpack of entries) {
                const icon = await invoke('read_base64_from_zip_sync', { zipPath: rpack.path, fileName: 'pack.png' });
                const mcmeta = await invoke('read_file_from_zip_sync', { zipPath: rpack.path, fileName: 'pack.mcmeta' });
                const nameFile = rpack.name;
                rpack.uuid = uuidv4()
                rpack.mcmeta = JSON.parse(mcmeta);
                rpack.icon = icon;
                rpack.name = nameFile.replace('.zip', '').replace('.disabled', '');
                rpack.state = !nameFile.endsWith('.disabled');
            }
            setRpacks(entries)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoad(true)
        }
    }

    function filterWithLike(array, property, value) {
        const regex = new RegExp(value, 'i'); // 'i' flag makes the search case-insensitive
        return array.filter(item => regex.test(item[property]));
    }

    async function handleChangeState(uuid, value) {
        const copyEntries = [...rpacks];
        let entry = copyEntries.find((r) => r.uuid == uuid);
        if (entry == undefined) return;
        entry.state = value;
        const rootDir = 'MCVersions/' + data?.id + '/resourcepacks/'
        const nameFileOriginal = rootDir + entry.name + (value ? '.disabled' : '.zip');
        const nameFileNew = rootDir + entry.name + (value ? '.zip' : '.disabled');
        await renameFile(nameFileOriginal, nameFileNew, { dir: BaseDirectory.AppData, recursive: true });
        setRpacks(copyEntries);
    }

    async function removeRpack(uuid) {
        let copyEntries = [...rpacks];
        const entry = copyEntries.find((r) => r.uuid == uuid);
        if(entry == undefined) return;
        const rootDir = 'MCVersions/' + data?.id + '/resourcepacks/'
        const nameFile = rootDir + entry.name + (entry.state ? '.zip' : '.disabled');
        await removeFile(nameFile, { dir: BaseDirectory.AppData, recursive: true })
        copyEntries = copyEntries.filter((r) => r.uuid !== entry.uuid);
        setRpacks(copyEntries);
    }

    return (
        <>
            <div className="flex flex-col gap-4 h-full">
                <div className="flex w-full gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <div className="absolute top-4 left-4 bg-[var(--fzbg-1)]"><SearchIcon /></div>
                            <input placeholder="Rechercher" value={query} onChange={(e) => { setQuery(e.target.value) }} className="w-full indent-12" type="text" />
                        </div>
                    </div>
                    <button className="default" onClick={openDirectory}>Fichiers</button>
                    <button style={{ background: 'var(--gradient_green)' }}><ImportIcon /> <span className="text-[#173117]">Importer</span></button>
                </div>
                {!load ?
                    <div className="flex flex-col gap-4 w-full flex-1 justify-center items-center">
                        <ProgressSpinner style={{ width: '80px', height: '80px' }} strokeWidth="8" animationDuration=".5s" />
                        <div className="flex flex-col gap-2">
                            <span className="text-center leading-5">Chargement de vos packs de ressources</span>
                        </div>
                    </div>
                    :
                    error ?
                        <div className="flex flex-col gap-8 w-full h-full justify-center items-center">
                            <MdOutlineError size={80} color="var(--color-2)" />
                            <div className="flex justify-center items-center flex-col gap-0">
                                <span className="text-center leading-5">Une erreur s'est produite lors de la lecture de vos screens</span>
                                <span className="text-[14px] text-center font-light whitespace-nowrap overflow-hidden text-ellipsis w-[650px]">{error}</span>
                            </div>
                        </div>
                        :
                        <div className="flex flex-col gap-4 w-full overflow-y-auto h-full">
                            {filterWithLike(rpacks, 'name', query).map((rpack, _) => {
                                
                                return (
                                    <div key={rpack.uuid} className="rpack flex bg-[var(--fzbg-1)] w-full p-4 rounded-lg">
                                        <div className="flex flex-1 gap-4">
                                            <div className="flex">
                                                <img width={48} height={48} className="rounded-[4px]" src={`data:image/png;base64,${rpack?.icon}`} alt="rpack_icon" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[#FFFFFF] text-[18px] font-bold">
                                                    {rpack?.name}
                                                </span>
                                                <span className="text-[#CDCDCD] text-[14px] font-medium">
                                                    {mccolors.stripColors(rpack?.mcmeta?.pack?.description)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <InputSwitch onChange={(e) => handleChangeState(rpack?.uuid, e.value)} checked={rpack.state} />
                                            <div onClick={() => { removeRpack(rpack?.uuid) }} className="flex cursor-pointer justify-center items-center bg-[#484C53] hover:bg-[var(--color-red)] transition-all" style={{ borderRadius: 4, width: '48px', height: '48px', padding: 0 }}>
                                                <HiTrash color="white" size={28} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                }
            </div>
            <style>
                {`
                    
                `}
            </style>
        </>
    )

}