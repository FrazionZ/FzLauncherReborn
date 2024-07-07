import ReactDOM from "react-dom/client";
import FzVariable from "./FzVariable";
import React from 'react'
import { sha1FileSync } from "sha1-file";
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, BaseDirectory, createDir, writeTextFile, writeBinaryFile } from '@tauri-apps/api/fs';
import byteSize from "byte-size";
import axios from "axios";
import { ResponseType, fetch } from "@tauri-apps/api/http";
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';


export default class Task {

  constructor(opts) {
    this.type = opts.type;
    this.state = { percentage: 0, file: opts.installerfilename || opts.fileZipDepend };
    this.uuidDl = opts.uuidDl;
    this.installerfileURL = opts.installerfileURL;
    this.installerfilename = opts.installerfilename;
    this.fupdate = opts.update !== undefined ? opts.update : true;
    this.prefix = opts.prefix;

    this.fileZipDepend = opts.fileZipDepend;
    this.dirServer = opts.dirServer;

    this.files = opts.files;
    this.timer = 0;
    this.aexist = false;
    this.lastTask = opts.lastTask;
    this.targetFolderZip = opts.target_folder;

    this.title = "";
    this.subtitle = "";
  }

  constUpdate(opts) {
    this.type = opts.type;
    this.uuidDl = opts.uuidDl;
    this.installerfileURL = opts.installerfileURL;
    this.installerfilename = opts.installerfilename;
    this.fupdate = opts.update !== undefined ? opts.update : true;
    this.prefix = opts.prefix;
    this.files = opts.files;
    this.targetFolderZip = opts.target_folder;
    this.fileZipDepend = opts.fileZipDepend;
    this.dirServer = opts.dirServer;
    this.lastTask = opts.lastTask;

    this.timer = 0;
    this.aexist = true;
  }

  start(fzContext) {
    let instance = this;
    try {
      if (this.fupdate) {
        this.startTime = new Date().getTime();
        /*if (
          document
            .querySelector(".main.connected .content-child .Tasks.sidepage")
            .hasAttribute("rendered")
        ) {
          if (!this.aexist) {
            let domRoot = document.querySelector(
              ".main.connected .content-child .Tasks.sidepage .downloads .listDls"
            );
            domRoot.querySelector(".nothing").style.display = "none";
            let domChild = domRoot.appendChild(document.createElement("div"));
            domChild.setAttribute("id", instance.uuidDl);
            const root = ReactDOM.createRoot(domChild);
            root.render(this.render(instance));
          } else {
            let domTask = document.querySelector(
              '.downloads .listDls .dl-items[id="' + instance.uuidDl + '"]'
            );
            if (domTask !== null || domTask !== undefined) { }
          }
          //document.querySelector('.taskOverlay').classList.remove('hidden')
        }*/
      }
      return new Promise((resolve, reject) => {
        if (instance.type == 0)
          //THIS IS A ONE FILE DOWNLOAD
          instance
            .download(instance, fzContext)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        else if (instance.type == 1) {
          //EXTRACT
          instance
            .extract(instance)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        } else if (instance.type == 2) {
          //MULTIPLE FILE DOWNLOAD
          instance
            .multipleDownload(instance)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        } else if (instance.type == 3) {
          //MULTIPLE FILE DOWNLOAD
          instance
            .multipleExtract(instance)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        } else resolve();
      });
    } catch (e) {
      console.log(e);
    }
  }

  request(element) {
    try {
      return axios({
        url: element,
        method: "GET",
        responseType: "stream"
      });
    } catch (e) {
      console.log('errore: ' + e)
    }
  }

  async download(instance, fzContext) {
    try {
      await invoke('download_file', { uuid: instance.uuidDl, url: instance.installerfileURL, filename: instance.installerfilename });
    } catch (error) {
      console.error('Erreur lors du téléchargement du fichier via Rust: ', error);
    }
  }

  async multipleDownload(instance) {
    return new Promise(async (resolve, reject) => {

      const filesDownloaded = []

      const updateMultipleState = () => {
        var title = instance.prefix + " - Téléchargement des fichiers";
        var subtitle = `${filesDownloaded.length} sur ${instance.files.length} fichiers téléchargés`;

        var percentage = (filesDownloaded.length * 100) / instance.files.length;
        let state = {
          percentage: parseInt(percentage, 10).toString(),
          total: instance.files.length,
        };

        return { title: title, subtitle: subtitle, percentage: percentage, state: state }
      }

      const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      let index = 0;
      for await (const file of instance.files) {
        if (! await exists(file.path)) await createDir(file.path, { recursive: true })
        if (! await exists(await join(file.path, file.file))) {
          /*const sha1File = sha1FileSync(await join(file.path, file.file));
          if (sha1File == file.hash) continue;*/
        }
        const filePath = await join(file.path, file.file);
        await invoke('download_file', { uuid: instance.uuidDl, url: file.url, filename: filePath });
        index++;
      }

      setTimeout(() => {
        //instance.finish(instance.uuidDl)
        return resolve()
      }, 1200)
    })
  }

