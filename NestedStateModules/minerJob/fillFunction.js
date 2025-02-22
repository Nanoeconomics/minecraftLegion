const {
  StateTransition,
  BehaviorIdle,
  NestedStateMachine
} = require('mineflayer-statemachine')

const BehaviorDigBlock = require('@BehaviorModules/BehaviorDigBlock')
const BehaviorCustomPlaceBlock = require('@BehaviorModules/BehaviorCustomPlaceBlock')
const BehaviorLoadConfig = require('@BehaviorModules/BehaviorLoadConfig')
const BehaviorMoveTo = require('@BehaviorModules/BehaviorMoveTo')

// let isDigging = false
function fillFunction (bot, targets) {
  let placeBlock2Position
  const { getNewPositionForPlaceBlock, blocksCanBeReplaced } = require('@modules/placeBlockModule')(bot)

  const start = new BehaviorIdle(targets)
  start.stateName = 'Start'
  start.x = 125
  start.y = 113

  const exit = new BehaviorIdle(targets)
  exit.stateName = 'Exit'
  exit.x = 125
  exit.y = 313

  const moveToBlock = new BehaviorMoveTo(bot, targets)
  moveToBlock.stateName = 'Move To Block'
  moveToBlock.x = 525
  moveToBlock.y = 113
  moveToBlock.movements = targets.movements

  const mineBlock = new BehaviorDigBlock(bot, targets)
  mineBlock.stateName = 'Mine Block'
  mineBlock.x = 725
  mineBlock.y = 113

  const placeBlock1 = new BehaviorCustomPlaceBlock(bot, targets)
  placeBlock1.stateName = 'Place Block 1'
  placeBlock1.x = 725
  placeBlock1.y = 313

  const placeBlock2 = new BehaviorCustomPlaceBlock(bot, targets)
  placeBlock2.stateName = 'Place Block 2'
  placeBlock2.x = 525
  placeBlock2.y = 313

  const loadConfig = new BehaviorLoadConfig(bot, targets)
  loadConfig.stateName = 'Load Bot Config'
  loadConfig.x = 325
  loadConfig.y = 113

  const transitions = [
    new StateTransition({
      parent: start,
      child: moveToBlock,
      shouldTransition: () => true
    }),

    new StateTransition({
      parent: moveToBlock,
      child: placeBlock2,
      name: 'if block is liquid',
      onTransition: () => {
        const positionForPlaceBlock = getNewPositionForPlaceBlock(targets.position)
        targets.position = positionForPlaceBlock.newPosition
        placeBlock2.setOffset(positionForPlaceBlock.blockOffset)
      },
      shouldTransition: () => {
        const block = bot.blockAt(targets.position.offset(0, 1, 0))
        return (moveToBlock.isFinished() || moveToBlock.distanceToTarget() < 3) && blocksCanBeReplaced.includes(block.name)
      }
    }),

    new StateTransition({
      parent: moveToBlock,
      child: mineBlock,
      name: 'If up block is solid',
      onTransition: () => {
        targets.position = targets.position.offset(0, 1, 0)
      },
      shouldTransition: () => {
        const block = bot.blockAt(targets.position.offset(0, 1, 0))
        if (bot.canDigBlock(block) && !blocksCanBeReplaced.includes(block.name)) {
          bot.pathfinder.setGoal(null)
          return !bot.pathfinder.isMining()
        }
      }
    }),

    new StateTransition({
      parent: mineBlock,
      child: placeBlock1,
      name: 'mineBlock -> placeBlock1',
      onTransition: () => {
        placeBlock2Position = targets.position.clone()
        const positionForPlaceBlock = getNewPositionForPlaceBlock(targets.position.offset(0, -1, 0))
        targets.position = positionForPlaceBlock.newPosition
        placeBlock1.setOffset(positionForPlaceBlock.blockOffset)
      },
      shouldTransition: () => mineBlock.isFinished()
    }),

    new StateTransition({
      parent: placeBlock1,
      child: placeBlock2,
      name: 'placeBlock1 -> placeBlock2',
      onTransition: () => {
        targets.position = placeBlock2Position
        const positionForPlaceBlock = getNewPositionForPlaceBlock(targets.position)
        targets.position = positionForPlaceBlock.newPosition
        placeBlock2.setOffset(positionForPlaceBlock.blockOffset)
      },
      shouldTransition: () => placeBlock1.isFinished() || placeBlock1.isItemNotFound() || placeBlock1.isCantPlaceBlock()
    }),

    new StateTransition({
      parent: placeBlock2,
      child: exit,
      name: 'placeBlock1 -> checkLayer',
      shouldTransition: () => placeBlock2.isFinished() || placeBlock2.isItemNotFound() || placeBlock2.isCantPlaceBlock()
    })

  ]

  const fillFunction = new NestedStateMachine(transitions, start, exit)
  fillFunction.stateName = 'Fill Water & Lava'
  return fillFunction
}

module.exports = fillFunction
