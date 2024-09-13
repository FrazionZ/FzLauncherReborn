import Vanilla from './games_types/Vanilla'
import Fabric from './games_types/Fabric'
import Forge from './games_types/Forge'
import Quilt from './games_types/Quilt'

export default class GameManager {

    constructor() {
        this.games_types = [];
    }

    register() {
        return new Promise(async (resolve, reject) => {
            this.init_class(new Fabric())
            this.init_class(new Vanilla())
            this.init_class(new Forge())
            this.init_class(new Quilt())
        })
    }

    init_class(game) {
        console.log("Register: ", game)
        this.games_types.push({ prefix: game.id, instance: game })
    }

    get_class(id) {
        console.log(id, this.games_types)
        return this.games_types.find((gt) => gt.prefix == id);
    }

}