  async multipleExtract(instance) {
    return new Promise(async (resolve, reject) => {
      try {
        for await (const file of instance.files) {
          const filePath = await join(file.path, file.file);
          await invoke('unzip_file', { uuid: instance.uuidDl, filePath: filePath, destPath: file.path, target_folder: instance.targetFolderZip });
        }
        return resolve();
      } catch (error) {
        console.error('Erreur lors de l\'extraction du fichier via Rust: ', error);
        return reject();
      }
    })
  }

  async extract(instance) {
    return new Promise(async (resolve) => {
      try {
        await invoke('unzip_file', { uuid: instance.uuidDl, filePath: instance.fileZipDepend, destPath: instance.dirServer });
        return resolve();
      } catch (error) {
        console.error('Erreur lors de l\'extraction du fichier via Rust: ', error);
        return reject();
      }
      /*const pack = onezip.extract(instance.fileZipDepend, instance.dirServer);

      pack.on("start", () => { });

      pack.on("progress", (state) => {
        var title = instance.prefix + " - Extraction des fichiers";
        var subtitle = "Fichiers extraits (" + state.i + " / " + state.n + ")";
        if (instance.fupdate)
          instance.update(instance.uuidDl, title, subtitle, state);
        else
          document.dispatchEvent(
            new CustomEvent("update", {
              detail: { title: instance.prefix, subtitle, state },
            })
          );
      });

      pack.on("error", (error) => {
        console.error(error);
      });

      pack.on("end", () => {
        if (instance.fupdate) instance.finish(instance.uuidDl);
        resolve(true);
      });*/
    });
  }

  update(uuidDl, title, subtitle, state) {
    this.title = title;
    this.subtitle = subtitle;
    this.state = state;

    if (this.fupdate) {
      let now = new Date().getTime();
      this.timer = now - this.startTime;
      if (
        document
          .querySelector(".main.connected .content-child .Tasks.sidepage")
          .hasAttribute("rendered")
      ) {
        
        let domTask = document.querySelector(
          `.downloads .listDls .dl-items[id="${uuidDl}"]`
        );
        
        if (domTask !== null || domTask !== undefined) {
          domTask.querySelector(".title").innerHTML = title;
          domTask.querySelector(".subtitle").innerHTML = subtitle;
          domTask.querySelector(".percentage").parentNode.style.display = "block";
          domTask.querySelector("#downloadbar").parentNode.style.display = "block";
          domTask.querySelector(".percentage").innerHTML = state.percentage + "%";
          domTask.querySelector("#downloadbar").style.width = state.percentage + "%";
          let taskOverlay = document.querySelector('.taskOverlay')
          taskOverlay.querySelector('.title').innerHTML = title;
          taskOverlay.querySelector('.subtitle').innerHTML = subtitle;
          taskOverlay.querySelector("#downloadbar").style.width = state.percentage + "%";

          const customEvent = new CustomEvent('task__updated', { detail: { title: title, subtitle: subtitle, state: { percentage: state.percentage } } });
          document.dispatchEvent(customEvent)
        }

      }
    }
  }

  finish(uuidDl) {
    let timeFinish = fzVariable.millisToMinutesAndSeconds(this.timer);
    let domTask = document.querySelector(
      '.downloads .listDls .dl-items[id="' + uuidDl + '"]'
    );
    if (domTask !== null || domTask !== undefined) {
      domTask.querySelector(".title").innerHTML = this.prefix;
      domTask.querySelector(".subtitle").innerHTML = `${(this.lastTask) ? `Terminé, (Temps: ${timeFinish})` : 'En attente'}`
      domTask.querySelector(".percentage").parentNode.style.display = "none";
      domTask.querySelector("#downloadbar").parentNode.style.display = "none";

      //RESET TASK OVERLAY
      let taskOverlay = document.querySelector('.taskOverlay');
      if (this.lastTask) taskOverlay.classList.add('hidden')
      taskOverlay.querySelector(".title").innerHTML = "Récupération des informations";
      taskOverlay.querySelector(".subtitle").innerHTML = "Traitement de la tâche en cours...";
      taskOverlay.querySelector("#downloadbar").style.width = "0%";
    }
  }

  render(task) {
    return (
      <div className="card dl-items" id={task.uuidDl}>
        <div className="card-body flex gap-15 direct-column justif-between">
          <div className="left flex gap-10 align-center">
            <div className="icon" style={{ textAlign: "center" }}>
              <span className="text-3xl percentage">0%</span>
            </div>
            <div className="infos flex direct-column w-100">
              <div className="title  w-100">{task.title}</div>
              <div className="subtitle  w-100">{task.subtitle}</div>
            </div>
          </div>
          <div className="progress  w-100">
            <div
              className="indicator"
              id="downloadbar"
              style={{ width: "0%" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }
}
