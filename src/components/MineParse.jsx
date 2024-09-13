export default class MineParse {

    minecraftColorCodes = {
        '§0': 'black',
        '§1': 'dark_blue',
        '§2': 'dark_green',
        '§3': 'dark_aqua',
        '§4': 'dark_red',
        '§5': 'dark_purple',
        '§6': 'gold',
        '§7': 'gray',
        '§8': 'dark_gray',
        '§9': 'blue',
        '§a': 'green',
        '§b': 'aqua',
        '§c': 'red',
        '§d': 'light_purple',
        '§e': 'yellow',
        '§f': 'white',
        '§l': 'bold',
        '§o': 'italic',
        '§r': '' // Reset style
    };

    transformToMinecraftColor = (text) => {
        let result = [];
        let currentStyles = [];
        let key = 0;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '§' && i + 1 < text.length) {
                let code = text[i] + text[i + 1];
                i++;

                if (code === '§r') {
                    currentStyles = [];
                } else { 
                    currentStyles = [];
                    let styleClass = this.minecraftColorCodes[code];
                    if (styleClass) {
                        currentStyles.push(styleClass);
                    }
                }
            } else {
                result.push(
                    <span key={key++} className={"minecraft-text " + currentStyles.join(' ')}>
                        {text[i]}
                    </span>
                );
            }
        }

        return result;
    };

}