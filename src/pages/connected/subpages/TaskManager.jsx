import { useEffect, useRef, useState, useReducer } from 'react'
import { useFzContext } from '../../../FzContext'
import { invoke } from '@tauri-apps/api/tauri';
import { v4 as uuidv4 } from 'uuid'
import { listen } from '@tauri-apps/api/event';
import { ProgressBar } from 'primereact/progressbar';
import { HiOutlineCubeTransparent } from "react-icons/hi2";
//STATE_PROFILE_GAME! 0=Waiting, 1=Install, 2=Update, 3=Playable

export default function TaskManager({ data }) {

    const fzContext = useFzContext();
    const fztasks = useRef([]);
    const [, forceUpdate] = useReducer((x) => x + 1, 0)

    const [value, setValue] = useState(60);

    useEffect(() => {
        let unlisten = () => { };
        let unlistenStateTask = () => { };
        let unlistenUpdateTask = () => { };
        init().then(async (un) => {
            unlisten = un;
            unlistenStateTask = await listen('update-state-frazionz', async (event) => {
                updateTask(event.payload)
            });
            unlistenUpdateTask = await listen('update-task-frazionz', async (event) => {
                console.log('update-task-frazionz', event.payload)
                updateTaskObject(event.payload)
            });
        })
        return () => {
            unlisten();
            unlistenStateTask();
            unlistenUpdateTask();
        }
    }, [])

    const getTasks = () => {
        return fztasks;
    }

    const addTask = (task) => {
        fztasks.current.push(task)
        forceUpdate()
    }

    const updateTask = (task) => {
        const task_index = fztasks.current.findIndex((t) => t.uuid == task.uuid)
        if (task_index == -1) return;
        fztasks.current[task_index].state.percentage = task.percentage
        fztasks.current[task_index].display.subtitle = task.subtitle
        forceUpdate()
    }

    const updateTaskObject = (task) => {
        const task_index = fztasks.current.findIndex((t) => t.uuid == task.uuid)
        if (task_index == -1) return;
        fztasks.current[task_index] = task;
        forceUpdate()
    }

    const replaceListTasks = (tasks) => {
        fztasks.current = tasks
        forceUpdate()
    }

    const init = async () => {
        return new Promise(async (resolve, reject) => {
            const tasks = await invoke('get_tasks', {});
            replaceListTasks(tasks);
            const unlisten = await listen('task-new-instance', (event) => {
                console.log("NEW EVENT!", event.payload)
                addTask(event.payload)
            });
            return resolve(unlisten);
        })
    }

    useEffect(() => {
        console.log(fztasks)
    }, [fztasks])

    const addTaskDebug = async () => {
        await invoke('add_task', { taskType: 1, uuid: uuidv4(), files: [], display: { title: "Title", subtitle: 'Subtitle' } })
    }

    return (
        <div className="task_manager_content gap-4 flex flex-col rounded-tl-lg w-full overflow-y-auto px-6 pt-6 pb-4">
            <div className="flex flex-col">
                <h2 className='text-white text-[24px] font-bold'>Gestionnaire des tâches</h2>
                <h5 className='text-white text-[16px] font-light'>Gérez les tâches effectués par le Launcher</h5>
            </div>
            {fztasks.current.length == 0 ?
                <div className="flex flex-col gap-8 w-full h-full justify-center items-center">
                    <HiOutlineCubeTransparent size={80} color="var(--color-2)" onClick={addTaskDebug} />
                    <div className="flex justify-center items-center flex-col gap-0">
                        <span className="text-center leading-5">Aucune tâche en cours</span>
                        <span className="text-[14px] text-center font-light whitespace-nowrap overflow-hidden text-ellipsis w-[650px]">Pas besoin de travailler pour le moment :)</span>
                    </div>
                </div>
            :
                <div className="flex flex-col gap-4 py-4">
                    {fztasks.current?.map((task, _) => {
                        const percentage = parseInt(task.state.percentage);
                        return (
                            <div className="bg-[var(--fzbg-4)] relative rounded-lg p-4 flex flex-col gap-4 justify-start" key={task.uuid}>
                                <div className="flex z-10 justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className='text-[20px] font-bold'>{task.display.title}</span>
                                        <span className='text-[16px] font-light'>{task.display.subtitle}</span>
                                    </div>
                                    <div className="flex">
                                        <span className='text-white text-[24px] font-bold'>{percentage}%</span>
                                    </div>
                                </div>
                                <ProgressBar mode={task?.task_type == 0 ? 'indeterminate' : 'determinate'}  showValue={false} className='absolute w-full h-1' color='var(--fzbg-2)' style={{ background: "var(--fzbg-3)", top: 0, left: 0, zIndex: 0, position: 'absolute', height: '100%' }} value={percentage}></ProgressBar>
                            </div>
                        )
                    })}
                </div>
            }
        </div>
    )

}