require('dotenv').config()
const config = require('./config')
const mineflayer = require("mineflayer");
const inventoryViewer = require('mineflayer-web-inventory')
const prismarineViewer = require('./modules/viewer')
const {
    StateTransition,
    BotStateMachine,
    StateMachineWebserver,
    BehaviorIdle,
    BehaviorPrintServerStats,
    NestedStateMachine,
    BehaviorMoveTo

    ,
    BehaviorFollowEntity,
    BehaviorGetClosestEntity,
    EntityFilters,
    BehaviorLookAtEntity
} = require("mineflayer-statemachine");
const BehaviorIsNight = require("./BehaviorModules/BehaviorIsNight");
const BehaviorGetPlayer = require("./BehaviorModules/BehaviorGetPlayer");

const goSleepFunction = require('./NestedStateModules/goSleepFunction');
// const baseFunction = require('./NestedStateModules/baseFunction');

// const { start } = require('repl');

const botsToStart = [
    { username: "Guard1", portBotStateMachine: 4000, portPrismarineViewer: null, portInventory: null },
    { username: "Guard2", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
    /*
        { username: "Guard3", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
        { username: "Archer1", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
        { username: "Archer2", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
        { username: "Archer3", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
        { username: "Archer4", portBotStateMachine: null, portPrismarineViewer: null, portInventory: null },
        */


];

let i = 0;
let totalBots = botsToStart.length;

function startBots() {
    botToStart = botsToStart[i];
    i++;
    if (i <= totalBots) {
        setTimeout(() => {
            createNewBot(botToStart.username, botToStart.portBotStateMachine, botToStart.portPrismarineViewer, botToStart.portInventory)
            startBots()
        }, 500)
    }
};
startBots();

let playerName = {};


function createNewBot(botName, portBotStateMachine = null, portPrismarineViewer = null, portInventory = null) {
    const bot = mineflayer.createBot({
        username: botName,
        host: config.server,
        port: config.port
    })

    bot.loadPlugin(require('mineflayer-pathfinder').pathfinder);

    bot.on('kicked', (reason, loggedIn) => {
        reasonDecoded = JSON.parse(reason)
        console.log(reasonDecoded)
    })

    bot.on('error', err => console.log(err))

    bot.once("spawn", () => {
        bot.chat('Im in!')
        if (portInventory !== null) {
            inventoryViewer(bot, { port: portInventory })
        }
        if (portPrismarineViewer !== null) {
            prismarineViewer.start(bot, portPrismarineViewer);
        }
    })

    bot.once("spawn", () => {
        const targets = {};

        const base = { position: { x: -81, y: 68, z: 96 } };

        const goBase = new BehaviorMoveTo(bot, base);
        const isNight = new BehaviorIsNight(bot, targets);
        const idleState = new BehaviorIdle(targets);
        const goSleep = goSleepFunction(bot, targets)
        const baseCommands = baseFunction(bot, targets)
        const playerEntity = new BehaviorGetPlayer(bot, targets)

        const transitions = [
            new StateTransition({ // Trigger -> 0
                parent: idleState,
                child: playerEntity,
                shouldTransition: () => playerEntity.playerFound(),
                name: 'Chat listener',
            }),
            new StateTransition({
                parent: playerEntity,
                child: baseCommands,
                shouldTransition: () => true,
                name: 'Transfer to sub nestered commands',
            }),
            new StateTransition({
                parent: baseCommands,
                child: idleState,
                shouldTransition: () => false,
                name: "Restart when players die",
            }),
            new StateTransition({
                parent: baseCommands,
                child: idleState,
                name: 'Finish Command',
                shouldTransition: () => baseCommands.isFinished(),
                onTransition: () => playerEntity.playerIsFound = false,
            }),
            new StateTransition({
                parent: goBase,
                child: idleState,
                name: '11 Near base',
                shouldTransition: () => goBase.distanceToTarget() < 2,
                onTransition: () => bot.chat("Im are on base!"),
            }),
            new StateTransition({
                parent: idleState,
                child: isNight,
                shouldTransition: () => isNight.getIsNight() && isNight.getBed() !== false,
                name: "idleState -> isNight",
                onTransition: () => {
                    goSleep.targets = isNight.bed;
                },
            }),
            new StateTransition({
                parent: isNight,
                child: goSleep,
                shouldTransition: () => true,
                name: "isNight -> goSleep",
                onTransition: () => {
                    goSleep.targets = isNight.bed
                },
            }),
            new StateTransition({
                parent: goSleep,
                child: idleState,
                shouldTransition: () => goSleep.isFinished(),
                name: "goSleep -> idleState",
            }),

        ];

        bot.on('death', function() {
            bot.chat('Omg im dead');
            transitions[3].trigger();
        })

        bot.on('time', () => {
            isNight.check()
        });

        bot.on("chat", (username, message) => {
            if (message === "hi " + bot.username || message === "hi all") {
                playerEntity.getPlayerEntity(username);
                transitions[0].trigger();
            }
        });

        const root = new NestedStateMachine(transitions, idleState);
        root.name = "main";
        const stateMachine = new BotStateMachine(bot, root);
        if (portBotStateMachine !== null) {
            const webserver = new StateMachineWebserver(bot, stateMachine, portBotStateMachine);
            webserver.startServer();
        }
    });

}


function baseFunction(bot, targets) {

    const enter = new BehaviorIdle(targets);
    const exit = new BehaviorIdle(targets);

    const followPlayer = new BehaviorFollowEntity(bot, targets);
    const lookAtFollowTarget = new BehaviorLookAtEntity(bot, targets);
    const lookAtPlayersState = new BehaviorLookAtEntity(bot, targets);

    const transitions = [
        new StateTransition({
            parent: lookAtPlayersState,
            child: exit,
            name: 'Player say: bye',
        }),
        new StateTransition({
            parent: followPlayer,
            child: exit,
            name: 'Player say: bye',
        }),
        new StateTransition({
            parent: lookAtFollowTarget,
            child: exit,
            name: 'Player say: bye',
        }),
        new StateTransition({
            parent: lookAtPlayersState,
            child: followPlayer,
            name: 'Player say: come',
            onTransition: () => bot.chat("Yes sr!"),
        }),
        new StateTransition({
            parent: followPlayer,
            child: lookAtFollowTarget,
            name: 'The player is too far',
            shouldTransition: () => followPlayer.distanceToTarget() < 2,
        }),
        new StateTransition({
            parent: lookAtFollowTarget,
            child: followPlayer,
            name: 'The player is too close',
            shouldTransition: () => lookAtFollowTarget.distanceToTarget() >= 2,
        }),
        new StateTransition({
            parent: enter,
            child: lookAtPlayersState,
            name: 'Enter to nested',
            shouldTransition: () => true,
        }),
    ];

    bot.on("chat", (username, message) => {
        switch (true) {
            case (message === "bye"):
                bot.chat("Bye Master!");
                transitions[0].trigger();
                transitions[1].trigger();
                transitions[2].trigger();
                break;
            case (message === "come"):
                transitions[3].trigger();
                break;
        }
    });

    const baseFunction = new NestedStateMachine(transitions, enter, exit);
    baseFunction.stateName = 'baseFunction'
    return baseFunction;
}