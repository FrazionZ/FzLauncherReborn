import GameType from '../GameType';

export default class Vanilla extends GameType {

    constructor() {
        super("vanilla");
    }

    async step_install(
        fzContext,
        data, 
        infosVersionManifest, 
        assetsDirectory,
        rootDirectory
    ) {
        return new Promise(async(resolve, reject) => {
            const task = await this.vanilla_game_universal(fzContext, data, assetsDirectory, rootDirectory, infosVersionManifest)
            return resolve()
        })
    }

}