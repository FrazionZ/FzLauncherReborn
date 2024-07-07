//import Store from 'electron-store'
import path from 'path-browserify';
import os from 'os';
import { platform } from '@tauri-apps/api/os';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, createDir, writeTextFile } from '@tauri-apps/api/fs';

export default class FzVariable {

  async init() {
    return new Promise(async (resolve, reject) => {
      try {
        this.platform = await platform()
        this.path = path
        let appData = ''
        if (this.platform == 'linux' || this.platform == 'darwin') {
          //appData = process.env.HOME
        } else if (this.platform == 'win32') {
          appData = await appDataDir();
          //appData = //this.store.get('launcher__dirapp_path', process.env['APPDATA'] + '\\.FrazionzLauncher')
        }
        this.dirFzLauncherRoot = await join(appData)
        if (!await exists(this.dirFzLauncherRoot)) await createDir(this.dirFzLauncherRoot)
  
        this.dirFzLauncherDatas = await join(this.dirFzLauncherRoot, 'Launcher')
        if (!await exists(this.dirFzLauncherDatas)) await createDir(this.dirFzLauncherDatas)

        this.dirFzMetaDatas = await join(this.dirFzLauncherRoot, 'Metas')
        if (!await exists(this.dirFzMetaDatas)) await createDir(this.dirFzMetaDatas)
  
        this.dirFzLauncherCapes = await join(this.dirFzLauncherDatas, 'capes')
        if (!await exists(this.dirFzLauncherCapes)) await createDir(this.dirFzLauncherCapes)
  
        this.shelfFzLauncherCapes = await join(this.dirFzLauncherDatas, 'capes.json')
        if (!await exists(this.shelfFzLauncherCapes)) await writeTextFile(this.shelfFzLauncherCapes, "[]", {})
  
        this.shelfFzLauncherSkins = await join(this.dirFzLauncherDatas, 'skins.json')
        if (!await exists(this.shelfFzLauncherSkins)) await writeTextFile(this.shelfFzLauncherSkins, "[]", {})
  
        this.shelfFzLauncherProfiles = await join(this.dirFzLauncherDatas, 'profiles.json')
        if (!await exists(this.shelfFzLauncherProfiles)) await writeTextFile(this.shelfFzLauncherProfiles, "[]", {})
  
        this.dirFzLauncherSkins = await join(this.dirFzLauncherDatas, 'skins')
        if (!await exists(this.dirFzLauncherSkins)) await createDir(this.dirFzLauncherSkins)
  
        this.dirFzLauncherRuntime = await join(this.dirFzLauncherDatas, 'runtime')
        if (!await exists(this.dirFzLauncherRuntime)) await createDir(this.dirFzLauncherRuntime)
  
        this.dirFzLauncherMCVersions = await join(this.dirFzLauncherRoot, 'MCVersions')
        if (!await exists(this.dirFzLauncherMCVersions)) await createDir(this.dirFzLauncherMCVersions)
  
        resolve()
      }catch(err) {
        console.log(err)
      }
      
    })
  }

  keyStoreBranch(branch, categorie) {
    return (
      'server_' +
      variables?.serverObj.name.toLowerCase() +
      '_' +
      branch +
      '_' +
      categorie +
      '_version'
    )
  }

  keyStoreServerOptions(key) {
    return 'server_' + variables?.serverObj.name.toLowerCase() + '_' + key
  }

  listRamAllocate() {
    if (os.arch().includes('64')) {
      var total_memory = os.totalmem();
      var total_mem_in_kb = total_memory / 1024;
      var total_mem_in_mb = total_mem_in_kb / 1024;
      var total_mem_in_gb = total_mem_in_mb / 1024;

      total_mem_in_kb = Math.floor(total_mem_in_kb);
      total_mem_in_mb = Math.floor(total_mem_in_mb);
      total_mem_in_gb = Math.floor(total_mem_in_gb);

      total_mem_in_mb = total_mem_in_mb % 1024;
      total_mem_in_kb = total_mem_in_kb % 1024;
      total_memory = total_memory % 1024;

      var allocate = [];
      for (var i = 1; i < 17; i++) {
        allocate.push({ index: i - 1, gb: i });
      }
      return { list: allocate, total_memory: 16 };
    } else {
      return [];
    }
  }

  stringToDate(_date, _format, _delimiter) {
    var formatLowerCase = _format.toLowerCase()
    var formatItems = formatLowerCase.split(_delimiter)
    var dateItems = _date.split(_delimiter)
    var monthIndex = formatItems.indexOf('mm')
    var dayIndex = formatItems.indexOf('dd')
    var yearIndex = formatItems.indexOf('yyyy')
    var month = parseInt(dateItems[monthIndex])
    month -= 1
    var formatedDate = new Date(dateItems[yearIndex], month, dateItems[dayIndex])
    return formatedDate
  }

  millisToMinutesAndSeconds(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

  UrlExists(url) {
    return new Promise((resolve, reject) => {
      var http = new XMLHttpRequest();
      http.open('HEAD', url, false);
      http.send();
      if (http.status != 404)
        return resolve(true);
      else
        return resolve(false);
    })
  }

  async dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }

  async downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
      /*const request = require('request')
      var req = request({
        method: 'GET',
        uri: url
      })

      req.on('response', function(response) {
        if (response.statusCode === 200) {
          req.pipe(fs.createWriteStream(filepath)
            .on('error', reject)
            .once('close', () => resolve(filepath)));
        } else {
          // Consume response data to free up memory
          req.resume();
          reject(new Error(`Request Failed With a Status Code: ${req.statusCode}`));

        }
      })*/
      reject(new Error(`Request Failed`))

    });
  }

  firstUCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  replaceMonth(str) {
    return str.replaceAll('January', 'Janvier')
      .replaceAll('February', 'Février')
      .replaceAll('March', 'Mars')
      .replaceAll('April', 'Avril')
      .replaceAll('May', 'Mai')
      .replaceAll('June', 'Juin')
      .replaceAll('July', 'Julliet')
      .replaceAll('August', 'Août')
      .replaceAll('September', 'Septembre')
      .replaceAll('October', 'Octobre')
      .replaceAll('November', 'Novembre')
      .replaceAll('December', 'Décembre')
  }

  lang(key, replaceArr) {
    //Before, search key in lang select
    let result = Object.entries(window.lang.langSelect.keys).find(lang => lang[0] == key);
    //If not found initial, search in default lang file
    if (result == undefined) result = Object.entries(window.lang.langDefault.keys).find(lang => lang[0] == key);
    //If key not found in default lang file, return key
    if (result == undefined) return key;
    else {
      let rstring = result[1];
      if (replaceArr !== undefined) {
        if (replaceArr.length > 0) {
          replaceArr.forEach((replace, i) => {
            rstring = rstring.replaceAll(replace.key, replace.value)
          })
          return rstring
        } else return rstring
      } else return rstring
    }
  }
}