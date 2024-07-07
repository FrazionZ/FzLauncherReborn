import { toast } from 'sonner'

import BubbleError from '../assets/img/icons/bubble_error.svg'
import BubbleSuccess from '../assets/img/icons/bubble_success.svg'
import BubbleInfos from '../assets/img/icons/bubble_infos.svg'
import BubbleWarning from '../assets/img/icons/bubble_warning.svg'

/*
const options = (state) => {
  let options = {
    position: toast.POSITION.TOP_CENTER,
    theme: 'dark',
    icon: () => {
      switch (state) {
        case 0:
          return <img src={BubbleError} />
        case 1:
          return <img src={BubbleSuccess} />
        case 2:
          return <img src={BubbleInfos} />
        case 3:
          return <img src={BubbleWarning} />
        default:
          return <img src={BubbleInfos} />
      }
    }
  }
  if (state == -1) delete options.icon
  return options
}

const processToast = (pendingMessage, callPromise, callSuccess, callError) => {
  return toast.promise(
    callPromise,
    {
      pending: pendingMessage,
      success: {
        render({ data }) {
          return callSuccess(data)
        },
        icon: () => <img src={BubbleSuccess} />
      },
      error: {
        render({ data }) {
          return callError(data)
        },
        icon: () => <img src={BubbleError} />
      }
    },
    options(-1)
  )
}*/

const error = (message, descr) => {
  return toast.error(message, { description: descr, theme: "dark" })
}

const info = (message, descr) => {
  return toast.info(message, { description: descr, theme: "dark" })
}

const success = (message, descr) => {
  return toast.success(message, { description: descr, theme: "dark"  })
}

export default { error, info, success }
