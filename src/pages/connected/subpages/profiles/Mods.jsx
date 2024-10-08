import { readDir, BaseDirectory, removeFile } from "@tauri-apps/api/fs"
import { join } from "@tauri-apps/api/path"
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
import { v4 as uuidv4 } from 'uuid';
import { renameFile } from '@tauri-apps/api/fs';
import { HiTrash } from "react-icons/hi2";
export default function Mods({ data }) {

    const fzContext = useFzContext();
    const [mods, setMods] = useState([])
    const [load, setLoad] = useState(false)
    const [error, setError] = useState(undefined)
    const [query, setQuery] = useState("")

    const getDirectory = async () => {
        return await join(fzContext.fzVariable.dirFzLauncherMCVersions, data?.id, 'mods')
    }

    const openDirectory = async () => {
        await invoke('open_directory', { path: await getDirectory() })
    }

    useEffect(() => {
        init()
    }, [])

    const init = async () => {
        try {
            let entries = await readDir('MCVersions/' + data?.id + '/mods', { dir: BaseDirectory.AppData, recursive: true });
            entries = entries.filter((f) => f.name.endsWith('.jar') || f.name.endsWith('.disabled'))
            const mods = [];
            for await (const mod of entries) {
                try {
                    const res = await invoke('read_file_from_zip_sync', { zipPath: mod.path, fileName: 'fabric.mod.json' });
                    const config_mod = JSON.parse(res);
                    const icon = await invoke('read_base64_from_zip_sync', { zipPath: mod.path, fileName: config_mod.icon });
                    let author = "N/A";
                    if (config_mod.authors.length > 0) {
                        author = typeof config_mod.authors[0] == "string" ? config_mod.authors[0] : config_mod.authors[0]?.name
                    }

                    const nameFile = mod.name;
                    const modObj = { name: config_mod.name, author: author, icon: icon };
                    modObj.uuid = uuidv4()
                    modObj.name = nameFile.replace('.jar', '').replace('.disabled', '');
                    modObj.state = !nameFile.endsWith('.disabled');
                    mods.push(modObj)
                } catch (e) {

                }
                /*const icon = await invoke('read_base64_from_zip_sync', { zipPath: rpack.path, fileName: 'pack.png' });
                const mcmeta = await invoke('read_file_from_zip_sync', { zipPath: rpack.path, fileName: 'pack.mcmeta' });
                rpack.mcmeta = JSON.parse(mcmeta); 
                rpack.icon = icon;
                rpack.name = rpack.name.replace('.zip', '')*/
            }
            setMods(mods)
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
        const copyEntries = [...mods];
        let entry = copyEntries.find((m) => m.uuid == uuid);
        if (entry == undefined) return;
        entry.state = value;
        const rootDir = 'MCVersions/' + data?.id + '/mods/'
        const nameFileOriginal = rootDir + entry.name + (value ? '.disabled' : '.jar');
        const nameFileNew = rootDir + entry.name + (value ? '.jar' : '.disabled');
        await renameFile(nameFileOriginal, nameFileNew, { dir: BaseDirectory.AppData, recursive: true });
        setMods(copyEntries);
    }

    async function removeMods(uuid) {
        let copyEntries = [...mods];
        const entry = copyEntries.find((m) => m.uuid == uuid);
        if (entry == undefined) return;
        const rootDir = 'MCVersions/' + data?.id + '/mods/'
        const nameFile = rootDir + entry.name + (entry.state ? '.jar' : '.disabled');
        await removeFile(nameFile, { dir: BaseDirectory.AppData, recursive: true })
        copyEntries = copyEntries.filter((r) => r.uuid !== entry.uuid);
        setMods(copyEntries);
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
                    <div className="flex flex-col gap-4 w-full h-full justify-center items-center">
                        <ProgressSpinner style={{ width: '80px', height: '80px' }} strokeWidth="8" animationDuration=".5s" />
                        <div className="flex flex-col gap-2">
                            <span className="text-center leading-5">Chargement de vos mods</span>
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
                        <div className="flex flex-col gap-4 w-full overflow-y-auto flex-1">
                            {filterWithLike(mods, 'name', query).map((mod, _) => {
                                return (
                                    <div key={_} className="rpack flex bg-[var(--fzbg-1)] w-full p-4 rounded-lg">
                                        <div className="flex flex-1 gap-4">
                                            <div className="flex">
                                                <img width={48} height={48} className="rounded-[4px]" src={`data:image/png;base64,${mod?.icon}`} alt="rpack_icon" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[#FFFFFF] text-[18px] font-bold">
                                                    {mod?.name}
                                                </span>
                                                <span className="text-[#CDCDCD] text-[14px] font-bold">
                                                    by {mod?.author}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <InputSwitch onChange={(e) => handleChangeState(mod?.uuid, e.value)} checked={mod.state} />
                                            <div onClick={() => { removeMods(mod?.uuid) }} className="flex cursor-pointer justify-center items-center bg-[#484C53] hover:bg-[var(--color-red)] transition-all" style={{ borderRadius: 4, width: '48px', height: '48px', padding: 0 }}>
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
                    div[data-pc-name="inputswitch"][aria-checked="false"] span[data-pc-section="slider"] {
                        background: #484C53;
                    }
                    span[data-pc-section="slider"] {
                        background: var(--btn-gradient);
                        border: none;
                        outline: none;
                    }
                    div[data-pc-name="inputswitch"][aria-checked="false"] span[data-pc-section="slider"]::before {
                        background: #848E95 !important;
                    }
                    div[data-pc-name="inputswitch"][aria-checked="true"] span[data-pc-section="slider"]::before {
                        background: white !important;
                    }
                `}
            </style>
        </>
    )

}