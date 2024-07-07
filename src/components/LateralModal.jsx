import React from "react"
import windowClose from '../assets/img/icons/window_close.svg'
import { motion } from "framer-motion"
//import { ipcRenderer } from "electron"

/*import Rpacks from "../pages/connected/lateralModal/rpacks"
import Profiles from "../pages/connected/lateralModal/profiles"
import Settings from "../pages/connected/lateralModal/settings"*/

export default class LateralModal extends React.Component {

    
    state = {
        title: 'N/A',
        isOpen: false
    }

    constructor(props) {
        super(props)
        this.variants = {
            open: { display: "flex", flexDirection: "column", width: "900px", translateX: "0px" },
            closed: { display: "flex", flexDirection: "column", width: "900px", translateX: "940px" },
        }
        this.router = undefined
        const loadLMPage = (args) => {
            this.setState({ isOpen: true })
            this.router.showPage('/' + args.id)
        }
        /*ipcRenderer.on('loadLateralModal', (e, args) => {
            if(args.state == "close") return this.setState({ isOpen: false })
            this.setState({ title: args.title })
            //router.showPage('/rpacks')
            if(this.router == undefined) {
                this.loadRouter().then(() => {
                    loadLMPage(args)
                })
            } else
                loadLMPage(args)
        })*/
    }

    async loadRouter() {
        return new Promise(async (resolve, reject) => {
            this.router = await new Router({
                domParent: document.querySelector('.lateralModalElectron .content-child'),
                multipleSubDom: false
            })
            this.router.setPages([
                {
                    component: <Profiles />,
                    name: 'Profiles',
                    url: '/profiles'
                },
                {
                    component: <Rpacks fp={this.props.fp} />,
                    name: 'Rpacks',
                    url: '/rpacks'
                },
                {
                    component: <Settings />,
                    name: 'Settings',
                    url: '/settings'
                },
            ])
            
            this.router.preRenderPage('/settings')
            resolve()
        });
        
    }

    async componentDidMount() {
        
    }

    async componentWillUnmount() {
        //ipcRenderer.removeAllListeners('loadLateralModal')
    }

    render() {
        return (
            <div className={`lateralModalElectron ${this.state.isOpen ? 'block' : ''}`}>
                <div onClick={(e) => { this.setState({ isOpen: false }) }} className={`backdropLateralModal ${this.state.isOpen ? "block" : "hidden"}`} />
                <motion.div
                    className="lateralModal"
                    initial={{
                        width: "0px",
                        translateX: "940px"
                    }}
                    transition={{ type: "tween", stiffness: 100 }}
                    variants={this.variants}
                    animate={
                        this.state.isOpen ? "open" : "closed"
                    }
                    onAnimationComplete={(e) => {
                        if (e == "closed") {
                            document.querySelector('.lateralModalElectron').classList.add('hidden')
                            document.querySelector('.lateralModalElectron').classList.remove('block')
                        }
                    }}
                    exit={{
                        width: "0px"
                    }}
                >
                    <div className="close" onClick={(e) => { this.setState({ isOpen: false }) }}><img src={windowClose} /></div>
                    <div className="title">{this.state.title}</div>
                    <div className="content-child"></div>
                </motion.div>
            </div>
        )
    }

}