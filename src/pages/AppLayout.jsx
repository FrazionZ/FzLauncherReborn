import { Toaster, toast } from 'sonner'
import { useEffect } from 'react';
import Header from '../components/Header'
import { useLocation } from 'wouter';
const tasks = []

export default function AppLayout({ children }) {

    const [location, setLocation] = useLocation()

    const screenSizeLocation = {
        updater: {
            width: 580,
            height: 720,
            resizable: false,
            maximizable: false
        },
        dirapp: {
            width: 1280,
            height: 720,
            resizable: true,
            maximizable: true
        },
        runtime: {
            width: 580,
            height: 720,
            resizable: false,
            maximizable: false
        },
        connected: {
            width: 1280,
            height: 720,
            resizable: true,
            maximizable: true
        }
    }

    useEffect(() => {
        const path = location.split('/')[1];
        let ssl = screenSizeLocation[path == "" ? "updater" : path /* Check if path is index ? */]
        //ipcRenderer.send('setSizeApp', ssl)
    }, [location]);
    
    const GetTask = async(uuidDl) => {
        for await (const task of tasks) {
            if (task !== null)
                if (task !== undefined)
                    if (uuidDl == task.uuidDl)
                        return task
        }
    }

    const AddTaskInQueue = async(taskObj) => {
        let ntask = tasks.find(task => task.uuidDl === taskObj.uuidDl)
        if (ntask == undefined || ntask == null) {
            ntask = new Task(taskObj)
            tasks.push(ntask)
        } else ntask.constUpdate(taskObj)
        const me = Symbol()
        await myq.wait(me, myPriority);
        return new Promise((resolve, reject) => {
            ntask.start()
                .then(() => { myq.end(me) })
                .catch((e) => console.error(e))
                .finally(() => { resolve() });
        })
    }

    const GetListTaskQueue = () => {
        return this.myq.queueWaiting;
    }

    
    const fp = { AddTaskInQueue: AddTaskInQueue, GetTask: GetTask, GetListTaskQueue: GetListTaskQueue }

    return (
        <div className="App">
            <Toaster visibleToasts={5} richColors={true} theme='dark' position='bottom-right' />
            <div className="layout">
                <Header fp={fp} tasks={tasks} />
                <div className="main">
                    {children}
                </div>
            </div>
        </div>
    )

}