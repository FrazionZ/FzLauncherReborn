import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";

export function javaversion(path) {
    return new Promise(async function (resolve, reject) {
        const directoryJava = path;
        try {
            const unlisten = listen('process-output', (event) => {
                const data = event.payload;
                var javaVersion = new RegExp('openjdk version').test(data) ? data.split(' ')[2].replace(/"/g, '') : false;
                if (javaVersion != false) {
                    return resolve(javaVersion);
                } else {
                    return resolve("no install")
                }
            });
            await invoke('start_child_process', { command: directoryJava, args: ['-version'] });
        } catch (error) {
            return resolve("no install")
        }
    })

}

export class MineParse {

    constructor() {
        this.obfuscators = [];
        this.styleMap = {
            '§0': 'color:#000000',
            '§1': 'color:#0000AA',
            '§2': 'color:#00AA00',
            '§3': 'color:#00AAAA',
            '§4': 'color:#AA0000',
            '§5': 'color:#AA00AA',
            '§6': 'color:#FFAA00',
            '§7': 'color:#AAAAAA',
            '§8': 'color:#555555',
            '§9': 'color:#5555FF',
            '§a': 'color:#55FF55',
            '§b': 'color:#55FFFF',
            '§c': 'color:#FF5555',
            '§d': 'color:#FF55FF',
            '§e': 'color:#FFFF55',
            '§f': 'color:#FFFFFF',
            '§l': 'font-weight:bold',
            '§m': 'text-decoration:line-through',
            '§n': 'text-decoration:underline',
            '§o': 'font-style:italic',
        }
    }


    obfuscate(string, elem) {
        var magicSpan,
            currNode,
            len = elem.childNodes.length;
        if(string.indexOf('<br>') > -1) {
            elem.innerHTML = string;
            for(var j = 0; j < len; j++) {
                currNode = elem.childNodes[j];
                if(currNode.nodeType === 3) {
                    magicSpan = document.createElement('span');
                    magicSpan.innerHTML = currNode.nodeValue;
                    elem.replaceChild(magicSpan, currNode);
                    init(magicSpan);
                }
            }
        } else {
            init(elem, string);
        }
        function init(el, str) {
            var i = 0,
                obsStr = str || el.innerHTML,
                len = obsStr.length;
            obfuscators.push( window.setInterval(function () {
                if(i >= len) i = 0;
                obsStr = replaceRand(obsStr, i);
                el.innerHTML = obsStr;
                i++;
            }, 0) );
        }
        function randInt(min, max) {
            return Math.floor( Math.random() * (max - min + 1) ) + min;
        }
        function replaceRand(string, i) {
            var randChar = String.fromCharCode( randInt(64,90) ); /*Numbers: 48-57 Al:64-90*/
            return string.substr(0, i) + randChar + string.substr(i + 1, string.length);
        }
    }
    applyCode(string, codes) {
        var len = codes.length;
        var elem = document.createElement('span'),
            obfuscated = false;
        for(var i = 0; i < len; i++) {
            elem.style.cssText += this.styleMap[codes[i]] + ';';
            if(codes[i] === '§k') {
                this.obfuscate(string, elem);
                obfuscated = true;
            }
        }
        if(!obfuscated) elem.innerHTML = string;
        return elem;
    }
    parseStyle(string) {
        var codes = string.match(/§.{1}/g) || [],
            indexes = [],
            apply = [],
            tmpStr,
            indexDelta,
            noCode,
            final = document.createElement('div'),
            len = codes.length
        
        for(var i = 0; i < len; i++) {
            indexes.push( string.indexOf(codes[i]) );
            string = string.replace(codes[i], '\x00\x00');
        }
        if(indexes[0] !== 0) {
            final.appendChild(this.applyCode( string.substring(0, indexes[0]), [] ) );
        }
        for(var i = 0; i < len; i++) {
            indexDelta = indexes[i + 1] - indexes[i];
            if(indexDelta === 2) {
                while(indexDelta === 2) {
                    apply.push ( codes[i] );
                    i++;
                    indexDelta = indexes[i + 1] - indexes[i];
                }
                apply.push ( codes[i] );
            } else {
                apply.push( codes[i] );
            }
            if( apply.lastIndexOf('§r') > -1) {
                apply = apply.slice( apply.lastIndexOf('§r') + 1 );
            }
            tmpStr = string.substring( indexes[i], indexes[i + 1] );
            final.appendChild(this.applyCode(tmpStr, apply) );
        }
        return final;
    }
    clearObfuscators() {
        var i = this.obfuscators.length;
        for(;i--;) {
            clearInterval(obfuscators[i]);
        }
        this.obfuscators = [];
    }
    
    replaceColorCodes = function(value) {
      this.clearObfuscators();
      var outputString = this.parseStyle(value);
      return outputString;
    };
    
    /////////////////////////////////////////////////
    cutString(str, cutStart, cutEnd){
      return str.substr(0,cutStart) + str.substr(cutEnd+1);
    }

}